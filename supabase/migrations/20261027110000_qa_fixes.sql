-- Suggested patches for QA findings, and whether each has been applied (#31)
alter table public.validation_reports add column fixes jsonb not null default '[]'::jsonb;
