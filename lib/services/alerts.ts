import { loggingService } from './logging'
import { query, insert } from '@/lib/db-query-builder'
import { HealthStatus, SystemHealthReport } from './health'
import nodemailer from 'nodemailer'

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum AlertType {
  SYSTEM_ERROR = 'system_error',
  API_FAILURE = 'api_failure',
  DATABASE_ISSUE = 'database_issue',
  QUEUE_ISSUE = 'queue_issue',
  PERFORMANCE_DEGRADATION = 'performance_degradation',
  RESOURCE_EXHAUSTION = 'resource_exhaustion',
  AUTHENTICATION_FAILURE = 'authentication_failure',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  SCHEDULER_FAILURE = 'scheduler_failure',
  CONTENT_PROCESSING_ERROR = 'content_processing_error'
}

export enum AlertChannel {
  EMAIL = 'email',
  WEBHOOK = 'webhook',
  LOG = 'log',
  CONSOLE = 'console'
}

export interface Alert {
  id?: string
  type: AlertType
  severity: AlertSeverity
  title: string
  message: string
  metadata?: Record<string, any>
  channels: AlertChannel[]
  createdAt: Date
  resolvedAt?: Date
  acknowledged: boolean
  acknowledgedBy?: string
  acknowledgedAt?: Date
  retryCount: number
  nextRetryAt?: Date
  suppressUntil?: Date
}

export interface AlertRule {
  id: string
  name: string
  description: string
  type: AlertType
  severity: AlertSeverity
  enabled: boolean
  conditions: AlertCondition[]
  throttle: {
    count: number
    windowMinutes: number
  }
  channels: AlertChannel[]
  suppressDuringMaintenance: boolean
}

export interface AlertCondition {
  metric: string
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'contains' | 'not_contains'
  value: any
  windowMinutes?: number
}

export interface AlertChannel {
  type: AlertChannel
  config: Record<string, any>
  enabled: boolean
}

export interface AlertThreshold {
  metric: string
  warning: number
  critical: number
  unit: string
  checkIntervalMinutes: number
}

export interface AlertHistory {
  alerts: Alert[]
  total: number
  byType: Record<AlertType, number>
  bySeverity: Record<AlertSeverity, number>
  resolvedCount: number
  unresolvedCount: number
}

export class AlertService {
  private emailTransporter?: nodemailer.Transporter
  private readonly alertThresholds: AlertThreshold[] = []
  private readonly suppressionMap = new Map<string, Date>()
  private readonly throttleMap = new Map<string, { count: number; windowStart: Date }>()

  constructor() {
    this.initializeEmailTransporter()
    this.initializeDefaultThresholds()
    this.ensureAlertsTable()
  }

  /**
   * Send critical alert for system failures
   */
  async sendCriticalAlert(
    title: string,
    message: string,
    type: AlertType = AlertType.SYSTEM_ERROR,
    metadata?: Record<string, any>,
    channels: AlertChannel[] = [AlertChannel.EMAIL, AlertChannel.LOG]
  ): Promise<void> {
    const alert: Alert = {
      type,
      severity: AlertSeverity.CRITICAL,
      title,
      message,
      metadata,
      channels,
      createdAt: new Date(),
      acknowledged: false,
      retryCount: 0
    }

    await this.sendAlert(alert)
  }

  /**
   * Send warning alert for concerning conditions
   */
  async sendWarningAlert(
    title: string,
    message: string,
    type: AlertType = AlertType.PERFORMANCE_DEGRADATION,
    metadata?: Record<string, any>,
    channels: AlertChannel[] = [AlertChannel.EMAIL, AlertChannel.LOG]
  ): Promise<void> {
    const alert: Alert = {
      type,
      severity: AlertSeverity.MEDIUM,
      title,
      message,
      metadata,
      channels,
      createdAt: new Date(),
      acknowledged: false,
      retryCount: 0
    }

    await this.sendAlert(alert)
  }

  /**
   * Check all alert thresholds against current metrics
   */
  async checkAlertThresholds(metrics: Record<string, any>): Promise<void> {
    for (const threshold of this.alertThresholds) {
      await this.checkThreshold(threshold, metrics)
    }
  }

  /**
   * Monitor system health and send alerts for issues
   */
  async monitorSystemHealth(healthReport: SystemHealthReport): Promise<void> {
    // Check overall system status
    if (healthReport.overallStatus === HealthStatus.CRITICAL) {
      const criticalChecks = this.getCriticalChecks(healthReport)
      await this.sendCriticalAlert(
        'System Health Critical',
        `System health is critical. Failed checks: ${criticalChecks.join(', ')}`,
        AlertType.SYSTEM_ERROR,
        {
          overallStatus: healthReport.overallStatus,
          failedChecks: criticalChecks,
          uptime: healthReport.uptime,
          summary: healthReport.summary
        }
      )
    } else if (healthReport.overallStatus === HealthStatus.WARNING) {
      const warningChecks = this.getWarningChecks(healthReport)
      await this.sendWarningAlert(
        'System Health Warning',
        `System health has warnings. Issues: ${warningChecks.join(', ')}`,
        AlertType.PERFORMANCE_DEGRADATION,
        {
          overallStatus: healthReport.overallStatus,
          warningChecks,
          uptime: healthReport.uptime,
          summary: healthReport.summary
        }
      )
    }

    // Check specific components
    await this.checkDatabaseHealth(healthReport.checks.database)
    await this.checkAPIHealth(healthReport.checks.apis)
    await this.checkServiceHealth(healthReport.checks.services)
    await this.checkSystemResources(healthReport.checks.system)
  }

  /**
   * Manage alert frequency to prevent spam
   */
  async manageAlertFrequency(alert: Alert): Promise<boolean> {
    const alertKey = `${alert.type}_${alert.severity}`
    
    // Check if alert is suppressed
    const suppressedUntil = this.suppressionMap.get(alertKey)
    if (suppressedUntil && suppressedUntil > new Date()) {
      await loggingService.logInfo('AlertService', 'Alert suppressed', {
        alertType: alert.type,
        severity: alert.severity,
        suppressedUntil
      })
      return false
    }

    // Check throttling
    const throttle = this.throttleMap.get(alertKey)
    const now = new Date()
    const throttleWindow = 15 * 60 * 1000 // 15 minutes

    if (throttle) {
      const timeSinceWindowStart = now.getTime() - throttle.windowStart.getTime()
      
      if (timeSinceWindowStart < throttleWindow) {
        if (throttle.count >= this.getMaxAlertsPerWindow(alert.severity)) {
          // Suppress for 1 hour
          const suppressUntil = new Date(now.getTime() + 60 * 60 * 1000)
          this.suppressionMap.set(alertKey, suppressUntil)
          
          await loggingService.logWarning('AlertService', 'Alert throttled and suppressed', {
            alertType: alert.type,
            severity: alert.severity,
            throttleCount: throttle.count,
            suppressUntil
          })
          
          return false
        }
        
        throttle.count++
      } else {
        // Reset window
        this.throttleMap.set(alertKey, { count: 1, windowStart: now })
      }
    } else {
      // First alert in window
      this.throttleMap.set(alertKey, { count: 1, windowStart: now })
    }

    return true
  }

  /**
   * Send alert through configured channels
   */
  private async sendAlert(alert: Alert): Promise<void> {
    // Check if alert should be throttled
    const shouldSend = await this.manageAlertFrequency(alert)
    if (!shouldSend) {
      return
    }

    try {
      // Store alert in database
      const alertId = await this.storeAlert(alert)
      alert.id = alertId

      // Send through each channel
      const promises = alert.channels.map(channel => 
        this.sendThroughChannel(alert, channel)
      )

      await Promise.allSettled(promises)

      await loggingService.logInfo('AlertService', 'Alert sent successfully', {
        alertId: alert.id,
        type: alert.type,
        severity: alert.severity,
        channels: alert.channels,
        title: alert.title
      })

    } catch (error) {
      await loggingService.logError('AlertService', 'Failed to send alert', {
        alert: {
          type: alert.type,
          severity: alert.severity,
          title: alert.title
        },
        error: error.message
      }, error as Error)

      // Retry logic for failed alerts
      await this.scheduleRetry(alert)
    }
  }

  /**
   * Send alert through specific channel
   */
  private async sendThroughChannel(alert: Alert, channel: AlertChannel): Promise<void> {
    switch (channel) {
      case AlertChannel.EMAIL:
        await this.sendEmailAlert(alert)
        break
      case AlertChannel.WEBHOOK:
        await this.sendWebhookAlert(alert)
        break
      case AlertChannel.LOG:
        await this.logAlert(alert)
        break
      case AlertChannel.CONSOLE:
        this.consoleAlert(alert)
        break
      default:
        throw new Error(`Unknown alert channel: ${channel}`)
    }
  }

  /**
   * Send alert via email
   */
  private async sendEmailAlert(alert: Alert): Promise<void> {
    if (!this.emailTransporter) {
      throw new Error('Email transporter not configured')
    }

    const adminEmail = process.env.ADMIN_EMAIL
    if (!adminEmail) {
      throw new Error('Admin email not configured')
    }

    const subject = `[${alert.severity.toUpperCase()}] ${alert.title}`
    const html = this.generateEmailHTML(alert)

    await this.emailTransporter.sendMail({
      from: process.env.SMTP_FROM || 'alerts@hotdog-diaries.com',
      to: adminEmail,
      subject,
      html,
      priority: alert.severity === AlertSeverity.CRITICAL ? 'high' : 'normal'
    })
  }

  /**
   * Send alert via webhook
   */
  private async sendWebhookAlert(alert: Alert): Promise<void> {
    const webhookUrl = process.env.ALERT_WEBHOOK_URL
    if (!webhookUrl) {
      throw new Error('Webhook URL not configured')
    }

    const payload = {
      alert: {
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        metadata: alert.metadata,
        timestamp: alert.createdAt.toISOString()
      },
      source: 'hotdog-diaries',
      environment: process.env.NODE_ENV || 'development'
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Hotdog-Diaries-Alert-Service'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      throw new Error(`Webhook failed with status ${response.status}`)
    }
  }

  /**
   * Log alert to logging service
   */
  private async logAlert(alert: Alert): Promise<void> {
    const logLevel = alert.severity === AlertSeverity.CRITICAL ? 'error' : 'warning'
    
    if (logLevel === 'error') {
      await loggingService.logError('AlertService', alert.message, {
        alertId: alert.id,
        alertType: alert.type,
        severity: alert.severity,
        title: alert.title,
        metadata: alert.metadata
      })
    } else {
      await loggingService.logWarning('AlertService', alert.message, {
        alertId: alert.id,
        alertType: alert.type,
        severity: alert.severity,
        title: alert.title,
        metadata: alert.metadata
      })
    }
  }

  /**
   * Output alert to console
   */
  private consoleAlert(alert: Alert): void {
    const prefix = `[ALERT:${alert.severity.toUpperCase()}]`
    const message = `${prefix} ${alert.title}: ${alert.message}`
    
    if (alert.severity === AlertSeverity.CRITICAL) {
      console.error(message, alert.metadata)
    } else {
      console.warn(message, alert.metadata)
    }
  }

  /**
   * Store alert in database
   */
  private async storeAlert(alert: Alert): Promise<string> {
    const result = await insert('system_alerts')
      .values({
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        metadata: JSON.stringify(alert.metadata || {}),
        channels: JSON.stringify(alert.channels),
        created_at: alert.createdAt,
        acknowledged: alert.acknowledged,
        retry_count: alert.retryCount
      })
      .returning(['id'])
      .first()

    return result.id
  }

  /**
   * Get alert history
   */
  async getAlertHistory(
    limit: number = 100,
    offset: number = 0,
    severity?: AlertSeverity[],
    type?: AlertType[],
    dateRange?: { start: Date; end: Date }
  ): Promise<AlertHistory> {
    let queryBuilder = query('system_alerts')
      .select([
        'id',
        'type',
        'severity', 
        'title',
        'message',
        'metadata',
        'channels',
        'created_at',
        'resolved_at',
        'acknowledged',
        'acknowledged_by',
        'acknowledged_at'
      ])
      .orderBy('created_at', 'DESC')

    if (severity && severity.length > 0) {
      queryBuilder = queryBuilder.whereIn('severity', severity)
    }

    if (type && type.length > 0) {
      queryBuilder = queryBuilder.whereIn('type', type)
    }

    if (dateRange) {
      queryBuilder = queryBuilder
        .where('created_at', '>=', dateRange.start)
        .where('created_at', '<=', dateRange.end)
    }

    // Get total count
    const totalResult = await queryBuilder.clone().count('*').first()
    const total = parseInt(totalResult?.count || '0')

    // Get paginated results
    const results = await queryBuilder
      .limit(limit)
      .offset(offset)
      .execute()

    const alerts: Alert[] = results.map((row: any) => ({
      id: row.id,
      type: row.type,
      severity: row.severity,
      title: row.title,
      message: row.message,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      channels: row.channels ? JSON.parse(row.channels) : [],
      createdAt: new Date(row.created_at),
      resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
      acknowledged: row.acknowledged,
      acknowledgedBy: row.acknowledged_by,
      acknowledgedAt: row.acknowledged_at ? new Date(row.acknowledged_at) : undefined,
      retryCount: 0
    }))

    // Calculate statistics
    const byType: Record<AlertType, number> = {} as any
    const bySeverity: Record<AlertSeverity, number> = {} as any
    let resolvedCount = 0

    alerts.forEach(alert => {
      byType[alert.type] = (byType[alert.type] || 0) + 1
      bySeverity[alert.severity] = (bySeverity[alert.severity] || 0) + 1
      if (alert.resolvedAt) {
        resolvedCount++
      }
    })

    return {
      alerts,
      total,
      byType,
      bySeverity,
      resolvedCount,
      unresolvedCount: total - resolvedCount
    }
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
    await query('system_alerts')
      .where('id', alertId)
      .update({
        acknowledged: true,
        acknowledged_by: acknowledgedBy,
        acknowledged_at: new Date()
      })

    await loggingService.logInfo('AlertService', 'Alert acknowledged', {
      alertId,
      acknowledgedBy
    })
  }

  /**
   * Resolve alert
   */
  async resolveAlert(alertId: string, resolvedBy: string): Promise<void> {
    await query('system_alerts')
      .where('id', alertId)
      .update({
        resolved_at: new Date(),
        acknowledged: true,
        acknowledged_by: resolvedBy,
        acknowledged_at: new Date()
      })

    await loggingService.logInfo('AlertService', 'Alert resolved', {
      alertId,
      resolvedBy
    })
  }

  /**
   * Test alert system
   */
  async testAlertSystem(): Promise<void> {
    await this.sendWarningAlert(
      'Alert System Test',
      'This is a test alert to verify the alert system is working correctly.',
      AlertType.SYSTEM_ERROR,
      {
        test: true,
        timestamp: new Date().toISOString()
      }
    )
  }

  // Private helper methods

  private initializeEmailTransporter(): void {
    const smtpHost = process.env.SMTP_HOST
    const smtpPort = process.env.SMTP_PORT
    const smtpUser = process.env.SMTP_USER
    const smtpPass = process.env.SMTP_PASS

    if (smtpHost && smtpUser && smtpPass) {
      this.emailTransporter = nodemailer.createTransporter({
        host: smtpHost,
        port: parseInt(smtpPort || '587'),
        secure: false,
        auth: {
          user: smtpUser,
          pass: smtpPass
        }
      })
    }
  }

  private initializeDefaultThresholds(): void {
    this.alertThresholds.push(
      {
        metric: 'queue_size',
        warning: 100,
        critical: 500,
        unit: 'items',
        checkIntervalMinutes: 5
      },
      {
        metric: 'error_rate',
        warning: 5,
        critical: 10,
        unit: 'percent',
        checkIntervalMinutes: 5
      },
      {
        metric: 'memory_usage',
        warning: 80,
        critical: 95,
        unit: 'percent',
        checkIntervalMinutes: 10
      }
    )
  }

  private async ensureAlertsTable(): Promise<void> {
    // This would be part of a migration, but ensuring it exists
    // Implementation would depend on your database setup
  }

  private async checkThreshold(threshold: AlertThreshold, metrics: Record<string, any>): Promise<void> {
    const value = metrics[threshold.metric]
    if (value === undefined) return

    if (value >= threshold.critical) {
      await this.sendCriticalAlert(
        `${threshold.metric} Critical`,
        `${threshold.metric} has reached critical level: ${value}${threshold.unit}`,
        AlertType.PERFORMANCE_DEGRADATION,
        { metric: threshold.metric, value, threshold: threshold.critical, unit: threshold.unit }
      )
    } else if (value >= threshold.warning) {
      await this.sendWarningAlert(
        `${threshold.metric} Warning`,
        `${threshold.metric} has reached warning level: ${value}${threshold.unit}`,
        AlertType.PERFORMANCE_DEGRADATION,
        { metric: threshold.metric, value, threshold: threshold.warning, unit: threshold.unit }
      )
    }
  }

  private getCriticalChecks(report: SystemHealthReport): string[] {
    const critical: string[] = []
    const { checks } = report

    if (checks.database.status === HealthStatus.CRITICAL) critical.push('Database')
    if (checks.apis.reddit.status === HealthStatus.CRITICAL) critical.push('Reddit API')
    if (checks.apis.mastodon.status === HealthStatus.CRITICAL) critical.push('Mastodon API')
    if (checks.apis.flickr.status === HealthStatus.CRITICAL) critical.push('Flickr API')
    if (checks.apis.youtube.status === HealthStatus.CRITICAL) critical.push('YouTube API')
    if (checks.apis.unsplash.status === HealthStatus.CRITICAL) critical.push('Unsplash API')
    if (checks.services.contentQueue.status === HealthStatus.CRITICAL) critical.push('Content Queue')
    if (checks.services.scheduler.status === HealthStatus.CRITICAL) critical.push('Scheduler')

    return critical
  }

  private getWarningChecks(report: SystemHealthReport): string[] {
    const warnings: string[] = []
    const { checks } = report

    if (checks.database.status === HealthStatus.WARNING) warnings.push('Database')
    if (checks.apis.reddit.status === HealthStatus.WARNING) warnings.push('Reddit API')
    if (checks.apis.mastodon.status === HealthStatus.WARNING) warnings.push('Mastodon API')
    if (checks.apis.flickr.status === HealthStatus.WARNING) warnings.push('Flickr API')
    if (checks.apis.youtube.status === HealthStatus.WARNING) warnings.push('YouTube API')
    if (checks.apis.unsplash.status === HealthStatus.WARNING) warnings.push('Unsplash API')
    if (checks.services.contentQueue.status === HealthStatus.WARNING) warnings.push('Content Queue')
    if (checks.services.scheduler.status === HealthStatus.WARNING) warnings.push('Scheduler')

    return warnings
  }

  private async checkDatabaseHealth(dbCheck: any): Promise<void> {
    if (dbCheck.status === HealthStatus.CRITICAL) {
      await this.sendCriticalAlert(
        'Database Critical',
        'Database is not responding or has critical issues',
        AlertType.DATABASE_ISSUE,
        { databaseCheck: dbCheck }
      )
    }
  }

  private async checkAPIHealth(apis: any): Promise<void> {
    for (const [platform, apiCheck] of Object.entries(apis)) {
      if ((apiCheck as any).status === HealthStatus.CRITICAL) {
        await this.sendCriticalAlert(
          `${platform} API Critical`,
          `${platform} API is not responding or authentication failed`,
          AlertType.API_FAILURE,
          { platform, apiCheck }
        )
      }
    }
  }

  private async checkServiceHealth(services: any): Promise<void> {
    if (services.contentQueue.status === HealthStatus.CRITICAL) {
      await this.sendCriticalAlert(
        'Content Queue Critical',
        'Content queue has critical issues',
        AlertType.QUEUE_ISSUE,
        { queueCheck: services.contentQueue }
      )
    }

    if (services.scheduler.status === HealthStatus.CRITICAL) {
      await this.sendCriticalAlert(
        'Scheduler Critical',
        'Content scheduler is not working',
        AlertType.SCHEDULER_FAILURE,
        { schedulerCheck: services.scheduler }
      )
    }
  }

  private async checkSystemResources(system: any): Promise<void> {
    if (system.memory.status === HealthStatus.CRITICAL) {
      await this.sendCriticalAlert(
        'Memory Critical',
        'System memory usage is critical',
        AlertType.RESOURCE_EXHAUSTION,
        { memoryCheck: system.memory }
      )
    }
  }

  private getMaxAlertsPerWindow(severity: AlertSeverity): number {
    switch (severity) {
      case AlertSeverity.CRITICAL: return 3
      case AlertSeverity.HIGH: return 5
      case AlertSeverity.MEDIUM: return 10
      case AlertSeverity.LOW: return 20
      default: return 10
    }
  }

  private generateEmailHTML(alert: Alert): string {
    return `
      <html>
        <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="background-color: ${this.getSeverityColor(alert.severity)}; color: white; padding: 20px;">
              <h1 style="margin: 0; font-size: 24px;">${alert.title}</h1>
              <p style="margin: 5px 0 0 0; opacity: 0.9;">Severity: ${alert.severity.toUpperCase()}</p>
            </div>
            <div style="padding: 20px;">
              <h2 style="color: #333; margin-top: 0;">Alert Details</h2>
              <p style="color: #666; line-height: 1.6;">${alert.message}</p>
              
              <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #333;">Alert Information</h3>
                <p><strong>Type:</strong> ${alert.type}</p>
                <p><strong>Time:</strong> ${alert.createdAt.toLocaleString()}</p>
                <p><strong>Alert ID:</strong> ${alert.id || 'N/A'}</p>
              </div>
              
              ${alert.metadata ? `
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px;">
                  <h3 style="margin-top: 0; color: #333;">Additional Details</h3>
                  <pre style="background-color: #e9ecef; padding: 10px; border-radius: 4px; overflow-x: auto; font-size: 12px;">${JSON.stringify(alert.metadata, null, 2)}</pre>
                </div>
              ` : ''}
              
              <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #666; font-size: 12px;">
                <p>This alert was generated by Hotdog Diaries monitoring system.</p>
                <p>Environment: ${process.env.NODE_ENV || 'development'}</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `
  }

  private getSeverityColor(severity: AlertSeverity): string {
    switch (severity) {
      case AlertSeverity.CRITICAL: return '#dc3545'
      case AlertSeverity.HIGH: return '#fd7e14'
      case AlertSeverity.MEDIUM: return '#ffc107'
      case AlertSeverity.LOW: return '#17a2b8'
      default: return '#6c757d'
    }
  }

  private async scheduleRetry(alert: Alert): Promise<void> {
    // Implement retry logic - could use a job queue in production
    const retryDelay = Math.min(1000 * Math.pow(2, alert.retryCount), 300000) // Max 5 minutes
    
    setTimeout(async () => {
      if (alert.retryCount < 3) {
        alert.retryCount++
        await this.sendAlert(alert)
      }
    }, retryDelay)
  }
}

// Export singleton instance
export const alertService = new AlertService()