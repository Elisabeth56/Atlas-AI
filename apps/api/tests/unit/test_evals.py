"""The eval harness runs the real agents and measures both modes against the same catalog."""
from __future__ import annotations

import json
from pathlib import Path

from evals.run import run_suite, table

CASES = [json.loads(line) for line in (Path(__file__).parents[2] / "evals" / "cases.jsonl").read_text().splitlines()]


def test_case_file_covers_what_the_issue_asks_for():
    kinds = [c["kind"] for c in CASES]
    assert len(CASES) >= 25 and len({c["id"] for c in CASES}) == len(CASES)
    assert kinds.count("unanswerable") >= 2 and "hallucination" in kinds and "pii" in kinds


async def test_mock_run_measures_both_modes_against_the_catalog():
    report = await run_suite("mock", ["grounded", "fresh"], CASES[:2], mock=True)

    grounded, fresh = report["summary"]["grounded"], report["summary"]["fresh"]
    # the demo fixture leaks card_last4, and QA blocks it whether or not the run is grounded
    assert grounded["pii_leak_rate"] == fresh["pii_leak_rate"] == 100.0
    assert grounded["qa_critical_rate"] == fresh["qa_critical_rate"] == 100.0
    assert "| mock | grounded | 2 |" in table([report])
