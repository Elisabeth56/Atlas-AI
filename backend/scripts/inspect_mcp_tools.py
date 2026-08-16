"""
Run this once your DataHub + MCP setup is live to print the REAL input
schema for every tool mcp-server-datahub exposes. app/datahub/mcp_gateway.py
was written against tool names/arguments from documentation, not a live
`list_tools()` call — this script is how you check whether that guess was
right before trusting it in a demo.

Usage:
    cd backend
    source .venv/bin/activate
    pip install mcp
    export DATAHUB_GMS_URL=http://localhost:8080
    export DATAHUB_GMS_TOKEN=  # leave blank if your instance has no auth
    python scripts/inspect_mcp_tools.py

What to check in the output against app/datahub/mcp_gateway.py:
  - Does "search" take a "query" argument? Does it support a "limit"?
  - Does "list_schema_fields" take "urn"? What does its result shape look
    like (field name key: "fieldPath" vs "name"; description field)?
  - Does "get_lineage" take "urn" and "direction"? What values does
    "direction" accept ("upstream"/"downstream" vs "UPSTREAM"/"DOWNSTREAM")?
  - Does "update_description" take "urn" and "description"?
If any of these don't match, fix the corresponding _call_tool(...)
arguments in mcp_gateway.py.
"""
from __future__ import annotations

import asyncio
import json
import os
import sys

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


async def main() -> None:
    gms_url = os.environ.get("DATAHUB_GMS_URL")
    if not gms_url:
        print("Set DATAHUB_GMS_URL first, e.g.:", file=sys.stderr)
        print("  export DATAHUB_GMS_URL=http://localhost:8080", file=sys.stderr)
        sys.exit(1)

    token = os.environ.get("DATAHUB_GMS_TOKEN", "")
    env = {"DATAHUB_GMS_URL": gms_url, "TOOLS_IS_MUTATION_ENABLED": "true"}
    if token:
        env["DATAHUB_GMS_TOKEN"] = token

    server_params = StdioServerParameters(command="mcp-server-datahub", args=[], env=env)

    print(f"Connecting to mcp-server-datahub (GMS: {gms_url})...\n")
    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools = await session.list_tools()

            for tool in tools.tools:
                print(f"=== {tool.name} ===")
                if tool.description:
                    print(f"  {tool.description}")
                print("  input schema:")
                print(json.dumps(tool.inputSchema, indent=4))
                print()

            # Also do one real call so you can see actual response shape,
            # not just the declared schema.
            search_tool = next((t for t in tools.tools if t.name == "search"), None)
            if search_tool is not None:
                print("=== live 'search' call, query='customer' ===")
                result = await session.call_tool("search", {"query": "customer"})
                if result.structuredContent is not None:
                 print(json.dumps(result.structuredContent, indent=2)[:2000])
                else:
                    for block in result.content:
                        if hasattr(block, "text"):
                            print(block.text[:2000])


if __name__ == "__main__":
    asyncio.run(main())
