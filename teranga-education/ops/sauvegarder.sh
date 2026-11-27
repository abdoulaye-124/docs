#!/usr/bin/env bash
# =============================================================================
# SAUVEGARDE CHIFFRÉE de TERANGA ÉDUCATION (base de données + fichiers audio).
# L'offre gratuite de Supabase ne fait pas de sauvegarde automatique : ce script
# la remplace. À lancer chaque semaine (au minimum) depuis l'ordinateur du centre.
#
# Variables attendues (dans un fichier ops/.env.sauvegarde, JAMAIS publié) :
#   DATABASE_URL           chaîne de connexion PostgreSQL (Supabase › Connect)
#   SUPABASE_URL           adresse du projet (https://xxxx.supabase.co)
#   SUPABASE_SERVICE_ROLE_KEY  clé « service_role » (Supabase › Settings › API)
#   SAUVEGARDE_PHRASE      phrase secrète de chiffrement (à conserver hors ligne !)
#   SAUVEGARDE_DOSSIER     (facultatif) dossier de destination, par défaut ./sauvegardes
#
# Résultat : teranga-AAAAMMJJ-HHMM.tar.enc (+ .sha256). Sans la phrase secrète,
# le fichier est illisible : il peut donc être copié sur une clé USB ou un disque.
# =============================================================================
set -euo pipefail
ICI="$(cd "$(dirname "$0")" && pwd)"
[ -f "$ICI/.env.sauvegarde" ] && { set -a; . "$ICI/.env.sauvegarde"; set +a; }
: "${DATABASE_URL:?DATABASE_URL manquant}"
: "${SAUVEGARDE_PHRASE:?SAUVEGARDE_PHRASE manquant}"
[ "${#SAUVEGARDE_PHRASE}" -ge 16 ] || { echo "La phrase secrète doit faire au moins 16 caractères." >&2; exit 1; }
DEST="${SAUVEGARDE_DOSSIER:-$ICI/sauvegardes}"
mkdir -p "$DEST"
NOM="teranga-$(date +%Y%m%d-%H%M)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
umask 077

echo "1/3 Base de données…"
pg_dump "$DATABASE_URL" --data-only --no-owner --no-privileges --format=custom \
  --schema=public --schema=auth --schema=storage \
  --exclude-table-data='storage.migrations' --exclude-table-data='auth.schema_migrations' \
  --file="$TMP/base.dump"

echo "2/3 Fichiers audio…"
mkdir -p "$TMP/fichiers"
if [ -n "${SUPABASE_URL:-}" ] && [ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  node "$ICI/fichiers.mjs" sauvegarder "$TMP/fichiers"
else
  echo "   (SUPABASE_URL ou clé service absente : fichiers audio non sauvegardés)"
fi
{ echo "date=$(date -Iseconds)"; echo "version_schema=$(ls "$ICI/../supabase/migrations" | tail -1)"; } > "$TMP/infos.txt"

echo "3/3 Chiffrement…"
tar -C "$TMP" -cf - base.dump fichiers infos.txt \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:SAUVEGARDE_PHRASE -out "$DEST/$NOM.tar.enc"
( cd "$DEST" && sha256sum "$NOM.tar.enc" > "$NOM.tar.enc.sha256" )
echo "Sauvegarde terminée : $DEST/$NOM.tar.enc ($(du -h "$DEST/$NOM.tar.enc" | cut -f1))"
