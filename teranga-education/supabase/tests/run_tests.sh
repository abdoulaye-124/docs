#!/usr/bin/env bash
# Lance les migrations puis les tests sur une base PostgreSQL LOCALE et JETABLE.
# Usage : ./run_tests.sh            (utilise les variables PG* habituelles)
# La base « teranga_test » est supprimée puis recréée : ne jamais pointer vers
# une base contenant de vraies données.
set -euo pipefail
cd "$(dirname "$0")/.."
DB=teranga_test
dropdb --if-exists "$DB"
createdb "$DB"
PSQL=(psql -q -t -A -v ON_ERROR_STOP=1 -d "$DB")
"${PSQL[@]}" -f tests/00_supabase_shim.sql
for f in migrations/*.sql; do "${PSQL[@]}" -f "$f"; done
"${PSQL[@]}" -f tests/10_scenario_validation_et_rls.sql 2>&1 | grep -E "NOTICE|ERROR|ÉCHEC|===" | sed 's/^psql:[^:]*:[0-9]*: //'
