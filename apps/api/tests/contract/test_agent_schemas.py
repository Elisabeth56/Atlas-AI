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
    DataEngineerOutput,
    DocumentationOutput,
    MetadataAnalystOutput,
    PlannerOutput,
    WritebackOutput,
)


def test_agent_sequence_matches_frontend_pipeline_order() -> None:
    """Mirrors apps/web/lib/pipeline.ts PIPELINE ids exactly."""
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
        "DocumentationOutput": DocumentationOutput,
        "WritebackOutput": WritebackOutput,
    }
    assert set(fixtures.keys()) == set(schema_by_name.keys())
    for name, fixture in fixtures.items():
        schema = schema_by_name[name]
        # Round-trips through dict -> schema exactly like MockLLMProvider does.
        revalidated = schema.model_validate(fixture.model_dump())
        assert revalidated == fixture
