#!/bin/bash

# API Connectivity Triager - Admin Endpoint Testing Script
# Tests admin endpoints in parallel and provides latency analysis

set -euo pipefail
IFS=$'\n\t'

# =========================
# Configuration
# =========================

# Default values
DEFAULT_BASE_URL="http://localhost:3001"
DEFAULT_PARALLEL_JOBS=5
DEFAULT_TIMEOUT=5
DEFAULT_THRESHOLD_MS=2000

# Parse environment or use defaults
BASE_URL="${BASE_URL:-$DEFAULT_BASE_URL}"
PARALLEL_JOBS="${PARALLEL_JOBS:-$DEFAULT_PARALLEL_JOBS}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-$DEFAULT_TIMEOUT}"
THRESHOLD_MS="${THRESHOLD_MS:-$DEFAULT_THRESHOLD_MS}"
AUTH_TOKEN="${AUTH_TOKEN:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Temporary directory for test results
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# =========================
# Admin Endpoints to Test
# =========================

# Core admin endpoints (curated list)
ADMIN_ENDPOINTS=(
  # Health checks
  "GET:/api/admin/health/deep"
  "GET:/api/admin/health/middleware-example"
  
  # Authentication
  "GET:/api/admin/auth/me"
  "GET:/api/admin/me"
  
  # Dashboard and stats
  "GET:/api/admin/dashboard/stats"
  "GET:/api/admin/content/stats" 
  "GET:/api/admin/queue/stats"
  "GET:/api/admin/queue/health"
  
  # Content management
  "GET:/api/admin/content/simple-queue"
  "GET:/api/admin/content/posted"
  
  # Platform status
  "GET:/api/admin/platforms/status"
  "GET:/api/admin/youtube/status"
  "GET:/api/admin/reddit/status"
  "GET:/api/admin/pixabay/status"
  "GET:/api/admin/imgur/status"
  "GET:/api/admin/giphy/status"
  
  # System monitoring
  "GET:/api/admin/automation-health"
  "GET:/api/admin/db-health"
  "GET:/api/admin/logs"
  
  # Testing endpoints
  "POST:/api/admin/health/middleware-example?delay=500"
  "GET:/api/admin/debug"
)

# =========================
# Helper Functions
# =========================

log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Test a single endpoint
test_endpoint() {
  local method_url="$1"
  local method=$(echo "$method_url" | cut -d: -f1)
  local url_path=$(echo "$method_url" | cut -d: -f2-)
  local full_url="${BASE_URL}${url_path}"
  local output_file="${TEMP_DIR}/$(echo "$url_path" | tr '/' '_' | tr '?' '_').json"
  
  # Prepare curl command
  local curl_cmd=(curl -s -w @- --max-time "$TIMEOUT_SECONDS")
  
  # Add method
  curl_cmd+=(-X "$method")
  
  # Add auth header if available
  if [[ -n "$AUTH_TOKEN" ]]; then
    curl_cmd+=(-H "x-admin-token: $AUTH_TOKEN")
    curl_cmd+=(-H "Authorization: Bearer $AUTH_TOKEN")
  fi
  
  # Add content type for POST requests
  if [[ "$method" == "POST" ]]; then
    curl_cmd+=(-H "Content-Type: application/json")
    curl_cmd+=(-d '{}')
  fi
  
  # Add URL
  curl_cmd+=("$full_url")
  
  # Custom curl write-out format for timing data
  local curl_format='{"url":"%{url}","http_code":%{http_code},"time_total":%{time_total},"time_connect":%{time_connect},"time_starttransfer":%{time_starttransfer},"size_download":%{size_download},"request_id":"%{header_x-request-id}"}'
  
  # Execute request and capture timing (cross-platform compatible)
  local start_time_sec=$(date +%s)
  local response
  local exit_code=0
  
  response=$("${curl_cmd[@]}" <<< "$curl_format" 2>/dev/null) || exit_code=$?
  local end_time_sec=$(date +%s)
  local duration_ms=$(((end_time_sec - start_time_sec) * 1000))
  
  # Parse response (last line is timing JSON)
  local response_body=$(echo "$response" | head -n -1)
  local timing_data=$(echo "$response" | tail -n 1)
  
  # Validate timing data is JSON
  if ! echo "$timing_data" | jq . >/dev/null 2>&1; then
    timing_data='{"url":"'$full_url'","http_code":0,"time_total":0,"error":"invalid_timing_data"}'
  fi
  
  # Extract values from timing data
  local http_code=$(echo "$timing_data" | jq -r '.http_code // 0')
  local time_total=$(echo "$timing_data" | jq -r '.time_total // 0')
  local time_total_ms=$(echo "$time_total * 1000" | bc 2>/dev/null || echo "0")
  local request_id=$(echo "$timing_data" | jq -r '.request_id // ""')
  
  # Determine status
  local status="UNKNOWN"
  local status_color="$NC"
  
  if [[ $exit_code -ne 0 ]]; then
    status="TIMEOUT"
    status_color="$RED"
  elif [[ $http_code -ge 200 && $http_code -lt 300 ]]; then
    if (( $(echo "$time_total_ms > $THRESHOLD_MS" | bc -l 2>/dev/null || echo "0") )); then
      status="SLOW"
      status_color="$YELLOW"
    else
      status="OK"
      status_color="$GREEN"
    fi
  elif [[ $http_code -ge 400 ]]; then
    status="ERROR"
    status_color="$RED"
  fi
  
  # Create result JSON
  local result=$(jq -n \
    --arg method "$method" \
    --arg url_path "$url_path" \
    --arg full_url "$full_url" \
    --argjson http_code "$http_code" \
    --argjson duration_ms "${time_total_ms%.*}" \
    --argjson curl_duration_ms "$duration_ms" \
    --arg status "$status" \
    --arg request_id "$request_id" \
    --argjson exit_code "$exit_code" \
    '{
      method: $method,
      url_path: $url_path, 
      full_url: $full_url,
      http_code: $http_code,
      duration_ms: $duration_ms,
      curl_duration_ms: $curl_duration_ms,
      status: $status,
      request_id: $request_id,
      exit_code: $exit_code
    }')
  
  # Save result
  echo "$result" > "$output_file"
  
  # Print formatted result
  printf "${status_color}%-8s${NC} %s %-60s %4dms (HTTP %d) %s\n" \
    "$status" \
    "$method" \
    "$url_path" \
    "${time_total_ms%.*}" \
    "$http_code" \
    "$request_id"
}

# =========================
# Main Execution
# =========================

main() {
  log_info "API Connectivity Triager - Admin Endpoint Testing"
  echo "======================================================"
  log_info "Base URL: $BASE_URL"
  log_info "Parallel jobs: $PARALLEL_JOBS"
  log_info "Timeout: ${TIMEOUT_SECONDS}s"
  log_info "Threshold: ${THRESHOLD_MS}ms"
  log_info "Auth token: $(if [[ -n "$AUTH_TOKEN" ]]; then echo "provided"; else echo "none"; fi)"
  echo ""
  
  log_info "Testing ${#ADMIN_ENDPOINTS[@]} admin endpoints..."
  echo ""
  
  # Header
  printf "%-8s %s %-60s %s\n" "STATUS" "METHOD" "ENDPOINT" "TIMING"
  printf "%s\n" "$(printf '=%.0s' {1..100})"
  
  # Test endpoints in parallel
  printf '%s\n' "${ADMIN_ENDPOINTS[@]}" | \
    xargs -I {} -P "$PARALLEL_JOBS" bash -c 'test_endpoint "$@"' _ {}
  
  echo ""
  
  # =========================
  # Results Analysis
  # =========================
  
  log_info "Analyzing results..."
  
  # Combine all results
  local all_results="$TEMP_DIR/all_results.json"
  jq -s '.' "$TEMP_DIR"/*.json > "$all_results" 2>/dev/null || echo '[]' > "$all_results"
  
  # Calculate summary statistics
  local total_endpoints=$(jq 'length' "$all_results")
  local ok_count=$(jq '[.[] | select(.status == "OK")] | length' "$all_results")
  local slow_count=$(jq '[.[] | select(.status == "SLOW")] | length' "$all_results")
  local error_count=$(jq '[.[] | select(.status == "ERROR")] | length' "$all_results")
  local timeout_count=$(jq '[.[] | select(.status == "TIMEOUT")] | length' "$all_results")
  
  # Calculate average response time
  local avg_duration=$(jq '[.[] | select(.duration_ms > 0) | .duration_ms] | add / length' "$all_results" 2>/dev/null || echo "0")
  
  echo "Summary:"
  echo "--------"
  log_success "OK: $ok_count/$total_endpoints"
  if [[ $slow_count -gt 0 ]]; then
    log_warn "SLOW: $slow_count/$total_endpoints (>${THRESHOLD_MS}ms)"
  fi
  if [[ $error_count -gt 0 ]]; then
    log_error "ERROR: $error_count/$total_endpoints"
  fi
  if [[ $timeout_count -gt 0 ]]; then
    log_error "TIMEOUT: $timeout_count/$total_endpoints"
  fi
  
  printf "Average response time: %.0fms\n" "$avg_duration"
  echo ""
  
  # Show failed endpoints
  local failed_endpoints=$(jq -r '.[] | select(.status != "OK") | "\(.status): \(.method) \(.url_path) (\(.duration_ms)ms, HTTP \(.http_code))"' "$all_results")
  
  if [[ -n "$failed_endpoints" ]]; then
    log_warn "Failed endpoints:"
    echo "$failed_endpoints"
    echo ""
  fi
  
  # Exit with error if any endpoints failed critically
  local critical_failures=$((error_count + timeout_count))
  if [[ $critical_failures -gt 0 ]]; then
    log_error "Critical failures detected: $critical_failures endpoints"
    exit 1
  elif [[ $slow_count -gt 0 ]]; then
    log_warn "Performance warnings: $slow_count slow endpoints"
    exit 2
  else
    log_success "All endpoints healthy!"
    exit 0
  fi
}

# =========================
# Script Entry Point
# =========================

# Make test_endpoint function available to xargs subshells
export -f test_endpoint
export BASE_URL TIMEOUT_SECONDS THRESHOLD_MS AUTH_TOKEN TEMP_DIR
export RED GREEN YELLOW BLUE NC

# Check dependencies
command -v curl >/dev/null || { log_error "curl not found"; exit 3; }
command -v jq >/dev/null || { log_error "jq not found"; exit 3; }
command -v bc >/dev/null || { log_error "bc not found"; exit 3; }

# Run main function
main "$@"