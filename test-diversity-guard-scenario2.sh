#!/bin/bash

# Test script for Availability-Aware Diversity Guard logic - Scenario 2: High quality platforms
set -euo pipefail

# Create test data directory
ARTIFACTS_DIR="test_artifacts_scenario2"
mkdir -p "$ARTIFACTS_DIR"

# Test configuration with lower thresholds for testing
MIN_CANDIDATES="${MIN_CANDIDATES:-3}"
MIN_CONF="${MIN_CONF:-0.70}"

echo "🧪 Testing Availability-Aware Diversity Guard - Scenario 2"
echo "Configuration: MIN_CANDIDATES=${MIN_CANDIDATES}, MIN_CONF=${MIN_CONF}"

# Create mock pool quality data with high-quality platforms
cat > "${ARTIFACTS_DIR}/pool_quality_raw.json" << 'EOF'
[
  {"source_platform": "reddit", "confidence_score": 0.8, "ingest_priority": 0, "is_posted": false, "is_approved": true},
  {"source_platform": "reddit", "confidence_score": 0.9, "ingest_priority": 0, "is_posted": false, "is_approved": true},
  {"source_platform": "reddit", "confidence_score": 0.75, "ingest_priority": 0, "is_posted": false, "is_approved": true},
  {"source_platform": "reddit", "confidence_score": 0.85, "ingest_priority": 0, "is_posted": false, "is_approved": true},
  {"source_platform": "pixabay", "confidence_score": 0.75, "ingest_priority": 0, "is_posted": false, "is_approved": true},
  {"source_platform": "pixabay", "confidence_score": 0.8, "ingest_priority": 0, "is_posted": false, "is_approved": true},
  {"source_platform": "pixabay", "confidence_score": 0.72, "ingest_priority": 0, "is_posted": false, "is_approved": true},
  {"source_platform": "pixabay", "confidence_score": 0.88, "ingest_priority": 0, "is_posted": false, "is_approved": true},
  {"source_platform": "youtube", "confidence_score": 0.9, "ingest_priority": 0, "is_posted": false, "is_approved": true},
  {"source_platform": "youtube", "confidence_score": 0.95, "ingest_priority": 0, "is_posted": false, "is_approved": true},
  {"source_platform": "youtube", "confidence_score": 0.82, "ingest_priority": 0, "is_posted": false, "is_approved": true},
  {"source_platform": "youtube", "confidence_score": 0.78, "ingest_priority": 0, "is_posted": false, "is_approved": true},
  {"source_platform": "tumblr", "confidence_score": 0.8, "ingest_priority": 0, "is_posted": false, "is_approved": true},
  {"source_platform": "tumblr", "confidence_score": 0.75, "ingest_priority": 0, "is_posted": false, "is_approved": true},
  {"source_platform": "tumblr", "confidence_score": 0.9, "ingest_priority": 0, "is_posted": false, "is_approved": true},
  {"source_platform": "giphy", "confidence_score": 0.7, "ingest_priority": 0, "is_posted": false, "is_approved": true},
  {"source_platform": "giphy", "confidence_score": 0.85, "ingest_priority": 0, "is_posted": false, "is_approved": true},
  {"source_platform": "giphy", "confidence_score": 0.72, "ingest_priority": 0, "is_posted": false, "is_approved": true},
  {"source_platform": "bluesky", "confidence_score": 0.75, "ingest_priority": 0, "is_posted": false, "is_approved": true},
  {"source_platform": "bluesky", "confidence_score": 0.8, "ingest_priority": 0, "is_posted": false, "is_approved": true},
  {"source_platform": "bluesky", "confidence_score": 0.88, "ingest_priority": 0, "is_posted": false, "is_approved": true},
  {"source_platform": "imgur", "confidence_score": 0.6, "ingest_priority": 0, "is_posted": false, "is_approved": true},
  {"source_platform": "imgur", "confidence_score": 0.5, "ingest_priority": 0, "is_posted": false, "is_approved": true}
]
EOF

echo "📊 Created mock data with high-quality content across 6 platforms"

# Apply the eligibility analysis logic
jq --argjson min_conf "$MIN_CONF" --argjson min_candidates "$MIN_CANDIDATES" '
  group_by(.source_platform) 
  | map({
      platform: (.[0].source_platform|ascii_downcase),
      eligible: (map(select((.confidence_score // 0) >= $min_conf)) | length),
      total: length
    })
  | map(. + {meets_cap: (.eligible >= $min_candidates)})
' "${ARTIFACTS_DIR}/pool_quality_raw.json" \
  > "${ARTIFACTS_DIR}/eligibility_snapshot.json"

echo "✅ Generated eligibility snapshot:"
cat "${ARTIFACTS_DIR}/eligibility_snapshot.json" | jq .

# Calculate eligible count
eligible_count=$(jq '[.[] | select(.meets_cap==true)] | length' "${ARTIFACTS_DIR}/eligibility_snapshot.json")

echo "📈 Eligible platforms at quality threshold: ${eligible_count}"

# Create TSV summary
jq -r '.[] | "\(.platform)\t\(.total)\t\(.eligible)\t\(.meets_cap)"' "${ARTIFACTS_DIR}/eligibility_snapshot.json" \
  > "${ARTIFACTS_DIR}/eligibility_summary.tsv"

echo "📋 Eligibility summary (platform | total | eligible | meets_cap):"
cat "${ARTIFACTS_DIR}/eligibility_summary.tsv"

# Test diversity validation logic with enough platforms
platforms_2d=5  # Mock: 5 platforms across 2 days (exceeds requirement)

echo ""
echo "🎯 Testing diversity validation logic..."
echo "Mock platforms_2d: ${platforms_2d}"

# Apply availability-aware diversity validation
if (( eligible_count >= 4 )); then
  pass_diversity=$([[ "${platforms_2d}" -ge 4 ]] && echo "OK" || echo "FAIL")
  diversity_note="Eligible platforms >=4; enforcing diversity>=4"
else
  pass_diversity="WARN"
  diversity_note="Eligible platforms <4 (pool lacks depth at MIN_CONF=${MIN_CONF}, MIN_CANDIDATES=${MIN_CANDIDATES}); diversity not enforced"
fi

echo "🔍 Results:"
echo "  eligible_platforms_at_quality: ${eligible_count}"
echo "  diversity_policy: ${diversity_note}"
echo "  criteria_diversity_result: ${pass_diversity}"

# Test final exit logic
if [[ "${pass_diversity}" == "OK" || "${pass_diversity}" == "WARN" ]]; then
  if [[ "${pass_diversity}" == "WARN" ]]; then
    echo "⚠️ WOULD PASS WITH WARNING: diversity warning due to limited platform pool quality"
  else
    echo "✅ WOULD PASS: All criteria met"
  fi
else
  echo "❌ WOULD FAIL: Diversity requirements not met"
fi

# Test failure scenario
echo ""
echo "🧪 Testing failure scenario (insufficient diversity)..."
platforms_2d=2  # Only 2 platforms (below requirement when >=4 eligible)

if (( eligible_count >= 4 )); then
  pass_diversity_fail=$([[ "${platforms_2d}" -ge 4 ]] && echo "OK" || echo "FAIL")
  diversity_note_fail="Eligible platforms >=4; enforcing diversity>=4"
else
  pass_diversity_fail="WARN"
  diversity_note_fail="Eligible platforms <4 (pool lacks depth at MIN_CONF=${MIN_CONF}, MIN_CANDIDATES=${MIN_CANDIDATES}); diversity not enforced"
fi

echo "🔍 Failure scenario results:"
echo "  platforms_across_2d: ${platforms_2d}"
echo "  criteria_diversity_result: ${pass_diversity_fail}"

if [[ "${pass_diversity_fail}" == "OK" || "${pass_diversity_fail}" == "WARN" ]]; then
  echo "⚠️ WOULD PASS"
else
  echo "❌ WOULD FAIL: Insufficient diversity when platforms are available"
fi

echo ""
echo "🧪 Test completed successfully!"
echo "📁 Artifacts in: ${ARTIFACTS_DIR}/"
ls -la "${ARTIFACTS_DIR}/"

# Cleanup
rm -rf "${ARTIFACTS_DIR}"
echo "🧹 Cleaned up test artifacts"