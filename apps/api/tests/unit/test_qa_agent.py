"""
Unit tests for QAAgent — exercises the deterministic checks (SQL lint,
PII exposure, not-null coverage, schema grounding) against a fake
RunContext, with no database or LLM involved.
"""
from __future__ import annotations

import pytest

from app.agents.base import RunContext
from app.agents.qa_agent import QAAgent
from app.datahub.mock_gateway import MockDataHubGateway
from app.llm.mock_provider import MockLLMProvider


def _make_ctx(data_engineer_files: list[dict]) -> RunContext:
    logs: list[str] = []

    async def emit_log(text: str) -> None:
        logs.append(text)

    ctx = RunContext(
        request_id="req-1",
        prompt="Build a customer revenue pipeline",
        llm=MockLLMProvider(fixtures={}),
        datahub=MockDataHubGateway(latency_seconds=0.0),
        emit_log=emit_log,
    )
    ctx.results["metadata_analyst"] = {
        "matched_datasets": [
            {
                "urn": "urn:li:dataset:(urn:li:dataPlatform:stripe,raw.stripe_payments,PROD)",
                "name": "raw.stripe_payments",
                "platform": "stripe",
                "confidence": 0.94,
                "columns": ["payment_id", "customer_id", "amount_cents", "card_last4"],
                "owners": [],
                "tags": ["pii"],
            }
        ],
        "reasoning": "test",
        "summary": "test",
    }
    ctx.results["data_engineer"] = {"files": data_engineer_files, "summary": "test"}
    return ctx


@pytest.mark.asyncio
async def test_flags_unmasked_pii_column() -> None:
    ctx = _make_ctx(
        [
            {
                "kind": "dbt_model",
                "filename": "models/fct_revenue.sql",
                "content": "select payment_id, customer_id, card_last4 from stripe_payments",
            },
            {
                "kind": "test",
                "filename": "schema.yml",
                "content": "models:\n  - name: fct_revenue\n    columns:\n      - name: payment_id\n        tests: [unique, not_null]",
            },
        ]
    )

    result = await QAAgent().run(ctx)

    assert result.data["passed"] is False
    pii_check = next(c for c in result.data["checks"] if c["name"] == "PII exposure")
    assert pii_check["passed"] is False
    assert "card_last4" in pii_check["message"]


@pytest.mark.asyncio
async def test_passes_when_pii_column_is_masked() -> None:
    ctx = _make_ctx(
        [
            {
                "kind": "dbt_model",
                "filename": "models/fct_revenue.sql",
                "content": "select payment_id, customer_id, md5(card_last4) as card_last4_hash from stripe_payments",
            },
            {
                "kind": "test",
                "filename": "schema.yml",
                "content": "models:\n  - name: fct_revenue\n    columns:\n      - name: payment_id\n        tests: [unique, not_null]",
            },
        ]
    )

    result = await QAAgent().run(ctx)

    pii_check = next(c for c in result.data["checks"] if c["name"] == "PII exposure")
    assert pii_check["passed"] is True


@pytest.mark.asyncio
async def test_flags_missing_not_null_test_coverage() -> None:
    ctx = _make_ctx(
        [
            {
                "kind": "dbt_model",
                "filename": "models/fct_revenue.sql",
                "content": "select payment_id, customer_id from stripe_payments",
            }
        ]
    )

    result = await QAAgent().run(ctx)

    not_null_check = next(c for c in result.data["checks"] if c["name"] == "Not-null constraints")
    assert not_null_check["passed"] is False
