#!/bin/bash
# Refresh authentication token for GitHub Actions
# This script is called before each scheduled job to ensure fresh tokens

set -e

# Check required environment variables
if [ -z "$SITE_URL" ]; then
  echo "❌ SITE_URL is not set"
  exit 1
fi

if [ -z "$SERVICE_ACCOUNT_SECRET" ] && [ -z "$REFRESH_TOKEN" ]; then
  echo "❌ Neither SERVICE_ACCOUNT_SECRET nor REFRESH_TOKEN is set"
  exit 1
fi

# Function to refresh token using service account
refresh_with_service_account() {
  echo "🔐 Refreshing token using service account..."
  
  RESPONSE=$(curl -s -X POST "$SITE_URL/api/auth/refresh" \
    -H "Content-Type: application/json" \
    -d "{\"serviceAccount\": \"$SERVICE_ACCOUNT_SECRET\"}")
  
  # Extract token from response
  ACCESS_TOKEN=$(echo "$RESPONSE" | jq -r '.accessToken')
  
  if [ "$ACCESS_TOKEN" == "null" ] || [ -z "$ACCESS_TOKEN" ]; then
    echo "❌ Failed to refresh token with service account"
    echo "Response: $RESPONSE"
    return 1
  fi
  
  echo "✅ Token refreshed successfully (service account)"
  echo "TOKEN_TYPE=service"
  echo "ACCESS_TOKEN=$ACCESS_TOKEN"
  
  # Export for GitHub Actions
  echo "AUTH_TOKEN=$ACCESS_TOKEN" >> $GITHUB_ENV
  echo "::add-mask::$ACCESS_TOKEN"
  
  return 0
}

# Function to refresh token using refresh token
refresh_with_refresh_token() {
  echo "🔐 Refreshing token using refresh token..."
  
  RESPONSE=$(curl -s -X POST "$SITE_URL/api/auth/refresh" \
    -H "Content-Type: application/json" \
    -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}")
  
  # Extract tokens from response
  ACCESS_TOKEN=$(echo "$RESPONSE" | jq -r '.accessToken')
  NEW_REFRESH_TOKEN=$(echo "$RESPONSE" | jq -r '.refreshToken')
  
  if [ "$ACCESS_TOKEN" == "null" ] || [ -z "$ACCESS_TOKEN" ]; then
    echo "❌ Failed to refresh token with refresh token"
    echo "Response: $RESPONSE"
    return 1
  fi
  
  echo "✅ Token refreshed successfully (refresh token)"
  echo "TOKEN_TYPE=bearer"
  echo "ACCESS_TOKEN=$ACCESS_TOKEN"
  
  # Export for GitHub Actions
  echo "AUTH_TOKEN=$ACCESS_TOKEN" >> $GITHUB_ENV
  echo "::add-mask::$ACCESS_TOKEN"
  
  # Update refresh token if provided
  if [ "$NEW_REFRESH_TOKEN" != "null" ] && [ -n "$NEW_REFRESH_TOKEN" ]; then
    echo "NEW_REFRESH_TOKEN=$NEW_REFRESH_TOKEN" >> $GITHUB_ENV
    echo "::add-mask::$NEW_REFRESH_TOKEN"
    echo "📝 New refresh token received"
  fi
  
  return 0
}

# Main logic
echo "🌭 Hotdog Diaries Token Refresh"
echo "================================"

# Try service account first (preferred for CI/CD)
if [ -n "$SERVICE_ACCOUNT_SECRET" ]; then
  if refresh_with_service_account; then
    exit 0
  fi
  echo "⚠️ Service account refresh failed, trying refresh token..."
fi

# Fallback to refresh token
if [ -n "$REFRESH_TOKEN" ]; then
  if refresh_with_refresh_token; then
    exit 0
  fi
fi

# If both methods fail, try using existing AUTH_TOKEN if still valid
if [ -n "$AUTH_TOKEN" ]; then
  echo "⚠️ Token refresh failed, checking existing token..."
  
  # Test if existing token still works
  TEST_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    "$SITE_URL/api/admin/queue/status")
  
  if [ "$TEST_RESPONSE" == "200" ]; then
    echo "✅ Existing token is still valid"
    exit 0
  fi
fi

echo "❌ CRITICAL: All token refresh methods failed"
echo "Manual intervention required:"
echo "1. Generate new service account token"
echo "2. Update SERVICE_ACCOUNT_SECRET in GitHub Secrets"
echo "3. Or update REFRESH_TOKEN with valid refresh token"
exit 1