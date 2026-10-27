#!/bin/sh
# Applies the auth stub, every migration in order, then the seed. Used by docker-compose's Postgres.
set -e
for f in /atlas/local/auth-stub.sql /atlas/migrations/*.sql /atlas/seed.sql; do
  echo "applying $f"
  psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$f"
done
