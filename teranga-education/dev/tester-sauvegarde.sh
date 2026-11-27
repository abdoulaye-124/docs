#!/usr/bin/env bash
# TEST de sauvegarde / restauration sur la pile LOCALE (données fictives).
# 1. sauvegarde chiffrée de teranga_dev ; 2. base vide de même structure ;
# 3. restauration ; 4. comparaison table par table ; 5. contrôles de refus.
set -euo pipefail
ICI="$(cd "$(dirname "$0")" && pwd)"
RACINE="$(cd "$ICI/.." && pwd)"
. "$ICI/.run/env"
TRAVAIL="$(mktemp -d)"; chmod 777 "$TRAVAIL"; trap 'rm -rf "$TRAVAIL"' EXIT
export SAUVEGARDE_PHRASE="phrase-de-test-locale-uniquement"
export SAUVEGARDE_DOSSIER="$TRAVAIL/sauvegardes"
export SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY
SRC="postgresql:///teranga_dev?host=/var/run/postgresql"
DST="postgresql:///teranga_restau?host=/var/run/postgresql"
# Les scripts tournent sous l'utilisateur système « postgres » (connexion locale).
en_postgres() { su -p postgres -s /bin/bash -c "$*"; }
echo "== 1. Sauvegarde"
DATABASE_URL="$SRC" en_postgres "$RACINE/ops/sauvegarder.sh"
ARCHIVE="$(ls "$SAUVEGARDE_DOSSIER"/*.tar.enc)"

echo "== 2. Base vide de même structure (équivalent d'un projet neuf + migrations)"
su postgres -c "dropdb --if-exists teranga_restau && createdb teranga_restau"
su postgres -c "pg_dump --schema-only teranga_dev" > "$TRAVAIL/structure.sql"
su postgres -c "psql -q -v ON_ERROR_STOP=0 -d teranga_restau -f $TRAVAIL/structure.sql" >/dev/null 2>&1 || true

echo "== 3. Restauration (base seule)"
( unset SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY; DATABASE_URL="$DST" en_postgres "$RACINE/ops/restaurer.sh" "$ARCHIVE" )

echo "== 4. Comparaison table par table"
REQ="select table_schema||'.'||table_name from information_schema.tables where table_type='BASE TABLE' and table_schema in ('public','auth','storage') and table_name not in ('migrations','schema_migrations') order by 1"
ECARTS=0; N=0
for t in $(su postgres -c "psql -tA -d teranga_dev -c \"$REQ\""); do
  a=$(su postgres -c "psql -tA -d teranga_dev -c \"select count(*) from $t\"")
  b=$(su postgres -c "psql -tA -d teranga_restau -c \"select count(*) from $t\"")
  N=$((N+1))
  if [ "$a" != "$b" ]; then echo "   ÉCART $t : $a ≠ $b"; ECARTS=$((ECARTS+1)); fi
done
for t in public.students public.mastery_records public.corrections auth.users; do
  ha=$(su postgres -c "psql -tA -d teranga_dev -c \"select md5(string_agg(x::text, '|' order by x::text)) from $t x\"")
  hb=$(su postgres -c "psql -tA -d teranga_restau -c \"select md5(string_agg(x::text, '|' order by x::text)) from $t x\"")
  [ "$ha" = "$hb" ] || { echo "   CONTENU DIFFÉRENT : $t"; ECARTS=$((ECARTS+1)); }
done
echo "   $N tables comparées, $ECARTS écart(s)"

echo "== 5. Fichiers audio dans l'archive"
mkdir -p "$TRAVAIL/x"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:SAUVEGARDE_PHRASE -in "$ARCHIVE" | tar -C "$TRAVAIL/x" -xf -
NB_ARCHIVE=$(find "$TRAVAIL/x/fichiers" -type f | wc -l)
NB_BASE=$(su postgres -c "psql -tA -d teranga_dev -c \"select count(*) from storage.objects where bucket_id='audio'\"")
echo "   $NB_ARCHIVE fichier(s) dans l'archive, $NB_BASE dans le stockage"
[ "$NB_ARCHIVE" = "$NB_BASE" ] || ECARTS=$((ECARTS+1))

echo "== 6. Restauration d'un fichier audio supprimé"
UN=$(cd "$TRAVAIL/x/fichiers" && find . -type f | head -1 | sed 's#^\./##')
if [ -n "$UN" ]; then
  curl -fsS -X DELETE "$SUPABASE_URL/storage/v1/object/audio/$UN" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" >/dev/null
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "$SUPABASE_URL/storage/v1/object/audio/$UN" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY")
  [ "$CODE" != 200 ] || { echo "   ÉCHEC : le fichier n'a pas été supprimé"; ECARTS=$((ECARTS+1)); }
  node "$RACINE/ops/fichiers.mjs" restaurer "$TRAVAIL/x/fichiers"
  curl -fsS "$SUPABASE_URL/storage/v1/object/audio/$UN" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" -o "$TRAVAIL/revenu"
  if cmp -s "$TRAVAIL/revenu" "$TRAVAIL/x/fichiers/$UN"; then echo "   OK : fichier audio restauré à l'identique"; else echo "   ÉCHEC : fichier restauré différent"; ECARTS=$((ECARTS+1)); fi
fi

echo "== 7. Refus attendus"
if SAUVEGARDE_PHRASE="mauvaise-phrase-secrete-test" DATABASE_URL="$DST" en_postgres "$RACINE/ops/restaurer.sh" "$ARCHIVE" >/dev/null 2>&1; then
  echo "   ÉCHEC : une mauvaise phrase secrète a été acceptée"; ECARTS=$((ECARTS+1)); else echo "   OK : mauvaise phrase secrète refusée"; fi
cp "$ARCHIVE" "$TRAVAIL/abime.tar.enc"; cp "$ARCHIVE.sha256" "$TRAVAIL/abime.tar.enc.sha256"
sed -i "s#$(basename "$ARCHIVE")#abime.tar.enc#" "$TRAVAIL/abime.tar.enc.sha256"
printf 'X' | dd of="$TRAVAIL/abime.tar.enc" bs=1 seek=100 conv=notrunc 2>/dev/null
if DATABASE_URL="$DST" en_postgres "$RACINE/ops/restaurer.sh" "$TRAVAIL/abime.tar.enc" >/dev/null 2>&1; then
  echo "   ÉCHEC : un fichier modifié a été accepté"; ECARTS=$((ECARTS+1)); else echo "   OK : fichier modifié refusé"; fi

su postgres -c "dropdb --if-exists teranga_restau"
[ "$ECARTS" = 0 ] && echo "=== SAUVEGARDE ET RESTAURATION VÉRIFIÉES ===" || { echo "=== $ECARTS PROBLÈME(S) ==="; exit 1; }
