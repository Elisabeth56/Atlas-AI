# fct_customer_revenue

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
