export interface PipelineStage {
  id: string;
  name: string;
  role: string;
  logs: string[];
}

export const PIPELINE: PipelineStage[] = [
  {
    id: "planner",
    name: "Planner",
    role: "Parsing intent into an engineering goal",
    logs: [
      "parsing prompt into engineering goal",
      "identified target entities: revenue, customer, orders",
    ],
  },
  {
    id: "metadata_analyst",
    name: "Metadata Analyst",
    role: "Searching DataHub for matching datasets",
    logs: [
      "searching DataHub for candidate datasets",
      "matched fct_orders, dim_customer · confidence 0.94",
      "pulled schema, lineage, owners, contracts",
    ],
  },
  {
    id: "data_engineer",
    name: "Data Engineer",
    role: "Generating the dbt model and SQL",
    logs: [
      "drafting dbt model against retrieved schema",
      "applying data contract constraints",
      "generated 3 models, 2 tests",
    ],
  },
  {
    id: "qa",
    name: "QA Agent",
    role: "Validating schema and flagging risk",
    logs: [
      "running schema-compatibility checks",
      "linting generated SQL",
      "flagged 1 PII column · masking required",
    ],
  },
  {
    id: "documentation",
    name: "Documentation Agent",
    role: "Writing the data dictionary and README",
    logs: ["generating data dictionary", "writing README from DataHub context"],
  },
  {
    id: "writeback",
    name: "Write-back",
    role: "Pushing lineage and docs to DataHub",
    logs: [
      "upserting metadata to DataHub",
      "emitting lineage edges",
      "run complete · artifacts ready",
    ],
  },
];

export const DEMO_PROMPT =
  "Build a customer revenue pipeline from raw Stripe and Postgres events";
