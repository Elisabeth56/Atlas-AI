"""
Demo fixture data — pre-built, schema-valid outputs for each agent,
consumed by `MockLLMProvider`. Content deliberately echoes the frontend's
own mock data (`lib/api.ts`) and stage narration (`lib/pipeline.ts`) so
demo mode feels coherent end-to-end even before the real Groq + DataHub
integrations are exercised.

Scenario: "Build a customer revenue pipeline from raw Stripe and
Postgres events" — the fixed DEMO_PROMPT baked into the frontend's
/demo page.
"""
from __future__ import annotations

from app.schemas import (
    DataEngineerOutput,
    DocumentationOutput,
    GeneratedFile,
    MatchedDataset,
    MetadataAnalystOutput,
    PlannerOutput,
    QAOutput,
    ValidationCheckOut,
    WritebackOutput,
)

PLANNER_OUTPUT = PlannerOutput(
    goal="Build a customer revenue pipeline joining Stripe payments with Postgres customers and orders",
    entities=["revenue", "customer", "orders", "payments"],
    summary="identified target entities: revenue, customer, orders, payments",
)

_MATCHED_DATASETS = [
    MatchedDataset(
        urn="urn:li:dataset:(urn:li:dataPlatform:stripe,raw.stripe_payments,PROD)",
        name="raw.stripe_payments",
        platform="stripe",
        confidence=0.94,
        columns=["payment_id", "customer_id", "amount_cents", "currency", "card_last4", "created_at"],
        owners=["data-platform@atlas.ai"],
        tags=["pii", "finance"],
    ),
    MatchedDataset(
        urn="urn:li:dataset:(urn:li:dataPlatform:postgres,public.customers,PROD)",
        name="public.customers",
        platform="postgres",
        confidence=0.91,
        columns=["customer_id", "customer_name", "email", "signup_at", "plan_tier"],
        owners=["backend-team@atlas.ai"],
        tags=["core"],
    ),
    MatchedDataset(
        urn="urn:li:dataset:(urn:li:dataPlatform:postgres,public.orders,PROD)",
        name="public.orders",
        platform="postgres",
        confidence=0.89,
        columns=["order_id", "customer_id", "payment_id", "order_total", "created_at"],
        owners=["backend-team@atlas.ai"],
        tags=["core", "finance"],
    ),
]

METADATA_ANALYST_OUTPUT = MetadataAnalystOutput(
    matched_datasets=_MATCHED_DATASETS,
    reasoning=(
        "Matched three datasets against the target entities using name, "
        "tag and lineage signals: raw.stripe_payments covers the payments "
        "entity, public.customers covers customer, and public.orders "
        "already links both via foreign keys, making it the natural join "
        "spine for the revenue fact table."
    ),
    summary="matched raw.stripe_payments, public.customers, public.orders · confidence 0.89-0.94",
)

_STG_STRIPE_PAYMENTS = GeneratedFile(
    kind="dbt_model",
    filename="models/staging/stg_stripe_payments.sql",
    content="""with source as (
    select * from {{ source('stripe', 'raw_stripe_payments') }}
)

select
    payment_id,
    customer_id,
    amount_cents / 100.0 as amount_usd,
    currency,
    card_last4,
    created_at
from source
""",
)

_STG_POSTGRES_CUSTOMERS = GeneratedFile(
    kind="dbt_model",
    filename="models/staging/stg_postgres_customers.sql",
    content="""with source as (
    select * from {{ source('postgres', 'customers') }}
)

select
    customer_id,
    customer_name,
    email,
    signup_at,
    plan_tier
from source
""",
)

_FCT_CUSTOMER_REVENUE = GeneratedFile(
    kind="dbt_model",
    filename="models/marts/fct_customer_revenue.sql",
    content="""with payments as (
    select * from {{ ref('stg_stripe_payments') }}
),
customers as (
    select * from {{ ref('stg_postgres_customers') }}
),
orders as (
    select * from {{ source('postgres', 'orders') }}
)

select
    o.order_id,
    o.customer_id,
    c.customer_name,
    c.plan_tier,
    p.amount_usd,
    p.currency,
    o.created_at
from orders o
left join customers c on o.customer_id = c.customer_id
left join payments p on o.payment_id = p.payment_id
""",
)

_ADHOC_SQL = GeneratedFile(
    kind="sql",
    filename="analysis/revenue_by_day.sql",
    content="""select
    date_trunc('day', created_at) as day,
    count(*) as orders,
    sum(amount_usd) as revenue_usd
from fct_customer_revenue
group by 1
order by 1 desc
limit 30;
""",
)

_SCHEMA_TESTS = GeneratedFile(
    kind="test",
    filename="models/marts/schema.yml",
    content="""version: 2
models:
  - name: fct_customer_revenue
    columns:
      - name: order_id
        tests: [unique, not_null]
      - name: customer_id
        tests: [not_null]
      - name: amount_usd
        tests:
          - dbt_utils.accepted_range:
              min_value: 0
""",
)

_CONFIG_FILE = GeneratedFile(
    kind="config",
    filename="dbt_project.yml",
    content="""models:
  atlas:
    staging:
      +materialized: view
      +schema: staging
    marts:
      +materialized: table
      +schema: analytics
      +tags: ['revenue', 'atlas-generated']
""",
)

DATA_ENGINEER_OUTPUT = DataEngineerOutput(
    files=[
        _STG_STRIPE_PAYMENTS,
        _STG_POSTGRES_CUSTOMERS,
        _FCT_CUSTOMER_REVENUE,
        _ADHOC_SQL,
        _SCHEMA_TESTS,
        _CONFIG_FILE,
    ],
    summary="generated 3 models, 1 ad-hoc query, 1 test suite, 1 config",
)

_QA_CHECKS = [
    ValidationCheckOut(
        name="Schema compatibility",
        passed=True,
        message="fct_customer_revenue matches the registered DataHub schema.",
        severity="info",
    ),
    ValidationCheckOut(
        name="SQL lint",
        passed=True,
        message="No syntax or style violations found.",
        severity="info",
    ),
    ValidationCheckOut(
        name="Not-null constraints",
        passed=True,
        message="order_id and customer_id pass not-null checks on sample data.",
        severity="info",
    ),
    ValidationCheckOut(
        name="PII exposure",
        passed=False,
        message="card_last4 is tagged PII in DataHub and is not currently masked in this model.",
        severity="critical",
    ),
    ValidationCheckOut(
        name="Missing metadata",
        passed=True,
        message="All columns have descriptions synced from DataHub glossary.",
        severity="warning",
    ),
]

QA_OUTPUT = QAOutput(
    checks=_QA_CHECKS,
    passed=False,
    summary="flagged 1 PII column · masking required",
)

_DATA_DICTIONARY = GeneratedFile(
    kind="doc",
    filename="docs/fct_customer_revenue.md",
    content="""# fct_customer_revenue

Grain: one row per order.

| Column | Description |
|---|---|
| order_id | Primary key |
| customer_id | FK to dim_customer |
| customer_name | Denormalized for reporting |
| plan_tier | Subscription tier at time of order |
| amount_usd | Payment amount in USD |
| currency | ISO currency code |
| created_at | Order timestamp (UTC) |

Source: stg_stripe_payments (Stripe), stg_postgres_customers (Postgres), orders (Postgres).
Owner: data-platform@atlas.ai
""",
)

_README = GeneratedFile(
    kind="doc",
    filename="README.md",
    content="""# Customer Revenue Pipeline

Generated by Atlas AI from the prompt:
"Build a customer revenue pipeline from raw Stripe and Postgres events"

## Models
- `stg_stripe_payments` — cleaned Stripe payment events
- `stg_postgres_customers` — cleaned Postgres customer records
- `fct_customer_revenue` — order-grain revenue fact table

## Known issues
- `card_last4` is flagged as PII and is not yet masked — see validation report.
""",
)

DOCUMENTATION_OUTPUT = DocumentationOutput(
    files=[_DATA_DICTIONARY, _README],
    summary="generated data dictionary and README",
)

WRITEBACK_OUTPUT = WritebackOutput(
    urns_updated=[ds.urn for ds in _MATCHED_DATASETS],
    lineage_edges_added=2,
    summary="upserted metadata to DataHub · emitted 2 lineage edges",
)


def mock_llm_fixtures() -> dict[str, object]:
    """Registry consumed by MockLLMProvider — keyed by output schema name."""
    return {
        "PlannerOutput": PLANNER_OUTPUT,
        "MetadataAnalystOutput": METADATA_ANALYST_OUTPUT,
        "DataEngineerOutput": DATA_ENGINEER_OUTPUT,
        "QAOutput": QA_OUTPUT,
        "DocumentationOutput": DOCUMENTATION_OUTPUT,
        "WritebackOutput": WRITEBACK_OUTPUT,
    }
