module.exports=[80517,a=>{"use strict";var b=a.i(87924),c=a.i(72131),d=a.i(50944),e=a.i(38246),f=a.i(19107),g=a.i(75160),h=a.i(93740),i=a.i(13412),j=a.i(64831);let k=(0,j.default)("triangle-alert",[["path",{d:"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",key:"wmoenq"}],["path",{d:"M12 9v4",key:"juzpu7"}],["path",{d:"M12 17h.01",key:"p32p05"}]]),l=(0,j.default)("circle-x",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m15 9-6 6",key:"1uzhvr"}],["path",{d:"m9 9 6 6",key:"z0biqf"}]]),m={info:{icon:i.CheckCircle2,cls:"text-accent"},warning:{icon:k,cls:"text-[#cfa53c]"},critical:{icon:l,cls:"text-accent"}};function n({report:a}){return(0,b.jsxs)("div",{children:[(0,b.jsxs)("div",{className:`card-atlas flex items-center gap-3 p-5 ${a.passed?"":"border-accent-dim-border"}`,children:[a.passed?(0,b.jsx)(i.CheckCircle2,{className:"h-6 w-6 flex-shrink-0 text-accent"}):(0,b.jsx)(l,{className:"h-6 w-6 flex-shrink-0 text-accent"}),(0,b.jsxs)("div",{children:[(0,b.jsx)("p",{className:"text-[15px] font-semibold text-text-heading",children:a.passed?"All checks passed":"Action required before write-back"}),(0,b.jsxs)("p",{className:"text-[13px] text-text-body",children:[a.checks.filter(a=>a.passed).length," of ",a.checks.length," checks passed"]})]})]}),(0,b.jsx)("div",{className:"mt-5 space-y-3",children:a.checks.map(a=>{let c=m[a.severity],d=c.icon;return(0,b.jsxs)("div",{className:"card-atlas flex items-start gap-3 p-4",children:[(0,b.jsx)(d,{className:`mt-0.5 h-4 w-4 flex-shrink-0 ${c.cls}`}),(0,b.jsxs)("div",{children:[(0,b.jsx)("p",{className:"text-[14px] font-medium text-text-heading",children:a.name}),(0,b.jsx)("p",{className:"mt-0.5 text-[13px] leading-relaxed text-text-body",children:a.message})]})]},a.name)})})]})}var o=a.i(53250);a.s(["default",0,function(){let a=(0,d.useParams)(),[i,j]=(0,c.useState)(null),[k,l]=(0,c.useState)(null);return(0,c.useEffect)(()=>{let b=!1;return(0,o.getValidationReport)(a.runId).then(a=>!b&&j(a)).catch(a=>!b&&l(String(a))),()=>{b=!0}},[a.runId]),(0,b.jsxs)(b.Fragment,{children:[(0,b.jsx)(h.AppSubNav,{crumb:`agents/${a.runId}/validation`}),(0,b.jsx)("main",{className:"flex-1 bg-bg-base",children:(0,b.jsxs)("div",{className:"mx-auto max-w-[760px] px-6 py-10 lg:px-10",children:[(0,b.jsxs)(e.default,{href:`/agents/${a.runId}`,className:"flex items-center gap-1.5 text-[13px] text-text-body transition-colors hover:text-text-heading",children:[(0,b.jsx)(f.ArrowLeft,{className:"h-3.5 w-3.5"})," Back to run"]}),(0,b.jsx)("h1",{className:"mt-3 text-[26px] font-bold text-text-heading",children:"Validation report"}),(0,b.jsx)("p",{className:"mt-1.5 text-[14px] text-text-body",children:"Schema, lint and governance checks run by the QA agent before write-back."}),(0,b.jsxs)("div",{className:"mt-8",children:[k&&(0,b.jsxs)("p",{className:"text-[14px] text-accent",children:["Failed to load report: ",k]}),!i&&!k&&(0,b.jsxs)("div",{className:"flex items-center gap-2 py-10 text-[14px] text-text-body",children:[(0,b.jsx)(g.Loader2,{className:"h-4 w-4 animate-spin"})," Loading validation report…"]}),i&&(0,b.jsx)(n,{report:i})]})]})})]})}],80517)},93740,a=>{"use strict";var b=a.i(87924),c=a.i(38246),d=a.i(50944),e=a.i(71215),f=a.i(19107);let g=[{label:"Control center",href:"/dashboard",icon:e.Image},{label:"Running agents",href:"/agents",icon:e.Image}];a.s(["AppSubNav",0,function({crumb:a}){let e=(0,d.usePathname)();return(0,b.jsxs)("header",{className:"border-b border-border-hairline bg-bg-base",children:[(0,b.jsx)("div",{className:"flex items-center justify-between px-6 py-2 text-[12px] text-text-muted lg:px-10",children:(0,b.jsxs)("span",{className:"font-mono-atlas",children:["/ ",a]})}),(0,b.jsxs)("div",{className:"flex items-center justify-between border-t border-border-hairline px-6 py-3.5 lg:px-10",children:[(0,b.jsxs)("div",{className:"flex items-center gap-6",children:[(0,b.jsxs)(c.default,{href:"/",className:"flex items-center gap-2.5",children:[(0,b.jsx)("span",{className:"flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-white",children:"A"}),(0,b.jsxs)("span",{className:"text-[14px] font-semibold text-text-heading",children:["Atlas ",(0,b.jsx)("span",{className:"text-accent",children:"AI"})]})]}),(0,b.jsx)("nav",{className:"flex items-center gap-1",children:g.map(a=>{let d=e===a.href,f=a.icon;return(0,b.jsxs)(c.default,{href:a.href,className:`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] transition-colors ${d?"bg-bg-card text-text-heading":"text-text-body hover:text-text-heading"}`,children:[(0,b.jsx)(f,{className:"h-3.5 w-3.5"}),a.label]},a.href)})})]}),(0,b.jsxs)(c.default,{href:"/",className:"flex items-center gap-1.5 text-[13px] text-text-body transition-colors hover:text-text-heading",children:[(0,b.jsx)(f.ArrowLeft,{className:"h-3.5 w-3.5"}),"Back to site"]})]})]})}])},53250,a=>{"use strict";let b=process.env.NEXT_PUBLIC_API_URL??"",c=b.length>0;async function d(a){let c=await fetch(`${b}${a}`);if(!c.ok)throw Error(`${c.status} ${c.statusText} on ${a}`);return c.json()}async function e(a){return c?d(`/api/requests/${a}/artifacts`):(await h(400),{request_id:a,dbt_models:`-- models/marts/fct_revenue.sql
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
      +tags: ['revenue', 'atlas-generated']`})}async function f(a){return c?d(`/api/requests/${a}/validation`):(await h(400),{request_id:a,passed:!1,checks:[{name:"Schema compatibility",passed:!0,message:"fct_revenue matches the registered DataHub schema.",severity:"info"},{name:"SQL lint",passed:!0,message:"No syntax or style violations found.",severity:"info"},{name:"Not-null constraints",passed:!0,message:"order_id and customer_id pass not-null checks on sample data.",severity:"info"},{name:"PII exposure",passed:!1,message:"customer_name is tagged PII in DataHub and is not currently masked in this model.",severity:"critical"},{name:"Missing metadata",passed:!0,message:"All columns have descriptions synced from DataHub glossary.",severity:"warning"}]})}async function g(a){if(c){let c=await fetch(`${b}/api/requests`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt:a})});if(!c.ok)throw Error(`${c.status} ${c.statusText}`);return c.json()}return{request_id:Math.random().toString(36).slice(2,8)}}function h(a){return new Promise(b=>setTimeout(b,a))}a.s(["HAS_BACKEND",0,c,"createRequest",0,g,"getArtifacts",0,e,"getValidationReport",0,f,"streamUrl",0,function(a){let c=b.replace(/^http/,"ws")||"ws://localhost:8000";return`${c}/api/requests/${a}/stream`}])},19107,a=>{"use strict";let b=(0,a.i(64831).default)("arrow-left",[["path",{d:"m12 19-7-7 7-7",key:"1l729n"}],["path",{d:"M19 12H5",key:"x3x0zl"}]]);a.s(["ArrowLeft",0,b],19107)},13412,a=>{"use strict";let b=(0,a.i(64831).default)("circle-check",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m9 12 2 2 4-4",key:"dzmm74"}]]);a.s(["CheckCircle2",0,b],13412)},71215,a=>{"use strict";let b=(0,a.i(64831).default)("image",[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",ry:"2",key:"1m3agn"}],["circle",{cx:"9",cy:"9",r:"2",key:"af1f0g"}],["path",{d:"m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21",key:"1xmnt7"}]]);a.s(["Image",0,b],71215)},75160,a=>{"use strict";let b=(0,a.i(64831).default)("loader-circle",[["path",{d:"M21 12a9 9 0 1 1-6.219-8.56",key:"13zald"}]]);a.s(["Loader2",0,b],75160)},69789,(a,b,c)=>{"use strict";Object.defineProperty(c,"__esModule",{value:!0});var d={actionAsyncStorage:function(){return f.actionAsyncStorage},workAsyncStorage:function(){return g.workAsyncStorage},workUnitAsyncStorage:function(){return h.workUnitAsyncStorage}};for(var e in d)Object.defineProperty(c,e,{enumerable:!0,get:d[e]});let f=a.r(20635),g=a.r(56704),h=a.r(32319);("function"==typeof c.default||"object"==typeof c.default&&null!==c.default)&&void 0===c.default.__esModule&&(Object.defineProperty(c.default,"__esModule",{value:!0}),Object.assign(c.default,c),b.exports=c.default)}];

//# sourceMappingURL=_1ow8ty7._.js.map