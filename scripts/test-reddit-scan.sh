#!/bin/bash

# Test Reddit scanner endpoint directly
set -a
source .env.production
set +a

echo "Testing Reddit scan endpoint..."
echo ""

RESPONSE=$(curl -X POST "https://hotdog-diaries.vercel.app/api/admin/smart-scan" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"platform": "reddit", "forceOverride": true, "maxPosts": 5}' \
  -w "\n\nHTTP_STATUS:%{http_code}\nTIME_TOTAL:%{time_total}s\n" \
  2>&1)

echo "Response:"
echo "$RESPONSE"
echo ""
echo "Attempting to parse as JSON:"
echo "$RESPONSE" | jq '.' 2>&1 || echo "Failed to parse as JSON"
