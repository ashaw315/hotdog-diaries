import { db, logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'
import { postingService } from './posting'

export interface QueueAlert {
  id: number
  alert_type: 'low_queue' | 'empty_queue' | 'high_pending' | 'posting_failure'
  message: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  metadata: Record<string, any>
  acknowledged: boolean
  created_at: Date
  acknowledged_at?: Date
}

export class QueueMonitorService {
  private static readonly CHECK_INTERVAL = 5 * 60 * 1000 // 5 minutes
  private static readonly LOW_QUEUE_THRESHOLD = 5
  private static readonly CRITICAL_QUEUE_THRESHOLD = 2
  private static readonly HIGH_PENDING_THRESHOLD = 50

  async checkQueueHealth(): Promise<{
    healthy: boolean
    alerts: QueueAlert[]
    queueStatus: any
  }> {
    try {
      const queueStatus = await postingService.getQueueStatus()
      const alerts: QueueAlert[] = []

      // Check for empty queue
      if (queueStatus.totalApproved === 0) {
        const alert = await this.createAlert(
          'empty_queue',
          'No approved content available for posting',
          'critical',
          { queueStatus }
        )
        alerts.push(alert)
      }

      // Check for low queue
      else if (queueStatus.totalApproved <= QueueMonitorService.CRITICAL_QUEUE_THRESHOLD) {
        const alert = await this.createAlert(
          'low_queue',
          `Critical: Only ${queueStatus.totalApproved} approved items remaining`,
          'critical',
          { queueStatus }
        )
        alerts.push(alert)
      }

      // Check for low queue warning
      else if (queueStatus.totalApproved <= QueueMonitorService.LOW_QUEUE_THRESHOLD) {
        const alert = await this.createAlert(
          'low_queue',
          `Warning: Only ${queueStatus.totalApproved} approved items remaining`,
          'medium',
          { queueStatus }
        )
        alerts.push(alert)
      }

      // Check for high pending count
      if (queueStatus.totalPending > QueueMonitorService.HIGH_PENDING_THRESHOLD) {
        const alert = await this.createAlert(
          'high_pending',
          `High number of pending items: ${queueStatus.totalPending}`,
          'low',
          { queueStatus }
        )
        alerts.push(alert)
      }

      const healthy = queueStatus.isHealthy && alerts.length === 0

      await logToDatabase(
        LogLevel.INFO,
        'Queue health check completed',
        'QueueMonitor',
        { healthy, alertCount: alerts.length, queueStatus }
      )

      return {
        healthy,
        alerts,
        queueStatus
      }
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'Queue health check failed',
        'QueueMonitor',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      )
      
      return {
        healthy: false,
        alerts: [],
        queueStatus: null
      }
    }
  }

  async getActiveAlerts(): Promise<QueueAlert[]> {
    try {
      const result = await db.query<QueueAlert>(
        `SELECT * FROM queue_alerts 
         WHERE acknowledged = false 
         ORDER BY created_at DESC 
         LIMIT 50`
      )

      return result.rows
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'Failed to get active alerts',
        'QueueMonitor',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      )
      return []
    }
  }

  async acknowledgeAlert(alertId: number): Promise<void> {
    try {
      await db.query(
        `UPDATE queue_alerts 
         SET acknowledged = true, acknowledged_at = NOW() 
         WHERE id = $1`,
        [alertId]
      )

      await logToDatabase(
        LogLevel.INFO,
        'Alert acknowledged',
        'QueueMonitor',
        { alertId }
      )
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'Failed to acknowledge alert',
        'QueueMonitor',
        { alertId, error: error instanceof Error ? error.message : 'Unknown error' }
      )
      throw error
    }
  }

  async acknowledgeAllAlerts(): Promise<void> {
    try {
      const result = await db.query(
        `UPDATE queue_alerts 
         SET acknowledged = true, acknowledged_at = NOW() 
         WHERE acknowledged = false`
      )

      await logToDatabase(
        LogLevel.INFO,
        'All alerts acknowledged',
        'QueueMonitor',
        { acknowledgedCount: result.rowCount }
      )
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'Failed to acknowledge all alerts',
        'QueueMonitor',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      )
      throw error
    }
  }

  async getAlertHistory(limit: number = 100): Promise<QueueAlert[]> {
    try {
      const result = await db.query<QueueAlert>(
        `SELECT * FROM queue_alerts 
         ORDER BY created_at DESC 
         LIMIT $1`,
        [limit]
      )

      return result.rows
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'Failed to get alert history',
        'QueueMonitor',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      )
      return []
    }
  }

  async createPostingFailureAlert(contentId: number, error: string): Promise<QueueAlert> {
    return await this.createAlert(
      'posting_failure',
      `Failed to post content ID ${contentId}: ${error}`,
      'high',
      { contentId, error }
    )
  }

  private async createAlert(
    alertType: QueueAlert['alert_type'],
    message: string,
    severity: QueueAlert['severity'],
    metadata: Record<string, any>
  ): Promise<QueueAlert> {
    try {
      // Check if similar alert already exists within the last hour
      const existingAlert = await db.query(
        `SELECT id FROM queue_alerts 
         WHERE alert_type = $1 
         AND acknowledged = false 
         AND created_at > NOW() - INTERVAL '1 hour'
         LIMIT 1`,
        [alertType]
      )

      if (existingAlert.rows.length > 0) {
        // Update existing alert timestamp instead of creating duplicate
        await db.query(
          `UPDATE queue_alerts 
           SET created_at = NOW(), metadata = $1 
           WHERE id = $2`,
          [JSON.stringify(metadata), existingAlert.rows[0].id]
        )

        const result = await db.query<QueueAlert>(
          'SELECT * FROM queue_alerts WHERE id = $1',
          [existingAlert.rows[0].id]
        )

        return result.rows[0]
      }

      // Create new alert
      const result = await db.query<QueueAlert>(
        `INSERT INTO queue_alerts (alert_type, message, severity, metadata, acknowledged, created_at)
         VALUES ($1, $2, $3, $4, false, NOW())
         RETURNING *`,
        [alertType, message, severity, JSON.stringify(metadata)]
      )

      const alert = result.rows[0]

      await logToDatabase(
        LogLevel.WARN,
        'Queue alert created',
        'QueueMonitor',
        { alertType, severity, message }
      )

      return alert
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'Failed to create alert',
        'QueueMonitor',
        { alertType, error: error instanceof Error ? error.message : 'Unknown error' }
      )
      throw error
    }
  }
}

export const queueMonitorService = new QueueMonitorService()