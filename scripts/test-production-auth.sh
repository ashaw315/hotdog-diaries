#!/bin/bash

# Test script to verify production AUTH_TOKEN is working
# Run this after updating Vercel environment variables

AUTH_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoiYWRtaW4iLCJpYXQiOjE3NjE2NzQzMDMsImV4cCI6MTc2MTc2MDcwMywiYXVkIjoiYWRtaW4iLCJpc3MiOiJob3Rkb2ctZGlhcmllcyJ9.ciBK7Jr2V2NNg1DjXt6IP-Upy18urCT8jtSusFUCg-0"
SITE_URL="https://hotdog-diaries.vercel.app"

echo "🧪 Testing production AUTH_TOKEN authentication..."
echo ""

# Test the refill endpoint
echo "📋 Testing refill endpoint..."
TOMORROW=$(date -d "+1 day" +%Y-%m-%d)

RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" \
  -X POST \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"days": 1}' \
  "$SITE_URL/api/admin/schedule/forecast/refill?date=$TOMORROW" \
  --max-time 30)

HTTP_STATUS=$(echo $RESPONSE | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
BODY=$(echo $RESPONSE | sed -e 's/HTTPSTATUS:.*//')

echo "HTTP Status: $HTTP_STATUS"
echo "Response: $BODY"

if [ "$HTTP_STATUS" -eq 200 ]; then
    echo "✅ Authentication successful! Production AUTH_TOKEN is working."
    echo ""
    echo "🚀 You can now run the scheduler workflow:"
    echo "   gh workflow run scheduler.yml --field operation=refill --field days=2"
else
    echo "❌ Authentication failed. Status: $HTTP_STATUS"
    echo "🔧 Next steps:"
    echo "   1. Verify Vercel environment variable AUTH_TOKEN is updated"
    echo "   2. Trigger a new deployment to refresh environment variables"
    echo "   3. Wait a few minutes for deployment to complete"
fi