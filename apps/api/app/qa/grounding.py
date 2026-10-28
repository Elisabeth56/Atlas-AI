"""Static grounding for generated dbt SQL: every column must trace back to a catalog dataset.

dbt's ref() and source() calls are swapped for real table names, then sqlglot's qualifier
resolves every column through CTEs, subqueries and aliases against the DataHub schemas.
A column it can't resolve doesn't exist in any source the model reads.

Models are checked in dependency order, so a mart that refs a staging model is checked
against the staging model's actual output columns, not the raw source.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

import sqlglot
from sqlglot import exp
from sqlglot.errors import OptimizeError, ParseError
from sqlglot.optimizer.qualify import qualify
from sqlglot.optimizer.scope import Scope, build_scope

DIALECT = "postgres"
GENERATED_SCHEMA = "atlas"  # where ref() targets live
# Wrapping a PII column in one of these makes the output safe to ship.
MASKING_FUNCTIONS = {"md5", "sha", "sha1", "sha2", "sha256", "sha512", "hash", "mask", "count"}

_REF = re.compile(r"\{\{\s*ref\(\s*['\"]([\w.]+)['\"]\s*\)\s*\}\}")
_SOURCE = re.compile(r"\{\{\s*source\(\s*['\"](\w+)['\"]\s*,\s*['\"](\w+)['\"]\s*\)\s*\}\}")
_CONFIG = re.compile(r"\{\{\s*config\(.*?\)\s*\}\}", re.DOTALL)
_ANY_JINJA = re.compile(r"\{\{|\{%|\{#")
_MISSING = re.compile(r"Unknown column: \"?(\w+)\"?|Column '\"?(\w+)\"?' could not be resolved")


@dataclass
class Table:
    columns: list[str]
    pii: set[str] = field(default_factory=set)


@dataclass
class PiiExposure:
    column: str  # the PII column as named in the file
    output: str  # the output column it reaches
    line: int


@dataclass
class ModelCheck:
    """What grounding found in one generated SQL file."""

    filename: str
    parse_error: str | None = None
    unverifiable: str | None = None
    unknown_tables: list[str] = field(default_factory=list)
    unresolved_columns: list[str] = field(default_factory=list)
    exposed_pii: list[PiiExposure] = field(default_factory=list)
    blocked_by: list[str] = field(default_factory=list)  # upstream models that failed

    @property
    def grounded(self) -> bool:
        return not (
            self.parse_error or self.unverifiable or self.unknown_tables
            or self.unresolved_columns or self.blocked_by
        )


def table_key(dataset_name: str) -> tuple[str, str]:
    """`db.schema.table` and `schema.table` both become (schema, table)."""
    parts = dataset_name.lower().split(".")
    return (parts[-2], parts[-1]) if len(parts) > 1 else ("catalog", parts[0])


def check_models(models: dict[str, str], catalog: dict[tuple[str, str], Table]) -> list[ModelCheck]:
    """Checks every model, upstream first. `models` maps filename → SQL."""
    tables = dict(catalog)
    pending = {_model_name(f): (f, sql) for f, sql in models.items()}
    results: list[ModelCheck] = []
    failed: set[str] = set()

    # a model is ready once every model it refs has been checked
    while pending:
        ready = [
            name for name, (_, sql) in pending.items()
            if not any(dep in pending and dep != name for dep in _REF.findall(sql))
        ]
        if not ready:  # a ref cycle: report it rather than loop forever
            for filename, _ in pending.values():
                results.append(ModelCheck(filename, parse_error="refs form a cycle"))
            break
        for name in ready:
            filename, sql = pending.pop(name)
            check, outputs = _check_model(filename, sql, tables, failed)
            results.append(check)
            if outputs is None:
                failed.add(name.lower())
            else:
                tables[(GENERATED_SCHEMA, name.lower())] = outputs
    return results


def _check_model(
    filename: str, sql: str, tables: dict[tuple[str, str], Table], failed: set[str]
) -> tuple[ModelCheck, Table | None]:
    check = ModelCheck(filename)
    plain, problem = _render(sql, tables)
    if problem:
        check.unverifiable = problem
        return check, None

    try:
        tree = sqlglot.parse_one(plain, read=DIALECT)
    except ParseError as e:
        check.parse_error = str(e).splitlines()[0]
        return check, None

    # unknown tables first: columns can't be checked against a table that isn't there
    ctes = {cte.alias_or_name.lower() for cte in tree.find_all(exp.CTE)}
    _qualify_bare_tables(tree, tables, ctes)
    for t in tree.find_all(exp.Table):
        key = (t.db.lower(), t.name.lower())
        if t.name.lower() in ctes or key in tables:
            continue
        if key[0] == GENERATED_SCHEMA and key[1] in failed:
            check.blocked_by.append(key[1])
        else:
            check.unknown_tables.append(f"{t.db}.{t.name}" if t.db else t.name)
    check.blocked_by = sorted(set(check.blocked_by))
    if check.unknown_tables or check.blocked_by:
        check.unknown_tables = sorted(set(check.unknown_tables))
        return check, None

    qualified, unresolved = _qualify(tree, _mapping_schema(tables))
    check.unresolved_columns = sorted(unresolved)

    root = build_scope(qualified)
    outputs = Table(columns=[s.alias_or_name.lower() for s in qualified.selects])
    for projection in qualified.selects:
        if _touches_pii(projection, root, tables):
            name = projection.alias_or_name.lower()
            outputs.pii.add(name)
            source = _source_name(projection)
            check.exposed_pii.append(PiiExposure(source, name, _line_of(sql, source)))
    return check, outputs


def _render(sql: str, tables: dict[tuple[str, str], Table]) -> tuple[str, str | None]:
    """Replaces ref()/source() with table names. Returns a problem if other Jinja remains."""
    by_table = {name: (schema, name) for schema, name in tables}
    by_table.update({f"{schema}_{name}": (schema, name) for schema, name in tables})  # source('stripe', 'raw_stripe_payments')

    def source(m: re.Match) -> str:
        schema, name = m.group(1).lower(), m.group(2).lower()
        if (schema, name) in tables:
            return f"{schema}.{name}"
        if name in by_table:  # dbt source names often differ from the DataHub schema
            return ".".join(by_table[name])
        return f"{schema}.{name}"  # left unresolved on purpose: reported as an unknown table

    out = _CONFIG.sub("", sql)
    out = _SOURCE.sub(source, out)
    out = _REF.sub(lambda m: f"{GENERATED_SCHEMA}.{m.group(1).lower()}", out)
    if _ANY_JINJA.search(out):
        return out, "uses Jinja beyond ref() and source(), so its columns can't be checked statically"
    return out, None


def _qualify_bare_tables(tree: exp.Expression, tables: dict[tuple[str, str], Table], ctes: set[str]) -> None:
    """`from customers` reads public.customers when exactly one catalog table has that name."""
    schemas: dict[str, list[str]] = {}
    for schema, name in tables:
        schemas.setdefault(name, []).append(schema)
    for t in tree.find_all(exp.Table):
        name = t.name.lower()
        if not t.db and name not in ctes and len(schemas.get(name, [])) == 1:
            t.set("db", exp.to_identifier(schemas[name][0]))


def _mapping_schema(tables: dict[tuple[str, str], Table]) -> dict[str, dict[str, dict[str, str]]]:
    schema: dict[str, dict[str, dict[str, str]]] = {}
    for (db, name), table in tables.items():
        schema.setdefault(db, {})[name] = {c: "VARCHAR" for c in table.columns}
    return schema


def _qualify(tree: exp.Expression, schema: dict) -> tuple[exp.Expression, set[str]]:
    """Qualifies every column, collecting the ones that don't exist instead of stopping at the first.

    sqlglot raises on a qualified column missing from its table (`p.refund_reason`), so each one
    found is recorded, swapped for NULL, and qualification runs again.
    """
    unresolved: set[str] = set()
    for _ in range(50):
        try:
            qualified = qualify(
                tree.copy(), schema=schema, dialect=DIALECT,
                validate_qualify_columns=False, quote_identifiers=False,
            )
            return qualified, unresolved | _unqualified(qualified)
        except OptimizeError as e:
            match = _MISSING.search(str(e))
            if not match:
                raise
            name = (match.group(1) or match.group(2)).lower()
            unresolved.add(name)
            for col in list(tree.find_all(exp.Column)):
                if col.name.lower() == name:
                    in_select_list = isinstance(col.parent, exp.Select)
                    col.replace(exp.alias_(exp.Null(), name) if in_select_list else exp.Null())
    raise OptimizeError("too many unresolved columns to report")


def _unqualified(tree: exp.Expression) -> set[str]:
    """Columns the qualifier couldn't tie to a table, minus ORDER BY / GROUP BY output aliases."""
    missing = set()
    for col in tree.find_all(exp.Column):
        if col.table:
            continue
        select = col.find_ancestor(exp.Select)
        aliases = {s.alias_or_name.lower() for s in select.selects} if select else set()
        if col.find_ancestor(exp.Order, exp.Group, exp.Having) and col.name.lower() in aliases:
            continue
        missing.add(col.name.lower())
    return missing


def _touches_pii(node: exp.Expression, scope: Scope, tables: dict[tuple[str, str], Table]) -> bool:
    """True if the expression carries a PII value through unmasked."""
    if isinstance(node, exp.Func) and _func_name(node) in MASKING_FUNCTIONS:
        return False
    if isinstance(node, exp.Column):
        return _column_is_pii(node, scope, tables)
    return any(_touches_pii(child, scope, tables) for child in node.iter_expressions())


def _column_is_pii(col: exp.Column, scope: Scope, tables: dict[tuple[str, str], Table]) -> bool:
    source = scope.sources.get(col.table)
    if isinstance(source, exp.Table):
        table = tables.get((source.db.lower(), source.name.lower()))
        return bool(table) and col.name.lower() in table.pii
    if isinstance(source, Scope):  # a CTE or subquery: follow the column into it
        for projection in source.expression.selects:
            if projection.alias_or_name.lower() == col.name.lower():
                return _touches_pii(projection, source, tables)
    return False


def _func_name(node: exp.Func) -> str:
    return (node.name if isinstance(node, exp.Anonymous) else node.sql_name()).lower()


def _source_name(projection: exp.Expression) -> str:
    """The column name to point at in the original file (the one inside an alias)."""
    col = projection.find(exp.Column)
    return col.name if col else projection.alias_or_name


def _line_of(sql: str, name: str) -> int:
    pattern = re.compile(rf"\b{re.escape(name)}\b", re.IGNORECASE)
    lines = sql.splitlines()
    # the last select list is where outputs are named, so search from the bottom up
    for i in range(len(lines) - 1, -1, -1):
        if pattern.search(lines[i]):
            return i + 1
    return 1


def _model_name(filename: str) -> str:
    return filename.rsplit("/", 1)[-1].removesuffix(".sql")


def parse_errors(models: dict[str, str]) -> dict[str, str]:
    """Syntax-only check for ungrounded runs: filename → first parse error."""
    errors = {}
    for filename, sql in models.items():
        plain, problem = _render(sql, {})
        if problem:
            continue
        try:
            sqlglot.parse_one(plain, read=DIALECT)
        except ParseError as e:
            errors[filename] = str(e).splitlines()[0]
    return errors


def tables_read(models: dict[str, str]) -> set[tuple[str, str]]:
    """The source tables the models read, as (schema, table); generated models and CTEs are left out."""
    found: set[tuple[str, str]] = set()
    for sql in models.values():
        plain, problem = _render(sql, {})
        if problem:
            continue
        try:
            tree = sqlglot.parse_one(plain, read=DIALECT)
        except ParseError:
            continue
        ctes = {cte.alias_or_name.lower() for cte in tree.find_all(exp.CTE)}
        for t in tree.find_all(exp.Table):
            if t.name.lower() not in ctes and t.db.lower() != GENERATED_SCHEMA:
                found.add((t.db.lower(), t.name.lower()))
    return found
