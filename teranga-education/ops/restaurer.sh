#!/usr/bin/env bash
# =============================================================================
# RESTAURATION d'une sauvegarde chiffrée dans un projet Supabase NEUF, sur lequel
# les migrations ont déjà été appliquées (supabase db push).
#   ./restaurer.sh chemin/teranga-AAAAMMJJ-HHMM.tar.enc
# Mêmes variables que sauvegarder.sh (DATABASE_URL = base de DESTINATION).
# Les règles automatiques (calculs, journal) sont suspendues pendant la copie :
# les données reviennent exactement telles qu'elles étaient.
# =============================================================================
set -euo pipefail
ICI="$(cd "$(dirname "$0")" && pwd)"
[ -f "$ICI/.env.sauvegarde" ] && { set -a; . "$ICI/.env.sauvegarde"; set +a; }
FICHIER="${1:?Indiquez le fichier de sauvegarde}"
: "${DATABASE_URL:?DATABASE_URL manquant}"
: "${SAUVEGARDE_PHRASE:?SAUVEGARDE_PHRASE manquant}"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

if [ -f "$FICHIER.sha256" ]; then
  ( cd "$(dirname "$FICHIER")" && sha256sum -c "$(basename "$FICHIER").sha256" >/dev/null ) \
    || { echo "Empreinte invalide : fichier abîmé ou modifié." >&2; exit 1; }
fi
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:SAUVEGARDE_PHRASE -in "$FICHIER" \
  | tar -C "$TMP" -xf - || { echo "Déchiffrement impossible : phrase secrète incorrecte ?" >&2; exit 1; }
cat "$TMP/infos.txt"

echo "Restauration de la base…"
PGOPTIONS='-c session_replication_role=replica' pg_restore --data-only --no-owner --no-privileges \
  --exit-on-error --single-transaction --dbname="$DATABASE_URL" "$TMP/base.dump"

if [ -n "${SUPABASE_URL:-}" ] && [ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ] && [ -d "$TMP/fichiers" ]; then
  echo "Restauration des fichiers audio…"
  node "$ICI/fichiers.mjs" restaurer "$TMP/fichiers"
fi
echo "Restauration terminée."
