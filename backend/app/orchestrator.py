"""
Orchestrator — the core pipeline runner, split into three resumable
phases with two genuine human-in-the-loop checkpoints between them:

    [context phase]  Planner -> Metadata Analyst -> PAUSE (context checkpoint)
                                                       |
                              human: accept matched datasets, or start fresh
                                                       v
    [generation phase]  Data Engineer -> QA -> Documentation -> PAUSE (writeback checkpoint)
                                                       |
                              human: approve writeback, or skip it
                                                       v
    [writeback phase]  Writeback (only if approved) -> complete

Each phase is its own background task, not one continuous loop — the
pipeline genuinely stops and the process returns to idle between phases.
Resuming a later phase reconstructs `RunContext.results` from what's
already persisted in `agent_runs.output_json` rather than holding
anything in memory across the pause, since nothing guarantees the same
process (or even the same server, in a future multi-instance deploy) is
what resumes it.

Still deliberately plain async/await per phase, not a graph framework —
see the original note this replaced: three fixed, non-cyclic phases don't
need LangGraph's machinery either. If a future agent needs to loop back
within a phase (e.g. QA rejecting and re-triggering Data Engineer), that's
the point to revisit this decision.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import select
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
from app.datahub.datahub_gateway import DataHubRestGateway
from app.datahub.gateway import DataHubGateway
from app.datahub.mcp_gateway import DataHubMCPGateway
from app.datahub.mock_gateway import MockDataHubGateway
from app.demo.seed_data import mock_llm_fixtures
from app.llm.groq_provider import GroqProvider
from app.llm.mock_provider import MockLLMProvider
from app.llm.provider import LLMProvider
from app.models import AgentRun, Artifact, Request, ValidationReport
from app.schemas import AGENT_SEQUENCE, AgentRunEvent, GeneratedFile, WSResult

logger = logging.getLogger("atlas.orchestrator")

# Fixed pipeline order — index doubles as AgentRun.sequence. Split into
# three phase slices below; this master list stays the single source of
# truth for ordering and sequence numbers.
PIPELINE: list[Agent] = [
    PlannerAgent(),
    MetadataAnalystAgent(),
    DataEngineerAgent(),
    QAAgent(),
    DocumentationAgent(),
    WritebackAgent(),
]

assert [a.name for a in PIPELINE] == AGENT_SEQUENCE, (
    "PIPELINE order must exactly match schemas.AGENT_SEQUENCE — the "
    "frontend's stepper renders stages in that fixed order."
)

CONTEXT_PHASE: list[tuple[int, Agent]] = list(enumerate(PIPELINE))[0:2]
GENERATION_PHASE: list[tuple[int, Agent]] = list(enumerate(PIPELINE))[2:5]
WRITEBACK_PHASE: list[tuple[int, Agent]] = list(enumerate(PIPELINE))[5:6]


def _build_llm_provider() -> LLMProvider:
    settings = get_settings()
    if settings.llm_demo_mode:
        logger.info("orchestrator: using MockLLMProvider (demo mode)")
        return MockLLMProvider(fixtures=mock_llm_fixtures())
    logger.info("orchestrator: using GroqProvider model=%s", settings.GROQ_MODEL)
    return GroqProvider(
        api_key=settings.GROQ_API_KEY,  # type: ignore[arg-type]  # guarded by llm_demo_mode
        base_url=settings.GROQ_BASE_URL,
        model=settings.GROQ_MODEL,
        timeout_seconds=settings.LLM_TIMEOUT_SECONDS,
        max_retries=settings.LLM_MAX_RETRIES,
    )


# Singleton for the MCP gateway specifically — it holds a live subprocess
# + session that's expensive to open (spawns mcp-server-datahub, does the
# MCP initialize handshake) and must be reused across every phase of every
# request, not reconnected per phase transition. Mock/direct gateways are
# cheap to construct fresh each time and don't need this treatment.
_mcp_gateway: DataHubMCPGateway | None = None


async def init_datahub_mcp_gateway() -> None:
    """Call once from FastAPI's lifespan at startup. No-op if DataHub
    isn't configured for MCP access — see Settings.datahub_access_mode_effective."""
    global _mcp_gateway
    settings = get_settings()
    if settings.datahub_access_mode_effective != "mcp":
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
        # Don't crash app boot over this — log loudly and let gateway
        # selection fall through to constructing an unconnected instance
        # per-call, which will fail clearly at first tool call with a
        # specific error rather than a silent startup failure.
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
    mode = settings.datahub_access_mode_effective

    if mode == "mock":
        logger.info("orchestrator: using MockDataHubGateway (no DATAHUB_GMS_URL configured)")
        return MockDataHubGateway()

    if mode == "mcp":
        if _mcp_gateway is not None:
            return _mcp_gateway
        # Startup connection failed or hasn't run yet (e.g. under a test
        # harness that skips lifespan) — construct unconnected so the
        # failure surfaces clearly at the first actual tool call instead
        # of here.
        logger.warning(
            "DataHubMCPGateway singleton not connected — constructing a "
            "fresh instance that will fail at first use. Check startup logs."
        )
        return DataHubMCPGateway(
            gms_url=settings.DATAHUB_GMS_URL,  # type: ignore[arg-type]
            token=settings.DATAHUB_TOKEN,
            timeout_seconds=settings.DATAHUB_TIMEOUT_SECONDS,
        )

    logger.info("orchestrator: using DataHubRestGateway url=%s (DATAHUB_ACCESS_MODE=direct)", settings.DATAHUB_GMS_URL)
    return DataHubRestGateway(
        gms_url=settings.DATAHUB_GMS_URL,  # type: ignore[arg-type]  # guarded by mode check above
        token=settings.DATAHUB_TOKEN,
        timeout_seconds=settings.DATAHUB_TIMEOUT_SECONDS,
    )


def _make_context(request_id: str, prompt: str) -> RunContext:
    llm = _build_llm_provider()
    datahub = _build_datahub_gateway()
    current_agent = {"name": PIPELINE[0].name}

    async def emit_log(text: str) -> None:
        # Structured server-side logging, not WS — see README "Execution
        # Flow" for why: useRunStream hardcodes the "started" log line's
        # text client-side, so per-line progress has no wire format to
        # ride on. This still gives full request_id + agent tracing.
        logger.info(
            "agent_log request_id=%s agent=%s message=%s",
            request_id, current_agent["name"], text,
        )

    ctx = RunContext(
        request_id=request_id, prompt=prompt, llm=llm, datahub=datahub, emit_log=emit_log,
    )
    ctx._current_agent_holder = current_agent  # type: ignore[attr-defined]
    return ctx


async def _load_prior_results(request_id: str) -> dict[str, dict]:
    """
    Rebuild RunContext.results from whatever's already persisted, for a
    phase resuming after a pause. Only successful stages contribute —
    a phase should never resume on top of a failed or incomplete one.
    """
    async with session_scope() as db:
        result = await db.execute(
            select(AgentRun)
            .where(AgentRun.request_id == request_id, AgentRun.status == "success")
            .order_by(AgentRun.sequence)
        )
        runs = result.scalars().all()
        return {run.agent_name: run.output_json or {} for run in runs}


async def _run_phase_agents(
    request_id: str, ctx: RunContext, phase: list[tuple[int, Agent]]
) -> bool:
    """Runs one phase's agents in order. Returns True if the phase
    completed successfully, False if an agent failed (and the pipeline
    should be marked failed rather than proceeding to the next phase)."""
    for sequence, agent in phase:
        ctx._current_agent_holder["name"] = agent.name  # type: ignore[attr-defined]

        await _persist_stage_start(request_id, sequence, agent.name)
        await ws_hub.broadcast(request_id, AgentRunEvent(agent=agent.name, status="started"))

        try:
            result: AgentResult = await agent.run(ctx)
        except Exception as exc:  # noqa: BLE001 — any agent failure aborts the run
            logger.exception("agent %s failed for request %s", agent.name, request_id)
            await _persist_stage_failure(request_id, sequence, agent.name, str(exc))
            await ws_hub.broadcast(
                request_id, AgentRunEvent(agent=agent.name, status="failed", error=str(exc)),
            )
            return False

        ctx.results[agent.name] = result.data
        await _persist_stage_success(request_id, sequence, agent.name, result)
        await ws_hub.broadcast(
            request_id,
            AgentRunEvent(agent=agent.name, status="done", result=WSResult(summary=result.summary)),
        )
    return True


# --- Phase entry points ---------------------------------------------------
# Each is invoked as its own FastAPI background task — see routers/requests.py.


async def run_context_phase(request_id: str, prompt: str) -> None:
    """Phase 1: Planner -> Metadata Analyst, then pause for the context
    checkpoint. Invoked immediately after POST /api/requests creates the
    row. Always pauses at the end — even when Metadata Analyst finds
    nothing, so "no existing data, start fresh" is a real, visible choice
    rather than a silent skip."""
    async with session_scope() as db:
        request = await db.get(Request, request_id)
        if request is None:
            logger.error("run_context_phase: request %s not found", request_id)
            return
        request.status = "running"

    ctx = _make_context(request_id, prompt)
    ok = await _run_phase_agents(request_id, ctx, CONTEXT_PHASE)
    if not ok:
        await _finalize_request(request_id, status="failed")
        return

    await _set_status(request_id, "awaiting_context_approval")
    await ws_hub.broadcast(
        request_id,
        AgentRunEvent(agent="metadata_analyst", status="awaiting_approval"),
    )


async def resume_generation_phase(request_id: str, *, context_mode: str) -> None:
    """Phase 2: Data Engineer -> QA -> Documentation, then pause for the
    writeback checkpoint. `context_mode` ("grounded" or "fresh") is
    recorded but doesn't change which agents run — it changes what the
    Data Engineer's prompt contains (see agents/data_engineer.py), since
    the "fresh" path still passes matched_datasets through, just
    (in real/Groq mode) as an empty or de-emphasized list rather than
    omitting the step entirely."""
    async with session_scope() as db:
        request = await db.get(Request, request_id)
        if request is None or request.status != "awaiting_context_approval":
            logger.error(
                "resume_generation_phase: request %s not awaiting context approval (status=%s)",
                request_id, request.status if request else "missing",
            )
            return
        request.status = "running"
        request.context_mode = context_mode
        prompt = request.prompt

    ctx = _make_context(request_id, prompt)
    ctx.results = await _load_prior_results(request_id)

    if context_mode == "fresh" and "metadata_analyst" in ctx.results:
        # Genuinely strip the matched datasets rather than just labeling the
        # choice — otherwise "start fresh" would be cosmetic and Data
        # Engineer would silently use DataHub context anyway. In demo mode
        # this doesn't change the *fixture* content (MockLLMProvider ignores
        # its prompt entirely, a pre-existing, documented limitation — see
        # README), but the actual empty list IS what reaches the prompt, so
        # real/Groq mode responds to this correctly.
        ctx.results["metadata_analyst"] = {
            **ctx.results["metadata_analyst"],
            "matched_datasets": [],
        }

    ok = await _run_phase_agents(request_id, ctx, GENERATION_PHASE)
    if not ok:
        await _finalize_request(request_id, status="failed")
        return

    await _persist_artifacts(request_id, ctx)
    await _persist_validation_report(request_id, ctx)

    await _set_status(request_id, "awaiting_writeback_approval")
    await ws_hub.broadcast(
        request_id,
        AgentRunEvent(agent="writeback", status="awaiting_approval"),
    )


async def resume_writeback_phase(request_id: str, *, approved: bool) -> None:
    """Phase 3: Writeback, only if the human approved it. Skipping still
    marks the request complete — the generated artifacts already exist
    from phase 2 regardless of this decision; only DataHub itself is
    affected by approve vs. skip."""
    async with session_scope() as db:
        request = await db.get(Request, request_id)
        if request is None or request.status != "awaiting_writeback_approval":
            logger.error(
                "resume_writeback_phase: request %s not awaiting writeback approval (status=%s)",
                request_id, request.status if request else "missing",
            )
            return
        request.status = "running"
        request.writeback_mode = "approved" if approved else "skipped"
        prompt = request.prompt

    if not approved:
        await ws_hub.broadcast(
            request_id,
            AgentRunEvent(agent="writeback", status="done", result=WSResult(summary="writeback skipped by user")),
        )
        await _finalize_request(request_id, status="complete")
        return

    ctx = _make_context(request_id, prompt)
    ctx.results = await _load_prior_results(request_id)

    ok = await _run_phase_agents(request_id, ctx, WRITEBACK_PHASE)
    await _finalize_request(request_id, status="complete" if ok else "failed")


# --- Persistence helpers -------------------------------------------------
# Each helper opens its own short-lived session so a mid-pipeline crash
# doesn't leave a single long-running transaction half-committed across
# every stage.


async def _persist_stage_start(request_id: str, sequence: int, agent_name: str) -> None:
    async with session_scope() as db:
        run = await _get_or_create_agent_run(db, request_id, sequence, agent_name)
        run.status = "started"
        run.started_at = datetime.now(timezone.utc)


async def _persist_stage_success(
    request_id: str, sequence: int, agent_name: str, result: AgentResult
) -> None:
    async with session_scope() as db:
        run = await _get_or_create_agent_run(db, request_id, sequence, agent_name)
        run.status = "success"
        run.finished_at = datetime.now(timezone.utc)
        run.output_json = result.data


async def _persist_stage_failure(
    request_id: str, sequence: int, agent_name: str, error: str
) -> None:
    async with session_scope() as db:
        run = await _get_or_create_agent_run(db, request_id, sequence, agent_name)
        run.status = "failed"
        run.finished_at = datetime.now(timezone.utc)
        run.error = error


async def _get_or_create_agent_run(
    db: AsyncSession, request_id: str, sequence: int, agent_name: str
) -> AgentRun:
    result = await db.execute(
        select(AgentRun).where(
            AgentRun.request_id == request_id, AgentRun.sequence == sequence
        )
    )
    run = result.scalar_one_or_none()
    if run is None:
        run = AgentRun(request_id=request_id, sequence=sequence, agent_name=agent_name)
        db.add(run)
        await db.flush()
    return run


async def _persist_artifacts(request_id: str, ctx: RunContext) -> None:
    data_engineer_files = [
        GeneratedFile.model_validate(f)
        for f in ctx.results.get("data_engineer", {}).get("files", [])
    ]
    documentation_files = [
        GeneratedFile.model_validate(f)
        for f in ctx.results.get("documentation", {}).get("files", [])
    ]
    all_files = data_engineer_files + documentation_files

    async with session_scope() as db:
        for f in all_files:
            db.add(
                Artifact(
                    request_id=request_id,
                    kind=f.kind,
                    filename=f.filename,
                    content=f.content,
                )
            )


async def _persist_validation_report(request_id: str, ctx: RunContext) -> None:
    qa_output = ctx.results.get("qa", {})
    async with session_scope() as db:
        db.add(
            ValidationReport(
                request_id=request_id,
                checks=qa_output.get("checks", []),
                passed=qa_output.get("passed", False),
            )
        )


async def _set_status(request_id: str, status: str) -> None:
    async with session_scope() as db:
        request = await db.get(Request, request_id)
        if request is not None:
            request.status = status


async def _finalize_request(request_id: str, *, status: str) -> None:
    await _set_status(request_id, status)
