"""
Contract tests — verify that every agent's I/O stays validated against
its Pydantic schema, and that the orchestrator's pipeline order matches
the AgentId sequence the frontend expects. These don't hit a database or
network; they're pure schema-shape guarantees.
"""
from __future__ import annotations

from app.demo.seed_data import mock_llm_fixtures
from app.schemas import (
    AGENT_SEQUENCE,
    AgentRunEvent,
    DataEngineerOutput,
    DocumentationOutput,
    MetadataAnalystOutput,
    PlannerOutput,
    QAOutput,
    WritebackOutput,
)


def test_agent_sequence_matches_frontend_pipeline_order() -> None:
    """Mirrors frontend/lib/pipeline.ts PIPELINE ids exactly."""
    assert AGENT_SEQUENCE == [
        "planner",
        "metadata_analyst",
        "data_engineer",
        "qa",
        "documentation",
        "writeback",
    ]


def test_every_demo_fixture_validates_against_its_schema() -> None:
    fixtures = mock_llm_fixtures()
    schema_by_name = {
        "PlannerOutput": PlannerOutput,
        "MetadataAnalystOutput": MetadataAnalystOutput,
        "DataEngineerOutput": DataEngineerOutput,
        "QAOutput": QAOutput,
        "DocumentationOutput": DocumentationOutput,
        "WritebackOutput": WritebackOutput,
    }
    assert set(fixtures.keys()) == set(schema_by_name.keys())
    for name, fixture in fixtures.items():
        schema = schema_by_name[name]
        # Round-trips through dict -> schema exactly like MockLLMProvider does.
        revalidated = schema.model_validate(fixture.model_dump())
        assert revalidated == fixture


def test_ws_event_shape_matches_frontend_contract() -> None:
    """Mirrors AgentRunEvent in frontend/lib/types.ts."""
    started = AgentRunEvent(agent="planner", status="started")
    assert started.model_dump(exclude_none=True) == {"agent": "planner", "status": "started"}

    done = AgentRunEvent(agent="planner", status="done", result={"summary": "ok"})
    dumped = done.model_dump(exclude_none=True)
    assert dumped["status"] == "done"
    assert dumped["result"] == {"summary": "ok"}

    failed = AgentRunEvent(agent="qa", status="failed", error="boom")
    assert failed.model_dump(exclude_none=True)["error"] == "boom"
