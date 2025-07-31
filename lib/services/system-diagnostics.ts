import { loggingService } from './logging'
import { healthService } from './health'
import { metricsService } from './metrics'
import { alertService } from './alerts'
import { errorRecoveryService } from './error-recovery'
import { db } from '@/lib/db'
import { query } from '@/lib/db-query-builder'

export interface DiagnosticResult {
  name: string
  status: 'passed' | 'warning' | 'failed' | 'skipped'
  message: string
  details?: Record<string, any>
  recommendations?: string[]
  duration: number
  timestamp: Date
}

export interface DiagnosticSuite {
  id: string
  name: string
  description: string
  tests: DiagnosticTest[]
  enabled: boolean
}

export interface DiagnosticTest {
  id: string
  name: string
  description: string
  category: 'system' | 'database' | 'network' | 'performance' | 'security'
  severity: 'low' | 'medium' | 'high' | 'critical'
  run: () => Promise<DiagnosticResult>
  enabled: boolean
}

export interface DiagnosticReport {
  suiteId: string
  suiteName: string
  startTime: Date
  endTime: Date
  duration: number
  results: DiagnosticResult[]
  summary: {
    total: number
    passed: number
    warnings: number
    failed: number
    skipped: number
  }
  overallStatus: 'healthy' | 'degraded' | 'critical'
  recommendations: string[]
}

export class SystemDiagnosticsService {
  private diagnosticSuites: Map<string, DiagnosticSuite> = new Map()

  constructor() {
    this.registerDefaultDiagnosticSuites()
  }

  /**
   * Register a diagnostic suite
   */
  registerDiagnosticSuite(suite: DiagnosticSuite): void {
    this.diagnosticSuites.set(suite.id, suite)
    
    loggingService.logInfo('SystemDiagnosticsService', `Registered diagnostic suite: ${suite.name}`, {
      suiteId: suite.id,
      testCount: suite.tests.length,
      enabled: suite.enabled
    })
  }

  /**
   * Run specific diagnostic suite
   */
  async runDiagnosticSuite(suiteId: string): Promise<DiagnosticReport> {
    const suite = this.diagnosticSuites.get(suiteId)
    if (!suite) {
      throw new Error(`Diagnostic suite not found: ${suiteId}`)
    }

    if (!suite.enabled) {
      throw new Error(`Diagnostic suite is disabled: ${suite.name}`)
    }

    const startTime = new Date()
    const results: DiagnosticResult[] = []
    const recommendations: string[] = []

    await loggingService.logInfo('SystemDiagnosticsService', `Starting diagnostic suite: ${suite.name}`, {
      suiteId,
      testCount: suite.tests.length
    })

    // Run all tests in the suite
    for (const test of suite.tests) {
      if (!test.enabled) {
        results.push({
          name: test.name,
          status: 'skipped',
          message: 'Test is disabled',
          duration: 0,
          timestamp: new Date()
        })
        continue
      }

      try {
        const testStartTime = Date.now()
        const result = await test.run()
        const testEndTime = Date.now()

        result.duration = testEndTime - testStartTime
        result.timestamp = new Date()
        
        results.push(result)

        // Collect recommendations
        if (result.recommendations) {
          recommendations.push(...result.recommendations)
        }

        // Log test completion
        await loggingService.logInfo('SystemDiagnosticsService', 
          `Diagnostic test completed: ${test.name}`, {
          suiteId,
          testId: test.id,
          status: result.status,
          duration: result.duration,
          message: result.message
        })

      } catch (error) {
        const failureResult: DiagnosticResult = {
          name: test.name,
          status: 'failed',
          message: `Test execution failed: ${error.message}`,
          duration: 0,
          timestamp: new Date(),
          details: { error: error.message }
        }
        
        results.push(failureResult)

        await loggingService.logError('SystemDiagnosticsService', 
          `Diagnostic test failed: ${test.name}`, {
          suiteId,
          testId: test.id,
          error: error.message
        }, error as Error)
      }
    }

    const endTime = new Date()
    const duration = endTime.getTime() - startTime.getTime()

    // Calculate summary
    const summary = {
      total: results.length,
      passed: results.filter(r => r.status === 'passed').length,
      warnings: results.filter(r => r.status === 'warning').length,
      failed: results.filter(r => r.status === 'failed').length,
      skipped: results.filter(r => r.status === 'skipped').length
    }

    // Determine overall status
    let overallStatus: 'healthy' | 'degraded' | 'critical' = 'healthy'
    if (summary.failed > 0) {
      overallStatus = 'critical'
    } else if (summary.warnings > 0) {
      overallStatus = 'degraded'
    }

    const report: DiagnosticReport = {
      suiteId,
      suiteName: suite.name,
      startTime,
      endTime,
      duration,
      results,
      summary,
      overallStatus,
      recommendations: [...new Set(recommendations)] // Remove duplicates
    }

    // Log completion
    await loggingService.logInfo('SystemDiagnosticsService', 
      `Diagnostic suite completed: ${suite.name}`, {
      suiteId,
      duration,
      overallStatus,
      summary
    })

    // Send alert if critical issues found
    if (overallStatus === 'critical') {
      await alertService.sendCriticalAlert(
        'Diagnostic Suite Critical Issues',
        `Diagnostic suite "${suite.name}" found ${summary.failed} critical issues`,
        'system_error',
        {
          suiteId,
          suiteName: suite.name,
          summary,
          failedTests: results.filter(r => r.status === 'failed').map(r => r.name)
        }
      )
    }

    return report
  }

  /**
   * Run all enabled diagnostic suites
   */
  async runAllDiagnostics(): Promise<DiagnosticReport[]> {
    const enabledSuites = Array.from(this.diagnosticSuites.values())
      .filter(suite => suite.enabled)

    const reports: DiagnosticReport[] = []

    for (const suite of enabledSuites) {
      try {
        const report = await this.runDiagnosticSuite(suite.id)
        reports.push(report)
      } catch (error) {
        await loggingService.logError('SystemDiagnosticsService', 
          `Failed to run diagnostic suite: ${suite.name}`, {
          suiteId: suite.id,
          error: error.message
        }, error as Error)
      }
    }

    return reports
  }

  /**
   * Get available diagnostic suites
   */
  getDiagnosticSuites(): DiagnosticSuite[] {
    return Array.from(this.diagnosticSuites.values())
  }

  /**
   * Enable/disable diagnostic suite
   */
  setDiagnosticSuiteEnabled(suiteId: string, enabled: boolean): void {
    const suite = this.diagnosticSuites.get(suiteId)
    if (suite) {
      suite.enabled = enabled
      
      loggingService.logInfo('SystemDiagnosticsService', 
        `Diagnostic suite ${enabled ? 'enabled' : 'disabled'}: ${suite.name}`, {
        suiteId,
        enabled
      })
    }
  }

  /**
   * Enable/disable specific diagnostic test
   */
  setDiagnosticTestEnabled(suiteId: string, testId: string, enabled: boolean): void {
    const suite = this.diagnosticSuites.get(suiteId)
    if (suite) {
      const test = suite.tests.find(t => t.id === testId)
      if (test) {
        test.enabled = enabled
        
        loggingService.logInfo('SystemDiagnosticsService', 
          `Diagnostic test ${enabled ? 'enabled' : 'disabled'}: ${test.name}`, {
          suiteId,
          testId,
          enabled
        })
      }
    }
  }

  // Private methods for registering default diagnostic suites

  private registerDefaultDiagnosticSuites(): void {
    // System Health Suite
    this.registerDiagnosticSuite({
      id: 'system_health',
      name: 'System Health Check',
      description: 'Basic system health and resource checks',
      enabled: true,
      tests: [
        {
          id: 'memory_usage',
          name: 'Memory Usage Check',
          description: 'Check system memory usage levels',
          category: 'system',
          severity: 'high',
          enabled: true,
          run: async (): Promise<DiagnosticResult> => {
            const memoryUsage = process.memoryUsage()
            const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024)
            const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024)
            const usagePercent = (heapUsedMB / heapTotalMB) * 100

            let status: 'passed' | 'warning' | 'failed' = 'passed'
            let message = `Memory usage is normal (${heapUsedMB}MB / ${heapTotalMB}MB, ${Math.round(usagePercent)}%)`
            const recommendations: string[] = []

            if (usagePercent > 90) {
              status = 'failed'
              message = `Critical memory usage: ${Math.round(usagePercent)}%`
              recommendations.push('Consider restarting the application')
              recommendations.push('Investigate memory leaks')
            } else if (usagePercent > 80) {
              status = 'warning'
              message = `High memory usage: ${Math.round(usagePercent)}%`
              recommendations.push('Monitor memory usage closely')
            }

            return {
              name: 'Memory Usage Check',
              status,
              message,
              details: {
                heapUsed: heapUsedMB,
                heapTotal: heapTotalMB,
                usagePercent: Math.round(usagePercent),
                rss: Math.round(memoryUsage.rss / 1024 / 1024),
                external: Math.round(memoryUsage.external / 1024 / 1024)
              },
              recommendations,
              duration: 0,
              timestamp: new Date()
            }
          }
        },
        {
          id: 'uptime_check',
          name: 'System Uptime Check',
          description: 'Check system uptime and stability',
          category: 'system',
          severity: 'medium',
          enabled: true,
          run: async (): Promise<DiagnosticResult> => {
            const uptime = process.uptime()
            const uptimeHours = uptime / 3600

            let status: 'passed' | 'warning' | 'failed' = 'passed'
            let message = `System uptime: ${Math.round(uptimeHours)} hours`
            const recommendations: string[] = []

            if (uptimeHours < 0.1) { // Less than 6 minutes
              status = 'warning'
              message = `System recently restarted (${Math.round(uptime)} seconds ago)`
              recommendations.push('Monitor for stability issues')
            }

            return {
              name: 'System Uptime Check',
              status,
              message,
              details: {
                uptimeSeconds: Math.round(uptime),
                uptimeHours: Math.round(uptimeHours * 100) / 100
              },
              recommendations,
              duration: 0,
              timestamp: new Date()
            }
          }
        }
      ]
    })

    // Database Health Suite
    this.registerDiagnosticSuite({
      id: 'database_health',
      name: 'Database Health Check',
      description: 'Database connectivity, performance, and integrity checks',
      enabled: true,
      tests: [
        {
          id: 'db_connectivity',
          name: 'Database Connectivity',
          description: 'Test database connection and basic queries',
          category: 'database',
          severity: 'critical',
          enabled: true,
          run: async (): Promise<DiagnosticResult> => {
            try {
              const startTime = Date.now()
              await db.query('SELECT 1 as test')
              const responseTime = Date.now() - startTime

              let status: 'passed' | 'warning' | 'failed' = 'passed'
              let message = `Database connected successfully (${responseTime}ms)`
              const recommendations: string[] = []

              if (responseTime > 1000) {
                status = 'warning'
                message = `Database connection slow (${responseTime}ms)`
                recommendations.push('Investigate database performance')
              }

              return {
                name: 'Database Connectivity',
                status,
                message,
                details: { responseTime },
                recommendations,
                duration: 0,
                timestamp: new Date()
              }

            } catch (error) {
              return {
                name: 'Database Connectivity',
                status: 'failed',
                message: `Database connection failed: ${error.message}`,
                details: { error: error.message },
                recommendations: [
                  'Check database server status',
                  'Verify connection credentials',
                  'Check network connectivity'
                ],
                duration: 0,
                timestamp: new Date()
              }
            }
          }
        },
        {
          id: 'db_pool_health',
          name: 'Connection Pool Health',
          description: 'Check database connection pool status',
          category: 'database',
          severity: 'high',
          enabled: true,
          run: async (): Promise<DiagnosticResult> => {
            try {
              const poolStats = db.getPoolStats()
              const utilization = (poolStats.active / poolStats.total) * 100

              let status: 'passed' | 'warning' | 'failed' = 'passed'
              let message = `Connection pool healthy (${poolStats.active}/${poolStats.total} active, ${Math.round(utilization)}% utilization)`
              const recommendations: string[] = []

              if (utilization > 90) {
                status = 'failed'
                message = `Connection pool nearly exhausted (${Math.round(utilization)}% utilization)`
                recommendations.push('Increase connection pool size')
                recommendations.push('Investigate connection leaks')
              } else if (utilization > 80) {
                status = 'warning'
                message = `High connection pool utilization (${Math.round(utilization)}%)`
                recommendations.push('Monitor connection usage')
              }

              return {
                name: 'Connection Pool Health',
                status,
                message,
                details: {
                  ...poolStats,
                  utilization: Math.round(utilization)
                },
                recommendations,
                duration: 0,
                timestamp: new Date()
              }

            } catch (error) {
              return {
                name: 'Connection Pool Health',
                status: 'failed',
                message: `Failed to get pool stats: ${error.message}`,
                details: { error: error.message },
                recommendations: ['Check database connection'],
                duration: 0,
                timestamp: new Date()
              }
            }
          }
        }
      ]
    })

    // Performance Suite
    this.registerDiagnosticSuite({
      id: 'performance_check',
      name: 'Performance Analysis',
      description: 'System performance and response time checks',
      enabled: true,
      tests: [
        {
          id: 'response_times',
          name: 'API Response Times',
          description: 'Check average API response times',
          category: 'performance',
          severity: 'medium',
          enabled: true,
          run: async (): Promise<DiagnosticResult> => {
            try {
              const performanceStats = await metricsService.getPerformanceStats()
              
              const avgResponseTime = (
                performanceStats.avgAPIResponseTime + 
                performanceStats.avgDatabaseQueryTime + 
                performanceStats.avgContentProcessingTime
              ) / 3

              let status: 'passed' | 'warning' | 'failed' = 'passed'
              let message = `Average response times are good (${Math.round(avgResponseTime)}ms average)`
              const recommendations: string[] = []

              if (avgResponseTime > 2000) {
                status = 'failed'
                message = `Poor response times (${Math.round(avgResponseTime)}ms average)`
                recommendations.push('Investigate performance bottlenecks')
                recommendations.push('Consider scaling resources')
              } else if (avgResponseTime > 1000) {
                status = 'warning'
                message = `Slow response times (${Math.round(avgResponseTime)}ms average)`
                recommendations.push('Monitor performance trends')
              }

              return {
                name: 'API Response Times',
                status,
                message,
                details: performanceStats,
                recommendations,
                duration: 0,
                timestamp: new Date()
              }

            } catch (error) {
              return {
                name: 'API Response Times',
                status: 'failed',
                message: `Failed to get performance stats: ${error.message}`,
                details: { error: error.message },
                recommendations: ['Check metrics service'],
                duration: 0,
                timestamp: new Date()
              }
            }
          }
        }
      ]
    })
  }
}

// Export singleton instance
export const systemDiagnosticsService = new SystemDiagnosticsService()