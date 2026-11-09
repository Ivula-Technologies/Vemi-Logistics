#!/usr/bin/env bash
# Builds a throwaway database from the migrations and runs the SQL tests against it.
# Needs Postgres 15+ with the contrib extensions (pgcrypto).
# Connection comes from the usual PGHOST / PGPORT / PGUSER / PGPASSWORD variables.
set -euo pipefail
cd "$(dirname "$0")/.."
db="${VEMI_TEST_DB:-vemi_test}"
psql_q() { psql -X -q -v ON_ERROR_STOP=1 -d "$db" "$@"; }

dropdb --if-exists "$db" >/dev/null 2>&1 || true
createdb "$db"
# Vemi's dates are Nairobi dates (private.eat_today()). Run the tests in that time zone so current_date in the
# tests matches, including between 21:00 and midnight UTC when the two days differ.
psql -X -q -d "$db" -c "alter database \"$db\" set timezone = 'Africa/Nairobi'"
psql_q -f tests/supabase-shim.sql
for migration in migrations/*.sql; do
  psql_q -1 -f "$migration"
done
psql_q -f tests/helpers.sql
for test in tests/*.test.sql; do
  echo "== $(basename "$test")"
  psql_q -o /dev/null -f "$test"
done
echo "All database tests passed."
