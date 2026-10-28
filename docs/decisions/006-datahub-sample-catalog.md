# 006. DataHub: self-host for development, seeded sample catalog for the public demo

Status: accepted · 2026-10-26

## Context
DataHub Cloud isn't available. The self-hosted quickstart needs about 5 GB+ of RAM (Kafka, search, database), which no free web host provides. The public demo still has to show grounding and run reliably.

## Decision
- Development and the recorded demo use DataHub's quickstart locally, through `mcp-server-datahub`.
- The public demo uses `MockDataHubGateway`, seeded with a realistic Stripe, Postgres and orders catalog: schemas, owners, PII tags and lineage.
- The UI labels this "Sample catalog". The demo never claims to be connected to a live DataHub.
- The gateway interface stays. Switching to a live DataHub is a config change (`DATAHUB_GMS_URL`).
- The direct REST gateway is removed. Its one remaining job, writing lineage, which MCP has no mutation tool for, moves into the MCP gateway as a single GraphQL call.

## Alternatives rejected
- **DataHub Cloud.** Not available.
- **A paid VM to host DataHub live.** Costs money. Possible later on a larger instance than the API needs (see 007).

## Consequences
- The live demo is honest and reliable, but grounding comes from a fixed catalog.
- Writeback in the public demo writes to the sample catalog and shows a diff of what would change.

## Revisit when
A free host with 8 GB+ of RAM is running, or an interviewer needs to see live ingestion.
