#!/usr/bin/env node

// @ts-check
// Single-file verification script for API health endpoints
// Usage: node scripts/ops/verify-health.mjs [--base-url=http://localhost:3000]

const DEFAULT_BASE = "http://localhost:3000";
const TIMEOUT_MS = 10000;

/**
 * @typedef {Object} HealthCheck
 * @property {string} name
 * @property {string} endpoint
 * @property {boolean} expectOk
 * @property {string[]} requiredFields
 */

/** @type {HealthCheck[]} */
const HEALTH_CHECKS = [
  {
    name: "Posting Source of Truth",
    endpoint: "/api/health/posting-source-of-truth",
    expectOk: true,
    requiredFields: ["status", "issues", "recommendations", "metadata", "feature_flag_active"]
  },
  {
    name: "Diversity Metrics (Valid Date)",
    endpoint: "/api/admin/metrics/diversity?date=2025-01-01",
    expectOk: true,
    requiredFields: ["status", "issues", "recommendations", "date", "metadata"]
  },
  {
    name: "Diversity Metrics (Invalid Date)",
    endpoint: "/api/admin/metrics/diversity?date=invalid",
    expectOk: true, // Should return 200 with error status
    requiredFields: ["status", "issues", "recommendations"]
  },
  {
    name: "Diversity Summary",
    endpoint: "/api/admin/diversity-summary?date=2025-01-01",
    expectOk: true,
    requiredFields: ["status", "issues", "recommendations", "date", "metadata"]
  },
  {
    name: "Diversity Summary (No Date)",
    endpoint: "/api/admin/diversity-summary",
    expectOk: true,
    requiredFields: ["status", "date"]
  }
];

/**
 * Parse command line arguments
 * @returns {{ baseUrl: string, verbose: boolean }}
 */
function parseArgs() {
  const args = process.argv.slice(2);
  let baseUrl = DEFAULT_BASE;
  let verbose = false;

  for (const arg of args) {
    if (arg.startsWith("--base-url=")) {
      baseUrl = arg.split("=")[1];
    } else if (arg === "--verbose" || arg === "-v") {
      verbose = true;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
Usage: node scripts/ops/verify-health.mjs [options]

Options:
  --base-url=URL    Base URL for API calls (default: ${DEFAULT_BASE})
  --verbose, -v     Show detailed output
  --help, -h        Show this help message

Examples:
  node scripts/ops/verify-health.mjs
  node scripts/ops/verify-health.mjs --base-url=https://hotdog-diaries.vercel.app
  node scripts/ops/verify-health.mjs --verbose
`);
      process.exit(0);
    }
  }

  return { baseUrl, verbose };
}

/**
 * Fetch with timeout
 * @param {string} url
 * @param {RequestInit} options
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${TIMEOUT_MS}ms`);
    }
    throw error;
  }
}

/**
 * Check a single health endpoint
 * @param {string} baseUrl
 * @param {HealthCheck} check
 * @param {boolean} verbose
 * @returns {Promise<{ success: boolean, details: string }>}
 */
async function checkEndpoint(baseUrl, check, verbose) {
  const url = `${baseUrl}${check.endpoint}`;
  
  try {
    if (verbose) {
      console.log(`  🔍 Fetching: ${url}`);
    }

    const response = await fetchWithTimeout(url);
    const isOk = response.ok;
    
    if (verbose) {
      console.log(`  📡 Status: ${response.status} ${response.statusText}`);
    }

    // For hardened endpoints, we expect 200 even for error states
    if (!isOk && response.status === 500) {
      return {
        success: false,
        details: `❌ FATAL: Returned 500 (should be hardened to never 500)`
      };
    }

    let data;
    try {
      data = await response.json();
    } catch (e) {
      return {
        success: false,
        details: `❌ Invalid JSON response: ${e.message}`
      };
    }

    // Check required fields
    const missingFields = check.requiredFields.filter(field => !(field in data));
    if (missingFields.length > 0) {
      return {
        success: false,
        details: `❌ Missing required fields: ${missingFields.join(', ')}`
      };
    }

    // Check status field specifically
    if ('status' in data && !['ok', 'error'].includes(data.status)) {
      return {
        success: false,
        details: `❌ Invalid status value: "${data.status}" (should be "ok" or "error")`
      };
    }

    // Check arrays are actually arrays
    if ('issues' in data && !Array.isArray(data.issues)) {
      return {
        success: false,
        details: `❌ Field 'issues' should be array, got ${typeof data.issues}`
      };
    }

    if ('recommendations' in data && !Array.isArray(data.recommendations)) {
      return {
        success: false,
        details: `❌ Field 'recommendations' should be array, got ${typeof data.recommendations}`
      };
    }

    // Success details
    const statusInfo = data.status ? ` (status: ${data.status})` : '';
    const issuesInfo = data.issues?.length > 0 ? ` [${data.issues.length} issues]` : '';
    const recsInfo = data.recommendations?.length > 0 ? ` [${data.recommendations.length} recs]` : '';
    
    return {
      success: true,
      details: `✅ HTTP ${response.status}${statusInfo}${issuesInfo}${recsInfo}`
    };

  } catch (error) {
    return {
      success: false,
      details: `❌ Network error: ${error.message}`
    };
  }
}

/**
 * Main verification function
 */
async function main() {
  const { baseUrl, verbose } = parseArgs();
  
  console.log(`🔍 Health Endpoint Verification`);
  console.log(`📍 Base URL: ${baseUrl}`);
  console.log(`⏱️  Timeout: ${TIMEOUT_MS}ms`);
  console.log('');

  let totalChecks = 0;
  let passedChecks = 0;
  const failures = [];

  for (const check of HEALTH_CHECKS) {
    totalChecks++;
    console.log(`🧪 ${check.name}`);
    
    const result = await checkEndpoint(baseUrl, check, verbose);
    
    if (result.success) {
      passedChecks++;
      console.log(`   ${result.details}`);
    } else {
      failures.push(`${check.name}: ${result.details}`);
      console.log(`   ${result.details}`);
    }
    
    console.log('');
  }

  // Summary
  console.log('📊 Summary:');
  console.log(`   Total checks: ${totalChecks}`);
  console.log(`   Passed: ${passedChecks}`);
  console.log(`   Failed: ${totalChecks - passedChecks}`);
  
  if (failures.length > 0) {
    console.log('');
    console.log('❌ Failures:');
    failures.forEach(failure => {
      console.log(`   • ${failure}`);
    });
    
    console.log('');
    console.log('🔧 Recommended actions:');
    console.log('   1. Check server logs for error details');
    console.log('   2. Verify environment variables are set correctly');
    console.log('   3. Ensure database is accessible and properly configured');
    console.log('   4. Validate API hardening changes are deployed');
    
    process.exit(1);
  } else {
    console.log('');
    console.log('🎉 All health checks passed!');
    console.log('✅ API endpoints are properly hardened and returning structured responses.');
    process.exit(0);
  }
}

// Handle unhandled errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});

// Run main function
main().catch((error) => {
  console.error('❌ Verification failed:', error);
  process.exit(1);
});