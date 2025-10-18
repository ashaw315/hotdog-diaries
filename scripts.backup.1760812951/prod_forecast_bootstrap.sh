#!/usr/bin/env bash
set -euo pipefail

# ========= Config =========
PROJECT_URL="https://hotdog-diaries.vercel.app"
TODAY_ET="${1:-}"
if [[ -z "${TODAY_ET}" ]]; then
  # Compute "today" in ET (naive: use system date; override via arg if needed)
  TODAY_ET=$(date -u +"%Y-%m-%d")
fi

echo "▶ Phase 5.12.x – Prod Forecast Bootstrap"
echo "   Target date (ET): ${TODAY_ET}"
echo

need() {
  command -v "$1" >/dev/null 2>&1 || { echo "❌ Missing required tool: $1"; exit 1; }
}

need "node"
need "npm"
need "curl"
need "jq"

# psql or docker fallback
if ! command -v psql >/dev/null 2>&1; then
  if ! command -v docker >/dev/null 2>&1; then
    echo "❌ Need either psql or docker to apply SQL migration."
    exit 1
  fi
  PSQL_DOCKER=1
else
  PSQL_DOCKER=0
fi

# ========= Secrets =========
export SUPABASE_DB_URL="${SUPABASE_DB_URL:-}"
export SUPABASE_URL="${SUPABASE_URL:-}"
export SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"

if [[ -z "${SUPABASE_DB_URL}" ]]; then
  read -r -p "Enter SUPABASE_DB_URL (Postgres connection string for PROD): " SUPABASE_DB_URL
  export SUPABASE_DB_URL
fi
if [[ -z "${SUPABASE_URL}" ]]; then
  read -r -p "Enter SUPABASE_URL (e.g. https://xxxx.supabase.co): " SUPABASE_URL
  export SUPABASE_URL
fi
if [[ -z "${SUPABASE_SERVICE_ROLE_KEY}" ]]; then
  read -r -s -p "Enter SUPABASE_SERVICE_ROLE_KEY (service role): " SUPABASE_SERVICE_ROLE_KEY
  echo
  export SUPABASE_SERVICE_ROLE_KEY
fi

SQL_FILE="supabase/migrations/20251009_create_scheduled_posts_prod.sql"
if [[ ! -f "${SQL_FILE}" ]]; then
  echo "❌ Migration file not found: ${SQL_FILE}"
  exit 1
fi

# ========= Apply migration =========
echo "🏗️  Applying SQL migration (idempotent)…"
if [[ "${PSQL_DOCKER}" -eq 1 ]]; then
  docker run --rm -i postgres:16-alpine sh -lc "cat >/tmp/migration.sql && PGPASSWORD=\$(echo '${SUPABASE_DB_URL}' | sed -E 's/.*:(.*)@.*/\1/') psql '${SUPABASE_DB_URL}' -v ON_ERROR_STOP=1 -f /tmp/migration.sql" < "${SQL_FILE}"
else
  psql "${SUPABASE_DB_URL}" -v ON_ERROR_STOP=1 -f "${SQL_FILE}"
fi
echo "✅ Migration applied (or already in place)."

# ========= Reload PostgREST cache =========
echo "🔁 Reloading PostgREST schema cache…"
echo "select pg_notify('pgrst','reload schema');" | \
  ( [[ "${PSQL_DOCKER}" -eq 1 ]] \
    && docker run --rm -i postgres:16-alpine sh -lc "PGPASSWORD=\$(echo '${SUPABASE_DB_URL}' | sed -E 's/.*:(.*)@.*/\1/') psql '${SUPABASE_DB_URL}' -v ON_ERROR_STOP=1" \
    || psql "${SUPABASE_DB_URL}" -v ON_ERROR_STOP=1 )
echo "✅ PostgREST cache reload requested."

# ========= Ensure Vercel env vars =========
if command -v vercel >/dev/null 2>&1; then
  echo "🔐 Ensuring Vercel env vars (production)…"
  # Try non-interactive; if it fails, print guidance.
  set +e
  vercel env set SUPABASE_URL "${SUPABASE_URL}" --environment=production >/dev/null 2>&1
  V1=$?
  vercel env set SUPABASE_SERVICE_ROLE_KEY "${SUPABASE_SERVICE_ROLE_KEY}" --environment=production >/dev/null 2>&1
  V2=$?
  set -e
  if [[ $V1 -ne 0 || $V2 -ne 0 ]]; then
    echo "⚠️  Could not set Vercel env via CLI (not linked/logged in?)."
    echo "   Please set in Vercel Dashboard → Project → Settings → Environment Variables:"
    echo "   - SUPABASE_URL = ${SUPABASE_URL}"
    echo "   - SUPABASE_SERVICE_ROLE_KEY = ••••••••"
    echo "   Then trigger a production redeploy."
  else
    echo "🚀 Triggering production redeploy…"
    vercel deploy --prod --force || true
  fi
else
  echo "⚠️  Vercel CLI not found. Set env vars in the Vercel dashboard and redeploy."
fi

# ========= Backfill today's schedule =========
echo "🗓️  Generating schedule for ${TODAY_ET}…"
npm run --silent schedule:day "${TODAY_ET}" || {
  echo "❌ Backfill script failed. Ensure scripts/generateScheduleForDate.ts can reach Supabase (env OK)."
  exit 1
}
echo "✅ Backfill complete."

# ========= Validate 6 rows for the day (UTC) =========
echo "🔎 Validating scheduled_posts has 6 rows for ${TODAY_ET} (UTC)…"
COUNT=$(cat <<'SQL' | ( [[ "${PSQL_DOCKER}" -eq 1 ]] \
    && docker run --rm -i postgres:16-alpine sh -lc "PGPASSWORD=\$(echo '${SUPABASE_DB_URL}' | sed -E 's/.*:(.*)@.*/\1/') psql '${SUPABASE_DB_URL}' -A -t -v ON_ERROR_STOP=1" \
    || psql "${SUPABASE_DB_URL}" -A -t -v ON_ERROR_STOP=1 )
WITH d AS (
  SELECT
    timestamp '${TODAY_ET} 00:00:00+00' AS day_start,
    timestamp '${TODAY_ET} 00:00:00+00' + interval '1 day' AS day_end
)
SELECT COUNT(*)::int
FROM public.scheduled_posts, d
WHERE scheduled_post_time >= d.day_start
  AND scheduled_post_time <  d.day_end;
SQL
)
echo "   Rows found: ${COUNT}"
if [[ "${COUNT}" -lt 6 ]]; then
  echo "❌ Expected 6 rows; found ${COUNT}. Investigate content sources / generator."
  exit 1
fi
echo "✅ Found 6/6 rows."

# ========= Hit health + forecast endpoints =========
echo "🌐 Hitting health endpoint…"
curl -s "${PROJECT_URL}/api/admin/schedule/forecast/health" | jq '.'

echo "🌐 Hitting forecast endpoint…"
FJSON=$(curl -s "${PROJECT_URL}/api/admin/schedule/forecast?date=${TODAY_ET}")
echo "${FJSON}" | jq '.date, .slots|length, .summary'

SLOTS=$(echo "${FJSON}" | jq -r '.slots|length // 0')
if [[ "${SLOTS}" != "6" ]]; then
  echo "❌ Forecast did not return 6 slots (got ${SLOTS}). Check logs and table contents."
  exit 1
fi

echo
echo "🎉 Success!"
echo " - scheduled_posts exists and has 6 rows for ${TODAY_ET}"
echo " - Forecast API returns 6 slots"
echo " - Admin UI should now display the "Forecast – What Will Post" table with posted/upcoming/missed"
echo
echo "Next:"
echo "  Visit ${PROJECT_URL}/admin/schedule and verify the Forecast section shows the exact lineup for the day."