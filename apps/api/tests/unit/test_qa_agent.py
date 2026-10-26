"""QAAgent turns grounding results into the five checks the run view shows."""
from __future__ import annotations

from app.agents.base import RunContext
from app.agents.qa_agent import QAAgent
from app.datahub.mock_gateway import MockDataHubGateway
from app.demo.seed_data import mock_llm_fixtures
from app.llm.mock_provider import MockLLMProvider

FIXTURES = mock_llm_fixtures()
STRIPE = {
    "urn": "urn:li:dataset:(urn:li:dataPlatform:stripe,raw.stripe_payments,PROD)",
    "name": "raw.stripe_payments",
    "platform": "stripe",
    "confidence": 0.94,
    # the analyst's column list is wrong on purpose: QA must trust DataHub, not this
    "columns": ["payment_id", "refund_reason"],
}
TESTS = {
    "kind": "test",
    "filename": "models/marts/schema.yml",
    "content": "models:\n  - name: fct\n    columns:\n      - name: payment_id\n        tests: [unique, not_null]\n",
}


def _ctx(files: list[dict], datasets: list[dict]) -> RunContext:
    async def emit_log(_: str) -> None:
        pass

    ctx = RunContext(
        run_id="r", prompt="p", llm=MockLLMProvider(fixtures={}),
        datahub=MockDataHubGateway(latency_seconds=0), emit_log=emit_log,
    )
    ctx.results["metadata_analyst"] = {"matched_datasets": datasets}
    ctx.results["data_engineer"] = {"files": files}
    return ctx


def _model(sql: str) -> dict:
    return {"kind": "dbt_model", "filename": "models/marts/fct.sql", "content": sql}


async def _checks(ctx: RunContext) -> dict[str, dict]:
    result = await QAAgent().run(ctx)
    return {c["name"]: c for c in result.data["checks"]}


async def test_demo_run_has_exactly_one_critical_finding():
    ctx = _ctx(FIXTURES["DataEngineerOutput"].model_dump()["files"],
               FIXTURES["MetadataAnalystOutput"].model_dump()["matched_datasets"])

    checks = await _checks(ctx)

    critical = [c for c in checks.values() if not c["passed"] and c["severity"] == "critical"]
    assert [c["name"] for c in critical] == ["PII stays masked"]
    assert "card_last4" in critical[0]["message"]
    assert "stg_stripe_payments.sql" in critical[0]["message"]


async def test_grounds_against_datahub_not_the_analysts_column_list():
    ctx = _ctx([_model("select payment_id, refund_reason from {{ source('raw', 'stripe_payments') }}"), TESTS],
               [STRIPE])

    checks = await _checks(ctx)

    columns = checks["Columns resolve to DataHub"]
    assert columns["severity"] == "critical"
    assert "refund_reason" in columns["message"]


async def test_start_fresh_is_ungrounded_not_passed():
    ctx = _ctx([_model("select payment_id from stripe_payments"), TESTS], [])

    checks = await _checks(ctx)

    columns = checks["Columns resolve to DataHub"]
    assert columns["passed"] is False
    assert columns["severity"] == "warning"
    assert "Ungrounded" in columns["message"]
    assert checks["SQL parses"]["passed"] is True


async def test_mart_without_key_tests_is_a_warning():
    ctx = _ctx([_model("select payment_id from {{ source('raw', 'stripe_payments') }}")], [STRIPE])

    checks = await _checks(ctx)

    assert checks["Keys have unique and not_null tests"]["passed"] is False
    assert checks["Keys have unique and not_null tests"]["severity"] == "warning"


async def test_clean_model_passes_everything():
    ctx = _ctx([_model("select payment_id, md5(card_last4) as card_hash from {{ source('raw', 'stripe_payments') }}"),
                TESTS], [STRIPE])

    checks = await _checks(ctx)

    assert all(c["passed"] for c in checks.values()), checks
