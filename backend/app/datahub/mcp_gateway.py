"""
DataHub gateway implemented over MCP — talks to `mcp-server-datahub` as a
stdio subprocess using the official MCP Python SDK, rather than calling
DataHub's GraphQL/REST API directly. This is the gateway Atlas AI actually
uses when a DataHub connection is configured: every read (search, schema,
lineage) and every write (description upsert) goes through MCP tool
calls, matching the "Atlas -> MCP tool calls -> DataHub MCP Server ->
DataHub" architecture end to end.from __future__ import annotations

One structural gap that's confirmed from documentation, not a guess:
there is no lineage-*writing* MCP tool as of mcp-server-datahub's current
tool list (get_lineage / get_lineage_paths_between are read-only). Rather
than silently dropping WritebackAgent's lineage-emission step, this
gateway falls back to a direct GraphQL call for that one operation only
— see emit_lineage() below. Everything else goes through MCP.
"""
import json
import logging
from contextlib import AsyncExitStack
from typing import Any

import httpx
from mcp import ClientSession, StdioServerParameters, types
from mcp.client.stdio import stdio_client

from app.datahub.gateway import DataHubError, DataHubGateway

logger = logging.getLogger("atlas.datahub.mcp")


class DataHubMCPGateway(DataHubGateway):
    def __init__(
        self,
        *,
        gms_url: str,
        token: str | None = None,
        timeout_seconds: float = 20.0,
        mcp_command: str = "mcp-server-datahub",
    ) -> None:
        self._gms_url = gms_url
        self._token = token
        self._timeout = timeout_seconds
        self._mcp_command = mcp_command
        self._stack: AsyncExitStack | None = None
        self._session: ClientSession | None = None

    # --- Lifecycle -----------------------------------------------------
    # Connect once (from FastAPI's lifespan — see main.py) and reuse the
    # same subprocess + session across every request. Spawning a fresh
    # `mcp-server-datahub` process per call would be slow and wasteful.

    async def connect(self) -> None:
        env = {
            "DATAHUB_GMS_URL": self._gms_url,
            # Mutations (update_description) are opt-in and off by default
            # in mcp-server-datahub — required for WritebackAgent to work.
            "TOOLS_IS_MUTATION_ENABLED": "true",
        }
        if self._token:
            env["DATAHUB_GMS_TOKEN"] = self._token

        server_params = StdioServerParameters(command=self._mcp_command, args=[], env=env)

        self._stack = AsyncExitStack()
        try:
            read, write = await self._stack.enter_async_context(stdio_client(server_params))
            self._session = await self._stack.enter_async_context(ClientSession(read, write))
            await self._session.initialize()
        except Exception:
            await self._stack.aclose()
            self._stack = None
            self._session = None
            raise
        logger.info("DataHubMCPGateway connected: gms_url=%s command=%s", self._gms_url, self._mcp_command)

    async def aclose(self) -> None:
        if self._stack is not None:
            await self._stack.aclose()
            self._stack = None
            self._session = None

    def _require_session(self) -> ClientSession:
        if self._session is None:
            raise DataHubError(
                "DataHubMCPGateway.connect() was never called, or connection "
                "failed at startup — check app startup logs for the real error."
            )
        return self._session

    async def _call_tool(self, name: str, arguments: dict[str, Any]) -> Any:
        session = self._require_session()
        try:
            result: types.CallToolResult = await session.call_tool(
                name, arguments, read_timeout_seconds=self._timeout
            )
        except Exception as exc:
            raise DataHubError(f"MCP tool call '{name}' failed: {exc}") from exc

        if result.is_error:
            raise DataHubError(f"MCP tool '{name}' returned an error: {result.content}")

        # FastMCP-based servers (which mcp-server-datahub is) populate
        # structured_content directly when the tool returns structured
        # data — prefer it. Fall back to parsing the first text block as
        # JSON for servers/tools that only return text content.
        if result.structured_content is not None:
            return result.structured_content

        for block in result.content:
            if isinstance(block, types.TextContent):
                try:
                    return json.loads(block.text)
                except json.JSONDecodeError:
                    return block.text

        raise DataHubError(f"MCP tool '{name}' returned no usable content")

    # --- DataHubGateway interface --------------------------------------

    async def search_datasets(self, query: str, *, limit: int = 10) -> list[dict[str, Any]]:
        # NEEDS VERIFICATION against live tool schema — see module docstring.
        raw = await self._call_tool("search", {"query": query or "*", "limit": limit})
        entities = raw.get("entities", raw) if isinstance(raw, dict) else raw
        results: list[dict[str, Any]] = []
        for entity in entities or []:
            results.append(
                {
                    "urn": entity.get("urn"),
                    "name": entity.get("name") or entity.get("properties", {}).get("name"),
                    "platform": entity.get("platform"),
                    "description": entity.get("description")
                    or entity.get("properties", {}).get("description", ""),
                    "tags": entity.get("tags", []),
                    "owners": entity.get("owners", []),
                }
            )
        return results

    async def get_schema(self, urn: str) -> dict[str, Any]:
        # NEEDS VERIFICATION against live tool schema — see module docstring.
        raw = await self._call_tool("list_schema_fields", {"urn": urn})
        fields = raw.get("fields", raw) if isinstance(raw, dict) else raw
        return {
            "urn": urn,
            "fields": [
                {
                    "name": f.get("fieldPath") or f.get("name"),
                    "type": f.get("type"),
                    "description": f.get("description") or "",
                }
                for f in (fields or [])
            ],
        }

    async def get_lineage(self, urn: str, *, direction: str = "upstream") -> list[dict[str, Any]]:
        # NEEDS VERIFICATION against live tool schema — see module docstring.
        raw = await self._call_tool("get_lineage", {"urn": urn, "direction": direction})
        edges = raw.get("relationships", raw) if isinstance(raw, dict) else raw
        return [
            {"urn": e.get("urn") or e.get("entity", {}).get("urn"), "type": direction}
            for e in (edges or [])
        ]

    async def upsert_metadata(self, urn: str, aspect: str, payload: dict[str, Any]) -> None:
        # mcp-server-datahub's mutation tools are narrow and named per-aspect
        # (update_description, add_tags, add_owners, set_domains, ...) rather
        # than a generic "write this aspect" tool. We only ever call this
        # with aspect="institutionalMemory" (see WritebackAgent), which maps
        # cleanly onto update_description. Any other aspect has no MCP
        # mutation tool to call — fail loudly rather than silently no-op.
        if aspect != "institutionalMemory":
            raise DataHubError(
                f"DataHubMCPGateway.upsert_metadata: no MCP mutation tool for "
                f"aspect '{aspect}'. Only 'institutionalMemory' (-> update_description) "
                f"is supported. Available mutation tools: add_tags, add_terms, "
                f"add_owners, set_domains, update_description, add_structured_properties."
            )
        description = payload.get("description", "")
        # NEEDS VERIFICATION against live tool schema — see module docstring.
        await self._call_tool("update_description", {"urn": urn, "description": description})

    async def emit_lineage(self, upstream_urn: str, downstream_urn: str) -> None:
        # No MCP mutation tool exists for writing lineage as of
        # mcp-server-datahub's current tool list (get_lineage /
        # get_lineage_paths_between are read-only). Direct GraphQL fallback
        # for this one operation — everything else in this class goes
        # through MCP. See module docstring for why.
        headers = {"Content-Type": "application/json"}
        if self._token:
            headers["Authorization"] = f"Bearer {self._token}"

        mutation = """
        mutation updateLineage($input: UpdateLineageInput!) {
          updateLineage(input: $input)
        }
        """
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(
                    f"{self._gms_url}/api/graphql",
                    headers=headers,
                    json={
                        "query": mutation,
                        "variables": {
                            "input": {
                                "edgesToAdd": [
                                    {"upstreamUrn": upstream_urn, "downstreamUrn": downstream_urn}
                                ],
                                "edgesToRemove": [],
                            }
                        },
                    },
                )
                resp.raise_for_status()
                body = resp.json()
                if body.get("errors"):
                    raise DataHubError(f"DataHub lineage write failed: {body['errors']}")
        except httpx.HTTPError as exc:
            raise DataHubError(f"DataHub lineage write failed: {exc}") from exc
