import { loggingService } from './logging'
import { healthService } from './health'
import { metricsService } from './metrics'
import { alertService } from './alerts'
import { errorRecoveryService } from './error-recovery'
import { systemDiagnosticsService } from './system-diagnostics'
import { proactiveMonitoringService } from './proactive-monitoring'

export class MonitoringInitializationService {
  private initialized = false
  private shutdownHandlers: (() => Promise<void>)[] = []

  /**
   * Initialize all monitoring services
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      await loggingService.logWarning('MonitoringInit', 'Monitoring services already initialized')
      return
    }

    try {
      await loggingService.logInfo('MonitoringInit', 'Starting monitoring services initialization')

      // Test alert system
      await alertService.testAlertSystem()

      // Start proactive monitoring
      await proactiveMonitoringService.start()

      // Register shutdown handlers
      this.registerShutdownHandlers()

      // Record initialization metrics
      await metricsService.recordCustomMetric(
        'monitoring_initialization',
        1,
        'count',
        { status: 'success' }
      )

      this.initialized = true

      await loggingService.logInfo('MonitoringInit', 'All monitoring services initialized successfully', {
        services: [
          'LoggingService',
          'HealthService', 
          'MetricsService',
          'AlertService',
          'ErrorRecoveryService',
          'SystemDiagnosticsService',
          'ProactiveMonitoringService'
        ]
      })

      // Send startup notification
      await alertService.sendWarningAlert(
        'Monitoring System Started',
        'All monitoring services have been initialized and are operational',
        'system_error',
        {
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV || 'development'
        }
      )

    } catch (error) {
      await loggingService.logError('MonitoringInit', 'Failed to initialize monitoring services', {
        error: error.message
      }, error as Error)

      // Record failure metrics
      await metricsService.recordCustomMetric(
        'monitoring_initialization',
        1,
        'count',
        { status: 'failed', error: error.message }
      )

      throw error
    }
  }

  /**
   * Shutdown all monitoring services gracefully
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return
    }

    await loggingService.logInfo('MonitoringInit', 'Shutting down monitoring services')

    try {
      // Stop proactive monitoring
      await proactiveMonitoringService.stop()

      // Execute all shutdown handlers
      await Promise.allSettled(
        this.shutdownHandlers.map(handler => handler())
      )

      // Final flush of services
      await Promise.allSettled([
        loggingService.shutdown(),
        metricsService.shutdown()
      ])

      this.initialized = false

      console.log('[MonitoringInit] All monitoring services shut down successfully')

    } catch (error) {
      console.error('[MonitoringInit] Error during shutdown:', error)
    }
  }

  /**
   * Get monitoring system status
   */
  async getMonitoringStatus(): Promise<{
    initialized: boolean
    services: {
      logging: boolean
      health: boolean
      metrics: boolean
      alerts: boolean
      recovery: boolean
      diagnostics: boolean
      proactiveMonitoring: boolean
    }
    uptime: number
  }> {
    const uptime = healthService.getUptime()

    return {
      initialized: this.initialized,
      services: {
        logging: true, // Always available
        health: true,  // Always available
        metrics: true, // Always available
        alerts: true,  // Always available
        recovery: true, // Always available
        diagnostics: true, // Always available
        proactiveMonitoring: this.initialized // Only when initialized
      },
      uptime
    }
  }

  /**
   * Run comprehensive health check
   */
  async runHealthCheck(): Promise<{
    healthy: boolean
    report: any
    diagnostics?: any
  }> {
    try {
      // Generate health report
      const report = await healthService.generateHealthReport()
      
      // Run system diagnostics if system is not healthy
      let diagnostics
      if (report.overallStatus !== 'healthy') {
        diagnostics = await systemDiagnosticsService.runDiagnosticSuite('system_health')
      }

      return {
        healthy: report.overallStatus === 'healthy' || report.overallStatus === 'warning',
        report,
        diagnostics
      }

    } catch (error) {
      await loggingService.logError('MonitoringInit', 'Health check failed', {
        error: error.message
      }, error as Error)

      return {
        healthy: false,
        report: null,
        diagnostics: null
      }
    }
  }

  /**
   * Register graceful shutdown handlers
   */
  private registerShutdownHandlers(): void {
    // Add shutdown handlers for logging and metrics services
    this.shutdownHandlers.push(
      () => loggingService.shutdown(),
      () => metricsService.shutdown()
    )

    // Register process signal handlers
    const gracefulShutdown = async (signal: string) => {
      console.log(`[MonitoringInit] Received ${signal}, shutting down gracefully...`)
      await this.shutdown()
      process.exit(0)
    }

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
    process.on('SIGINT', () => gracefulShutdown('SIGINT'))

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      await loggingService.logError('MonitoringInit', 'Uncaught exception', {
        error: error.message,
        stack: error.stack
      }, error)

      await alertService.sendCriticalAlert(
        'Uncaught Exception',
        `Application encountered uncaught exception: ${error.message}`,
        'system_error',
        {
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        }
      )

      // Give time for logging and alerts to complete
      setTimeout(() => {
        process.exit(1)
      }, 2000)
    })

    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason, promise) => {
      const error = reason instanceof Error ? reason : new Error(String(reason))
      
      await loggingService.logError('MonitoringInit', 'Unhandled promise rejection', {
        reason: String(reason),
        error: error.message
      }, error)

      await alertService.sendCriticalAlert(
        'Unhandled Promise Rejection',
        `Application encountered unhandled promise rejection: ${String(reason)}`,
        'system_error',
        {
          reason: String(reason),
          timestamp: new Date().toISOString()
        }
      )
    })
  }

  /**
   * Check if monitoring is initialized
   */
  isInitialized(): boolean {
    return this.initialized
  }
}

// Export singleton instance
export const monitoringInit = new MonitoringInitializationService()

// Auto-initialize in production environments
if (process.env.NODE_ENV === 'production' || process.env.AUTO_INIT_MONITORING === 'true') {
  // Initialize after a short delay to allow other services to start
  setTimeout(async () => {
    try {
      await monitoringInit.initialize()
    } catch (error) {
      console.error('[MonitoringInit] Auto-initialization failed:', error)
    }
  }, 5000) // 5 second delay
}