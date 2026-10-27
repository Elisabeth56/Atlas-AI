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

## As built (Oct 2026)
- Ground truth is the schema DataHub returns at QA time (one `get_schema` per dataset, concurrently), not the column list in the metadata analyst's output, which is itself LLM-written.
- Models are checked in `ref()` order, so a mart is checked against its staging model's real output columns. A model downstream of a failed one is reported as blocked, not blamed.
- `source(schema, table)` resolves by exact catalog name, then by table name alone. Anything else is an unknown table.
- Masking functions: md5, sha*, hash, mask, and count (a count of PII is not PII). Any other function, `lower()` included, still carries PII through.

## Consequences
- dbt Jinja beyond `ref` and `source` (macros, loops) won't parse. These are reported as "unverifiable", not passed.
- This module is the one the project is known for. Elisabeth writes it herself (see the build plan).

## At 10x
Pure CPU work, in milliseconds per file. It doesn't limit throughput.

## Revisit when
Users generate macro-heavy dbt projects that sqlglot can't parse after Jinja is stripped.

## Fixes (#31)
- For each PII exposure, QA suggests a line patch when the line holds just that column: `card_last4,` becomes `md5(card_last4) as card_last4_hash,`. Anything more complex gets no suggestion and still blocks, so QA never guesses at SQL it can't read with confidence.
- The fix id is a hash of file and column, so the same finding always has the same id.
- `POST /runs/{id}/fixes/{fix_id}/apply` works only at the writeback checkpoint. In one transaction holding the run's row lock, it patches the artifact and the data engineer's stored output, then re-runs QA with a provider that refuses to be called. Applying a fix twice is a no-op. If the line changed underneath, the response is `fix_stale`.
- Documentation isn't regenerated after a fix. The docs keep the old column name until a later run.
