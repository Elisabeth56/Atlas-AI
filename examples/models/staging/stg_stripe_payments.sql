with source as (
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
