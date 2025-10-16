#!/bin/bash

set -euo pipefail
IFS=$'\n\t'

# =========================
# ENV & PREREQS
# =========================
: "${APP_ORIGIN:=}"                     # e.g. https://hotdog-diaries.vercel.app
: "${AUTH_TOKEN:=}"                     # admin x-admin-token
: "${SUPABASE_URL:=}"                   # e.g. https://<project>.supabase.co
: "${SUPABASE_SERVICE_KEY:=}"           # service role key (ops only)

missing=()
[[ -z "${APP_ORIGIN}" ]] && missing+=("APP_ORIGIN")
[[ -z "${AUTH_TOKEN}" ]] && missing+=("AUTH_TOKEN")
[[ -z "${SUPABASE_URL}" ]] && missing+=("SUPABASE_URL")
[[ -z "${SUPABASE_SERVICE_KEY}" ]] && missing+=("SUPABASE_SERVICE_KEY")
if (( ${#missing[@]} )); then
  echo "Missing required env: ${missing[*]}"
  echo "Need: APP_ORIGIN, AUTH_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_KEY"
  exit 2
fi

command -v curl >/dev/null || { echo "curl not found"; exit 3; }
command -v jq   >/dev/null || { echo "jq not found"; exit 3; }

ARTIFACTS_DIR="${ARTIFACTS_DIR:-rebalance_artifacts}"
mkdir -p "$ARTIFACTS_DIR"

# Common headers for Supabase REST
SB_HDR=(-H "apikey: ${SUPABASE_SERVICE_KEY}" -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" -H "Content-Type: application/json")

# ET day boundaries and UTC conversions for REST filters
ET_TZ="America/New_York"
TODAY_ET=$(TZ="$ET_TZ" date +%F)
TOMORROW_ET=$(TZ="$ET_TZ" date -v+1d +%F)

# helper: ET "YYYY-MM-DD 00:00/24:00" → UTC ISO
et_to_utc_iso () { # $1=date (YYYY-MM-DD) $2=HH:MM
  local d="$1" hm="$2"
  # Handle 24:00 as next day 00:00
  if [[ "$hm" == "24:00" ]]; then
    local next_day=$(TZ="$ET_TZ" date -v+1d -jf "%Y-%m-%d" "$d" +%Y-%m-%d)
    hm="00:00"
    d="$next_day"
  fi
  # Use python for consistent UTC conversion
  python3 -c "
import datetime
import zoneinfo
et = zoneinfo.ZoneInfo('America/New_York')
dt = datetime.datetime.strptime('${d} ${hm}', '%Y-%m-%d %H:%M').replace(tzinfo=et)
print(dt.astimezone(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'))
"
}

TODAY_UTC_START=$(et_to_utc_iso "${TODAY_ET}" "00:00")
TODAY_UTC_END=$(et_to_utc_iso   "${TODAY_ET}" "24:00")
TOMORROW_UTC_START=$(et_to_utc_iso "${TOMORROW_ET}" "00:00")
TOMORROW_UTC_END=$(et_to_utc_iso   "${TOMORROW_ET}" "24:00")

echo "Using ET dates:"
echo "  TODAY_ET=${TODAY_ET}  (${TODAY_UTC_START} → ${TODAY_UTC_END} UTC)"
echo "  TOMORROW_ET=${TOMORROW_ET} (${TOMORROW_UTC_START} → ${TOMORROW_UTC_END} UTC)"

# =========================
# STEP 1 — HEALTH
# =========================
echo "STEP 1 — Health check"
curl -sS "${APP_ORIGIN}/api/admin/schedule/forecast/health" \
  | tee "${ARTIFACTS_DIR}/health.json" >/dev/null
jq . "${ARTIFACTS_DIR}/health.json" >/dev/null
ok=$(jq -r '.ok' < "${ARTIFACTS_DIR}/health.json" 2>/dev/null || echo "false")
table_ok=$(jq -r '.table_ok' < "${ARTIFACTS_DIR}/health.json" 2>/dev/null || echo "false")
if [[ "$ok" != "true" || "$table_ok" != "true" ]]; then
  echo "Health check failed: expected {ok:true, table_ok:true} → see ${ARTIFACTS_DIR}/health.json"
  exit 10
fi

# =========================
# STEP 2 — POOL DISTRIBUTION (Supabase REST)
# =========================
echo "STEP 2 — Pool distribution (active only via REST)"
# Filters: is_approved=true AND (is_posted is null OR is_posted=false) AND ingest_priority>=0
# PostgREST or= syntax: or=(is_posted.is.null,is_posted.eq.false)
curl -sS "${SUPABASE_URL}/rest/v1/content_queue?select=source_platform&is_approved=eq.true&ingest_priority=gte.0&or=(is_posted.is.null,is_posted.eq.false)" \
  "${SB_HDR[@]}" \
  | tee "${ARTIFACTS_DIR}/pool_active_raw.json" >/dev/null

jq -r '
  . as $rows
  | ( $rows | group_by(.source_platform) 
      | map({platform: (.[0].source_platform|ascii_downcase), active_items: length})
      | sort_by(-.active_items) )' \
  "${ARTIFACTS_DIR}/pool_active_raw.json" \
  | tee "${ARTIFACTS_DIR}/pool_active_distribution.json" >/dev/null

# also TSV for quick glance
jq -r '.[] | "\(.platform)\t\(.active_items)"' "${ARTIFACTS_DIR}/pool_active_distribution.json" \
  | tee "${ARTIFACTS_DIR}/pool_active_distribution.tsv" >/dev/null

# =========================
# STEP 3 — REFILL (API)
# =========================
echo "STEP 3 — Trigger refills"
curl -sS -X POST "${APP_ORIGIN}/api/admin/schedule/forecast/refill?date=${TODAY_ET}" \
  -H "x-admin-token: ${AUTH_TOKEN}" \
  | tee "${ARTIFACTS_DIR}/refill_today.json" >/dev/null

curl -sS -X POST "${APP_ORIGIN}/api/admin/schedule/forecast/refill?date=${TODAY_ET}&mode=aggressive" \
  -H "x-admin-token: ${AUTH_TOKEN}" \
  | tee "${ARTIFACTS_DIR}/refill_today_aggressive.json" >/dev/null

curl -sS -X POST "${APP_ORIGIN}/api/admin/schedule/forecast/refill?date=${TOMORROW_ET}" \
  -H "x-admin-token: ${AUTH_TOKEN}" \
  | tee "${ARTIFACTS_DIR}/refill_tomorrow.json" >/dev/null

if jq -e 'has("status") and .status==401' < "${ARTIFACTS_DIR}/refill_today.json" >/dev/null 2>&1; then
  echo "AUTH_TOKEN mismatch: ensure Vercel Production AUTH_TOKEN equals header x-admin-token."
  exit 11
fi

# =========================
# STEP 4 — FORECAST VALIDATION
# =========================
echo "STEP 4 — Forecast validation (today & tomorrow)"
for D in "${TODAY_ET}" "${TOMORROW_ET}"; do
  curl -sS "${APP_ORIGIN}/api/admin/schedule/forecast?date=${D}" \
    | tee "${ARTIFACTS_DIR}/forecast_${D}.json" >/dev/null
  jq '{date, summary, slots: [.slots[] | {time:.time_local,status, platform:(.content.platform//null), type:(.content.content_type//null), id:(.content.id//null)}]}' \
    < "${ARTIFACTS_DIR}/forecast_${D}.json" \
    | tee "${ARTIFACTS_DIR}/forecast_${D}_summary.json" >/dev/null
done

slots_today=$(jq '.slots|length' < "${ARTIFACTS_DIR}/forecast_${TODAY_ET}.json")
slots_tomorrow=$(jq '.slots|length' < "${ARTIFACTS_DIR}/forecast_${TOMORROW_ET}.json")

platforms_2d=$(jq -r '
  [ inputs.slots[].content.platform ] 
  | map(select(.!=null)) 
  | unique 
  | length
' "${ARTIFACTS_DIR}/forecast_${TODAY_ET}.json" "${ARTIFACTS_DIR}/forecast_${TOMORROW_ET}.json")

# =========================
# STEP 5 — scheduled_posts Reality (Supabase REST)
# =========================
echo "STEP 5 — DB scheduled_posts (via REST, UTC window)"
# Filter by scheduled_post_time between UTC start/end
fetch_sched () {
  local start_utc="$1" end_utc="$2" out="$3"
  curl -sS "${SUPABASE_URL}/rest/v1/scheduled_posts?select=id,scheduled_slot_index,scheduled_post_time,actual_posted_at,content_id,platform,content_type,title&scheduled_post_time=gte.${start_utc}&scheduled_post_time=lt.${end_utc}&order=scheduled_slot_index.asc" \
    "${SB_HDR[@]}" \
    | tee "${out}" >/dev/null
}
fetch_sched "${TODAY_UTC_START}" "${TODAY_UTC_END}" "${ARTIFACTS_DIR}/scheduled_today.json"
fetch_sched "${TOMORROW_UTC_START}" "${TOMORROW_UTC_END}" "${ARTIFACTS_DIR}/scheduled_tomorrow.json"

# TSV pretty
jq -r '.[] | "\(.id)\t\(.scheduled_slot_index)\t\(.scheduled_post_time)\t\(.actual_posted_at//"")\t\(.content_id)\t\(.platform)\t\(.content_type)\t\(.title[0:50])"' \
  "${ARTIFACTS_DIR}/scheduled_today.json"    | tee "${ARTIFACTS_DIR}/scheduled_today.tsv" >/dev/null
jq -r '.[] | "\(.id)\t\(.scheduled_slot_index)\t\(.scheduled_post_time)\t\(.actual_posted_at//"")\t\(.content_id)\t\(.platform)\t\(.content_type)\t\(.title[0:50])"' \
  "${ARTIFACTS_DIR}/scheduled_tomorrow.json" | tee "${ARTIFACTS_DIR}/scheduled_tomorrow.tsv" >/dev/null

# =========================
# STEP 6 — Diversity Snapshots
# =========================
echo "STEP 6 — Diversity snapshots (API)"
for D in "${TODAY_ET}" "${TOMORROW_ET}"; do
  echo "=== Diversity for ${D} ===" | tee -a "${ARTIFACTS_DIR}/diversity.txt"
  jq '.summary.platforms' < "${ARTIFACTS_DIR}/forecast_${D}.json" | tee -a "${ARTIFACTS_DIR}/diversity.txt" >/dev/null
done

# =========================
# STEP 7 — Reconcile (optional)
# =========================
echo "STEP 7 — Reconcile (optional)"
curl -sS -X POST "${APP_ORIGIN}/api/admin/schedule/forecast/reconcile?date=${TODAY_ET}" \
  -H "x-admin-token: ${AUTH_TOKEN}" \
  | tee "${ARTIFACTS_DIR}/reconcile_today.json" >/dev/null || true

# =========================
# STEP 8 — Report + Strict PASS/FAIL
# =========================
pass_slots=$([[ "${slots_today}" == "6" && "${slots_tomorrow}" == "6" ]] && echo "OK" || echo "FAIL")
pass_diversity=$([[ "${platforms_2d}" -ge 4 ]] && echo "OK" || echo "FAIL")

{
  echo "# Rebalance Verification Report (Supabase REST)"
  echo "## Health"
  cat "${ARTIFACTS_DIR}/health.json"
  echo
  echo "## Pool Distribution (active) — REST grouped via jq"
  cat "${ARTIFACTS_DIR}/pool_active_distribution.json"
  echo
  echo "## Refill Responses"
  echo "### Today"; cat "${ARTIFACTS_DIR}/refill_today.json"; echo
  echo "### Today (aggressive)"; cat "${ARTIFACTS_DIR}/refill_today_aggressive.json"; echo
  echo "### Tomorrow"; cat "${ARTIFACTS_DIR}/refill_tomorrow.json"; echo
  echo "## Forecast Summaries"
  echo "### ${TODAY_ET}"; cat "${ARTIFACTS_DIR}/forecast_${TODAY_ET}_summary.json"; echo
  echo "### ${TOMORROW_ET}"; cat "${ARTIFACTS_DIR}/forecast_${TOMORROW_ET}_summary.json"; echo
  echo "## DB scheduled_posts (UTC window)"
  echo "### ${TODAY_ET}"; cat "${ARTIFACTS_DIR}/scheduled_today.tsv"; echo
  echo "### ${TOMORROW_ET}"; cat "${ARTIFACTS_DIR}/scheduled_tomorrow.tsv"; echo
  echo "## Diversity (API)"
  cat "${ARTIFACTS_DIR}/diversity.txt"; echo
  echo "## PASS/FAIL Summary"
  echo "slots_filled_today:    ${slots_today}"
  echo "slots_filled_tomorrow: ${slots_tomorrow}"
  echo "platforms_across_2d:   ${platforms_2d}"
  echo "criteria_slots_6_each_day: ${pass_slots}"
  echo "criteria_diversity_>=4:    ${pass_diversity}"
} | tee "${ARTIFACTS_DIR}/rebalance_verification.md" >/dev/null

# Helpful nudges
if [[ "${pass_slots}" == "FAIL" ]]; then
  echo "TROUBLESHOOT: Not all days have 6/6 slots. Ensure refill for D and D+1 is invoked and scheduler respects ingest_priority>=0."
fi
if jq -e '[.slots[]|select(.content==null)]|length>0' < "${ARTIFACTS_DIR}/forecast_${TODAY_ET}.json" >/dev/null 2>&1; then
  echo "TROUBLESHOOT: Enrichment mismatch on TODAY — verify enrichment joins on content_queue.id and platform names."
fi

echo
echo "Artifacts written to: ${ARTIFACTS_DIR}"
ls -1 "${ARTIFACTS_DIR}" || true

# Final exit based on criteria
if [[ "${pass_slots}" == "OK" && "${pass_diversity}" == "OK" ]]; then
  echo "✅ VALIDATION PASSED: All criteria met"
  exit 0
else
  echo "❌ VALIDATION FAILED: See troubleshooting above"
  exit 1
fi