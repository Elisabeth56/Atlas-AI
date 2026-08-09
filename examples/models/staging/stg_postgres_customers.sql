with source as (
    select * from {{ source('postgres', 'customers') }}
)

select
    customer_id,
    customer_name,
    email,
    signup_at,
    plan_tier
from source
