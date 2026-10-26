"""Grounding resolves every column to a catalog dataset and follows PII through the SQL."""
from __future__ import annotations

from app.qa.grounding import Table, check_models

CATALOG = {
    ("raw", "stripe_payments"): Table(
        ["payment_id", "customer_id", "amount_cents", "currency", "card_last4", "created_at"], {"card_last4"}
    ),
    ("public", "customers"): Table(["customer_id", "customer_name", "email", "plan_tier"], {"customer_name", "email"}),
}

STAGING = """with source as (
    select * from {{ source('raw', 'stripe_payments') }}
)
select
    payment_id,
    customer_id,
    amount_cents / 100.0 as amount_usd,
    md5(card_last4) as card_hash
from source
"""


def one(sql: str, catalog=CATALOG):
    return check_models({"models/m.sql": sql}, catalog)[0]


def test_invented_column_is_reported():
    result = one("select payment_id, refund_reason from {{ source('raw', 'stripe_payments') }}")
    assert result.unresolved_columns == ["refund_reason"]
    assert not result.grounded


def test_every_invented_column_is_reported_not_just_the_first():
    result = one(
        "with p as (select * from {{ source('raw', 'stripe_payments') }}) "
        "select p.refund_reason, p.payment_id, ghost from p"
    )
    assert result.unresolved_columns == ["ghost", "refund_reason"]


def test_columns_resolve_through_ctes_and_aliases():
    result = one(
        "with p as (select payment_id as id, amount_cents as cents from {{ source('raw', 'stripe_payments') }}) "
        "select x.id, x.cents * 2 as doubled from p as x order by doubled"
    )
    assert result.grounded
    assert result.unresolved_columns == []


def test_mart_is_checked_against_the_staging_models_real_outputs():
    mart = (
        "with p as (select * from {{ ref('stg_payments') }}) "
        "select payment_id, amount_usd, amount_cents from p"
    )
    results = check_models(
        {"models/marts/fct.sql": mart, "models/staging/stg_payments.sql": STAGING}, CATALOG
    )
    by_file = {r.filename: r for r in results}
    # amount_cents exists in the raw source but the staging model doesn't output it
    assert by_file["models/marts/fct.sql"].unresolved_columns == ["amount_cents"]
    assert by_file["models/staging/stg_payments.sql"].grounded


def test_source_outside_the_catalog_is_an_unknown_table():
    result = one("select id from {{ source('stripe', 'refunds') }}")
    assert result.unknown_tables == ["stripe.refunds"]


def test_downstream_of_a_failed_model_is_blocked_not_blamed():
    results = check_models(
        {
            "models/staging/stg.sql": "select * from {{ source('stripe', 'refunds') }}",
            "models/marts/fct.sql": "select * from {{ ref('stg') }}",
        },
        CATALOG,
    )
    fct = next(r for r in results if r.filename.endswith("fct.sql"))
    assert fct.blocked_by == ["stg"]
    assert fct.unknown_tables == []


def test_unmasked_pii_is_exposed_with_its_line():
    sql = "select\n    payment_id,\n    card_last4\nfrom {{ source('raw', 'stripe_payments') }}"
    result = one(sql)
    assert [(e.column, e.line) for e in result.exposed_pii] == [("card_last4", 3)]


def test_pii_is_followed_through_renames_ctes_and_refs():
    staging = "select payment_id, card_last4 as last4 from {{ source('raw', 'stripe_payments') }}"
    mart = "with s as (select last4 as digits from {{ ref('stg') }}) select digits from s"
    results = check_models({"models/stg.sql": staging, "models/fct.sql": mart}, CATALOG)
    exposed = {r.filename: [e.output for e in r.exposed_pii] for r in results}
    assert exposed == {"models/stg.sql": ["last4"], "models/fct.sql": ["digits"]}


def test_hashing_or_counting_masks_pii_but_lower_does_not():
    result = one(
        "select md5(email) as h, count(distinct email) as n, lower(email) as e "
        "from {{ source('public', 'customers') }} group by 3"
    )
    assert [e.output for e in result.exposed_pii] == ["e"]


def test_select_star_from_a_pii_source_is_an_exposure():
    result = one("select * from {{ source('public', 'customers') }}")
    assert sorted(e.output for e in result.exposed_pii) == ["customer_name", "email"]


def test_jinja_beyond_ref_and_source_is_unverifiable_not_passed():
    result = one("select {% if true %} payment_id {% endif %} from {{ source('raw', 'stripe_payments') }}")
    assert result.unverifiable
    assert not result.grounded


def test_config_block_is_ignored():
    result = one("{{ config(materialized='table') }}\nselect payment_id from {{ source('raw', 'stripe_payments') }}")
    assert result.grounded


def test_unparseable_sql_is_reported():
    assert one("selec payment_id frm").parse_error
