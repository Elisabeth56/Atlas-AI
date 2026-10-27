"""
Pipeline runner: three phases separated by two human checkpoints.

    context:     planner -> metadata_analyst          -> pause (accept / start fresh)
    generation:  data_engineer -> qa -> documentation  -> pause (approve / skip writeback)
    writeback:   writeback (only if approved)          -> complete

Each phase runs as its own task. Nothing is held in memory across a pause: a resuming
phase rebuilds earlier results from steps.output. Plain async/await, no graph
framework: the phases are fixed and never loop.
"""
from __future__ import annotations

import logging
from datetime import UTC, datetime

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import ws_hub
from app.agents.base import Agent, AgentResult, RunContext
from app.agents.data_engineer import DataEngineerAgent
from app.agents.documentation_agent import DocumentationAgent
from app.agents.metadata_analyst import MetadataAnalystAgent
from app.agents.planner import PlannerAgent
from app.agents.qa_agent import QAAgent
from app.agents.writeback_agent import WritebackAgent
from app.config import get_settings
from app.database import session_scope
from app.datahub.gateway import DataHubGateway
from app.datahub.mcp_gateway import DataHubMCPGateway
from app.datahub.mock_gateway import MockDataHubGateway
from app.demo.seed_data import mock_llm_fixtures
from app.llm.chain import ProviderChain, providers_from_settings
from app.llm.mock_provider import MockLLMProvider
from app.llm.provider import LLMProvider
from app.models import Artifact, Run, RunStep, ValidationReport
from app.schemas import AGENT_SEQUENCE, GeneratedFile, RunEvent, WSResult

logger = logging.getLogger("atlas.orchestrator")

# index doubles as RunStep.sequence; the frontend stepper renders the same order
PIPELINE: list[Agent] = [
    PlannerAgent(),
    MetadataAnalystAgent(),
    DataEngineerAgent(),
    QAAgent(),
    DocumentationAgent(),
    WritebackAgent(),
]

assert [a.name for a in PIPELINE] == AGENT_SEQUENCE, "PIPELINE must match AGENT_SEQUENCE"

CONTEXT_PHASE: list[tuple[int, Agent]] = list(enumerate(PIPELINE))[0:2]
GENERATION_PHASE: list[tuple[int, Agent]] = list(enumerate(PIPELINE))[2:5]
WRITEBACK_PHASE: list[tuple[int, Agent]] = list(enumerate(PIPELINE))[5:6]


def _build_llm_provider() -> LLMProvider:
    settings = get_settings()
    if settings.llm_demo_mode:
        logger.info("orchestrator: using MockLLMProvider (demo mode)")
        return MockLLMProvider(fixtures=mock_llm_fixtures())
    providers = providers_from_settings(settings)
    logger.info("orchestrator: using providers %s", [p.name for p in providers])
    return ProviderChain(providers, timeout_seconds=settings.LLM_TIMEOUT_SECONDS)


# One MCP connection (a subprocess plus session) shared by every phase of every run.
_mcp_gateway: DataHubMCPGateway | None = None


async def init_datahub_mcp_gateway() -> None:
    """Connects the shared MCP gateway at startup. No-op when DataHub isn't configured."""
    global _mcp_gateway
    settings = get_settings()
    if settings.datahub_mode != "mcp":
        return

    gateway = DataHubMCPGateway(
        gms_url=settings.DATAHUB_GMS_URL,  # type: ignore[arg-type]  # guarded above
        token=settings.DATAHUB_TOKEN,
        timeout_seconds=settings.DATAHUB_TIMEOUT_SECONDS,
    )
    try:
        await gateway.connect()
        _mcp_gateway = gateway
    except Exception:
        # don't block boot; calls will fail with a clear error until DataHub is reachable
        logger.exception(
            "Failed to connect DataHubMCPGateway at startup — DataHub MCP "
            "calls will fail until this is fixed. Run "
            "scripts/inspect_mcp_tools.py to debug the connection directly."
        )
        _mcp_gateway = None


async def shutdown_datahub_mcp_gateway() -> None:
    """Call once from FastAPI's lifespan at shutdown."""
    global _mcp_gateway
    if _mcp_gateway is not None:
        await _mcp_gateway.aclose()
        _mcp_gateway = None


def _build_datahub_gateway() -> DataHubGateway:
    settings = get_settings()
    if settings.datahub_mode == "mock":
        return MockDataHubGateway()
    if _mcp_gateway is not None:
        return _mcp_gateway
    logger.warning("MCP gateway not connected at startup; this run's DataHub calls will fail")
    return DataHubMCPGateway(
        gms_url=settings.DATAHUB_GMS_URL,  # type: ignore[arg-type]  # set when mode is mcp
        token=settings.DATAHUB_TOKEN,
        timeout_seconds=settings.DATAHUB_TIMEOUT_SECONDS,
    )


def _make_context(run_id: str, prompt: str) -> RunContext:
    ctx: RunContext

    async def emit_log(text: str) -> None:
        logger.info(
            "agent_log run_id=%s agent=%s message=%s", run_id, ctx.current_agent, text
        )

    ctx = RunContext(
        run_id=run_id,
        prompt=prompt,
        llm=_build_llm_provider(),
        datahub=_build_datahub_gateway(),
        emit_log=emit_log,
    )
    return ctx


async def _load_prior_results(run_id: str) -> dict[str, dict]:
    """Rebuilds RunContext.results from successful stages, for a phase resuming after a pause."""
    async with session_scope() as db:
        result = await db.execute(
            select(RunStep)
            .where(RunStep.run_id == run_id, RunStep.status == "success")
            .order_by(RunStep.sequence)
        )
        return {step.agent: step.output or {} for step in result.scalars().all()}


async def _run_phase_agents(
    run_id: str,
    ctx: RunContext,
    phase: list[tuple[int, Agent]],
    *,
    end_status: str | None = None,
) -> bool:
    """Runs one phase's agents in order. Returns False as soon as one fails.

    `end_status` is committed in the same transaction as the last agent's output,
    so the run never shows a finished phase with half its results missing.
    """
    for index, (sequence, agent) in enumerate(phase):
        ctx.current_agent = agent.name

        await _persist_stage_start(run_id, sequence, agent.name)
        await ws_hub.broadcast(run_id, RunEvent(agent=agent.name, status="started"))

        try:
            result: AgentResult = await agent.run(ctx)
        except Exception as exc:  # noqa: BLE001 — any agent failure aborts the run
            logger.exception("agent %s failed for run %s", agent.name, run_id)
            await _persist_stage_failure(run_id, sequence, agent.name, str(exc))
            await ws_hub.broadcast(
                run_id, RunEvent(agent=agent.name, status="failed", error=str(exc)),
            )
            return False

        ctx.results[agent.name] = result.data
        is_last = index == len(phase) - 1
        await _persist_stage_success(
            run_id, sequence, agent.name, result,
            status=end_status if is_last else None,
        )
        await ws_hub.broadcast(
            run_id,
            RunEvent(agent=agent.name, status="done", result=WSResult(summary=result.summary)),
        )
    return True


async def run_context_phase(run_id: str, prompt: str) -> None:
    """Phase 1. Always pauses at the end, even with no matches, so starting fresh is a visible choice."""
    async with session_scope() as db:
        run = await db.get(Run, run_id)
        if run is None:
            logger.error("run_context_phase: run %s not found", run_id)
            return
        run.status = "running"

    ctx = _make_context(run_id, prompt)
    ok = await _run_phase_agents(run_id, ctx, CONTEXT_PHASE)
    if not ok:
        await _finalize_request(run_id, status="failed")
        return

    await _set_status(run_id, "awaiting_context_approval")
    await ws_hub.broadcast(
        run_id,
        RunEvent(agent="metadata_analyst", status="awaiting_approval"),
    )


async def resume_generation_phase(run_id: str) -> None:
    """Phase 2. Runs after the endpoint claimed the run; "fresh" mode drops the matched datasets."""
    async with session_scope() as db:
        run = await db.get(Run, run_id)
        # the endpoint already claimed the run (status=running, context_mode set)
        if run is None or run.status != "running":
            logger.error(
                "resume_generation_phase: run %s not claimed (status=%s)",
                run_id, run.status if run else "missing",
            )
            return
        context_mode = run.context_mode
        prompt = run.prompt

    ctx = _make_context(run_id, prompt)
    ctx.results = await _load_prior_results(run_id)

    if context_mode == "fresh" and "metadata_analyst" in ctx.results:
        # strip the matches for real, so "start fresh" changes what the data engineer sees
        ctx.results["metadata_analyst"] = {
            **ctx.results["metadata_analyst"],
            "matched_datasets": [],
        }

    ok = await _run_phase_agents(
        run_id, ctx, GENERATION_PHASE, end_status="awaiting_writeback_approval"
    )
    if not ok:
        await _finalize_request(run_id, status="failed")
        return

    await ws_hub.broadcast(
        run_id,
        RunEvent(agent="writeback", status="awaiting_approval"),
    )


async def resume_writeback_phase(run_id: str) -> None:
    """Phase 3. Skipping still completes the run; only DataHub is affected by the choice."""
    async with session_scope() as db:
        run = await db.get(Run, run_id)
        # the endpoint already claimed the run (status=running, writeback_mode set)
        if run is None or run.status != "running":
            logger.error(
                "resume_writeback_phase: run %s not claimed (status=%s)",
                run_id, run.status if run else "missing",
            )
            return
        approved = run.writeback_mode == "approved"
        prompt = run.prompt

    if not approved:
        await ws_hub.broadcast(
            run_id,
            RunEvent(agent="writeback", status="done", result=WSResult(summary="writeback skipped by user")),
        )
        await _finalize_request(run_id, status="complete")
        return

    ctx = _make_context(run_id, prompt)
    ctx.results = await _load_prior_results(run_id)

    ok = await _run_phase_agents(run_id, ctx, WRITEBACK_PHASE)
    await _finalize_request(run_id, status="complete" if ok else "failed")


# Each helper uses its own short transaction, so a crash never leaves one spanning stages.


async def _persist_stage_start(run_id: str, sequence: int, agent: str) -> None:
    async with session_scope() as db:
        step = await _get_or_create_step(db, run_id, sequence, agent)
        step.status = "started"
        step.started_at = datetime.now(UTC)


async def _persist_stage_success(
    run_id: str,
    sequence: int,
    agent: str,
    result: AgentResult,
    *,
    status: str | None = None,
) -> None:
    """Saves a finished stage and everything it produced in one transaction."""
    async with session_scope() as db:
        step = await _get_or_create_step(db, run_id, sequence, agent)
        step.status = "success"
        step.finished_at = datetime.now(UTC)
        step.output = result.data

        if "files" in result.data:
            await _replace_artifacts(db, run_id, agent, result.data["files"])
        if agent == "qa":
            await _replace_validation_report(db, run_id, result.data)
        if status is not None:
            run = await db.get(Run, run_id)
            run.status = status


async def _persist_stage_failure(
    run_id: str, sequence: int, agent: str, error: str
) -> None:
    async with session_scope() as db:
        step = await _get_or_create_step(db, run_id, sequence, agent)
        step.status = "failed"
        step.finished_at = datetime.now(UTC)
        step.error = error


async def _get_or_create_step(
    db: AsyncSession, run_id: str, sequence: int, agent: str
) -> RunStep:
    result = await db.execute(
        select(RunStep).where(
            RunStep.run_id == run_id, RunStep.sequence == sequence
        )
    )
    step = result.scalar_one_or_none()
    if step is None:
        step = RunStep(run_id=run_id, sequence=sequence, agent=agent)
        db.add(step)
        await db.flush()
    return step


async def _replace_artifacts(
    db: AsyncSession, run_id: str, agent: str, files: list[dict]
) -> None:
    """Swaps in this stage's files; deleting first makes a re-run replace, not duplicate."""
    await db.execute(
        delete(Artifact).where(
            Artifact.run_id == run_id, Artifact.source_agent == agent
        )
    )
    for raw in files:
        f = GeneratedFile.model_validate(raw)
        db.add(
            Artifact(
                run_id=run_id,
                source_agent=agent,
                kind=f.kind,
                filename=f.filename,
                content=f.content,
            )
        )


async def _replace_validation_report(db: AsyncSession, run_id: str, qa_output: dict) -> None:
    checks = qa_output.get("checks", [])
    blocking = any(not c["passed"] and c["severity"] == "critical" for c in checks)
    await db.execute(delete(ValidationReport).where(ValidationReport.run_id == run_id))
    db.add(
        ValidationReport(
            run_id=run_id,
            checks=checks,
            passed=qa_output.get("passed", False),
            blocking=blocking,
        )
    )


async def _set_status(run_id: str, status: str) -> None:
    async with session_scope() as db:
        run = await db.get(Run, run_id)
        if run is not None:
            run.status = status


async def _finalize_request(run_id: str, *, status: str) -> None:
    await _set_status(run_id, status)
