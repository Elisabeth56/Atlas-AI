with payments as (
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
