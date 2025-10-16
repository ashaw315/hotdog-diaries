#!/bin/bash

##
# Hotdog Diaries Smoke Test Suite
#
# Comprehensive health checks for all critical system endpoints.
# Exits 0 on success, non-zero on failure with clear error messages.
#
# Usage:
#   ./scripts/smoke.sh                    # Test production
#   ./scripts/smoke.sh --dev              # Test development  
#   ./scripts/smoke.sh --load-test        # Include load testing
#   ./scripts/smoke.sh --help             # Show help
##

set -e

# Default configuration
BASE_URL="https://hotdog-diaries.vercel.app"
LOAD_TEST=false
TIMEOUT=30
VERBOSE=false
OUTPUT_FORMAT="human"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
declare -a FAILURES=()

##
# Helper Functions
##

log_info() {
    if [[ "$OUTPUT_FORMAT" == "human" ]]; then
        echo -e "${BLUE}ℹ️  $1${NC}"
    fi
}

log_success() {
    if [[ "$OUTPUT_FORMAT" == "human" ]]; then
        echo -e "${GREEN}✅ $1${NC}"
    fi
    ((PASSED_TESTS++))
}

log_warning() {
    if [[ "$OUTPUT_FORMAT" == "human" ]]; then
        echo -e "${YELLOW}⚠️  $1${NC}"
    fi
}

log_error() {
    if [[ "$OUTPUT_FORMAT" == "human" ]]; then
        echo -e "${RED}❌ $1${NC}"
    fi
    FAILURES+=("$1")
    ((FAILED_TESTS++))
}

log_verbose() {
    if [[ "$VERBOSE" == true ]]; then
        echo -e "${NC}🔍 $1${NC}"
    fi
}

increment_test() {
    ((TOTAL_TESTS++))
}

##
# Test Functions
##

test_system_metrics() {
    log_info "Testing system metrics endpoint..."
    increment_test
    
    local response
    local http_code
    
    response=$(curl -s -w "\n%{http_code}" --max-time $TIMEOUT "$BASE_URL/api/system/metrics" || echo "000")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    if [[ "$http_code" != "200" ]]; then
        log_error "System metrics returned HTTP $http_code"
        return 1
    fi
    
    # Validate JSON structure
    if ! echo "$body" | jq -e '.timestamp and .health_status' > /dev/null 2>&1; then
        log_error "System metrics missing required fields"
        return 1
    fi
    
    local health_status
    health_status=$(echo "$body" | jq -r '.health_status')
    
    if [[ "$health_status" != "healthy" ]]; then
        log_warning "System health status: $health_status"
    fi
    
    log_success "System metrics endpoint healthy"
    log_verbose "Health status: $health_status"
    return 0
}

test_deep_health() {
    log_info "Testing deep health check..."
    increment_test
    
    if [[ -z "$AUTH_TOKEN" ]]; then
        log_error "AUTH_TOKEN environment variable required for deep health check"
        return 1
    fi
    
    local response
    local http_code
    
    response=$(curl -s -w "\n%{http_code}" --max-time $TIMEOUT \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        "$BASE_URL/api/admin/health/deep" || echo "000")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    if [[ "$http_code" == "401" ]]; then
        log_error "Deep health check authentication failed - check AUTH_TOKEN"
        return 1
    elif [[ "$http_code" != "200" ]]; then
        log_error "Deep health check returned HTTP $http_code"
        return 1
    fi
    
    # Check component health
    local database_status
    local scheduler_status
    
    database_status=$(echo "$body" | jq -r '.components.database.status // "unknown"')
    scheduler_status=$(echo "$body" | jq -r '.components.scheduler.status // "unknown"')
    
    if [[ "$database_status" != "healthy" ]]; then
        log_error "Database health check failed: $database_status"
        return 1
    fi
    
    if [[ "$scheduler_status" != "healthy" ]]; then
        log_warning "Scheduler health degraded: $scheduler_status"
    fi
    
    log_success "Deep health check passed"
    log_verbose "Database: $database_status, Scheduler: $scheduler_status"
    return 0
}

test_auth_token() {
    log_info "Testing auth token validation..."
    increment_test
    
    if [[ -z "$AUTH_TOKEN" ]]; then
        log_error "AUTH_TOKEN environment variable required"
        return 1
    fi
    
    local response
    local http_code
    
    response=$(curl -s -w "\n%{http_code}" --max-time $TIMEOUT \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        "$BASE_URL/api/admin/health/auth-token" || echo "000")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    if [[ "$http_code" != "200" ]]; then
        log_error "Auth token validation returned HTTP $http_code"
        return 1
    fi
    
    local valid
    valid=$(echo "$body" | jq -r '.data.valid // false')
    
    if [[ "$valid" != "true" ]]; then
        log_error "Auth token validation failed"
        return 1
    fi
    
    log_success "Auth token validation passed"
    return 0
}

test_forecast_endpoints() {
    log_info "Testing forecast endpoints..."
    
    if [[ -z "$AUTH_TOKEN" ]]; then
        log_error "AUTH_TOKEN environment variable required for forecast tests"
        return 1
    fi
    
    local today
    today=$(date -u +%Y-%m-%d)
    
    # Test today's forecast
    increment_test
    local response
    local http_code
    
    response=$(curl -s -w "\n%{http_code}" --max-time $TIMEOUT \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        "$BASE_URL/api/admin/schedule/forecast?date=$today" || echo "000")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    if [[ "$http_code" != "200" ]]; then
        log_error "Today's forecast returned HTTP $http_code"
        return 1
    fi
    
    # Validate forecast structure
    local slots_count
    slots_count=$(echo "$body" | jq -r '.data.slots | length')
    
    if [[ "$slots_count" != "6" ]]; then
        log_error "Forecast should have 6 slots, got $slots_count"
        return 1
    fi
    
    log_success "Today's forecast endpoint healthy"
    
    # Test tomorrow's forecast
    increment_test
    local tomorrow
    tomorrow=$(date -u -d "tomorrow" +%Y-%m-%d)
    
    response=$(curl -s -w "\n%{http_code}" --max-time $TIMEOUT \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        "$BASE_URL/api/admin/schedule/forecast?date=$tomorrow" || echo "000")
    
    http_code=$(echo "$response" | tail -n1)
    
    if [[ "$http_code" != "200" ]]; then
        log_error "Tomorrow's forecast returned HTTP $http_code"
        return 1
    fi
    
    log_success "Tomorrow's forecast endpoint healthy"
    return 0
}

test_load_performance() {
    if [[ "$LOAD_TEST" != true ]]; then
        return 0
    fi
    
    log_info "Running load tests..."
    increment_test
    
    local start_time
    local end_time
    local duration
    
    start_time=$(date +%s.%N)
    
    # Test 5 concurrent requests to system metrics
    for i in {1..5}; do
        curl -s --max-time $TIMEOUT "$BASE_URL/api/system/metrics" > /dev/null &
    done
    
    wait
    
    end_time=$(date +%s.%N)
    duration=$(echo "$end_time - $start_time" | bc)
    
    # Should complete within reasonable time (10 seconds for 5 requests)
    if (( $(echo "$duration > 10" | bc -l) )); then
        log_error "Load test took too long: ${duration}s"
        return 1
    fi
    
    log_success "Load test completed in ${duration}s"
    return 0
}

test_response_times() {
    log_info "Testing response times..."
    increment_test
    
    local start_time
    local end_time
    local duration
    
    # Test system metrics response time
    start_time=$(date +%s.%N)
    curl -s --max-time $TIMEOUT "$BASE_URL/api/system/metrics" > /dev/null
    end_time=$(date +%s.%N)
    duration=$(echo "$end_time - $start_time" | bc)
    
    # Should respond within 5 seconds
    if (( $(echo "$duration > 5" | bc -l) )); then
        log_warning "Slow response time for system metrics: ${duration}s"
    else
        log_success "Response time acceptable: ${duration}s"
    fi
    
    return 0
}

##
# Utility Functions
##

show_help() {
    cat << EOF
Hotdog Diaries Smoke Test Suite

USAGE:
    ./scripts/smoke.sh [OPTIONS]

OPTIONS:
    --dev             Test development environment (localhost:3000)
    --load-test       Include load testing (concurrent requests)
    --timeout SEC     Request timeout in seconds (default: 30)
    --verbose         Show detailed output
    --json            Output results in JSON format
    --help            Show this help message

ENVIRONMENT VARIABLES:
    AUTH_TOKEN        Required for admin endpoint tests
    BASE_URL          Override default URL (default: https://hotdog-diaries.vercel.app)

EXAMPLES:
    ./scripts/smoke.sh                    # Test production
    ./scripts/smoke.sh --dev              # Test development
    ./scripts/smoke.sh --load-test        # Include load tests
    AUTH_TOKEN=xyz ./scripts/smoke.sh     # Test with auth token

EXIT CODES:
    0    All tests passed
    1    One or more tests failed
    2    Configuration error

EOF
}

print_summary() {
    echo ""
    if [[ "$OUTPUT_FORMAT" == "json" ]]; then
        cat << EOF
{
  "timestamp": "$(date -u -Iseconds)",
  "environment": "$BASE_URL",
  "summary": {
    "total": $TOTAL_TESTS,
    "passed": $PASSED_TESTS,
    "failed": $FAILED_TESTS,
    "success_rate": $(echo "scale=2; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc)
  },
  "failures": $(printf '%s\n' "${FAILURES[@]}" | jq -R . | jq -s .)
}
EOF
    else
        echo "===================="
        echo "📊 SMOKE TEST SUMMARY"
        echo "===================="
        echo "🌐 Environment: $BASE_URL"
        echo "📈 Total Tests: $TOTAL_TESTS"
        echo "✅ Passed: $PASSED_TESTS"
        echo "❌ Failed: $FAILED_TESTS"
        
        if [[ $FAILED_TESTS -eq 0 ]]; then
            echo -e "\n${GREEN}🎉 ALL TESTS PASSED!${NC}"
        else
            echo -e "\n${RED}💥 FAILURES DETECTED:${NC}"
            for failure in "${FAILURES[@]}"; do
                echo -e "${RED}  • $failure${NC}"
            done
        fi
        echo ""
    fi
}

##
# Main execution
##

main() {
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dev)
                BASE_URL="http://localhost:3000"
                shift
                ;;
            --load-test)
                LOAD_TEST=true
                shift
                ;;
            --timeout)
                TIMEOUT="$2"
                shift 2
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            --json)
                OUTPUT_FORMAT="json"
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                echo "Use --help for usage information"
                exit 2
                ;;
        esac
    done
    
    # Override BASE_URL from environment if set
    if [[ -n "$BASE_URL_OVERRIDE" ]]; then
        BASE_URL="$BASE_URL_OVERRIDE"
    fi
    
    # Check dependencies
    if ! command -v curl &> /dev/null; then
        log_error "curl is required but not installed"
        exit 2
    fi
    
    if ! command -v jq &> /dev/null; then
        log_error "jq is required but not installed"
        exit 2
    fi
    
    if [[ "$LOAD_TEST" == true ]] && ! command -v bc &> /dev/null; then
        log_error "bc is required for load testing but not installed"
        exit 2
    fi
    
    # Start smoke tests
    if [[ "$OUTPUT_FORMAT" == "human" ]]; then
        echo "🔥 Starting Hotdog Diaries smoke tests..."
        echo "🌐 Target: $BASE_URL"
        echo ""
    fi
    
    # Run test suite
    test_system_metrics
    test_response_times
    
    # Only run auth-required tests if token is available
    if [[ -n "$AUTH_TOKEN" ]]; then
        test_auth_token
        test_deep_health  
        test_forecast_endpoints
    else
        log_warning "Skipping admin tests - AUTH_TOKEN not set"
    fi
    
    # Optional load testing
    test_load_performance
    
    # Print summary and exit
    print_summary
    
    if [[ $FAILED_TESTS -eq 0 ]]; then
        exit 0
    else
        exit 1
    fi
}

# Execute main function
main "$@"