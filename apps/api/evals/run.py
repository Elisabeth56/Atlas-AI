"""Eval harness: does grounding keep generated SQL inside the catalog, and does QA catch what slips through?

    python -m evals.run                         # every configured provider, grounded and fresh
    python -m evals.run --providers groq --limit 5
    python -m evals.run --mock                  # the demo fixtures; checks the harness, not a model

Each case runs the real agents in-process (planner → analyst → data engineer → QA) against the sample
catalog, once grounded and once with the matched datasets dropped (start fresh). Every generated model is
then checked against the full catalog, so both modes are measured the same way. No database, no writeback.
Results go to evals/results/: one JSON file per provider and a markdown table.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import statistics
import time
import uuid
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path

from app.agents.base import RunContext
from app.agents.data_engineer import DataEngineerAgent
from app.agents.metadata_analyst import MetadataAnalystAgent
from app.agents.planner import PlannerAgent
from app.agents.qa_agent import QAAgent
from app.config import get_settings
from app.datahub.gateway import is_pii
from app.datahub.mock_gateway import _FIXTURE_DATASETS, MockDataHubGateway
from app.demo.seed_data import mock_llm_fixtures
from app.llm.chain import CallRecord, ProviderChain, providers_from_settings
from app.llm.mock_provider import MockLLMProvider
from app.qa.grounding import Table, check_models, table_key

HERE = Path(__file__).parent
CONFIDENT = 0.5  # an analyst match at or above this counts as "the model claimed it found a source"

# the sample catalog as QA sees it, used to judge both modes the same way
CATALOG = {
    table_key(ds["name"]): Table(
        columns=[f["name"].lower() for f in ds["schema"]],
        pii={f["name"].lower() for f in ds["schema"] if is_pii(f)},
    )
    for ds in _FIXTURE_DATASETS
}


@dataclass
class CaseResult:
    case: str
    kind: str
    mode: str
    ok: bool
    error: str | None = None
    matched: int = 0  # datasets the analyst claimed at >= CONFIDENT
    unresolved: list[str] = field(default_factory=list)  # columns or tables not in the catalog
    pii_exposed: list[str] = field(default_factory=list)
    qa_critical: int = 0
    seconds: float = 0.0
    tokens: int = 0
    calls: int = 0


async def run_case(case: dict, mode: str, llm, tokens: list[CallRecord]) -> CaseResult:
    async def quiet(_line: str) -> None:
        pass

    ctx = RunContext(run_id=str(uuid.uuid4()), prompt=case["prompt"], llm=llm,
                     datahub=MockDataHubGateway(latency_seconds=0), emit_log=quiet)
    tokens.clear()
    started = time.monotonic()
    result = CaseResult(case=case["id"], kind=case["kind"], mode=mode, ok=False)
    try:
        for agent in (PlannerAgent(), MetadataAnalystAgent()):
            ctx.current_agent = agent.name
            ctx.results[agent.name] = (await agent.run(ctx)).data
        matched = ctx.results["metadata_analyst"].get("matched_datasets", [])
        result.matched = sum(1 for d in matched if d.get("confidence", 0) >= CONFIDENT)
        if mode == "fresh":  # what "Start fresh" does at checkpoint 1
            ctx.results["metadata_analyst"] = {**ctx.results["metadata_analyst"], "matched_datasets": []}
        for agent in (DataEngineerAgent(), QAAgent()):
            ctx.current_agent = agent.name
            ctx.results[agent.name] = (await agent.run(ctx)).data

        files = ctx.results["data_engineer"]["files"]
        models = {f["filename"]: f["content"] for f in files if f["kind"] in ("dbt_model", "sql")}
        for check in check_models(models, CATALOG):
            result.unresolved += [f"{check.filename}: {c}" for c in check.unresolved_columns + check.unknown_tables]
            result.pii_exposed += [f"{check.filename}: {e.column}" for e in check.exposed_pii]
        result.qa_critical = sum(
            1 for c in ctx.results["qa"]["checks"] if not c["passed"] and c["severity"] == "critical"
        )
        result.ok = True
    except Exception as exc:  # noqa: BLE001 — a failed case is a data point, not a crash
        result.error = f"{type(exc).__name__}: {exc}"[:300]
    result.seconds = round(time.monotonic() - started, 2)
    result.calls = len(tokens)
    result.tokens = sum((t.tokens_in or 0) + (t.tokens_out or 0) for t in tokens)
    return result


def summarise(results: list[CaseResult]) -> dict:
    def rate(rows: list[CaseResult], hit) -> float | None:
        return round(100 * sum(1 for r in rows if hit(r)) / len(rows), 1) if rows else None

    out = {}
    for mode in ("grounded", "fresh"):
        rows = [r for r in results if r.mode == mode and r.ok]
        if not any(r.mode == mode for r in results):
            continue
        times = sorted(r.seconds for r in rows) or [0.0]
        out[mode] = {
            "cases": sum(1 for r in results if r.mode == mode),
            "failed": sum(1 for r in results if r.mode == mode and not r.ok),
            "unresolved_column_rate": rate(rows, lambda r: r.unresolved),
            "pii_leak_rate": rate(rows, lambda r: r.pii_exposed),
            "qa_critical_rate": rate(rows, lambda r: r.qa_critical),
            # an unanswerable request should come back with no confident match
            "false_match_rate": rate([r for r in rows if r.kind == "unanswerable"], lambda r: r.matched),
            "latency_p50_s": round(statistics.median(times), 2),
            "latency_p95_s": round(times[min(len(times) - 1, int(0.95 * len(times)))], 2),
            "tokens_per_run": round(statistics.mean(r.tokens for r in rows)) if rows else 0,
        }
    return out


async def run_suite(provider: str, modes: list[str], cases: list[dict], mock: bool = False, pause: float = 0.0) -> dict:
    calls: list[CallRecord] = []

    async def record(call: CallRecord) -> None:
        calls.append(call)

    if mock:
        llm = MockLLMProvider(fixtures=mock_llm_fixtures(), latency_seconds=0)
    else:
        config = next(p for p in providers_from_settings(get_settings()) if p.name == provider)
        # one provider at a time: a fallback would blur whose numbers these are
        llm = ProviderChain([config], timeout_seconds=get_settings().LLM_TIMEOUT_SECONDS, on_call=record)

    results: list[CaseResult] = []
    for case in cases:
        for mode in modes:
            result = await run_case(case, mode, llm, calls)
            results.append(result)
            print(f"  {provider:9} {mode:8} {case['id']:24} "
                  f"{'ok' if result.ok else 'FAILED':6} unresolved={len(result.unresolved)} pii={len(result.pii_exposed)}")
            if pause:
                await asyncio.sleep(pause)  # free tiers count requests per minute
    return {"provider": provider, "summary": summarise(results), "results": [asdict(r) for r in results]}


def table(reports: list[dict]) -> str:
    rows = [
        "| provider | mode | cases | failed | unresolved columns | PII leaks | QA critical | false matches | p50 s | p95 s | tokens/run |",
        "|---|---|---|---|---|---|---|---|---|---|---|",
    ]
    pct = lambda v: "n/a" if v is None else f"{v}%"  # noqa: E731
    for rep in reports:
        for mode, s in rep["summary"].items():
            rows.append(
                f"| {rep['provider']} | {mode} | {s['cases']} | {s['failed']} | {pct(s['unresolved_column_rate'])} | "
                f"{pct(s['pii_leak_rate'])} | {pct(s['qa_critical_rate'])} | {pct(s['false_match_rate'])} | "
                f"{s['latency_p50_s']} | {s['latency_p95_s']} | {s['tokens_per_run']} |"
            )
    return "\n".join(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--providers", help="comma-separated; default: every provider with a key")
    parser.add_argument("--modes", default="grounded,fresh")
    parser.add_argument("--limit", type=int, help="run only the first N cases")
    parser.add_argument("--mock", action="store_true", help="use the demo fixtures instead of a model")
    parser.add_argument("--pause", type=float, default=2.0, help="seconds between cases, for rate limits")
    args = parser.parse_args()

    cases = [json.loads(line) for line in (HERE / "cases.jsonl").read_text().splitlines() if line.strip()]
    cases = cases[: args.limit] if args.limit else cases
    modes = args.modes.split(",")
    if args.mock:
        providers = ["mock"]
    else:
        configured = [p.name for p in providers_from_settings(get_settings())]
        providers = args.providers.split(",") if args.providers else configured
        if not providers:
            raise SystemExit("No provider keys set (GROQ_API_KEY, CEREBRAS_API_KEY, GEMINI_API_KEY). Use --mock to check the harness.")

    stamp = datetime.now(UTC).strftime("%Y%m%d-%H%M")
    reports = []
    for provider in providers:
        print(f"{provider}: {len(cases)} cases × {len(modes)} modes")
        report = asyncio.run(run_suite(provider, modes, cases, mock=args.mock, pause=0 if args.mock else args.pause))
        report["ran_at"] = stamp
        (HERE / "results" / f"{stamp}-{provider}.json").write_text(json.dumps(report, indent=2))
        reports.append(report)

    md = table(reports)
    (HERE / "results" / "latest.md").write_text(f"Run {stamp} UTC, {len(cases)} cases.\n\n{md}\n")
    print("\n" + md)


if __name__ == "__main__":
    main()
