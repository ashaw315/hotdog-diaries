#!/bin/bash

# 24-Hour Recovery Monitoring Script for Hotdog Diaries
# This script monitors the system recovery after the 5-day outage
# Run every 4 hours to check system health

echo "🏥 Hotdog Diaries 24-Hour Recovery Monitor"
echo "=========================================="
echo "⏰ Started: $(date -u)"
echo ""

# Configuration
SITE_URL="https://hotdog-diaries.vercel.app"
# AUTH_TOKEN should be set in environment variables
if [ -z "$AUTH_TOKEN" ]; then
    echo "❌ Error: AUTH_TOKEN environment variable is not set"
    echo "Please set AUTH_TOKEN in your .env.local file or export it before running this script"
    exit 1
fi

# Success criteria counters
CHECKS_PASSED=0
CHECKS_TOTAL=6

# Check 1: Production Posts Today
echo "1. 📊 Checking for new production posts..."
RECENT_POSTS=$(curl -s "$SITE_URL/api/feed" | grep -c "posted_at.*2025-08-2[7-8]" || echo 0)
if [ "$RECENT_POSTS" -gt 0 ]; then
    echo "   ✅ Found $RECENT_POSTS posts from Aug 27-28"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
else
    echo "   ❌ No posts found from Aug 27-28"
    echo "   🔍 Last posts:"
    curl -s "$SITE_URL/api/feed" | grep -o '"posted_at":"[^"]*"' | head -3
fi
echo ""

# Check 2: GitHub Actions Status
echo "2. 🔧 Checking GitHub Actions workflows..."
FAILED_WORKFLOWS=$(gh run list --limit 10 --json conclusion | grep -c "failure" || echo 0)
if [ "$FAILED_WORKFLOWS" -eq 0 ]; then
    echo "   ✅ All recent workflows successful"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
elif [ "$FAILED_WORKFLOWS" -lt 3 ]; then
    echo "   ⚠️  $FAILED_WORKFLOWS minor workflow failures (acceptable)"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
else
    echo "   ❌ $FAILED_WORKFLOWS workflow failures detected"
fi
echo ""

# Check 3: Production API Health
echo "3. 🌐 Testing production API endpoints..."
HEALTH_STATUS=$(curl -s -w "%{http_code}" "$SITE_URL/api/health" | tail -n1)
if [ "$HEALTH_STATUS" = "200" ]; then
    echo "   ✅ Health endpoint responding (HTTP 200)"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
else
    echo "   ❌ Health endpoint failed (HTTP $HEALTH_STATUS)"
fi

# Check posting API
POSTING_STATUS=$(curl -s -w "%{http_code}" -H "Authorization: Bearer $AUTH_TOKEN" "$SITE_URL/api/admin/posting/post-now" | tail -n1)
if [ "$POSTING_STATUS" = "200" ]; then
    echo "   ✅ Posting API accessible (HTTP 200)"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
else
    echo "   ❌ Posting API failed (HTTP $POSTING_STATUS)"
fi
echo ""

# Check 4: Content Pipeline Health
echo "4. 📋 Checking content pipeline..."
SYSTEM_HEALTH=$(curl -s -H "Authorization: Bearer $AUTH_TOKEN" "$SITE_URL/api/admin/system-verification" 2>/dev/null | grep -o '"healthStatus":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
case "$SYSTEM_HEALTH" in
    "healthy")
        echo "   ✅ Content pipeline healthy"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
        ;;
    "warning")
        echo "   ⚠️  Content pipeline has warnings (acceptable)"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
        ;;
    *)
        echo "   ❌ Content pipeline health: $SYSTEM_HEALTH"
        ;;
esac
echo ""

# Check 5: Platform Diversity
echo "5. 🎨 Checking platform diversity..."
PLATFORM_DATA=$(curl -s "$SITE_URL/api/feed" | head -c 3000 | grep -o '"source_platform":"[^"]*"' | sort | uniq -c | sort -nr)
if [ -n "$PLATFORM_DATA" ]; then
    TOTAL_POSTS=$(echo "$PLATFORM_DATA" | awk '{sum += $1} END {print sum}')
    MAX_PLATFORM_COUNT=$(echo "$PLATFORM_DATA" | head -1 | awk '{print $1}')
    MAX_PERCENTAGE=$(echo "$MAX_PLATFORM_COUNT * 100 / $TOTAL_POSTS" | bc -l | cut -d. -f1)
    
    if [ "$MAX_PERCENTAGE" -le 30 ]; then
        echo "   ✅ Platform diversity healthy (max: ${MAX_PERCENTAGE}%)"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
    else
        echo "   ⚠️  Platform imbalance detected (max: ${MAX_PERCENTAGE}%)"
        echo "   📊 Distribution:"
        echo "$PLATFORM_DATA" | head -3 | sed 's/^/      /'
    fi
else
    echo "   ❌ Could not check platform diversity"
fi
echo ""

# Check 6: Posting Schedule Adherence  
echo "6. ⏰ Checking posting schedule adherence..."
CURRENT_HOUR=$(date -u +%H)
LAST_POST_TIME=$(curl -s "$SITE_URL/api/feed" | grep -o '"posted_at":"[^"]*"' | head -1 | sed 's/"posted_at":"//g' | sed 's/"//g')

if [ -n "$LAST_POST_TIME" ]; then
    LAST_POST_UNIX=$(date -d "$LAST_POST_TIME" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%S" "${LAST_POST_TIME%.*}" +%s 2>/dev/null || echo "0")
    CURRENT_UNIX=$(date +%s)
    HOURS_SINCE=$((($CURRENT_UNIX - $LAST_POST_UNIX) / 3600))
    
    if [ "$HOURS_SINCE" -le 6 ]; then
        echo "   ✅ Last post $HOURS_SINCE hours ago (within schedule)"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
    elif [ "$HOURS_SINCE" -le 8 ]; then
        echo "   ⚠️  Last post $HOURS_SINCE hours ago (slightly delayed)"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
    else
        echo "   ❌ Last post $HOURS_SINCE hours ago (missed schedule)"
    fi
else
    echo "   ❌ Could not determine last post time"
fi
echo ""

# Generate Summary Report
echo "📊 MONITORING SUMMARY"
echo "===================="
SUCCESS_RATE=$(echo "$CHECKS_PASSED * 100 / $CHECKS_TOTAL" | bc -l | cut -d. -f1)

if [ "$CHECKS_PASSED" -eq "$CHECKS_TOTAL" ]; then
    echo "🎉 Status: FULLY RECOVERED ($CHECKS_PASSED/$CHECKS_TOTAL checks passed)"
    echo "✅ Success Rate: $SUCCESS_RATE%"
    echo "🚀 System is operating normally!"
elif [ "$CHECKS_PASSED" -ge 4 ]; then
    echo "🟡 Status: MOSTLY RECOVERED ($CHECKS_PASSED/$CHECKS_TOTAL checks passed)"  
    echo "⚠️  Success Rate: $SUCCESS_RATE%"
    echo "🔧 Minor issues remain but core functionality working"
else
    echo "🔴 Status: PARTIAL RECOVERY ($CHECKS_PASSED/$CHECKS_TOTAL checks passed)"
    echo "❌ Success Rate: $SUCCESS_RATE%"
    echo "🚨 Major issues still present - investigation needed"
fi

echo ""
echo "⏰ Completed: $(date -u)"
echo "🔄 Next check in 4 hours"

# Exit with status code based on success rate
if [ "$CHECKS_PASSED" -ge 5 ]; then
    exit 0  # Success
elif [ "$CHECKS_PASSED" -ge 3 ]; then
    exit 1  # Warning
else
    exit 2  # Critical
fi