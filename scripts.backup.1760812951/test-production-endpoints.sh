#!/bin/bash

# Test script to verify production endpoints are working
# Usage: ./scripts/test-production-endpoints.sh https://your-site.vercel.app your_auth_token

SITE_URL=$1
AUTH_TOKEN=$2

if [ -z "$SITE_URL" ] || [ -z "$AUTH_TOKEN" ]; then
    echo "Usage: $0 <SITE_URL> <AUTH_TOKEN>"
    echo "Example: $0 https://your-site.vercel.app eyJhbGciOiJIUzI1NiIs..."
    exit 1
fi

echo "🧪 Testing Production Endpoints..."
echo "Site: $SITE_URL"
echo "Token: ${AUTH_TOKEN:0:20}..."
echo

# Test 1: Health check (should work without auth)
echo "1. Testing health endpoint..."
response=$(curl -s -w "HTTP_STATUS:%{http_code}" "$SITE_URL/api/health" 2>/dev/null)
http_code=$(echo "$response" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
body=$(echo "$response" | sed 's/HTTP_STATUS:[0-9]*$//')

if [ "$http_code" = "200" ]; then
    echo "✅ Health check passed"
else
    echo "❌ Health check failed (Status: $http_code)"
fi

echo

# Test 2: Cleanup endpoint
echo "2. Testing cleanup endpoint..."
response=$(curl -s -w "HTTP_STATUS:%{http_code}" \
    -X POST "$SITE_URL/api/admin/cleanup-duplicates" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"dry_run": true}' 2>/dev/null)

http_code=$(echo "$response" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
body=$(echo "$response" | sed 's/HTTP_STATUS:[0-9]*$//')

echo "Status: $http_code"
if [ "$http_code" = "200" ]; then
    echo "✅ Cleanup endpoint working"
    echo "Response: $body" | head -c 100
    echo "..."
elif [ "$http_code" = "401" ]; then
    echo "❌ Authentication failed - check AUTH_TOKEN"
elif [ "$http_code" = "404" ]; then
    echo "❌ Endpoint not found - may need deployment"
else
    echo "❌ Cleanup endpoint failed"
    echo "Response: $body" | head -c 200
fi

echo -e "\n"

# Test 3: Monitor endpoint  
echo "3. Testing monitor endpoint..."
response=$(curl -s -w "HTTP_STATUS:%{http_code}" \
    -X GET "$SITE_URL/api/admin/monitor/duplicates" \
    -H "Authorization: Bearer $AUTH_TOKEN" 2>/dev/null)

http_code=$(echo "$response" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
body=$(echo "$response" | sed 's/HTTP_STATUS:[0-9]*$//')

echo "Status: $http_code"
if [ "$http_code" = "200" ]; then
    echo "✅ Monitor endpoint working"
    echo "Response: $body" | head -c 100
    echo "..."
elif [ "$http_code" = "401" ]; then
    echo "❌ Authentication failed - check AUTH_TOKEN"
elif [ "$http_code" = "404" ]; then
    echo "❌ Endpoint not found - may need deployment"
else
    echo "❌ Monitor endpoint failed"
    echo "Response: $body" | head -c 200
fi

echo -e "\n"

# Test 4: Sync endpoint
echo "4. Testing sync endpoint..."
response=$(curl -s -w "HTTP_STATUS:%{http_code}" \
    -X POST "$SITE_URL/api/admin/sync/posted-flags" \
    -H "Authorization: Bearer $AUTH_TOKEN" 2>/dev/null)

http_code=$(echo "$response" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
body=$(echo "$response" | sed 's/HTTP_STATUS:[0-9]*$//')

echo "Status: $http_code"
if [ "$http_code" = "200" ]; then
    echo "✅ Sync endpoint working" 
    echo "Response: $body" | head -c 100
    echo "..."
elif [ "$http_code" = "401" ]; then
    echo "❌ Authentication failed - check AUTH_TOKEN"
elif [ "$http_code" = "404" ]; then
    echo "❌ Endpoint not found - may need deployment"
else
    echo "❌ Sync endpoint failed"
    echo "Response: $body" | head -c 200
fi

echo -e "\n📋 Summary:"
echo "If endpoints return 404, you need to deploy the latest code."
echo "If endpoints return 401, check your AUTH_TOKEN secret in GitHub."
echo "If endpoints return 500, check your Supabase configuration."
echo -e "\nNext: Run 'git add . && git commit -m \"fix: Update duplicate cleanup workflow\" && git push' to deploy fixes"