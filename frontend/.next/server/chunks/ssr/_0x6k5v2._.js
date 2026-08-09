module.exports=[93740,a=>{"use strict";var b=a.i(87924),c=a.i(38246),d=a.i(50944),e=a.i(71215),f=a.i(19107);let g=[{label:"Control center",href:"/dashboard",icon:e.Image},{label:"Running agents",href:"/agents",icon:e.Image}];a.s(["AppSubNav",0,function({crumb:a}){let e=(0,d.usePathname)();return(0,b.jsxs)("header",{className:"border-b border-border-hairline bg-bg-base",children:[(0,b.jsx)("div",{className:"flex items-center justify-between px-6 py-2 text-[12px] text-text-muted lg:px-10",children:(0,b.jsxs)("span",{className:"font-mono-atlas",children:["/ ",a]})}),(0,b.jsxs)("div",{className:"flex items-center justify-between border-t border-border-hairline px-6 py-3.5 lg:px-10",children:[(0,b.jsxs)("div",{className:"flex items-center gap-6",children:[(0,b.jsxs)(c.default,{href:"/",className:"flex items-center gap-2.5",children:[(0,b.jsx)("span",{className:"flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-white",children:"A"}),(0,b.jsxs)("span",{className:"text-[14px] font-semibold text-text-heading",children:["Atlas ",(0,b.jsx)("span",{className:"text-accent",children:"AI"})]})]}),(0,b.jsx)("nav",{className:"flex items-center gap-1",children:g.map(a=>{let d=e===a.href,f=a.icon;return(0,b.jsxs)(c.default,{href:a.href,className:`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] transition-colors ${d?"bg-bg-card text-text-heading":"text-text-body hover:text-text-heading"}`,children:[(0,b.jsx)(f,{className:"h-3.5 w-3.5"}),a.label]},a.href)})})]}),(0,b.jsxs)(c.default,{href:"/",className:"flex items-center gap-1.5 text-[13px] text-text-body transition-colors hover:text-text-heading",children:[(0,b.jsx)(f.ArrowLeft,{className:"h-3.5 w-3.5"}),"Back to site"]})]})]})}])},53250,a=>{"use strict";let b=process.env.NEXT_PUBLIC_API_URL??"",c=b.length>0;async function d(a){let c=await fetch(`${b}${a}`);if(!c.ok)throw Error(`${c.status} ${c.statusText} on ${a}`);return c.json()}async function e(a){return c?d(`/api/requests/${a}/artifacts`):(await h(400),{request_id:a,dbt_models:`-- models/marts/fct_revenue.sql
with orders as (
    select * from {{ ref('stg_orders') }}
),
customers as (
    select * from {{ ref('stg_customers') }}
)

select
    o.order_id,
    o.customer_id,
    c.customer_name,
    o.order_total,
    o.created_at
from orders o
left join customers c on o.customer_id = c.customer_id`,sql:`-- ad-hoc validation query
select
    date_trunc('day', created_at) as day,
    count(*) as orders,
    sum(order_total) as revenue
from fct_revenue
group by 1
order by 1 desc
limit 30;`,tests:`# tests/schema.yml
version: 2
models:
  - name: fct_revenue
    columns:
      - name: order_id
        tests: [unique, not_null]
      - name: customer_id
        tests: [not_null]
      - name: order_total
        tests:
          - dbt_utils.accepted_range:
              min_value: 0`,docs:`# fct_revenue

Grain: one row per order.

| Column | Description |
|---|---|
| order_id | Primary key |
| customer_id | FK to dim_customer |
| customer_name | Denormalized for reporting |
| order_total | Order value in USD |
| created_at | Order timestamp (UTC) |

Source: stg_orders (Stripe), stg_customers (Postgres).
Owner: data-platform@atlas.ai`,configs:`# dbt_project.yml (excerpt)
models:
  atlas:
    marts:
      +materialized: table
      +schema: analytics
      +tags: ['revenue', 'atlas-generated']`})}async function f(a){return c?d(`/api/requests/${a}/validation`):(await h(400),{request_id:a,passed:!1,checks:[{name:"Schema compatibility",passed:!0,message:"fct_revenue matches the registered DataHub schema.",severity:"info"},{name:"SQL lint",passed:!0,message:"No syntax or style violations found.",severity:"info"},{name:"Not-null constraints",passed:!0,message:"order_id and customer_id pass not-null checks on sample data.",severity:"info"},{name:"PII exposure",passed:!1,message:"customer_name is tagged PII in DataHub and is not currently masked in this model.",severity:"critical"},{name:"Missing metadata",passed:!0,message:"All columns have descriptions synced from DataHub glossary.",severity:"warning"}]})}async function g(a){if(c){let c=await fetch(`${b}/api/requests`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt:a})});if(!c.ok)throw Error(`${c.status} ${c.statusText}`);return c.json()}return{request_id:Math.random().toString(36).slice(2,8)}}function h(a){return new Promise(b=>setTimeout(b,a))}a.s(["HAS_BACKEND",0,c,"createRequest",0,g,"getArtifacts",0,e,"getValidationReport",0,f,"streamUrl",0,function(a){let c=b.replace(/^http/,"ws")||"ws://localhost:8000";return`${c}/api/requests/${a}/stream`}])},83915,a=>{"use strict";a.s(["DEMO_PROMPT",0,"Build a customer revenue pipeline from raw Stripe and Postgres events","PIPELINE",0,[{id:"planner",name:"Planner",role:"Parsing intent into an engineering goal",logs:["parsing prompt into engineering goal","identified target entities: revenue, customer, orders"]},{id:"metadata_analyst",name:"Metadata Analyst",role:"Searching DataHub for matching datasets",logs:["searching DataHub for candidate datasets","matched fct_orders, dim_customer · confidence 0.94","pulled schema, lineage, owners, contracts"]},{id:"data_engineer",name:"Data Engineer",role:"Generating the dbt model and SQL",logs:["drafting dbt model against retrieved schema","applying data contract constraints","generated 3 models, 2 tests"]},{id:"qa",name:"QA Agent",role:"Validating schema and flagging risk",logs:["running schema-compatibility checks","linting generated SQL","flagged 1 PII column · masking required"]},{id:"documentation",name:"Documentation Agent",role:"Writing the data dictionary and README",logs:["generating data dictionary","writing README from DataHub context"]},{id:"writeback",name:"Write-back",role:"Pushing lineage and docs to DataHub",logs:["upserting metadata to DataHub","emitting lineage edges","run complete · artifacts ready"]}]])},19107,a=>{"use strict";let b=(0,a.i(64831).default)("arrow-left",[["path",{d:"m12 19-7-7 7-7",key:"1l729n"}],["path",{d:"M19 12H5",key:"x3x0zl"}]]);a.s(["ArrowLeft",0,b],19107)},71215,a=>{"use strict";let b=(0,a.i(64831).default)("image",[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",ry:"2",key:"1m3agn"}],["circle",{cx:"9",cy:"9",r:"2",key:"af1f0g"}],["path",{d:"m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21",key:"1xmnt7"}]]);a.s(["Image",0,b],71215)},69789,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0});var d={actionAsyncStorage:function(){return f.actionAsyncStorage},workAsyncStorage:function(){return g.workAsyncStorage},workUnitAsyncStorage:function(){return h.workUnitAsyncStorage}};for(var e in d)Object.defineProperty(c,e,{enumerable:!0,get:d[e]});let f=a.r(20635),g=a.r(56704),h=a.r(32319);("function"==typeof c.default||"object"==typeof c.default&&null!==c.default)&&void 0===c.default.__esModule&&(Object.defineProperty(c.default,"__esModule",{value:!0}),Object.assign(c.default,c),b.exports=c.default)}];

//# sourceMappingURL=_0x6k5v2._.js.map