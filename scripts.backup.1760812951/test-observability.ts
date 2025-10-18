#!/usr/bin/env tsx

/**
 * Observability System Test
 * 
 * Tests the metrics endpoint and deploy gate functionality locally
 */

interface TestResult {
  name: string
  success: boolean
  message: string
  data?: any
}

class ObservabilityTester {
  private baseUrl: string
  private authToken?: string

  constructor(baseUrl = 'http://localhost:3001', authToken?: string) {
    this.baseUrl = baseUrl
    this.authToken = authToken
  }

  /**
   * Make HTTP request with optional auth
   */
  private async makeRequest(path: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.baseUrl}${path}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {})
    }

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`
    }

    const response = await fetch(url, {
      ...options,
      headers
    })

    return response
  }

  /**
   * Test system metrics endpoint
   */
  async testSystemMetrics(): Promise<TestResult> {
    try {
      const response = await this.makeRequest('/api/system/metrics')
      
      if (!response.ok) {
        return {
          name: 'System Metrics',
          success: false,
          message: `HTTP ${response.status}: ${response.statusText}`
        }
      }

      const data = await response.json()
      
      // Validate required fields
      const requiredFields = [
        'timestamp', 'uptime_seconds', 'queue_depth_by_platform',
        'posts_today', 'scans_last_24h', 'refill_count',
        'errors_last_1h', 'health_status', 'version', 'environment'
      ]

      const missingFields = requiredFields.filter(field => !(field in data))
      
      if (missingFields.length > 0) {
        return {
          name: 'System Metrics',
          success: false,
          message: `Missing required fields: ${missingFields.join(', ')}`,
          data
        }
      }

      // Validate data types
      if (typeof data.uptime_seconds !== 'number' ||
          typeof data.queue_depth_by_platform !== 'object' ||
          typeof data.posts_today !== 'number' ||
          typeof data.errors_last_1h !== 'number') {
        return {
          name: 'System Metrics',
          success: false,
          message: 'Invalid data types in response',
          data
        }
      }

      return {
        name: 'System Metrics',
        success: true,
        message: 'All required fields present with correct types',
        data: {
          health_status: data.health_status,
          total_queue: Object.values(data.queue_depth_by_platform as Record<string, number>)
            .reduce((sum, count) => sum + count, 0),
          posts_today: data.posts_today,
          errors: data.errors_last_1h
        }
      }

    } catch (error) {
      return {
        name: 'System Metrics',
        success: false,
        message: `Request failed: ${error}`
      }
    }
  }

  /**
   * Test deep health endpoint
   */
  async testDeepHealth(): Promise<TestResult> {
    if (!this.authToken) {
      return {
        name: 'Deep Health',
        success: false,
        message: 'Auth token required for deep health check'
      }
    }

    try {
      const response = await this.makeRequest('/api/admin/health/deep')
      
      if (!response.ok) {
        return {
          name: 'Deep Health',
          success: false,
          message: `HTTP ${response.status}: ${response.statusText}`
        }
      }

      const data = await response.json()
      
      // Validate structure
      if (!data.ok || !data.components) {
        return {
          name: 'Deep Health',
          success: false,
          message: 'Invalid response structure',
          data
        }
      }

      return {
        name: 'Deep Health',
        success: true,
        message: `Health check OK: ${data.status}`,
        data: {
          ok: data.ok,
          status: data.status,
          components: Object.keys(data.components)
        }
      }

    } catch (error) {
      return {
        name: 'Deep Health',
        success: false,
        message: `Request failed: ${error}`
      }
    }
  }

  /**
   * Test forecast endpoint (simulates refill check)
   */
  async testForecast(): Promise<TestResult> {
    if (!this.authToken) {
      return {
        name: 'Forecast Check',
        success: false,
        message: 'Auth token required for forecast check'
      }
    }

    try {
      const today = new Date().toISOString().split('T')[0]
      const response = await this.makeRequest(`/api/admin/schedule/forecast?date=${today}`)
      
      if (!response.ok) {
        return {
          name: 'Forecast Check',
          success: false,
          message: `HTTP ${response.status}: ${response.statusText}`
        }
      }

      const data = await response.json()
      
      // Validate structure
      if (!Array.isArray(data.slots)) {
        return {
          name: 'Forecast Check',
          success: false,
          message: 'Invalid forecast structure - no slots array',
          data
        }
      }

      const totalSlots = data.slots.length
      const filledSlots = data.slots.filter((slot: any) => slot.content_id !== null).length

      if (totalSlots !== 6) {
        return {
          name: 'Forecast Check',
          success: false,
          message: `Expected 6 slots, got ${totalSlots}`,
          data: { total_slots: totalSlots, filled_slots: filledSlots }
        }
      }

      return {
        name: 'Forecast Check',
        success: true,
        message: `Forecast structure valid: ${filledSlots}/${totalSlots} slots filled`,
        data: { 
          total_slots: totalSlots, 
          filled_slots: filledSlots,
          diversity_score: data.summary?.diversity_score || 0
        }
      }

    } catch (error) {
      return {
        name: 'Forecast Check',
        success: false,
        message: `Request failed: ${error}`
      }
    }
  }

  /**
   * Run all tests
   */
  async runAllTests(): Promise<TestResult[]> {
    console.log('🧪 Testing Observability System')
    console.log('===============================')
    console.log(`Base URL: ${this.baseUrl}`)
    console.log(`Auth: ${this.authToken ? 'Provided' : 'None'}`)
    console.log('')

    const tests = [
      () => this.testSystemMetrics(),
      () => this.testDeepHealth(),
      () => this.testForecast()
    ]

    const results: TestResult[] = []

    for (const test of tests) {
      const result = await test()
      results.push(result)
      
      const status = result.success ? '✅' : '❌'
      console.log(`${status} ${result.name}: ${result.message}`)
      
      if (result.data) {
        console.log(`   Data: ${JSON.stringify(result.data)}`)
      }
      console.log('')
    }

    return results
  }
}

/**
 * CLI Interface
 */
async function main() {
  const args = process.argv.slice(2)
  
  // Parse arguments
  let baseUrl = 'http://localhost:3001'
  let authToken: string | undefined
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    
    if (arg === '--url' && i + 1 < args.length) {
      baseUrl = args[i + 1]
      i++
    } else if (arg === '--token' && i + 1 < args.length) {
      authToken = args[i + 1]
      i++
    } else if (arg === '--help') {
      console.log(`
🧪 Observability System Test

Tests the metrics endpoint and deploy gate functionality.

USAGE:
  npm run test-observability [options]

OPTIONS:
  --url <url>      Base URL (default: http://localhost:3001)
  --token <token>  Auth token for authenticated endpoints
  --help           Show this help

EXAMPLES:
  # Test local development server
  npm run test-observability

  # Test with authentication
  npm run test-observability --token "your-jwt-token"

  # Test production (requires token)
  npm run test-observability --url https://hotdog-diaries.vercel.app --token "prod-token"
`)
      process.exit(0)
    }
  }

  // Use environment token if not provided
  if (!authToken) {
    authToken = process.env.AUTH_TOKEN || process.env.ADMIN_TOKEN
  }

  const tester = new ObservabilityTester(baseUrl, authToken)
  const results = await tester.runAllTests()
  
  // Summary
  const passed = results.filter(r => r.success).length
  const total = results.length
  
  console.log('📊 Test Summary')
  console.log('===============')
  console.log(`Passed: ${passed}/${total}`)
  console.log(`Success Rate: ${Math.round((passed / total) * 100)}%`)
  
  if (passed === total) {
    console.log('🎉 All observability tests passed!')
    process.exit(0)
  } else {
    console.log('❌ Some tests failed')
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Test failed:', error)
    process.exit(1)
  })
}

export { ObservabilityTester }