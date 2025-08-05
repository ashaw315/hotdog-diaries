/**
 * Regression Testing Framework for Hotdog Diaries
 * 
 * This framework provides utilities for comprehensive regression testing
 * across all application components, APIs, and integrations.
 */

import { jest } from '@jest/globals'

export interface RegressionTestSuite {
  name: string
  description: string
  version: string
  tests: RegressionTest[]
  setup?: () => Promise<void>
  teardown?: () => Promise<void>
}

export interface RegressionTest {
  id: string
  name: string
  category: 'api' | 'integration' | 'component' | 'e2e' | 'performance'
  priority: 'critical' | 'high' | 'medium' | 'low'
  description: string
  testFn: () => Promise<TestResult>
  prerequisites?: string[]
  timeout?: number
}

export interface TestResult {
  passed: boolean
  duration: number
  error?: Error
  details?: Record<string, any>
  metrics?: TestMetrics
}

export interface TestMetrics {
  responseTime?: number
  memoryUsage?: number
  cpuUsage?: number
  networkRequests?: number
  databaseQueries?: number
}

export interface RegressionReport {
  timestamp: string
  version: string
  environment: string
  summary: {
    total: number
    passed: number
    failed: number
    skipped: number
    duration: number
  }
  results: TestExecutionResult[]
  failures: TestFailure[]
  performance: PerformanceMetrics
}

export interface TestExecutionResult {
  testId: string
  name: string
  category: string
  priority: string
  status: 'passed' | 'failed' | 'skipped'
  duration: number
  error?: string
  metrics?: TestMetrics
}

export interface TestFailure {
  testId: string
  name: string
  category: string
  priority: string
  error: string
  stackTrace?: string
  reproducible: boolean
  impact: 'blocking' | 'major' | 'minor'
}

export interface PerformanceMetrics {
  averageResponseTime: number
  maxResponseTime: number
  totalMemoryUsage: number
  totalCpuUsage: number
  networkActivity: number
  databaseActivity: number
}

/**
 * Regression Test Runner
 * Executes test suites and generates comprehensive reports
 */
export class RegressionTestRunner {
  private suites: RegressionTestSuite[] = []
  private environment: string
  private version: string

  constructor(environment: string = 'test', version: string = '1.0.0') {
    this.environment = environment
    this.version = version
  }

  /**
   * Register a test suite
   */
  registerSuite(suite: RegressionTestSuite): void {
    this.suites.push(suite)
  }

  /**
   * Run all registered test suites
   */
  async runAll(): Promise<RegressionReport> {
    const startTime = Date.now()
    const results: TestExecutionResult[] = []
    const failures: TestFailure[] = []

    console.log(`🚀 Starting regression test run - ${this.suites.length} suites`)

    for (const suite of this.suites) {
      console.log(`\n📦 Running suite: ${suite.name}`)
      
      try {
        if (suite.setup) {
          await suite.setup()
        }

        for (const test of suite.tests) {
          const result = await this.executeTest(test)
          results.push(result)

          if (result.status === 'failed') {
            failures.push(this.createFailure(test, result))
          }

          this.logTestResult(result)
        }

        if (suite.teardown) {
          await suite.teardown()
        }
      } catch (error) {
        console.error(`❌ Suite ${suite.name} failed during setup/teardown:`, error)
      }
    }

    const duration = Date.now() - startTime
    const summary = this.calculateSummary(results, duration)
    const performance = this.calculatePerformanceMetrics(results)

    const report: RegressionReport = {
      timestamp: new Date().toISOString(),
      version: this.version,
      environment: this.environment,
      summary,
      results,
      failures,
      performance
    }

    this.generateReport(report)
    return report
  }

  /**
   * Run tests for a specific category
   */
  async runCategory(category: string): Promise<TestExecutionResult[]> {
    const categoryTests = this.suites
      .flatMap(suite => suite.tests)
      .filter(test => test.category === category)

    const results: TestExecutionResult[] = []

    for (const test of categoryTests) {
      const result = await this.executeTest(test)
      results.push(result)
      this.logTestResult(result)
    }

    return results
  }

  /**
   * Run tests with specific priority
   */
  async runPriority(priority: string): Promise<TestExecutionResult[]> {
    const priorityTests = this.suites
      .flatMap(suite => suite.tests)
      .filter(test => test.priority === priority)

    const results: TestExecutionResult[] = []

    for (const test of priorityTests) {
      const result = await this.executeTest(test)
      results.push(result)
      this.logTestResult(result)
    }

    return results
  }

  /**
   * Execute a single test
   */
  private async executeTest(test: RegressionTest): Promise<TestExecutionResult> {
    const startTime = Date.now()

    try {
      // Check prerequisites
      if (test.prerequisites && !this.checkPrerequisites(test.prerequisites)) {
        return {
          testId: test.id,
          name: test.name,
          category: test.category,
          priority: test.priority,
          status: 'skipped',
          duration: 0
        }
      }

      // Execute test with timeout
      const timeout = test.timeout || 30000
      const testPromise = test.testFn()
      const timeoutPromise = new Promise<TestResult>((_, reject) =>
        setTimeout(() => reject(new Error(`Test timeout after ${timeout}ms`)), timeout)
      )

      const result = await Promise.race([testPromise, timeoutPromise])
      const duration = Date.now() - startTime

      return {
        testId: test.id,
        name: test.name,
        category: test.category,
        priority: test.priority,
        status: result.passed ? 'passed' : 'failed',
        duration,
        error: result.error?.message,
        metrics: result.metrics
      }
    } catch (error) {
      const duration = Date.now() - startTime
      return {
        testId: test.id,
        name: test.name,
        category: test.category,
        priority: test.priority,
        status: 'failed',
        duration,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Check if prerequisites are met
   */
  private checkPrerequisites(prerequisites: string[]): boolean {
    // Implementation would check environment variables, services, etc.
    return true
  }

  /**
   * Create failure object from test result
   */
  private createFailure(test: RegressionTest, result: TestExecutionResult): TestFailure {
    const impact = this.determineImpact(test.priority, test.category)
    
    return {
      testId: test.id,
      name: test.name,
      category: test.category,
      priority: test.priority,
      error: result.error || 'Unknown error',
      reproducible: true,
      impact
    }
  }

  /**
   * Determine impact level based on priority and category
   */
  private determineImpact(priority: string, category: string): 'blocking' | 'major' | 'minor' {
    if (priority === 'critical' || (priority === 'high' && category === 'api')) {
      return 'blocking'
    }
    if (priority === 'high' || priority === 'medium') {
      return 'major'
    }
    return 'minor'
  }

  /**
   * Calculate test summary
   */
  private calculateSummary(
    results: TestExecutionResult[], 
    duration: number
  ): RegressionReport['summary'] {
    return {
      total: results.length,
      passed: results.filter(r => r.status === 'passed').length,
      failed: results.filter(r => r.status === 'failed').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      duration
    }
  }

  /**
   * Calculate performance metrics
   */
  private calculatePerformanceMetrics(results: TestExecutionResult[]): PerformanceMetrics {
    const responseTimes = results
      .map(r => r.metrics?.responseTime)
      .filter(Boolean) as number[]

    return {
      averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length || 0,
      maxResponseTime: Math.max(...responseTimes, 0),
      totalMemoryUsage: results.reduce((sum, r) => sum + (r.metrics?.memoryUsage || 0), 0),
      totalCpuUsage: results.reduce((sum, r) => sum + (r.metrics?.cpuUsage || 0), 0),
      networkActivity: results.reduce((sum, r) => sum + (r.metrics?.networkRequests || 0), 0),
      databaseActivity: results.reduce((sum, r) => sum + (r.metrics?.databaseQueries || 0), 0)
    }
  }

  /**
   * Log individual test result
   */
  private logTestResult(result: TestExecutionResult): void {
    const icon = result.status === 'passed' ? '✅' : 
                 result.status === 'failed' ? '❌' :
                 '⏭️'
    
    const duration = `${result.duration}ms`
    console.log(`  ${icon} ${result.name} (${duration})`)
    
    if (result.error) {
      console.log(`    Error: ${result.error}`)
    }
  }

  /**
   * Generate comprehensive test report
   */
  private generateReport(report: RegressionReport): void {
    console.log('\n' + '='.repeat(80))
    console.log('📊 REGRESSION TEST REPORT')
    console.log('='.repeat(80))
    console.log(`Environment: ${report.environment}`)
    console.log(`Version: ${report.version}`)
    console.log(`Timestamp: ${report.timestamp}`)
    console.log(`Duration: ${report.summary.duration}ms`)
    console.log('')
    
    // Summary
    console.log('📈 SUMMARY')
    console.log(`Total Tests: ${report.summary.total}`)
    console.log(`✅ Passed: ${report.summary.passed}`)
    console.log(`❌ Failed: ${report.summary.failed}`)
    console.log(`⏭️ Skipped: ${report.summary.skipped}`)
    
    const successRate = ((report.summary.passed / report.summary.total) * 100).toFixed(1)
    console.log(`Success Rate: ${successRate}%`)
    console.log('')

    // Failures
    if (report.failures.length > 0) {
      console.log('🚨 FAILURES')
      report.failures.forEach(failure => {
        console.log(`❌ ${failure.name} (${failure.priority} priority)`)
        console.log(`   Impact: ${failure.impact}`)
        console.log(`   Error: ${failure.error}`)
        console.log('')
      })
    }

    // Performance
    console.log('⚡ PERFORMANCE')
    console.log(`Average Response Time: ${report.performance.averageResponseTime.toFixed(2)}ms`)
    console.log(`Max Response Time: ${report.performance.maxResponseTime}ms`)
    console.log(`Network Requests: ${report.performance.networkActivity}`)
    console.log(`Database Queries: ${report.performance.databaseActivity}`)
    console.log('')

    // Category breakdown
    const categories = [...new Set(report.results.map(r => r.category))]
    console.log('📂 BY CATEGORY')
    categories.forEach(category => {
      const categoryResults = report.results.filter(r => r.category === category)
      const passed = categoryResults.filter(r => r.status === 'passed').length
      const total = categoryResults.length
      const rate = ((passed / total) * 100).toFixed(1)
      console.log(`${category}: ${passed}/${total} (${rate}%)`)
    })

    console.log('='.repeat(80))
  }
}

/**
 * Test utilities and helpers
 */
export class TestUtils {
  /**
   * Measure function execution time
   */
  static async measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const start = Date.now()
    const result = await fn()
    const duration = Date.now() - start
    return { result, duration }
  }

  /**
   * Wait for condition with timeout
   */
  static async waitFor(
    condition: () => boolean | Promise<boolean>,
    timeout: number = 5000,
    interval: number = 100
  ): Promise<void> {
    const start = Date.now()
    
    while (Date.now() - start < timeout) {
      if (await condition()) {
        return
      }
      await this.sleep(interval)
    }
    
    throw new Error(`Condition not met within ${timeout}ms`)
  }

  /**
   * Sleep for specified milliseconds
   */
  static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Generate test data
   */
  static generateTestContent() {
    return {
      id: Math.floor(Math.random() * 1000),
      content_text: 'Test hotdog content',
      content_image_url: 'https://example.com/test.jpg',
      source_platform: 'test',
      source_url: 'https://example.com/source',
      content_type: 'image',
      created_at: new Date().toISOString()
    }
  }

  /**
   * Mock API response
   */
  static mockApiResponse(data: any, status: number = 200) {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve({ success: status < 400, data, timestamp: new Date().toISOString() }),
      text: () => Promise.resolve(JSON.stringify(data))
    } as Response
  }

  /**
   * Create database mock
   */
  static createDbMock() {
    return {
      query: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
      transaction: jest.fn()
    }
  }
}

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map()

  recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }
    this.metrics.get(name)!.push(value)
  }

  getMetrics(name: string): { avg: number; min: number; max: number; count: number } {
    const values = this.metrics.get(name) || []
    if (values.length === 0) {
      return { avg: 0, min: 0, max: 0, count: 0 }
    }

    return {
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length
    }
  }

  getAllMetrics(): Record<string, { avg: number; min: number; max: number; count: number }> {
    const result: Record<string, any> = {}
    for (const [name] of this.metrics) {
      result[name] = this.getMetrics(name)
    }
    return result
  }

  reset(): void {
    this.metrics.clear()
  }
}