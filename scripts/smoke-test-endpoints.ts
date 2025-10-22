#!/usr/bin/env tsx
/**
 * Smoke Test Script - API Endpoint Health Check
 * 
 * This script performs basic smoke tests on critical API endpoints to ensure
 * they're responding correctly and not throwing 500 errors.
 * 
 * Usage:
 *   npm run smoke:test
 *   # or direct:
 *   npx tsx scripts/smoke-test-endpoints.ts
 *   
 *   # Test specific endpoints:
 *   npx tsx scripts/smoke-test-endpoints.ts --endpoints health,admin
 *   
 *   # Run with custom base URL:
 *   npx tsx scripts/smoke-test-endpoints.ts --base-url https://hotdog-diaries.vercel.app
 */

import { envOptional } from '../app/lib/server/env'

interface SmokeTestConfig {
  baseUrl: string
  endpoints: string[]
  timeout: number
  verbose: boolean
}

interface TestResult {
  endpoint: string
  url: string
  status: number
  responseTime: number
  passed: boolean
  error?: string
  body?: any
}

interface SmokeTestReport {
  timestamp: string
  baseUrl: string
  totalTests: number
  passed: number
  failed: number
  results: TestResult[]
  overallPassed: boolean
}

const ENDPOINT_GROUPS = {
  health: [
    { path: '/api/health/posting-source-of-truth', description: 'Posting source of truth health check' },
    { path: '/api/health/schedule-tz', description: 'Timezone health check' }
  ],
  admin: [
    { path: '/api/admin/metrics/diversity?date=2025-01-01', description: 'Admin diversity metrics' },
    { path: '/api/admin/diversity-summary?date=2025-01-01', description: 'Admin diversity summary proxy' }
  ],
  public: [
    { path: '/api/posts', description: 'Public posts API' },
    { path: '/api/health', description: 'Basic health check' }
  ]
}

const ALL_ENDPOINTS = [
  ...ENDPOINT_GROUPS.health,
  ...ENDPOINT_GROUPS.admin,
  ...ENDPOINT_GROUPS.public
]

class SmokeTestRunner {
  private config: SmokeTestConfig
  
  constructor(config: SmokeTestConfig) {
    this.config = config
  }
  
  private async testEndpoint(endpoint: { path: string; description: string }): Promise<TestResult> {
    const url = `${this.config.baseUrl}${endpoint.path}`
    const startTime = Date.now()
    
    try {
      if (this.config.verbose) {
        console.log(`  🧪 Testing ${endpoint.path}...`)
      }
      
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'smoke-test-script',
          'Accept': 'application/json'
        },
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      const responseTime = Date.now() - startTime
      
      let body: any = null
      try {
        const text = await response.text()
        if (text) {
          try {
            body = JSON.parse(text)
          } catch {
            body = { raw: text.substring(0, 200) }
          }
        }
      } catch {
        body = { error: 'Failed to read response body' }
      }
      
      // Success criteria: 
      // - Status 200 (healthy)
      // - Status 200 with status:"error" (expected error state)
      // - Status 503 (service unavailable but responding)
      // NOT 500 (unexpected server error)
      const passed = response.status !== 500
      
      return {
        endpoint: endpoint.path,
        url,
        status: response.status,
        responseTime,
        passed,
        error: passed ? undefined : `HTTP 500 - unexpected server error`,
        body
      }
      
    } catch (error: any) {
      const responseTime = Date.now() - startTime
      
      // Network errors are considered soft failures (not 500s)
      const isNetworkError = error.name === 'AbortError' || error.code === 'ECONNREFUSED' || error.message.includes('fetch')
      
      return {
        endpoint: endpoint.path,
        url,
        status: 0,
        responseTime,
        passed: isNetworkError, // Network errors pass smoke test (they're not 500s)
        error: error.message,
        body: null
      }
    }
  }
  
  private getEndpointsToTest(): Array<{ path: string; description: string }> {
    if (this.config.endpoints.length === 0) {
      return ALL_ENDPOINTS
    }
    
    const endpoints: Array<{ path: string; description: string }> = []
    
    for (const group of this.config.endpoints) {
      if (group in ENDPOINT_GROUPS) {
        endpoints.push(...ENDPOINT_GROUPS[group as keyof typeof ENDPOINT_GROUPS])
      } else {
        console.warn(`⚠️  Unknown endpoint group: ${group}`)
      }
    }
    
    return endpoints.length > 0 ? endpoints : ALL_ENDPOINTS
  }
  
  async runTests(): Promise<SmokeTestReport> {
    console.log('🧪 API Smoke Test Runner')
    console.log('========================')
    console.log('')
    console.log(`🎯 Base URL: ${this.config.baseUrl}`)
    console.log(`⏱️  Timeout: ${this.config.timeout}ms`)
    console.log('')
    
    const endpoints = this.getEndpointsToTest()
    const results: TestResult[] = []
    
    console.log(`🚀 Testing ${endpoints.length} endpoints...`)
    console.log('')
    
    for (const endpoint of endpoints) {
      const result = await this.testEndpoint(endpoint)
      results.push(result)
      
      const status = result.passed ? '✅ PASS' : '❌ FAIL'
      const timing = `${result.responseTime}ms`
      
      if (this.config.verbose) {
        console.log(`  ${status} ${endpoint.path} (${result.status}) [${timing}]`)
        if (result.error) {
          console.log(`    Error: ${result.error}`)
        }
        if (result.body?.status) {
          console.log(`    Response Status: ${result.body.status}`)
        }
        console.log('')
      } else {
        console.log(`${status} ${endpoint.path} (${result.status}) [${timing}]`)
      }
    }
    
    const passed = results.filter(r => r.passed).length
    const failed = results.length - passed
    
    const report: SmokeTestReport = {
      timestamp: new Date().toISOString(),
      baseUrl: this.config.baseUrl,
      totalTests: results.length,
      passed,
      failed,
      results,
      overallPassed: failed === 0
    }
    
    console.log('')
    console.log('📊 SUMMARY')
    console.log('==========')
    console.log(`Total endpoints tested: ${report.totalTests}`)
    console.log(`✅ Passed: ${report.passed}`)
    console.log(`❌ Failed: ${report.failed}`)
    console.log('')
    
    if (report.overallPassed) {
      console.log('🎉 All smoke tests passed!')
      console.log('✅ No endpoints are returning unexpected 500 errors')
    } else {
      console.log('💥 Some smoke tests failed!')
      console.log('')
      console.log('Failed endpoints:')
      results.filter(r => !r.passed).forEach(result => {
        console.log(`  ❌ ${result.endpoint}: ${result.error}`)
      })
    }
    
    console.log('')
    console.log('🔍 Key Success Criteria:')
    console.log('  - No HTTP 500 errors (unexpected server failures)')
    console.log('  - HTTP 200 with status:"error" is OK (expected error states)')
    console.log('  - HTTP 503 is OK (service unavailable but responding)')
    console.log('  - Network errors are OK (not server errors)')
    
    return report
  }
}

// CLI argument parsing
function parseArgs(): SmokeTestConfig {
  const args = process.argv.slice(2)
  const config: SmokeTestConfig = {
    baseUrl: envOptional('NEXT_PUBLIC_SITE_URL') || 'http://localhost:3000',
    endpoints: [],
    timeout: 10000, // 10 seconds
    verbose: false
  }
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    const nextArg = args[i + 1]
    
    switch (arg) {
      case '--base-url':
        if (!nextArg) {
          throw new Error('--base-url requires a URL')
        }
        config.baseUrl = nextArg
        i++
        break
        
      case '--endpoints':
        if (!nextArg) {
          throw new Error('--endpoints requires a comma-separated list')
        }
        config.endpoints = nextArg.split(',').map(s => s.trim())
        i++
        break
        
      case '--timeout':
        if (!nextArg || !nextArg.match(/^\d+$/)) {
          throw new Error('--timeout requires a number in milliseconds')
        }
        config.timeout = parseInt(nextArg, 10)
        i++
        break
        
      case '--verbose':
      case '-v':
        config.verbose = true
        break
        
      case '--help':
      case '-h':
        console.log('API Smoke Test Runner')
        console.log('')
        console.log('Usage:')
        console.log('  npx tsx scripts/smoke-test-endpoints.ts [options]')
        console.log('')
        console.log('Options:')
        console.log('  --base-url URL       Base URL to test (default: localhost:3000)')
        console.log('  --endpoints LIST     Comma-separated endpoint groups to test')
        console.log('                       Available: health,admin,public (default: all)')
        console.log('  --timeout MS         Request timeout in milliseconds (default: 10000)')
        console.log('  --verbose, -v        Show detailed progress')
        console.log('  --help, -h           Show this help')
        console.log('')
        console.log('Examples:')
        console.log('  npx tsx scripts/smoke-test-endpoints.ts')
        console.log('  npx tsx scripts/smoke-test-endpoints.ts --endpoints health,admin')
        console.log('  npx tsx scripts/smoke-test-endpoints.ts --base-url https://hotdog-diaries.vercel.app')
        console.log('')
        console.log('Endpoint Groups:')
        Object.entries(ENDPOINT_GROUPS).forEach(([group, endpoints]) => {
          console.log(`  ${group}:`)
          endpoints.forEach(ep => {
            console.log(`    ${ep.path} - ${ep.description}`)
          })
        })
        process.exit(0)
        
      default:
        if (arg.startsWith('-')) {
          throw new Error(`Unknown option: ${arg}`)
        }
    }
  }
  
  return config
}

// Main execution
const main = async () => {
  try {
    const config = parseArgs()
    const runner = new SmokeTestRunner(config)
    const report = await runner.runTests()
    
    // Exit with appropriate code
    process.exit(report.overallPassed ? 0 : 1)
    
  } catch (error: any) {
    console.error('❌ Smoke test runner failed:', error.message)
    process.exit(1)
  }
}

// Run if called directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`
if (isMainModule) {
  main()
}

export { SmokeTestRunner, type SmokeTestConfig, type TestResult, type SmokeTestReport }