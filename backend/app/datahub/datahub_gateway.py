"""
Real DataHub gateway — talks to a DataHub GMS instance over its REST +
GraphQL APIs via httpx.
`MockDataHubGateway` remains the default
until `DATAHUB_GMS_URL` is set (and DataHubMCPGateway is the default once
it is — see app/orchestrator.py's _build_datahub_gateway).
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.datahub.gateway import DataHubError, DataHubGateway

logger = logging.getLogger("atlas.datahub.rest")

_SEARCH_QUERY = """
query search($input: SearchInput!) {
  search(input: $input) {
    searchResults {
      entity {
        urn
        ... on Dataset {
          name
          platform { name }
          properties { description }
          tags { tags { tag { urn name } } }
          ownership { owners { owner { ... on CorpUser { username } } } }
        }
      }
    }
  }
}
"""

_SCHEMA_QUERY = """
query getSchema($urn: String!) {
  dataset(urn: $urn) {
    schemaMetadata {
      fields { fieldPath type { type } description }
    }
  }
}
"""

_LINEAGE_QUERY = """
query getLineage($urn: String!, $direction: LineageDirection!) {
  dataset(urn: $urn) {
    lineage(input: { direction: $direction, start: 0, count: 50 }) {
      relationships { entity { urn } }
    }
  }
}
"""


class DataHubRestGateway(DataHubGateway):
    def __init__(
        self,
        *,
        gms_url: str,
        token: str | None = None,
        timeout_seconds: float = 20.0,
    ) -> None:
        self._gms_url = gms_url.rstrip("/")
        self._token = token
        self._timeout = timeout_seconds

    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self._token:
            headers["Authorization"] = f"Bearer {self._token}"
        return headers

    async def _graphql(self, query: str, variables: dict[str, Any]) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            resp = await client.post(
                f"{self._gms_url}/api/graphql",
                headers=self._headers(),
                json={"query": query, "variables": variables},
            )
            resp.raise_for_status()
            body = resp.json()
            if "errors" in body and body["errors"]:
                raise DataHubError(f"DataHub GraphQL error: {body['errors']}")
            return body["data"]

    async def search_datasets(self, query: str, *, limit: int = 10) -> list[dict[str, Any]]:
        try:
            data = await self._graphql(
                _SEARCH_QUERY,
                {
                    "input": {
                        "type": "DATASET",
                        "query": query or "*",
                        "start": 0,
                        "count": limit,
                    }
                },
            )
        except httpx.HTTPError as exc:
            raise DataHubError(f"DataHub search failed: {exc}") from exc

        results = []
        for item in data.get("search", {}).get("searchResults", []):
            entity = item.get("entity", {})
            results.append(
                {
                    "urn": entity.get("urn"),
                    "name": entity.get("name"),
                    "platform": (entity.get("platform") or {}).get("name"),
                    "description": (entity.get("properties") or {}).get("description") or "",
                    "tags": [
                        t["tag"]["name"]
                        for t in (entity.get("tags") or {}).get("tags", [])
                    ],
                    "owners": [
                        o["owner"].get("username")
                        for o in (entity.get("ownership") or {}).get("owners", [])
                        if o.get("owner")
                    ],
                }
            )
        return results

    async def get_schema(self, urn: str) -> dict[str, Any]:
        try:
            data = await self._graphql(_SCHEMA_QUERY, {"urn": urn})
        except httpx.HTTPError as exc:
            raise DataHubError(f"DataHub schema fetch failed: {exc}") from exc

        fields = (
            (data.get("dataset") or {}).get("schemaMetadata") or {}
        ).get("fields", [])
        return {
            "urn": urn,
            "fields": [
                {
                    "name": f.get("fieldPath"),
                    "type": (f.get("type") or {}).get("type"),
                    "description": f.get("description") or "",
                }
                for f in fields
            ],
        }

    async def get_lineage(self, urn: str, *, direction: str = "upstream") -> list[dict[str, Any]]:
        try:
            data = await self._graphql(
                _LINEAGE_QUERY,
                {"urn": urn, "direction": direction.upper()},
            )
        except httpx.HTTPError as exc:
            raise DataHubError(f"DataHub lineage fetch failed: {exc}") from exc

        relationships = (
            (data.get("dataset") or {}).get("lineage") or {}
        ).get("relationships", [])
        return [
            {"urn": r["entity"]["urn"], "type": direction}
            for r in relationships
            if r.get("entity")
        ]

    async def upsert_metadata(self, urn: str, aspect: str, payload: dict[str, Any]) -> None:
        # DataHub metadata writes go through the /entities ingest-proposal
        # endpoint (MetadataChangeProposal). Kept minimal here — extend the
        # aspect payload shape per DataHub's MCP schema once validated
        # against a live instance.
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(
                    f"{self._gms_url}/aspects?action=ingestProposal",
                    headers=self._headers(),
                    json={
                        "proposal": {
                            "entityType": "dataset",
                            "entityUrn": urn,
                            "aspectName": aspect,
                            "changeType": "UPSERT",
                            "aspect": {
                                "contentType": "application/json",
                                "value": payload,
                            },
                        }
                    },
                )
                resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise DataHubError(f"DataHub upsert failed for {urn}/{aspect}: {exc}") from exc

    async def emit_lineage(self, upstream_urn: str, downstream_urn: str) -> None:
        await self.upsert_metadata(
            downstream_urn,
            "upstreamLineage",
            {
                "upstreams": [
                    {"dataset": upstream_urn, "type": "TRANSFORMED"}
                ]
            },
        )
