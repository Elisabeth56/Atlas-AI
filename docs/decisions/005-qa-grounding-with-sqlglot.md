# 005. QA grounding: resolve every column with sqlglot, and QA gates writeback

Status: accepted · 2026-10-26

## Context
The project's main claim is that generated SQL only uses real columns. The old check passed a file if it contained *any* known column name as a substring. It passed automatically when no datasets were matched ("start fresh"). QA also returned `passed: false` as data without blocking anything, so writeback could be approved with unmasked PII still in the output.

## Decision
- Parse each model with `sqlglot`, after replacing dbt Jinja (`ref`, `source`) with placeholder table names.
- Resolve every column reference through CTEs and aliases back to a source table. Check it against that dataset's schema from DataHub. An unresolved column is a critical failure that names the file and the column.
- With no grounding, the check reports "ungrounded" as a warning instead of passing.
- PII masking is checked per column, at the select where the column is used, not by looking for a masking function anywhere in the file.
- Any critical failure sets `validation_reports.blocking = true`. Writeback approval then returns 409, and the UI shows why.

## Alternatives rejected
- **LLM judge.** Its verdict changes from run to run. QA has to give the same answer for the same input.
- **`dbt compile` and run on DuckDB with sample rows.** The strongest proof that the SQL runs, but it needs dbt-core in the image and synthetic data. Stretch goal after a 2-hour spike.

## Consequences
- dbt Jinja beyond `ref` and `source` (macros, loops) won't parse. These are reported as "unverifiable", not passed.
- This module is the one the project is known for. Elisabeth writes it herself (see the build plan).

## At 10x
Pure CPU work, in milliseconds per file. It doesn't limit throughput.

## Revisit when
Users generate macro-heavy dbt projects that sqlglot can't parse after Jinja is stripped.
