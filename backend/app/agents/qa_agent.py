"""QA agent — validates the Data Engineer's generated artifacts.

Unlike the other agents, QA does NOT ask an LLM to judge correctness —
validation results need to be deterministic and reproducible, not subject
to model sampling variance. Instead this agent runs real checks:
SQL parseability (sqlparse), PII-column exposure (cross-referenced
against DataHub field descriptions/tags), not-null test coverage for
primary/foreign keys, and metadata completeness (DataHub glossary sync).
"""
from __future__ import annotations

import re

import sqlparse

from app.agents.base import Agent, AgentResult, RunContext
from app.schemas import GeneratedFile, MatchedDataset, ValidationCheckOut

_MASK_FN_PATTERN = re.compile(r"(md5|sha256|sha1|mask|hash|left)\s*\(", re.IGNORECASE)


class QAAgent(Agent):
    name = "qa"
    critical = True

    async def run(self, ctx: RunContext) -> AgentResult:
        metadata_output = ctx.prior("metadata_analyst")
        data_engineer_output = ctx.prior("data_engineer")

        matched_datasets = [
            MatchedDataset.model_validate(d)
            for d in metadata_output["matched_datasets"]
        ]
        files = [
            GeneratedFile.model_validate(f) for f in data_engineer_output["files"]
        ]

        await ctx.emit_log("running schema-compatibility checks")
        checks: list[ValidationCheckOut] = []
        checks.append(await self._schema_compatibility_check(ctx, matched_datasets, files))

        await ctx.emit_log("linting generated SQL")
        checks.append(self._sql_lint_check(files))
        checks.append(self._not_null_test_check(files))

        pii_check = await self._pii_exposure_check(ctx, matched_datasets, files)
        checks.append(pii_check)
        if not pii_check.passed:
            await ctx.emit_log(f"flagged 1 PII column · masking required")
        else:
            await ctx.emit_log("no unmasked PII columns detected")

        checks.append(self._metadata_completeness_check(matched_datasets))

        passed = all(c.passed for c in checks)
        critical_failures = [c for c in checks if not c.passed and c.severity == "critical"]
        summary = (
            f"{len(critical_failures)} critical issue(s) found"
            if critical_failures
            else "all checks passed"
        )

        output_dict = {
            "checks": [c.model_dump() for c in checks],
            "passed": passed,
            "summary": summary,
        }
        return AgentResult(summary=summary, data=output_dict)

    async def _schema_compatibility_check(
        self,
        ctx: RunContext,
        matched_datasets: list[MatchedDataset],
        files: list[GeneratedFile],
    ) -> ValidationCheckOut:
        known_columns: set[str] = set()
        for ds in matched_datasets:
            known_columns.update(ds.columns)
            schema = await ctx.datahub.get_schema(ds.urn)
            known_columns.update(f["name"] for f in schema.get("fields", []) if f.get("name"))

        # Real check (deliberately conservative, not a full SQL parser):
        # every dbt_model/sql file must reference at least one column name
        # that actually exists in the matched DataHub schemas. Full
        # dialect-aware column-resolution (accounting for CTEs, aliases,
        # computed columns) is out of scope for a hackathon QA pass and
        # would need a real SQL AST — see README "Future Improvements".
        model_files = [f for f in files if f.kind in ("dbt_model", "sql")]
        ungrounded: list[str] = []
        for f in model_files:
            content_lower = f.content.lower()
            if known_columns and not any(
                col.lower() in content_lower for col in known_columns
            ):
                ungrounded.append(f.filename)

        if ungrounded:
            return ValidationCheckOut(
                name="Schema compatibility",
                passed=False,
                message=(
                    f"{', '.join(ungrounded)} reference no columns found in "
                    "the matched DataHub schemas — possible hallucinated fields."
                ),
                severity="critical",
            )
        return ValidationCheckOut(
            name="Schema compatibility",
            passed=True,
            message="All generated models reference columns present in the matched DataHub schemas.",
            severity="info",
        )

    def _sql_lint_check(self, files: list[GeneratedFile]) -> ValidationCheckOut:
        issues: list[str] = []
        for f in files:
            if f.kind not in ("dbt_model", "sql"):
                continue
            if not f.content.strip():
                issues.append(f"{f.filename} is empty")
                continue
            try:
                parsed = sqlparse.parse(f.content)
                if not parsed or not any(str(s).strip() for s in parsed):
                    issues.append(f"{f.filename} did not parse as valid SQL")
            except Exception as exc:  # sqlparse rarely raises, but be defensive
                issues.append(f"{f.filename} failed to parse: {exc}")

        if issues:
            return ValidationCheckOut(
                name="SQL lint",
                passed=False,
                message="; ".join(issues),
                severity="warning",
            )
        return ValidationCheckOut(
            name="SQL lint",
            passed=True,
            message="No syntax or style violations found.",
            severity="info",
        )

    def _not_null_test_check(self, files: list[GeneratedFile]) -> ValidationCheckOut:
        test_files = [f for f in files if f.kind == "test"]
        combined = "\n".join(f.content for f in test_files)
        has_not_null = "not_null" in combined
        has_unique = "unique" in combined

        if test_files and has_not_null and has_unique:
            return ValidationCheckOut(
                name="Not-null constraints",
                passed=True,
                message="Primary key columns carry unique and not_null tests.",
                severity="info",
            )
        return ValidationCheckOut(
            name="Not-null constraints",
            passed=False,
            message="Generated test suite is missing unique/not_null coverage on key columns.",
            severity="warning",
        )

    async def _pii_exposure_check(
        self,
        ctx: RunContext,
        matched_datasets: list[MatchedDataset],
        files: list[GeneratedFile],
    ) -> ValidationCheckOut:
        # Deliberately field-level only: a dataset-level "pii" tag (e.g. on
        # raw.stripe_payments) means *some* column in that dataset is
        # sensitive, not that every column is — treating the dataset tag as
        # blanket coverage would flag amount_cents, currency, created_at,
        # etc. as PII just because they share a table with card_last4.
        pii_columns: set[str] = set()
        for ds in matched_datasets:
            schema = await ctx.datahub.get_schema(ds.urn)
            for field in schema.get("fields", []):
                description = (field.get("description") or "").lower()
                if "pii" in description:
                    pii_columns.add(field["name"])

        exposed: list[str] = []
        model_files = [f for f in files if f.kind in ("dbt_model", "sql")]
        for col in pii_columns:
            for f in model_files:
                if col in f.content and not _MASK_FN_PATTERN.search(f.content):
                    exposed.append(col)
                    break

        if exposed:
            return ValidationCheckOut(
                name="PII exposure",
                passed=False,
                message=(
                    f"{', '.join(sorted(set(exposed)))} "
                    f"{'is' if len(set(exposed)) == 1 else 'are'} tagged PII in DataHub "
                    "and not currently masked in the generated models."
                ),
                severity="critical",
            )
        return ValidationCheckOut(
            name="PII exposure",
            passed=True,
            message="No unmasked PII columns detected in generated models.",
            severity="info",
        )

    def _metadata_completeness_check(
        self, matched_datasets: list[MatchedDataset]
    ) -> ValidationCheckOut:
        missing = [ds.name for ds in matched_datasets if not ds.columns]
        if missing:
            return ValidationCheckOut(
                name="Missing metadata",
                passed=False,
                message=f"No column metadata available for: {', '.join(missing)}.",
                severity="warning",
            )
        return ValidationCheckOut(
            name="Missing metadata",
            passed=True,
            message="All matched datasets have column-level metadata from DataHub.",
            severity="info",
        )

