import { loggingService } from './logging'
import { queueManager } from './queue-manager'
import { db } from '@/lib/db'

export interface APILimit {
  platform: string
  limitType: 'hourly' | 'daily' | 'monthly'
  limit: number
  currentUsage: number
  resetTime: Date
  costPerCall?: number
  remainingCalls: number
  usagePercentage: number
}

export interface APIUsageMetric {
  platform: string
  endpoint: string
  timestamp: Date
  responseTime: number
  success: boolean
  costEstimate: number
}

export class APICostTracker {
  private readonly API_LIMITS = {
    youtube: {
      limitType: 'daily' as const,
      limit: 10000, // YouTube API daily quota
      costPerCall: 0.001, // Estimated cost per call
      resetHours: 24
    },
    reddit: {
      limitType: 'hourly' as const,
      limit: 60, // Reddit API rate limit
      costPerCall: 0, // Free
      resetHours: 1
    },
    pixabay: {
      limitType: 'monthly' as const,
      limit: 20000, // Pixabay free tier
      costPerCall: 0, // Free tier
      resetHours: 24 * 30
    },
    giphy: {
      limitType: 'hourly' as const,
      limit: 1000, // Giphy rate limit
      costPerCall: 0, // Free
      resetHours: 1
    },
    bluesky: {
      limitType: 'hourly' as const,
      limit: 100, // Conservative estimate
      costPerCall: 0, // Free
      resetHours: 1
    },
    tumblr: {
      limitType: 'hourly' as const,
      limit: 1000, // Tumblr rate limit
      costPerCall: 0, // Free
      resetHours: 1
    },
    imgur: {
      limitType: 'hourly' as const,
      limit: 1250, // Imgur rate limit
      costPerCall: 0, // Free
      resetHours: 1
    },
    lemmy: {
      limitType: 'hourly' as const,
      limit: 100, // Conservative estimate
      costPerCall: 0, // Free
      resetHours: 1
    }
  }

  /**
   * Check if we should make an API call based on limits and queue status
   */
  async shouldMakeAPICall(platform: string, estimatedCalls: number = 1): Promise<{
    allowed: boolean
    reason: string
    usageInfo: APILimit
  }> {
    try {
      const usage = await this.getAPIUsage(platform)
      const queueStats = await queueManager.getQueueStats()

      // Check basic API limits
      if (usage.remainingCalls < estimatedCalls) {
        return {
          allowed: false,
          reason: `API limit exceeded. ${usage.remainingCalls} calls remaining, need ${estimatedCalls}`,
          usageInfo: usage
        }
      }

      // Smart conservation based on queue status
      const conservationFactor = this.calculateConservationFactor(queueStats)
      const conservativeLimit = usage.limit * conservationFactor

      if (usage.currentUsage + estimatedCalls > conservativeLimit) {
        return {
          allowed: false,
          reason: `Conservation mode: Queue has ${queueStats.daysOfContent.toFixed(1)} days of content. Using ${(conservationFactor * 100).toFixed(0)}% of API quota.`,
          usageInfo: usage
        }
      }

      return {
        allowed: true,
        reason: `API call allowed. ${usage.remainingCalls - estimatedCalls} calls will remain.`,
        usageInfo: usage
      }

    } catch (error) {
      await loggingService.logError('APICostTracker', `Failed to check API call allowance for ${platform}`, { platform, estimatedCalls }, error as Error)
      
      // Default to allowing calls if we can't check limits
      return {
        allowed: true,
        reason: 'Unable to check limits, defaulting to allow',
        usageInfo: await this.getAPIUsage(platform)
      }
    }
  }

  /**
   * Calculate conservation factor based on queue status
   */
  private calculateConservationFactor(queueStats: any): number {
    const daysOfContent = queueStats.daysOfContent

    // If we have more than 2 weeks of content, be very conservative
    if (daysOfContent > 14) {
      return 0.1 // Use only 10% of quota
    }
    
    // If we have more than 1 week, be moderately conservative
    if (daysOfContent > 7) {
      return 0.5 // Use only 50% of quota
    }
    
    // If we have less than 1 week, use most of quota
    if (daysOfContent > 3) {
      return 0.8 // Use 80% of quota
    }
    
    // If we're critically low, use full quota
    return 0.95 // Use 95% of quota
  }

  /**
   * Get current API usage for a platform
   */
  async getAPIUsage(platform: string): Promise<APILimit> {
    try {
      const config = this.API_LIMITS[platform]
      if (!config) {
        throw new Error(`No API configuration found for platform: ${platform}`)
      }

      // Calculate reset time
      const now = new Date()
      const resetTime = new Date(now)
      
      if (config.limitType === 'hourly') {
        resetTime.setHours(now.getHours() + 1, 0, 0, 0)
      } else if (config.limitType === 'daily') {
        resetTime.setDate(now.getDate() + 1)
        resetTime.setHours(0, 0, 0, 0)
      } else if (config.limitType === 'monthly') {
        resetTime.setMonth(now.getMonth() + 1, 1)
        resetTime.setHours(0, 0, 0, 0)
      }

      // Get usage from database
      const currentUsage = await this.getCurrentUsage(platform, config.limitType)
      const remainingCalls = Math.max(0, config.limit - currentUsage)
      const usagePercentage = config.limit > 0 ? (currentUsage / config.limit) * 100 : 0

      return {
        platform,
        limitType: config.limitType,
        limit: config.limit,
        currentUsage,
        resetTime,
        costPerCall: config.costPerCall,
        remainingCalls,
        usagePercentage
      }

    } catch (error) {
      await loggingService.logError('APICostTracker', `Failed to get API usage for ${platform}`, { platform }, error as Error)
      
      // Return safe defaults
      return {
        platform,
        limitType: 'daily',
        limit: 1000,
        currentUsage: 0,
        resetTime: new Date(),
        costPerCall: 0,
        remainingCalls: 1000,
        usagePercentage: 0
      }
    }
  }

  /**
   * Record an API call
   */
  async recordAPICall(metric: APIUsageMetric): Promise<void> {
    try {
      // Record in metrics table
      await db.query(`
        INSERT INTO api_usage_metrics (
          platform, 
          endpoint, 
          timestamp, 
          response_time, 
          success, 
          cost_estimate
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        metric.platform,
        metric.endpoint,
        metric.timestamp,
        metric.responseTime,
        metric.success,
        metric.costEstimate
      ])

      await loggingService.logInfo('APICostTracker', `API call recorded for ${metric.platform}`, {
        platform: metric.platform,
        endpoint: metric.endpoint,
        success: metric.success,
        responseTime: metric.responseTime,
        costEstimate: metric.costEstimate
      })

    } catch (error) {
      // Create table if it doesn't exist
      if (error.message?.includes('no such table') || error.message?.includes('does not exist')) {
        await this.createAPIUsageTable()
        // Retry the insert
        await this.recordAPICall(metric)
      } else {
        await loggingService.logError('APICostTracker', `Failed to record API call for ${metric.platform}`, metric, error as Error)
      }
    }
  }

  /**
   * Get current usage count for a platform and time period
   */
  private async getCurrentUsage(platform: string, limitType: 'hourly' | 'daily' | 'monthly'): Promise<number> {
    try {
      let whereClause = 'WHERE platform = $1 AND success = true'
      let timeParam: Date | undefined

      const now = new Date()
      
      if (limitType === 'hourly') {
        timeParam = new Date(now.getTime() - 60 * 60 * 1000) // 1 hour ago
        whereClause += ' AND timestamp >= $2'
      } else if (limitType === 'daily') {
        timeParam = new Date(now)
        timeParam.setHours(0, 0, 0, 0) // Start of today
        whereClause += ' AND timestamp >= $2'
      } else if (limitType === 'monthly') {
        timeParam = new Date(now)
        timeParam.setDate(1)
        timeParam.setHours(0, 0, 0, 0) // Start of month
        whereClause += ' AND timestamp >= $2'
      }

      const queryParams: (string | Date)[] = [platform]
      if (timeParam) {
        queryParams.push(timeParam)
      }

      const result = await db.query(`
        SELECT COUNT(*) as usage_count
        FROM api_usage_metrics
        ${whereClause}
      `, queryParams)

      return parseInt(result.rows[0]?.usage_count || '0')

    } catch (error) {
      await loggingService.logError('APICostTracker', `Failed to get current usage for ${platform}`, { platform, limitType }, error as Error)
      return 0
    }
  }

  /**
   * Get API usage summary for all platforms
   */
  async getAllAPIUsage(): Promise<APILimit[]> {
    const platforms = Object.keys(this.API_LIMITS)
    const usagePromises = platforms.map(platform => this.getAPIUsage(platform))
    
    try {
      return await Promise.all(usagePromises)
    } catch (error) {
      await loggingService.logError('APICostTracker', 'Failed to get all API usage', {}, error as Error)
      return []
    }
  }

  /**
   * Get estimated monthly cost
   */
  async getEstimatedMonthlyCost(): Promise<{
    totalCost: number
    platformCosts: Record<string, number>
    callCounts: Record<string, number>
  }> {
    try {
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      const result = await db.query(`
        SELECT 
          platform,
          COUNT(*) as call_count,
          SUM(cost_estimate) as total_cost
        FROM api_usage_metrics
        WHERE timestamp >= $1 AND success = true
        GROUP BY platform
      `, [startOfMonth])

      const platformCosts: Record<string, number> = {}
      const callCounts: Record<string, number> = {}
      let totalCost = 0

      for (const row of result.rows) {
        const cost = parseFloat(row.total_cost || '0')
        const count = parseInt(row.call_count || '0')
        
        platformCosts[row.platform] = cost
        callCounts[row.platform] = count
        totalCost += cost
      }

      return {
        totalCost,
        platformCosts,
        callCounts
      }

    } catch (error) {
      await loggingService.logError('APICostTracker', 'Failed to get estimated monthly cost', {}, error as Error)
      return {
        totalCost: 0,
        platformCosts: {},
        callCounts: {}
      }
    }
  }

  /**
   * Create API usage metrics table
   */
  private async createAPIUsageTable(): Promise<void> {
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS api_usage_metrics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          platform TEXT NOT NULL,
          endpoint TEXT NOT NULL,
          timestamp DATETIME NOT NULL,
          response_time INTEGER,
          success BOOLEAN NOT NULL,
          cost_estimate REAL DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)

      // Create indexes for performance
      await db.query(`CREATE INDEX IF NOT EXISTS idx_api_usage_platform_timestamp ON api_usage_metrics(platform, timestamp DESC)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_api_usage_timestamp ON api_usage_metrics(timestamp DESC)`)

      await loggingService.logInfo('APICostTracker', 'API usage metrics table created successfully')

    } catch (error) {
      await loggingService.logError('APICostTracker', 'Failed to create API usage table', {}, error as Error)
      throw error
    }
  }

  /**
   * Clean up old API usage records
   */
  async cleanupOldRecords(retentionDays: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

      const result = await db.query(`
        DELETE FROM api_usage_metrics 
        WHERE timestamp < $1
      `, [cutoffDate])

      await loggingService.logInfo('APICostTracker', `Cleaned up ${result.rowCount || 0} old API usage records`, {
        retentionDays,
        cutoffDate: cutoffDate.toISOString()
      })

      return result.rowCount || 0

    } catch (error) {
      await loggingService.logError('APICostTracker', 'Failed to cleanup old API usage records', { retentionDays }, error as Error)
      return 0
    }
  }
}

export const apiCostTracker = new APICostTracker()