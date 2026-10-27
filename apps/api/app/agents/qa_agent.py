"""QA agent: checks generated files with code, not a model, so the same files always get the same verdict.

Five checks, in the order the report shows them:
columns resolve to DataHub · SQL parses · PII stays masked · keys are tested · metadata complete.
Ground truth is the schema DataHub returns now, not the column list the metadata analyst
(an LLM) wrote down, which could itself be wrong.
"""
from __future__ import annotations

import asyncio

import yaml

from app.agents.base import Agent, AgentResult, RunContext
from app.qa.fixes import suggest_mask
from app.qa.grounding import ModelCheck, Table, check_models, parse_errors, table_key
from app.schemas import GeneratedFile, MatchedDataset, ValidationCheckOut

MAX_LISTED = 4  # findings named in one message before "and N more"


class QAAgent(Agent):
    name = "qa"

    async def run(self, ctx: RunContext) -> AgentResult:
        datasets = [MatchedDataset.model_validate(d) for d in ctx.prior("metadata_analyst")["matched_datasets"]]
        files = [GeneratedFile.model_validate(f) for f in ctx.prior("data_engineer")["files"]]
        models = {f.filename: f.content for f in files if f.kind in ("dbt_model", "sql")}

        if datasets:
            await ctx.emit_log("reading source schemas from DataHub")
            catalog, empty = await _load_catalog(ctx, datasets)
            await ctx.emit_log("resolving every column against the catalog")
            results = check_models(models, catalog)
            fixes = [
                fix for r in results for e in r.exposed_pii
                if (fix := suggest_mask(r.filename, models[r.filename], e))
            ]
            checks = [
                _columns_check(results),
                _parse_check(results),
                _pii_check(results),
                _key_tests_check(files),
                _metadata_check(empty),
            ]
        else:
            await ctx.emit_log("no catalog datasets: checking syntax and tests only")
            fixes = []
            checks = [
                _check("Columns resolve to DataHub", False, "warning",
                       "Ungrounded: this run started fresh, so no column could be checked against DataHub."),
                _parse_check_ungrounded(parse_errors(models)),
                _check("PII stays masked", False, "warning",
                       "Without catalog datasets there are no PII tags to check against."),
                _key_tests_check(files),
            ]

        critical = [c for c in checks if not c.passed and c.severity == "critical"]
        summary = f"{len(critical)} critical issue(s) found" if critical else "no critical issues"
        await ctx.emit_log(summary)
        return AgentResult(
            summary=summary,
            data={
                "checks": [c.model_dump() for c in checks],
                "passed": all(c.passed for c in checks),
                "summary": summary,
                "fixes": [f.as_dict() for f in fixes],
            },
        )


async def _load_catalog(ctx: RunContext, datasets: list[MatchedDataset]) -> tuple[dict, list[str]]:
    """One schema fetch per dataset, all at once. Returns the catalog and datasets with no fields."""
    schemas = await asyncio.gather(*(ctx.datahub.get_schema(d.urn) for d in datasets))
    catalog: dict[tuple[str, str], Table] = {}
    empty: list[str] = []
    for ds, schema in zip(datasets, schemas, strict=True):
        fields = [f for f in schema.get("fields", []) if f.get("name")]
        if not fields:
            empty.append(ds.name)
        catalog[table_key(ds.name)] = Table(
            columns=[f["name"].lower() for f in fields],
            pii={f["name"].lower() for f in fields if _is_pii(f)},
        )
    return catalog, empty


def _is_pii(field: dict) -> bool:
    tags = " ".join(str(t) for t in field.get("tags") or [])
    return "pii" in (field.get("description") or "").lower() or "pii" in tags.lower()


def _columns_check(results: list[ModelCheck]) -> ValidationCheckOut:
    problems = []
    for r in results:
        name = _short(r.filename)
        if r.unknown_tables:
            problems.append(f"{name} reads {', '.join(r.unknown_tables)}, which isn't in the catalog")
        if r.unresolved_columns:
            cols = ", ".join(r.unresolved_columns)
            problems.append(f"{name}: {cols} {'doesn’t' if len(r.unresolved_columns) == 1 else 'don’t'} exist in any source it reads")
        if r.blocked_by:
            problems.append(f"{name} couldn’t be checked because {', '.join(r.blocked_by)} failed")
    if problems:
        return _check("Columns resolve to DataHub", False, "critical", _listed(problems))
    return _check("Columns resolve to DataHub", True, "info",
                  f"Every column in {len(results)} file(s) traces back to a DataHub dataset.")


def _parse_check(results: list[ModelCheck]) -> ValidationCheckOut:
    broken = [f"{_short(r.filename)} doesn’t parse ({r.parse_error})" for r in results if r.parse_error]
    if broken:
        return _check("SQL parses", False, "critical", _listed(broken))
    unverifiable = [f"{_short(r.filename)} {r.unverifiable}" for r in results if r.unverifiable]
    if unverifiable:
        return _check("SQL parses", False, "warning", _listed(unverifiable))
    return _check("SQL parses", True, "info", f"All {len(results)} SQL file(s) parse.")


def _parse_check_ungrounded(errors: dict[str, str]) -> ValidationCheckOut:
    if errors:
        return _check("SQL parses", False, "critical", _listed([f"{_short(f)}: {e}" for f, e in errors.items()]))
    return _check("SQL parses", True, "info", "All SQL files parse.")


def _pii_check(results: list[ModelCheck]) -> ValidationCheckOut:
    leaks = [
        f"{e.column} reaches {_short(r.filename)}’s output unmasked (line {e.line})"
        for r in results for e in r.exposed_pii
    ]
    if leaks:
        return _check("PII stays masked", False, "critical",
                      _listed(leaks) + ". Hash with md5() or drop the column.")
    return _check("PII stays masked", True, "info", "No column tagged PII in DataHub reaches an output unmasked.")


def _key_tests_check(files: list[GeneratedFile]) -> ValidationCheckOut:
    """Every mart needs one column with both unique and not_null tests."""
    marts = [_short(f.filename).removesuffix(".sql") for f in files if f.kind == "dbt_model" and "/marts/" in f"/{f.filename}"]
    tested: set[str] = set()
    for f in files:
        if f.kind != "test":
            continue
        try:
            doc = yaml.safe_load(f.content) or {}
        except yaml.YAMLError:
            return _check("Keys have unique and not_null tests", False, "warning", f"{_short(f.filename)} isn’t valid YAML.")
        for model in doc.get("models") or []:
            for col in model.get("columns") or []:
                names = {t if isinstance(t, str) else next(iter(t)) for t in (col.get("tests") or col.get("data_tests") or [])}
                if {"unique", "not_null"} <= names:
                    tested.add(model.get("name"))
    missing = [m for m in marts if m not in tested]
    if missing:
        return _check("Keys have unique and not_null tests", False, "warning",
                      f"No column in {', '.join(missing)} has both unique and not_null tests.")
    return _check("Keys have unique and not_null tests", True, "info", "Every mart has a key with unique and not_null tests.")


def _metadata_check(empty: list[str]) -> ValidationCheckOut:
    if empty:
        return _check("Metadata complete", False, "warning", f"DataHub returned no columns for {', '.join(empty)}.")
    return _check("Metadata complete", True, "info", "Every matched dataset has column metadata in DataHub.")


def _check(name: str, passed: bool, severity: str, message: str) -> ValidationCheckOut:
    return ValidationCheckOut(name=name, passed=passed, severity=severity, message=message)


def _listed(items: list[str]) -> str:
    shown = "; ".join(items[:MAX_LISTED])
    return shown + (f"; and {len(items) - MAX_LISTED} more" if len(items) > MAX_LISTED else "")


def _short(filename: str) -> str:
    return filename.rsplit("/", 1)[-1]
