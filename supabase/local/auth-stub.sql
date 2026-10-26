-- The parts of Supabase's auth schema the migrations rely on, for plain Postgres
-- (docker-compose and the test suite). Supabase itself already provides these.
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key,
  email text
);

-- Supabase reads the caller from the JWT; locally it comes from a session setting
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
