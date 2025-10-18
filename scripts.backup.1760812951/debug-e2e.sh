#!/bin/bash

# Debug E2E Tests - Playwright Server Startup Debugging
# 
# This script enables verbose server logs during E2E testing for debugging
# server startup issues and health endpoint readiness.

echo "🔍 E2E Test Debug Mode"
echo "======================"
echo ""
echo "🎬 This will run Playwright tests with verbose server startup logging"
echo "✅ You'll see detailed messages about server readiness checks"
echo "🌐 Health endpoint: http://127.0.0.1:3000/api/health"
echo ""

# Set debug environment variables
export DEBUG="pw:webserver"
export PLAYWRIGHT_BASE_URL="http://127.0.0.1:3000"
export DATABASE_URL_SQLITE="./test_hotdog_diaries.db"
export NODE_ENV="test" 
export JWT_SECRET="test-jwt-secret-for-e2e-debugging"
export CI="true"

echo "🔧 Environment configured:"
echo "   DEBUG: $DEBUG"
echo "   PLAYWRIGHT_BASE_URL: $PLAYWRIGHT_BASE_URL" 
echo "   NODE_ENV: $NODE_ENV"
echo "   CI: $CI"
echo ""

echo "📋 Running with debug output..."
echo "Look for these key messages:"
echo "   [pw:webserver] waiting for http://127.0.0.1:3000/api/health"
echo "   [pw:webserver] 200 GET /api/health"
echo ""

# Run Playwright tests with debug output
npm run test:e2e

echo ""
echo "🎯 Debug session complete!"
echo ""
echo "💡 Tips for debugging:"
echo "   - Server startup logs appear above"
echo "   - Look for 'waiting for /api/health' messages"
echo "   - Health endpoint should return 200 OK before tests start"
echo "   - If tests still timeout, check server build and database init"