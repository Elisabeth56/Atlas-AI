"""QA fixes are deterministic line patches; anything unusual gets no fix rather than a guess."""
from __future__ import annotations

import pytest

from app.qa.fixes import StaleFix, apply, suggest_mask
from app.qa.grounding import PiiExposure

SQL = "select\n    payment_id,\n    p.card_last4,\n    email as contact\nfrom source\n"


def test_bare_column_is_hashed_under_a_new_name():
    fix = suggest_mask("stg.sql", SQL, PiiExposure(column="card_last4", output="card_last4", line=3))

    assert (fix.before, fix.after) == ("    p.card_last4,", "    md5(p.card_last4) as card_last4_hash,")
    assert "md5(p.card_last4) as card_last4_hash," in apply(SQL, fix)


def test_alias_is_kept():
    fix = suggest_mask("stg.sql", SQL, PiiExposure(column="email", output="contact", line=4))

    assert fix.after == "    md5(email) as contact"


def test_expression_lines_get_no_fix():
    sql = "select\n    upper(card_last4) || 'x' as c\nfrom t\n"

    assert suggest_mask("m.sql", sql, PiiExposure(column="card_last4", output="c", line=2)) is None


def test_same_finding_same_fix_id():
    a = suggest_mask("stg.sql", SQL, PiiExposure(column="card_last4", output="card_last4", line=3))
    b = suggest_mask("stg.sql", SQL, PiiExposure(column="CARD_LAST4", output="card_last4", line=3))

    assert a.id == b.id


def test_changed_line_is_refused():
    fix = suggest_mask("stg.sql", SQL, PiiExposure(column="card_last4", output="card_last4", line=3))

    with pytest.raises(StaleFix):
        apply(SQL.replace("p.card_last4", "p.card_last4_raw"), fix)
