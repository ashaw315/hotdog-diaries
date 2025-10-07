import { loggingService } from './logging'
import { healthService } from './health'
import { metricsService } from './metrics'
import { alertService } from './alerts'
import { errorRecoveryService } from './error-recovery'
import { systemDiagnosticsService } from './system-diagnostics'
import { query } from '@/lib/db-query-builder'

export interface MonitoringRule {
  id: string
  name: string
  description: string
  category: 'health' | 'performance' | 'business' | 'security'
  enabled: boolean
  conditions: MonitoringCondition[]
  actions: MonitoringAction[]
  schedule: {
    interval: number // in milliseconds
    maxExecutions?: number
    activeHours?: { start: number; end: number } // 0-23 hour format
  }
  metadata?: Record<string, any>
}

export interface MonitoringCondition {
  type: 'metric_threshold' | 'health_status' | 'log_pattern' | 'custom'
  metric?: string
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'contains' | 'not_contains'
  value: any
  windowMinutes?: number
  aggregation?: 'avg' | 'sum' | 'count' | 'min' | 'max'
}

export interface MonitoringAction {
  type: 'alert' | 'recovery' | 'log' | 'custom'
  severity?: 'low' | 'medium' | 'high' | 'critical'
  alertType?: string
  recoveryActionId?: string
  customFunction?: () => Promise<void>
  metadata?: Record<string, any>
}

export interface MonitoringExecution {
  ruleId: string
  executedAt: Date
  conditionsMet: boolean
  actionsExecuted: number
  duration: number
  error?: string
  details: Record<string, any>
}

export interface AlertCorrelation {
  pattern: string
  description: string
  timeWindowMinutes: number
  minimumOccurrences: number
  alertTypes: string[]
  action: 'escalate' | 'suppress' | 'group'
}

export class ProactiveMonitoringService {
  private monitoringRules: Map<string, MonitoringRule> = new Map()
  private scheduledJobs: Map<string, NodeJS.Timeout> = new Map()
  private executionHistory: MonitoringExecution[] = []
  private alertCorrelations: AlertCorrelation[] = []
  private isActive = false

  constructor() {
    this.registerDefaultMonitoringRules()
    this.registerAlertCorrelations()
  }

  /**
   * Start proactive monitoring
   */
  async start(): Promise<void> {
    if (this.isActive) {
      await loggingService.logWarning('ProactiveMonitoringService', 'Monitoring already active')
      return
    }

    // Skip background monitoring loops in CI/test environments
    if (process.env.CI || process.env.DISABLE_HEALTH_LOOPS === 'true') {
      console.log('🧪 [CI] Skipping background health checks and monitoring loops')
      await loggingService.logInfo('ProactiveMonitoringService', 'Proactive monitoring disabled in CI/test environment')
      return
    }

    this.isActive = true
    
    await loggingService.logInfo('ProactiveMonitoringService', 'Starting proactive monitoring')

    // Schedule all enabled monitoring rules
    for (const [ruleId, rule] of this.monitoringRules) {
      if (rule.enabled) {
        this.scheduleMonitoringRule(ruleId)
      }
    }

    // Start alert correlation monitoring
    this.startAlertCorrelation()

    await loggingService.logInfo('ProactiveMonitoringService', 'Proactive monitoring started', {
      activeRules: Array.from(this.monitoringRules.values()).filter(r => r.enabled).length,
      totalRules: this.monitoringRules.size
    })
  }

  /**
   * Stop proactive monitoring
   */
  async stop(): Promise<void> {
    if (!this.isActive) {
      return
    }

    this.isActive = false

    // Clear all scheduled jobs
    for (const [ruleId, timer] of this.scheduledJobs) {
      clearInterval(timer)
    }
    this.scheduledJobs.clear()

    await loggingService.logInfo('ProactiveMonitoringService', 'Proactive monitoring stopped')
  }

  /**
   * Register a monitoring rule
   */
  registerMonitoringRule(rule: MonitoringRule): void {
    this.monitoringRules.set(rule.id, rule)
    
    // If monitoring is active and rule is enabled, schedule it
    if (this.isActive && rule.enabled) {
      this.scheduleMonitoringRule(rule.id)
    }

    loggingService.logInfo('ProactiveMonitoringService', `Registered monitoring rule: ${rule.name}`, {
      ruleId: rule.id,
      category: rule.category,
      enabled: rule.enabled,
      conditionCount: rule.conditions.length,
      actionCount: rule.actions.length
    })
  }

  /**
   * Execute a specific monitoring rule
   */
  async executeMonitoringRule(ruleId: string): Promise<MonitoringExecution> {
    const rule = this.monitoringRules.get(ruleId)
    if (!rule) {
      throw new Error(`Monitoring rule not found: ${ruleId}`)
    }

    const startTime = Date.now()
    const execution: MonitoringExecution = {
      ruleId,
      executedAt: new Date(),
      conditionsMet: false,
      actionsExecuted: 0,
      duration: 0,
      details: {}
    }

    try {
      // Check if rule should run based on active hours
      if (rule.schedule.activeHours) {
        const currentHour = new Date().getHours()
        const { start, end } = rule.schedule.activeHours
        
        if (start <= end) {
          // Normal range (e.g., 9-17)
          if (currentHour < start || currentHour > end) {
            execution.details.skipped = 'Outside active hours'
            return execution
          }
        } else {
          // Overnight range (e.g., 22-6)
          if (currentHour < start && currentHour > end) {
            execution.details.skipped = 'Outside active hours'
            return execution
          }
        }
      }

      await loggingService.logDebug('ProactiveMonitoringService', `Executing monitoring rule: ${rule.name}`, {
        ruleId,
        category: rule.category
      })

      // Evaluate all conditions
      const conditionResults = await Promise.all(
        rule.conditions.map(condition => this.evaluateCondition(condition))
      )

      execution.conditionsMet = conditionResults.every(result => result.met)
      execution.details.conditionResults = conditionResults

      // If conditions are met, execute actions
      if (execution.conditionsMet) {
        await loggingService.logInfo('ProactiveMonitoringService', 
          `Monitoring rule conditions met: ${rule.name}`, {
          ruleId,
          conditionResults
        })

        for (const action of rule.actions) {
          try {
            await this.executeMonitoringAction(action, rule, execution.details)
            execution.actionsExecuted++
          } catch (error) {
            await loggingService.logError('ProactiveMonitoringService', 
              `Failed to execute monitoring action`, {
              ruleId,
              actionType: action.type,
              error: error.message
            }, error as Error)
            
            execution.error = error.message
          }
        }

        // Record metrics
        await metricsService.recordCustomMetric(
          'monitoring_rule_triggered',
          1,
          'count',
          {
            ruleId,
            category: rule.category,
            actionsExecuted: execution.actionsExecuted.toString()
          }
        )
      }

    } catch (error) {
      execution.error = error.message
      await loggingService.logError('ProactiveMonitoringService', 
        `Error executing monitoring rule: ${rule.name}`, {
        ruleId,
        error: error.message
      }, error as Error)
    }

    execution.duration = Date.now() - startTime
    
    // Store execution history (keep last 1000 executions)
    this.executionHistory.push(execution)
    if (this.executionHistory.length > 1000) {
      this.executionHistory.shift()
    }

    return execution
  }

  /**
   * Get monitoring statistics
   */
  getMonitoringStatistics(): {
    totalRules: number
    activeRules: number
    totalExecutions: number
    successfulExecutions: number
    triggeredExecutions: number
    averageExecutionTime: number
    recentTriggers: MonitoringExecution[]
  } {
    const recentExecutions = this.executionHistory.filter(exec => 
      Date.now() - exec.executedAt.getTime() < 24 * 60 * 60 * 1000 // Last 24 hours
    )

    const triggeredExecutions = recentExecutions.filter(exec => exec.conditionsMet)
    const successfulExecutions = recentExecutions.filter(exec => !exec.error)
    
    const totalExecutionTime = recentExecutions.reduce((sum, exec) => sum + exec.duration, 0)
    const averageExecutionTime = recentExecutions.length > 0 
      ? Math.round(totalExecutionTime / recentExecutions.length) 
      : 0

    return {
      totalRules: this.monitoringRules.size,
      activeRules: Array.from(this.monitoringRules.values()).filter(r => r.enabled).length,
      totalExecutions: recentExecutions.length,
      successfulExecutions: successfulExecutions.length,
      triggeredExecutions: triggeredExecutions.length,
      averageExecutionTime,
      recentTriggers: triggeredExecutions.slice(-10) // Last 10 triggered executions
    }
  }

  /**
   * Enable/disable monitoring rule
   */
  setMonitoringRuleEnabled(ruleId: string, enabled: boolean): void {
    const rule = this.monitoringRules.get(ruleId)
    if (!rule) {
      return
    }

    rule.enabled = enabled

    if (this.isActive) {
      if (enabled) {
        this.scheduleMonitoringRule(ruleId)
      } else {
        this.unscheduleMonitoringRule(ruleId)
      }
    }

    loggingService.logInfo('ProactiveMonitoringService', 
      `Monitoring rule ${enabled ? 'enabled' : 'disabled'}: ${rule.name}`, {
      ruleId,
      enabled
    })
  }

  /**
   * Get monitoring rules
   */
  getMonitoringRules(): MonitoringRule[] {
    return Array.from(this.monitoringRules.values())
  }

  // Private methods

  private scheduleMonitoringRule(ruleId: string): void {
    const rule = this.monitoringRules.get(ruleId)
    if (!rule || !rule.enabled) {
      return
    }

    // Clear existing timer if any
    this.unscheduleMonitoringRule(ruleId)

    let executionCount = 0
    const timer = setInterval(async () => {
      try {
        await this.executeMonitoringRule(ruleId)
        executionCount++

        // Check if max executions reached
        if (rule.schedule.maxExecutions && executionCount >= rule.schedule.maxExecutions) {
          this.unscheduleMonitoringRule(ruleId)
          
          await loggingService.logInfo('ProactiveMonitoringService', 
            `Monitoring rule reached max executions: ${rule.name}`, {
            ruleId,
            executionCount,
            maxExecutions: rule.schedule.maxExecutions
          })
        }
      } catch (error) {
        await loggingService.logError('ProactiveMonitoringService', 
          `Error in scheduled monitoring rule: ${rule.name}`, {
          ruleId,
          error: error.message
        }, error as Error)
      }
    }, rule.schedule.interval)

    this.scheduledJobs.set(ruleId, timer)
  }

  private unscheduleMonitoringRule(ruleId: string): void {
    const timer = this.scheduledJobs.get(ruleId)
    if (timer) {
      clearInterval(timer)
      this.scheduledJobs.delete(ruleId)
    }
  }

  private async evaluateCondition(condition: MonitoringCondition): Promise<{
    met: boolean
    value: any
    details: Record<string, any>
  }> {
    switch (condition.type) {
      case 'metric_threshold':
        return await this.evaluateMetricCondition(condition)
      
      case 'health_status':
        return await this.evaluateHealthCondition(condition)
      
      case 'log_pattern':
        return await this.evaluateLogCondition(condition)
      
      case 'custom':
        return await this.evaluateCustomCondition(condition)
      
      default:
        return { met: false, value: null, details: { error: 'Unknown condition type' } }
    }
  }

  private async evaluateMetricCondition(condition: MonitoringCondition): Promise<{
    met: boolean
    value: any
    details: Record<string, any>
  }> {
    try {
      const now = new Date()
      const windowStart = new Date(now.getTime() - (condition.windowMinutes || 5) * 60 * 1000)

      const result = await metricsService.queryMetrics({
        name: [condition.metric!],
        dateRange: { start: windowStart, end: now },
        aggregation: condition.aggregation || 'avg'
      })

      const value = result.aggregatedValue || 0
      let met = false

      switch (condition.operator) {
        case 'gt':
          met = value > condition.value
          break
        case 'gte':
          met = value >= condition.value
          break
        case 'lt':
          met = value < condition.value
          break
        case 'lte':
          met = value <= condition.value
          break
        case 'eq':
          met = value === condition.value
          break
      }

      return {
        met,
        value,
        details: {
          metric: condition.metric,
          operator: condition.operator,
          threshold: condition.value,
          aggregation: condition.aggregation,
          windowMinutes: condition.windowMinutes
        }
      }

    } catch (error) {
      return {
        met: false,
        value: null,
        details: { error: error.message }
      }
    }
  }

  private async evaluateHealthCondition(condition: MonitoringCondition): Promise<{
    met: boolean
    value: any
    details: Record<string, any>
  }> {
    try {
      const healthReport = await healthService.generateHealthReport()
      const value = healthReport.overallStatus
      
      let met = false
      switch (condition.operator) {
        case 'eq':
          met = value === condition.value
          break
        case 'contains':
          met = value.includes(condition.value)
          break
        case 'not_contains':
          met = !value.includes(condition.value)
          break
      }

      return {
        met,
        value,
        details: {
          overallStatus: healthReport.overallStatus,
          summary: healthReport.summary
        }
      }

    } catch (error) {
      return {
        met: false,
        value: null,
        details: { error: error.message }
      }
    }
  }

  private async evaluateLogCondition(condition: MonitoringCondition): Promise<{
    met: boolean
    value: any
    details: Record<string, any>
  }> {
    try {
      const now = new Date()
      const windowStart = new Date(now.getTime() - (condition.windowMinutes || 5) * 60 * 1000)

      const result = await loggingService.queryLogs({
        search: condition.metric, // Use metric field as search pattern
        dateRange: { start: windowStart, end: now },
        limit: 1000
      })

      const value = result.logs.length
      let met = false

      switch (condition.operator) {
        case 'gt':
          met = value > condition.value
          break
        case 'gte':
          met = value >= condition.value
          break
        case 'lt':
          met = value < condition.value
          break
        case 'lte':
          met = value <= condition.value
          break
        case 'eq':
          met = value === condition.value
          break
      }

      return {
        met,
        value,
        details: {
          pattern: condition.metric,
          matchCount: value,
          threshold: condition.value,
          windowMinutes: condition.windowMinutes
        }
      }

    } catch (error) {
      return {
        met: false,
        value: null,
        details: { error: error.message }
      }
    }
  }

  private async evaluateCustomCondition(condition: MonitoringCondition): Promise<{
    met: boolean
    value: any
    details: Record<string, any>
  }> {
    // This would be implemented based on specific custom logic needs
    return {
      met: false,
      value: null,
      details: { message: 'Custom condition evaluation not implemented' }
    }
  }

  private async executeMonitoringAction(
    action: MonitoringAction, 
    rule: MonitoringRule, 
    executionDetails: Record<string, any>
  ): Promise<void> {
    switch (action.type) {
      case 'alert':
        const alertTitle = `Monitoring Alert: ${rule.name}`
        const alertMessage = `Monitoring rule "${rule.name}" triggered. Conditions: ${JSON.stringify(executionDetails.conditionResults)}`
        
        if (action.severity === 'critical') {
          await alertService.sendCriticalAlert(
            alertTitle,
            alertMessage,
            action.alertType as any,
            { ruleId: rule.id, ...action.metadata }
          )
        } else {
          await alertService.sendWarningAlert(
            alertTitle,
            alertMessage,
            action.alertType as any,
            { ruleId: rule.id, ...action.metadata }
          )
        }
        break

      case 'recovery':
        if (action.recoveryActionId) {
          await errorRecoveryService.executeRecoveryAction(action.recoveryActionId)
        }
        break

      case 'log':
        await loggingService.logWarning('ProactiveMonitoringService', 
          `Monitoring action triggered: ${rule.name}`, {
          ruleId: rule.id,
          executionDetails,
          actionMetadata: action.metadata
        })
        break

      case 'custom':
        if (action.customFunction) {
          await action.customFunction()
        }
        break
    }
  }

  private registerDefaultMonitoringRules(): void {
    // High error rate monitoring
    this.registerMonitoringRule({
      id: 'high_error_rate',
      name: 'High Error Rate Detection',
      description: 'Monitors for sustained high error rates',
      category: 'performance',
      enabled: true,
      conditions: [
        {
          type: 'log_pattern',
          metric: 'error',
          operator: 'gt',
          value: 10,
          windowMinutes: 5,
          aggregation: 'count'
        }
      ],
      actions: [
        {
          type: 'alert',
          severity: 'critical',
          alertType: 'performance_degradation'
        }
      ],
      schedule: {
        interval: 60000 // Every minute
      }
    })

    // Memory usage monitoring
    this.registerMonitoringRule({
      id: 'memory_usage_high',
      name: 'High Memory Usage',
      description: 'Monitors for high memory usage',
      category: 'performance',
      enabled: true,
      conditions: [
        {
          type: 'metric_threshold',
          metric: 'system_memory_usage',
          operator: 'gt',
          value: 512, // 512MB
          windowMinutes: 5,
          aggregation: 'avg'
        }
      ],
      actions: [
        {
          type: 'alert',
          severity: 'high',
          alertType: 'resource_exhaustion'
        },
        {
          type: 'recovery',
          recoveryActionId: 'force_garbage_collection'
        }
      ],
      schedule: {
        interval: 120000 // Every 2 minutes
      }
    })

    // Queue backup monitoring
    this.registerMonitoringRule({
      id: 'queue_backup',
      name: 'Content Queue Backup',
      description: 'Monitors for content queue backup',
      category: 'business',
      enabled: true,
      conditions: [
        {
          type: 'metric_threshold',
          metric: 'business_queue_size',
          operator: 'gt',
          value: 100,
          windowMinutes: 10,
          aggregation: 'avg'
        }
      ],
      actions: [
        {
          type: 'alert',
          severity: 'medium',
          alertType: 'queue_issue'
        },
        {
          type: 'recovery',
          recoveryActionId: 'clear_stuck_queue_items'
        }
      ],
      schedule: {
        interval: 300000 // Every 5 minutes
      }
    })
  }

  private registerAlertCorrelations(): void {
    this.alertCorrelations = [
      {
        pattern: 'database_failures',
        description: 'Multiple database-related failures',
        timeWindowMinutes: 10,
        minimumOccurrences: 3,
        alertTypes: ['database_issue', 'api_failure'],
        action: 'escalate'
      },
      {
        pattern: 'memory_issues',
        description: 'Memory-related performance issues',
        timeWindowMinutes: 15,
        minimumOccurrences: 2,
        alertTypes: ['resource_exhaustion', 'performance_degradation'],
        action: 'group'
      }
    ]
  }

  private startAlertCorrelation(): void {
    // This would implement alert correlation logic
    // For now, it's a placeholder for future implementation
    setInterval(async () => {
      // Check for alert patterns and correlations
      // This would be implemented based on alert history analysis
    }, 60000) // Check every minute
  }
}

// Export singleton instance
export const proactiveMonitoringService = new ProactiveMonitoringService()