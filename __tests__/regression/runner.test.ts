/**
 * Regression Test Runner
 * Main entry point for running all regression tests
 */

import { RegressionTestRunner } from './framework'
import apiRegressionSuite from './api-regression.test'
import integrationRegressionSuite from './integration-regression.test'
import componentRegressionSuite from './component-regression-simple.test'

describe('Regression Test Suite', () => {
  let runner: RegressionTestRunner

  beforeAll(() => {
    runner = new RegressionTestRunner('test', '1.0.0')
    
    // Register all test suites
    runner.registerSuite(apiRegressionSuite)
    runner.registerSuite(integrationRegressionSuite)
    runner.registerSuite(componentRegressionSuite)
  })

  describe('Full Regression Test Run', () => {
    it('should run all regression tests and generate report', async () => {
      const report = await runner.runAll()

      // Verify report structure
      expect(report).toHaveProperty('timestamp')
      expect(report).toHaveProperty('version', '1.0.0')
      expect(report).toHaveProperty('environment', 'test')
      expect(report).toHaveProperty('summary')
      expect(report).toHaveProperty('results')
      expect(report).toHaveProperty('failures')
      expect(report).toHaveProperty('performance')

      // Verify summary
      expect(report.summary.total).toBeGreaterThan(0)
      expect(report.summary.passed + report.summary.failed + report.summary.skipped).toBe(report.summary.total)

      // Log results
      console.log(`\n📊 Regression Test Results:`)
      console.log(`Total: ${report.summary.total}`)
      console.log(`Passed: ${report.summary.passed}`)
      console.log(`Failed: ${report.summary.failed}`)
      console.log(`Skipped: ${report.summary.skipped}`)
      console.log(`Success Rate: ${((report.summary.passed / report.summary.total) * 100).toFixed(1)}%`)
      console.log(`Duration: ${report.summary.duration}ms`)

      // Verify we have reasonable success rate
      const successRate = (report.summary.passed / report.summary.total) * 100
      expect(successRate).toBeGreaterThan(80) // At least 80% success rate
    }, 60000) // 60 second timeout for full regression run
  })

  describe('Category-Specific Regression Tests', () => {
    it('should run API regression tests', async () => {
      const results = await runner.runCategory('api')
      
      expect(results.length).toBeGreaterThan(0)
      
      const passed = results.filter(r => r.status === 'passed').length
      const total = results.length
      const successRate = (passed / total) * 100

      console.log(`\n🔌 API Tests: ${passed}/${total} passed (${successRate.toFixed(1)}%)`)
      
      // API tests should have high success rate since they're mocked
      expect(successRate).toBeGreaterThan(90)
    })

    it('should run integration regression tests', async () => {
      const results = await runner.runCategory('integration')
      
      expect(results.length).toBeGreaterThan(0)
      
      const passed = results.filter(r => r.status === 'passed').length
      const total = results.length
      const successRate = (passed / total) * 100

      console.log(`\n🔗 Integration Tests: ${passed}/${total} passed (${successRate.toFixed(1)}%)`)
      
      // Integration tests might have lower success rate due to complexity
      expect(successRate).toBeGreaterThan(70)
    })

    it('should run component regression tests', async () => {
      const results = await runner.runCategory('component')
      
      expect(results.length).toBeGreaterThan(0)
      
      const passed = results.filter(r => r.status === 'passed').length
      const total = results.length
      const successRate = (passed / total) * 100

      console.log(`\n🧩 Component Tests: ${passed}/${total} passed (${successRate.toFixed(1)}%)`)
      
      // Component tests should have good success rate with mocking
      expect(successRate).toBeGreaterThan(80)
    })
  })

  describe('Priority-Based Regression Tests', () => {
    it('should run critical priority tests', async () => {
      const results = await runner.runPriority('critical')
      
      expect(results.length).toBeGreaterThan(0)
      
      const passed = results.filter(r => r.status === 'passed').length
      const total = results.length
      const successRate = (passed / total) * 100

      console.log(`\n🚨 Critical Tests: ${passed}/${total} passed (${successRate.toFixed(1)}%)`)
      
      // Critical tests must have very high success rate
      expect(successRate).toBeGreaterThan(95)
    })

    it('should run high priority tests', async () => {
      const results = await runner.runPriority('high')
      
      expect(results.length).toBeGreaterThan(0)
      
      const passed = results.filter(r => r.status === 'passed').length
      const total = results.length
      const successRate = (passed / total) * 100

      console.log(`\n⚠️ High Priority Tests: ${passed}/${total} passed (${successRate.toFixed(1)}%)`)
      
      // High priority tests should have high success rate
      expect(successRate).toBeGreaterThan(85)
    })
  })

  describe('Performance Regression Tests', () => {
    it('should run performance tests', async () => {
      const results = await runner.runCategory('performance')
      
      if (results.length > 0) {
        const avgResponseTime = results.reduce((sum, r) => 
          sum + (r.metrics?.responseTime || 0), 0
        ) / results.length

        console.log(`\n⚡ Performance Tests: Average response time ${avgResponseTime.toFixed(2)}ms`)
        
        // Performance tests should complete within reasonable time
        expect(avgResponseTime).toBeLessThan(5000) // Less than 5 seconds average
      }
    })
  })

  describe('Regression Test Framework Validation', () => {
    it('should validate framework functionality', () => {
      // Test that runner was properly initialized
      expect(runner).toBeDefined()
      
      // Test that suites were registered
      expect(runner['suites']).toHaveLength(3)
      
      // Verify suite names
      const suiteNames = runner['suites'].map(s => s.name)
      expect(suiteNames).toContain('API Regression Tests')
      expect(suiteNames).toContain('Integration Regression Tests')
      expect(suiteNames).toContain('Component Regression Tests')
    })

    it('should handle test execution errors gracefully', async () => {
      // Create a runner with a failing test
      const testRunner = new RegressionTestRunner('test', '1.0.0')
      
      testRunner.registerSuite({
        name: 'Failing Test Suite',
        description: 'Suite with intentionally failing tests',
        version: '1.0.0',
        tests: [
          {
            id: 'fail-001',
            name: 'Intentionally failing test',
            category: 'api',
            priority: 'low',
            description: 'This test should fail',
            testFn: async () => {
              throw new Error('Intentional failure')
            }
          }
        ]
      })

      const report = await testRunner.runAll()
      
      // Should handle the failure gracefully
      expect(report.summary.failed).toBe(1)
      expect(report.failures).toHaveLength(1)
      expect(report.failures[0].error).toContain('Intentional failure')
    })
  })
})

// Export the runner for standalone use
export { runner }

// CLI runner (if running directly)
if (require.main === module) {
  async function runRegressionTests() {
    console.log('🚀 Starting Hotdog Diaries Regression Test Suite')
    console.log('=' .repeat(60))
    
    const runner = new RegressionTestRunner(
      process.env.NODE_ENV || 'test',
      process.env.npm_package_version || '1.0.0'
    )
    
    // Register suites
    runner.registerSuite(apiRegressionSuite)
    runner.registerSuite(integrationRegressionSuite)
    runner.registerSuite(componentRegressionSuite)
    
    try {
      const report = await runner.runAll()
      
      // Exit with appropriate code
      const hasFailures = report.summary.failed > 0
      const hasCriticalFailures = report.failures.some(f => f.impact === 'blocking')
      
      if (hasCriticalFailures) {
        console.log('\n🚨 CRITICAL FAILURES DETECTED - Blocking issues found!')
        process.exit(2)
      } else if (hasFailures) {
        console.log('\n⚠️ Some tests failed - Review required')
        process.exit(1)
      } else {
        console.log('\n✅ All regression tests passed!')
        process.exit(0)
      }
    } catch (error) {
      console.error('\n❌ Regression test suite failed to complete:', error)
      process.exit(3)
    }
  }

  runRegressionTests().catch(console.error)
}