#!/bin/bash
# Opens the admin against the PRODUCTION database.
#
# Imports have to run here rather than on Vercel: 1688 blocks datacenter IPs,
# Vercel has no Python, and its filesystem is read-only. Everything else in the
# admin works either way — this just puts the importer somewhere it can work.
set -e
cd "$(dirname "$0")/.."

if [ ! -f .env.production.local ]; then
  cat <<'MSG'
Missing .env.production.local

Create it with your production database URL:

  DATABASE_URL="<from Vercel → Storage → .env.local>"
  SESSION_SECRET="<the same value you set in Vercel>"

It is git-ignored.
MSG
  exit 1
fi

echo "Starting the admin against the PRODUCTION database."
echo "Anything you publish here is live immediately."
echo
echo "  http://localhost:3000/admin/import"
echo

set -a; . ./.env.production.local; set +a
exec npx next dev
