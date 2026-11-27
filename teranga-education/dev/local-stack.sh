#!/usr/bin/env bash
# =============================================================================
# Pile Supabase LOCALE minimale pour développer et tester TERANGA ÉDUCATION.
#   PostgreSQL (local)  : port 5432, base « teranga_dev »
#   GoTrue (auth)       : port 9999  (image officielle supabase/gotrue)
#   PostgREST (données) : port 3000  (image officielle postgrest/postgrest)
#   Stockage (fichiers) : port 5000  (image officielle supabase/storage-api)
#   Passerelle          : port 54321 (Deno) : /auth/v1 → GoTrue, /rest/v1 → PostgREST,
#                         /functions/v1 → fonctions serveur (même code que les Edge Functions)
# L'application (Vite, port 5173) relaie ces chemins vers la passerelle, comme
# le ferait un projet Supabase hébergé (une seule adresse).
#
# Tout ici est réservé au DÉVELOPPEMENT : secrets factices, données fictives.
#
# Usage : ./local-stack.sh up | down | reset | env
#   reset = supprime la base et repart de zéro (+ compte admin de démonstration)
# =============================================================================
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
DB="${TERANGA_DB:-teranga_dev}"
PG_SUPER="${PG_SUPER:-postgres}"
JWT_SECRET="dev-only-jwt-secret-teranga-education-local-32+chars"
GOTRUE_IMAGE="supabase/gotrue:v2.170.0"
POSTGREST_IMAGE="postgrest/postgrest:v12.2.3"
STORAGE_IMAGE="supabase/storage-api:v1.14.5"
RUN_DIR="${TERANGA_RUN_DIR:-$HERE/.run}"
mkdir -p "$RUN_DIR"

psql_super() { su "$PG_SUPER" -c "psql -q -v ON_ERROR_STOP=1 -d $1 $2"; }

keys() { node "$HERE/jwt.mjs" "$JWT_SECRET"; }

write_env() {
  eval "$(keys)"
  cat > "$RUN_DIR/env" <<EOF
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=$ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
GOTRUE_URL=http://localhost:9999
POSTGREST_URL=http://localhost:3000
STORAGE_URL=http://localhost:5000
# Assistant IA : simulation en local (aucune clé, aucun coût). En production :
# secret ANTHROPIC_API_KEY sur la fonction serveur, et TERANGA_IA_FOURNISSEUR=anthropic.
TERANGA_IA_FOURNISSEUR=simulation
EOF
  # Variables lues par Vite (seule la clé publique « anon » va dans le navigateur).
  cat > "$ROOT/app/.env.local" <<EOF
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=$ANON_KEY
EOF
}

wait_http() { # url, nom
  for _ in $(seq 1 60); do
    if curl -fsS -o /dev/null "$1" 2>/dev/null; then return 0; fi
    sleep 1
  done
  echo "Le service $2 ne répond pas ($1)" >&2; return 1
}

db_create() {
  service postgresql start >/dev/null
  su "$PG_SUPER" -c "dropdb --if-exists --force $DB"
  su "$PG_SUPER" -c "createdb $DB"
  su "$PG_SUPER" -c "psql -q -v ON_ERROR_STOP=1 -d $DB -f $HERE/roles.sql"
  psql_super "$DB" "-c 'create schema if not exists auth authorization supabase_auth_admin; grant create on database $DB to supabase_auth_admin; alter role supabase_auth_admin set search_path = auth;'"
  psql_super "$DB" "-c 'create schema if not exists storage authorization supabase_storage_admin; grant create on database $DB to supabase_storage_admin; alter role supabase_storage_admin set search_path = storage;'"
}

start_storage() {
  eval "$(keys)"
  mkdir -p "$RUN_DIR/storage"
  docker rm -f teranga-storage >/dev/null 2>&1 || true
  docker run -d --name teranga-storage --network host \
    -v "$RUN_DIR/storage:/var/lib/storage" \
    -e ANON_KEY="$ANON_KEY" -e SERVICE_KEY="$SERVICE_ROLE_KEY" \
    -e AUTH_JWT_SECRET="$JWT_SECRET" -e PGRST_JWT_SECRET="$JWT_SECRET" \
    -e POSTGREST_URL=http://localhost:3000 \
    -e "DATABASE_URL=postgres://supabase_storage_admin:dev-storage-admin@localhost:5432/$DB" \
    -e FILE_SIZE_LIMIT=5242880 -e STORAGE_BACKEND=file -e FILE_STORAGE_BACKEND_PATH=/var/lib/storage \
    -e TENANT_ID=stub -e REGION=local -e GLOBAL_S3_BUCKET=stub -e ENABLE_IMAGE_TRANSFORMATION=false \
    -e SERVER_PORT=5000 -e PORT=5000 -e DATABASE_SEARCH_PATH=storage,public \
    "$STORAGE_IMAGE" >/dev/null
  wait_http http://localhost:5000/status "Stockage"
}

start_gotrue() {
  docker rm -f teranga-gotrue >/dev/null 2>&1 || true
  docker run -d --name teranga-gotrue --network host \
    -e GOTRUE_API_HOST=0.0.0.0 -e PORT=9999 \
    -e API_EXTERNAL_URL=http://localhost:5173/auth/v1 \
    -e GOTRUE_DB_DRIVER=postgres \
    -e "GOTRUE_DB_DATABASE_URL=postgres://supabase_auth_admin:dev-auth-admin@localhost:5432/$DB?search_path=auth" \
    -e GOTRUE_SITE_URL=http://localhost:5173 \
    -e GOTRUE_JWT_SECRET="$JWT_SECRET" -e GOTRUE_JWT_EXP=3600 \
    -e GOTRUE_JWT_AUD=authenticated -e GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated \
    -e GOTRUE_JWT_ADMIN_ROLES=service_role \
    -e GOTRUE_DISABLE_SIGNUP=true \
    -e GOTRUE_EXTERNAL_EMAIL_ENABLED=true -e GOTRUE_MAILER_AUTOCONFIRM=true \
    -e GOTRUE_EXTERNAL_PHONE_ENABLED=true -e GOTRUE_SMS_AUTOCONFIRM=true \
    -e GOTRUE_PASSWORD_MIN_LENGTH=8 \
    -e GOTRUE_RATE_LIMIT_TOKEN_REFRESH=10000 -e GOTRUE_RATE_LIMIT_VERIFY=10000 \
    "$GOTRUE_IMAGE" >/dev/null
  wait_http http://localhost:9999/health GoTrue
}

start_postgrest() {
  docker rm -f teranga-postgrest >/dev/null 2>&1 || true
  docker run -d --name teranga-postgrest --network host \
    -e "PGRST_DB_URI=postgres://authenticator:dev-authenticator@localhost:5432/$DB" \
    -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon \
    -e PGRST_JWT_SECRET="$JWT_SECRET" -e PGRST_SERVER_PORT=3000 \
    -e PGRST_DB_USE_LEGACY_GUCS=false \
    "$POSTGREST_IMAGE" >/dev/null
  wait_http http://localhost:3000/ PostgREST
}

stop_functions() {
  # npx lance Deno dans un sous-processus : on arrête tout processus de la passerelle.
  pkill -f "supabase/functions/serve-local.ts" 2>/dev/null || true
  for _ in $(seq 1 20); do
    curl -fsS -o /dev/null http://localhost:54321/health 2>/dev/null || return 0
    sleep 0.5
  done
  echo "La passerelle locale ne s'arrête pas (port 54321 occupé)" >&2; return 1
}

start_functions() {
  stop_functions
  set -a; . "$RUN_DIR/env"; set +a
  nohup npx --yes deno@2.9.6 run --allow-net --allow-env \
    "$ROOT/supabase/functions/serve-local.ts" > "$RUN_DIR/functions.log" 2>&1 &
  echo $! > "$RUN_DIR/functions.pid"
  wait_http http://localhost:54321/health "passerelle locale"
  if ! kill -0 "$(cat "$RUN_DIR/functions.pid")" 2>/dev/null; then
    echo "La passerelle locale n'a pas démarré : voir $RUN_DIR/functions.log" >&2; return 1
  fi
}

apply_migrations() {
  for f in "$ROOT"/supabase/migrations/*.sql; do
    su "$PG_SUPER" -c "psql -q -v ON_ERROR_STOP=1 -d $DB -f $f"
  done
  # Équivalent des droits par défaut de Supabase sur les schémas auth et storage.
  psql_super "$DB" "-c 'grant usage on schema auth to anon, authenticated, service_role; grant all on all tables in schema public to service_role; grant all on all sequences in schema public to service_role; grant execute on all functions in schema public to service_role; grant usage on schema storage to anon, authenticated, service_role; grant all on all tables in schema storage to anon, authenticated, service_role;'"
  docker kill -s SIGUSR1 teranga-postgrest >/dev/null 2>&1 || true   # recharge le cache de schéma
}

case "${1:-}" in
  up)
    service postgresql start >/dev/null
    write_env; start_gotrue; start_storage; start_postgrest; start_functions
    echo "Pile locale démarrée. Lancer l'application : cd app && npm run dev" ;;
  reset)
    docker rm -f teranga-gotrue teranga-postgrest teranga-storage >/dev/null 2>&1 || true
    db_create; write_env; start_gotrue; start_storage; apply_migrations
    su "$PG_SUPER" -c "psql -q -v ON_ERROR_STOP=1 -d $DB -f $ROOT/supabase/seed/referentiel-provisoire-demo.sql"
    start_postgrest; start_functions
    node "$HERE/bootstrap-admin.mjs"
    echo "Base réinitialisée." ;;
  down)
    docker rm -f teranga-gotrue teranga-postgrest teranga-storage >/dev/null 2>&1 || true
    stop_functions
    echo "Pile locale arrêtée." ;;
  env) write_env; cat "$RUN_DIR/env" ;;
  *) echo "Usage : $0 up | down | reset | env"; exit 1 ;;
esac
