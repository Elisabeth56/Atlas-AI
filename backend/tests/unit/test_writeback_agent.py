"""WritebackAgent documents the generated mart and points each source at it."""
from __future__ import annotations

from app.agents.base import RunContext
from app.agents.writeback_agent import WritebackAgent
from app.datahub.mock_gateway import MockDataHubGateway
from app.llm.mock_provider import MockLLMProvider

STRIPE = "urn:li:dataset:(urn:li:dataPlatform:stripe,raw.stripe_payments,PROD)"
CUSTOMERS = "urn:li:dataset:(urn:li:dataPlatform:postgres,raw.pg_customers,PROD)"
MART = "urn:li:dataset:(urn:li:dataPlatform:dbt,fct_customer_revenue,PROD)"


def _dataset(urn: str, name: str) -> dict:
    return {"urn": urn, "name": name, "platform": "x", "confidence": 0.9, "columns": ["id"]}


def _ctx(gateway: MockDataHubGateway) -> RunContext:
    async def emit_log(_: str) -> None:
        pass

    ctx = RunContext(
        request_id="req-1",
        prompt="customer revenue",
        llm=MockLLMProvider(fixtures={}),
        datahub=gateway,
        emit_log=emit_log,
    )
    ctx.results["metadata_analyst"] = {
        "matched_datasets": [
            _dataset(STRIPE, "raw.stripe_payments"),
            _dataset(CUSTOMERS, "raw.pg_customers"),
        ]
    }
    ctx.results["data_engineer"] = {
        "files": [
            {"kind": "dbt_model", "filename": "models/staging/stg_stripe_payments.sql", "content": "select 1"},
            {"kind": "dbt_model", "filename": "models/marts/fct_customer_revenue.sql", "content": "select 1"},
        ]
    }
    ctx.results["documentation"] = {
        "files": [
            {"kind": "doc", "filename": "README.md", "content": "pipeline readme"},
            {"kind": "doc", "filename": "docs/fct_customer_revenue.md", "content": "mart dictionary"},
        ]
    }
    return ctx


async def test_lineage_runs_from_each_source_to_the_mart():
    gateway = MockDataHubGateway(latency_seconds=0)

    await WritebackAgent().run(_ctx(gateway))

    assert gateway._emitted_lineage == [(STRIPE, MART), (CUSTOMERS, MART)]


async def test_docs_go_on_the_mart_and_sources_are_untouched():
    gateway = MockDataHubGateway(latency_seconds=0)

    result = await WritebackAgent().run(_ctx(gateway))

    assert gateway._written_aspects == [
        (MART, "institutionalMemory", {"description": "mart dictionary"})
    ]
    assert result.data["urns_updated"] == [MART]
    assert result.data["lineage_edges_added"] == 2


async def test_no_mart_means_no_writes():
    gateway = MockDataHubGateway(latency_seconds=0)
    ctx = _ctx(gateway)
    ctx.results["data_engineer"]["files"] = [
        {"kind": "sql", "filename": "analysis/revenue_by_day.sql", "content": "select 1"}
    ]

    result = await WritebackAgent().run(ctx)

    assert gateway._written_aspects == []
    assert gateway._emitted_lineage == []
    assert result.data["lineage_edges_added"] == 0
