"""Deterministic patches for QA findings. The same finding always gets the same fix, with no model involved."""
from __future__ import annotations

import hashlib
import re
from dataclasses import asdict, dataclass

from app.qa.grounding import PiiExposure


@dataclass(frozen=True)
class Fix:
    id: str
    file: str
    line: int
    column: str
    before: str
    after: str
    applied: bool = False

    def as_dict(self) -> dict:
        return asdict(self)


class StaleFix(Exception):
    """The line the fix targets has changed since QA suggested it."""


def fix_id(filename: str, column: str) -> str:
    return hashlib.sha1(f"{filename}:{column.lower()}".encode()).hexdigest()[:12]


def suggest_mask(filename: str, sql: str, exposure: PiiExposure) -> Fix | None:
    """Hashes the column where it's selected: `card_last4,` becomes `md5(card_last4) as card_last4_hash,`.

    Only a line holding nothing but that column (optionally qualified and aliased) gets a fix;
    anything more involved is left to a person, and the finding still blocks.
    """
    lines = sql.splitlines()
    if not 1 <= exposure.line <= len(lines):
        return None
    before = lines[exposure.line - 1]
    shape = re.compile(
        rf"^(?P<indent>\s*)(?P<ref>(?:\w+\.)?{re.escape(exposure.column)})"
        rf"(?:\s+as\s+(?P<alias>\w+))?(?P<trail>\s*,?\s*)$",
        re.IGNORECASE,
    )
    m = shape.match(before)
    if not m:
        return None
    alias = m["alias"] or f"{exposure.column}_hash"
    after = f"{m['indent']}md5({m['ref']}) as {alias}{m['trail']}"
    return Fix(fix_id(filename, exposure.column), filename, exposure.line, exposure.column, before, after)


def apply(sql: str, fix: Fix) -> str:
    lines = sql.split("\n")
    if lines[fix.line - 1] != fix.before:
        raise StaleFix(f"{fix.file} line {fix.line} has changed")
    lines[fix.line - 1] = fix.after
    return "\n".join(lines)
