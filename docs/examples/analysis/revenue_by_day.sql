select
    date_trunc('day', created_at) as day,
    count(*) as orders,
    sum(amount_usd) as revenue_usd
from fct_customer_revenue
group by 1
order by 1 desc
limit 30;
