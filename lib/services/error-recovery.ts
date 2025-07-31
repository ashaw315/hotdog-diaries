import { loggingService } from './logging'
import { alertService } from './alerts'
import { healthService } from './health'
import { metricsService } from './metrics'
import { query } from '@/lib/db-query-builder'

export interface RecoveryAction {
  id: string
  name: string
  description: string
  trigger: RecoveryTrigger
  action: () => Promise<boolean>
  maxRetries: number
  retryDelay: number
  priority: 'low' | 'medium' | 'high' | 'critical'
  enabled: boolean
}

export interface RecoveryTrigger {
  type: 'health_check_failure' | 'alert_threshold' | 'manual' | 'scheduled'
  conditions: Record<string, any>
}

export interface RecoveryExecution {
  id: string
  actionId: string
  triggeredAt: Date
  completedAt?: Date
  success: boolean
  retryCount: number
  error?: string
  metrics?: Record<string, any>
}

export interface GracefulDegradationConfig {
  enabled: boolean
  fallbackModes: {
    databaseDown: {
      enabled: boolean
      useCache: boolean
      cacheTimeout: number
    }
    apiDown: {
      enabled: boolean
      skipNonCritical: boolean
      useBackupData: boolean
    }
    highLoad: {
      enabled: boolean
      rateLimitRequests: boolean
      disableNonEssential: boolean
    }
  }
}

export class ErrorRecoveryService {
  private recoveryActions: Map<string, RecoveryAction> = new Map()
  private executionHistory: RecoveryExecution[] = []
  private gracefulDegradation: GracefulDegradationConfig
  private recoveryInProgress = new Set<string>()

  constructor() {
    this.gracefulDegradation = {
      enabled: true,
      fallbackModes: {
        databaseDown: {
          enabled: true,
          useCache: true,
          cacheTimeout: 300000 // 5 minutes
        },
        apiDown: {
          enabled: true,
          skipNonCritical: true,
          useBackupData: true
        },
        highLoad: {
          enabled: true,
          rateLimitRequests: true,
          disableNonEssential: true
        }
      }
    }

    this.registerDefaultRecoveryActions()
    this.startRecoveryMonitoring()
  }

  /**
   * Register a recovery action
   */
  registerRecoveryAction(action: RecoveryAction): void {
    this.recoveryActions.set(action.id, action)
    
    loggingService.logInfo('ErrorRecoveryService', `Registered recovery action: ${action.name}`, {
      actionId: action.id,
      priority: action.priority,
      enabled: action.enabled
    })
  }

  /**
   * Execute recovery action
   */
  async executeRecoveryAction(actionId: string, manual: boolean = false): Promise<boolean> {
    const action = this.recoveryActions.get(actionId)
    if (!action) {
      throw new Error(`Recovery action not found: ${actionId}`)
    }

    if (!action.enabled && !manual) {
      await loggingService.logWarning('ErrorRecoveryService', `Recovery action disabled: ${action.name}`, {
        actionId,
        manual
      })
      return false
    }

    // Prevent concurrent execution of the same action
    if (this.recoveryInProgress.has(actionId)) {
      await loggingService.logWarning('ErrorRecoveryService', `Recovery action already in progress: ${action.name}`, {
        actionId
      })
      return false
    }

    const execution: RecoveryExecution = {
      id: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      actionId,
      triggeredAt: new Date(),
      success: false,
      retryCount: 0
    }

    this.recoveryInProgress.add(actionId)

    try {
      await loggingService.logInfo('ErrorRecoveryService', `Starting recovery action: ${action.name}`, {
        actionId,
        executionId: execution.id,
        manual
      })

      // Record metrics
      const startTime = Date.now()
      
      // Execute action with retries
      let success = false
      let lastError: Error | undefined

      for (let attempt = 0; attempt <= action.maxRetries; attempt++) {
        try {
          execution.retryCount = attempt
          success = await action.action()
          
          if (success) {
            break
          }
        } catch (error) {
          lastError = error as Error
          
          await loggingService.logWarning('ErrorRecoveryService', 
            `Recovery action attempt ${attempt + 1} failed: ${action.name}`, {
            actionId,
            executionId: execution.id,
            attempt: attempt + 1,
            maxRetries: action.maxRetries,
            error: error.message
          })

          // Wait before retry (except on last attempt)
          if (attempt < action.maxRetries) {
            await new Promise(resolve => setTimeout(resolve, action.retryDelay))
          }
        }
      }

      execution.success = success
      execution.completedAt = new Date()
      execution.error = lastError?.message

      // Record execution metrics
      const duration = Date.now() - startTime
      await metricsService.recordCustomMetric(
        'recovery_action_duration',
        duration,
        'ms',
        {
          action: action.name,
          success: success.toString(),
          retries: execution.retryCount.toString()
        }
      )

      if (success) {
        await loggingService.logInfo('ErrorRecoveryService', `Recovery action completed successfully: ${action.name}`, {
          actionId,
          executionId: execution.id,
          duration,
          retryCount: execution.retryCount
        })

        // Send success notification for critical actions
        if (action.priority === 'critical') {
          await alertService.sendWarningAlert(
            'Recovery Action Successful',
            `Critical recovery action "${action.name}" completed successfully`,
            'system_error',
            {
              actionId,
              executionId: execution.id,
              duration,
              retryCount: execution.retryCount
            }
          )
        }
      } else {
        await loggingService.logError('ErrorRecoveryService', `Recovery action failed: ${action.name}`, {
          actionId,
          executionId: execution.id,
          duration,
          retryCount: execution.retryCount,
          lastError: lastError?.message
        }, lastError)

        // Send failure alert
        await alertService.sendCriticalAlert(
          'Recovery Action Failed',
          `Recovery action "${action.name}" failed after ${execution.retryCount} retries`,
          'system_error',
          {
            actionId,
            executionId: execution.id,
            duration,
            retryCount: execution.retryCount,
            error: lastError?.message
          }
        )
      }

      this.executionHistory.push(execution)
      
      // Keep only last 100 executions
      if (this.executionHistory.length > 100) {
        this.executionHistory.shift()
      }

      return success

    } finally {
      this.recoveryInProgress.delete(actionId)
    }
  }

  /**
   * Trigger graceful degradation for specific scenarios
   */
  async triggerGracefulDegradation(scenario: 'database_down' | 'api_down' | 'high_load'): Promise<void> {
    if (!this.gracefulDegradation.enabled) {
      return
    }

    await loggingService.logWarning('ErrorRecoveryService', `Triggering graceful degradation: ${scenario}`, {
      scenario,
      config: this.gracefulDegradation.fallbackModes[scenario.replace('_', '') as keyof typeof this.gracefulDegradation.fallbackModes]
    })

    switch (scenario) {
      case 'database_down':
        await this.handleDatabaseDown()
        break
      case 'api_down':
        await this.handleAPIDown()
        break
      case 'high_load':
        await this.handleHighLoad()
        break
    }

    await alertService.sendWarningAlert(
      'Graceful Degradation Activated',
      `System has entered graceful degradation mode: ${scenario}`,
      'system_error',
      { scenario, timestamp: new Date().toISOString() }
    )
  }

  /**
   * Get recovery action status
   */
  getRecoveryActionStatus(actionId: string): {
    exists: boolean
    enabled: boolean
    inProgress: boolean
    lastExecution?: RecoveryExecution
  } {
    const action = this.recoveryActions.get(actionId)
    const lastExecution = this.executionHistory
      .filter(exec => exec.actionId === actionId)
      .sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime())[0]

    return {
      exists: !!action,
      enabled: action?.enabled || false,
      inProgress: this.recoveryInProgress.has(actionId),
      lastExecution
    }
  }

  /**
   * Get recovery statistics
   */
  getRecoveryStatistics(): {
    totalActions: number
    enabledActions: number
    totalExecutions: number
    successfulExecutions: number
    failedExecutions: number
    averageExecutionTime: number
    actionsInProgress: number
  } {
    const executions = this.executionHistory.filter(exec => exec.completedAt)
    const successfulExecutions = executions.filter(exec => exec.success).length
    const totalExecutionTime = executions.reduce((sum, exec) => {
      return sum + (exec.completedAt!.getTime() - exec.triggeredAt.getTime())
    }, 0)

    return {
      totalActions: this.recoveryActions.size,
      enabledActions: Array.from(this.recoveryActions.values()).filter(action => action.enabled).length,
      totalExecutions: executions.length,
      successfulExecutions,
      failedExecutions: executions.length - successfulExecutions,
      averageExecutionTime: executions.length > 0 ? Math.round(totalExecutionTime / executions.length) : 0,
      actionsInProgress: this.recoveryInProgress.size
    }
  }

  /**
   * Enable/disable recovery action
   */
  setRecoveryActionEnabled(actionId: string, enabled: boolean): void {
    const action = this.recoveryActions.get(actionId)
    if (action) {
      action.enabled = enabled
      
      loggingService.logInfo('ErrorRecoveryService', `Recovery action ${enabled ? 'enabled' : 'disabled'}: ${action.name}`, {
        actionId,
        enabled
      })
    }
  }

  /**
   * Test recovery action (dry run)
   */
  async testRecoveryAction(actionId: string): Promise<boolean> {
    const action = this.recoveryActions.get(actionId)
    if (!action) {
      throw new Error(`Recovery action not found: ${actionId}`)
    }

    await loggingService.logInfo('ErrorRecoveryService', `Testing recovery action: ${action.name}`, {
      actionId,
      testMode: true
    })

    try {
      // For testing, we just validate the action exists and is callable
      // In a real implementation, you might have test modes for actions
      return typeof action.action === 'function'
    } catch (error) {
      await loggingService.logError('ErrorRecoveryService', `Recovery action test failed: ${action.name}`, {
        actionId,
        error: error.message
      }, error as Error)
      
      return false
    }
  }

  // Private methods

  private registerDefaultRecoveryActions(): void {
    // Database recovery actions
    this.registerRecoveryAction({
      id: 'restart_database_connection',
      name: 'Restart Database Connection',
      description: 'Attempts to restart database connection pool',
      trigger: {
        type: 'health_check_failure',
        conditions: { component: 'database', status: 'critical' }
      },
      action: async () => {
        try {
          // This would contain actual database restart logic
          await loggingService.logInfo('ErrorRecoveryService', 'Attempting database connection restart')
          
          // Simulate restart (replace with actual logic)
          await new Promise(resolve => setTimeout(resolve, 2000))
          
          // Check if database is back online
          const healthReport = await healthService.generateHealthReport()
          return healthReport.checks.database.status !== 'critical'
        } catch (error) {
          return false
        }
      },
      maxRetries: 3,
      retryDelay: 5000,
      priority: 'critical',
      enabled: true
    })

    // Queue management recovery
    this.registerRecoveryAction({
      id: 'clear_stuck_queue_items',
      name: 'Clear Stuck Queue Items',
      description: 'Removes queue items that have been processing too long',
      trigger: {
        type: 'health_check_failure',
        conditions: { component: 'contentQueue', status: 'warning' }
      },
      action: async () => {
        try {
          // Clear items that have been processing for more than 30 minutes
          const cutoffTime = new Date(Date.now() - 30 * 60 * 1000)
          
          const clearedCount = await query('content_queue')
            .where('status', 'processing')
            .where('updated_at', '<', cutoffTime)
            .update({ status: 'pending', updated_at: new Date() })

          await loggingService.logInfo('ErrorRecoveryService', `Cleared ${clearedCount} stuck queue items`)
          return true
        } catch (error) {
          return false
        }
      },
      maxRetries: 2,
      retryDelay: 3000,
      priority: 'medium',
      enabled: true
    })

    // Memory cleanup recovery
    this.registerRecoveryAction({
      id: 'force_garbage_collection',
      name: 'Force Garbage Collection',
      description: 'Forces Node.js garbage collection to free memory',
      trigger: {
        type: 'alert_threshold',
        conditions: { metric: 'memory_usage', threshold: 80 }
      },
      action: async () => {
        try {
          if (global.gc) {
            global.gc()
            await loggingService.logInfo('ErrorRecoveryService', 'Forced garbage collection')
            return true
          } else {
            await loggingService.logWarning('ErrorRecoveryService', 'Garbage collection not available')
            return false
          }
        } catch (error) {
          return false
        }
      },
      maxRetries: 1,
      retryDelay: 1000,
      priority: 'medium',
      enabled: true
    })

    // Service restart recovery
    this.registerRecoveryAction({
      id: 'restart_scanning_services',
      name: 'Restart Scanning Services',
      description: 'Restarts social media scanning services',
      trigger: {
        type: 'health_check_failure',
        conditions: { component: 'scheduler', status: 'critical' }
      },
      action: async () => {
        try {
          // This would contain logic to restart scanning services
          await loggingService.logInfo('ErrorRecoveryService', 'Restarting scanning services')
          
          // Simulate service restart
          await new Promise(resolve => setTimeout(resolve, 3000))
          
          return true
        } catch (error) {
          return false
        }
      },
      maxRetries: 2,
      retryDelay: 10000,
      priority: 'high',
      enabled: true
    })
  }

  private async handleDatabaseDown(): Promise<void> {
    const config = this.gracefulDegradation.fallbackModes.databaseDown
    if (!config.enabled) return

    // Implement database fallback logic
    if (config.useCache) {
      await loggingService.logInfo('ErrorRecoveryService', 'Switching to cache-only mode for database operations')
      // Set cache-only flag globally
    }
  }

  private async handleAPIDown(): Promise<void> {
    const config = this.gracefulDegradation.fallbackModes.apiDown
    if (!config.enabled) return

    // Implement API fallback logic
    if (config.skipNonCritical) {
      await loggingService.logInfo('ErrorRecoveryService', 'Skipping non-critical API calls')
      // Set skip flag globally
    }

    if (config.useBackupData) {
      await loggingService.logInfo('ErrorRecoveryService', 'Using backup/cached data for API responses')
      // Switch to backup data source
    }
  }

  private async handleHighLoad(): Promise<void> {
    const config = this.gracefulDegradation.fallbackModes.highLoad
    if (!config.enabled) return

    // Implement high load fallback logic
    if (config.rateLimitRequests) {
      await loggingService.logInfo('ErrorRecoveryService', 'Activating request rate limiting')
      // Enable rate limiting
    }

    if (config.disableNonEssential) {
      await loggingService.logInfo('ErrorRecoveryService', 'Disabling non-essential features')
      // Disable non-essential features
    }
  }

  private startRecoveryMonitoring(): void {
    // Monitor system health and trigger recovery actions as needed
    setInterval(async () => {
      try {
        const healthReport = await healthService.generateHealthReport()
        
        // Check for critical database issues
        if (healthReport.checks.database.status === 'critical') {
          await this.executeRecoveryAction('restart_database_connection')
        }

        // Check for queue issues
        if (healthReport.checks.services.contentQueue.status === 'warning') {
          await this.executeRecoveryAction('clear_stuck_queue_items')
        }

        // Check memory usage
        if (healthReport.checks.system.memory.status === 'critical') {
          await this.executeRecoveryAction('force_garbage_collection')
        }

        // Check scheduler issues
        if (healthReport.checks.services.scheduler.status === 'critical') {
          await this.executeRecoveryAction('restart_scanning_services')
        }

      } catch (error) {
        await loggingService.logError('ErrorRecoveryService', 'Error in recovery monitoring', {
          error: error.message
        }, error as Error)
      }
    }, 60000) // Check every minute
  }
}

// Export singleton instance
export const errorRecoveryService = new ErrorRecoveryService()