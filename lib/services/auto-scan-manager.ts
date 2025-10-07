import { queueManager } from './queue-manager'
import { loggingService } from './logging'

export interface AutoScanResult {
  success: boolean
  triggeredScans: string[]
  skippedScans: string[]
  errors: string[]
  queueHealth: {
    totalApproved: number
    daysOfContent: number
    platformBalance: Record<string, number>
    isHealthy: boolean
    issues: string[]
  }
  recommendations: {
    platform: string
    priority: 'high' | 'medium' | 'low' | 'skip'
    reason: string
    contentType: string
  }[]
}

export interface GitHubWorkflowConfig {
  platform: string
  workflowFile: string
  apiEndpoint: string
  defaultMaxPosts: number
  quotaLimits?: {
    dailyLimit?: number
    hourlyLimit?: number
  }
}

export class AutoScanManager {
  private readonly GITHUB_API_BASE = 'https://api.github.com'
  private readonly REPO_OWNER = 'adampseudo' // Replace with actual GitHub username
  private readonly REPO_NAME = 'hotdog-diaries'
  
  // Workflow configuration mapping
  private readonly WORKFLOW_CONFIGS: GitHubWorkflowConfig[] = [
    {
      platform: 'reddit',
      workflowFile: 'scan-reddit.yml',
      apiEndpoint: '/api/admin/reddit/scan',
      defaultMaxPosts: 20
    },
    {
      platform: 'youtube',
      workflowFile: 'scan-youtube.yml', 
      apiEndpoint: '/api/admin/youtube/scan',
      defaultMaxPosts: 10,
      quotaLimits: { dailyLimit: 2 } // Quota limited
    },
    {
      platform: 'pixabay',
      workflowFile: 'scan-pixabay.yml',
      apiEndpoint: '/api/admin/pixabay/scan', 
      defaultMaxPosts: 15
    },
    {
      platform: 'giphy',
      workflowFile: 'scan-giphy.yml',
      apiEndpoint: '/api/admin/giphy/scan',
      defaultMaxPosts: 15
    },
    {
      platform: 'bluesky',
      workflowFile: 'scan-bluesky.yml',
      apiEndpoint: '/api/admin/bluesky/scan',
      defaultMaxPosts: 15
    },
    {
      platform: 'tumblr',
      workflowFile: 'scan-tumblr.yml',
      apiEndpoint: '/api/admin/tumblr/scan',
      defaultMaxPosts: 15
    },
    {
      platform: 'imgur',
      workflowFile: 'scan-imgur.yml',
      apiEndpoint: '/api/admin/imgur/scan',
      defaultMaxPosts: 15
    },
    {
      platform: 'lemmy',
      workflowFile: 'scan-lemmy.yml',
      apiEndpoint: '/api/admin/lemmy/scan',
      defaultMaxPosts: 15
    }
  ]

  /**
   * Main auto-scanning orchestration method
   */
  async performAutoScan(): Promise<AutoScanResult> {
    try {
      await loggingService.logInfo('AutoScanManager', 'Starting automated scan cycle')
      
      // 1. Get current queue health and scan recommendations
      const queueStats = await queueManager.getQueueStats()
      const recommendations = await queueManager.getScanRecommendations()
      const queueHealthCheck = await queueManager.isQueueHealthy()
      
      const queueHealth = {
        totalApproved: queueStats.totalApproved,
        daysOfContent: queueStats.daysOfContent,
        platformBalance: queueStats.platformPercentages,
        isHealthy: queueHealthCheck.healthy,
        issues: queueHealthCheck.issues
      }

      await loggingService.logInfo('AutoScanManager', 'Queue health analysis complete', {
        totalApproved: queueStats.totalApproved,
        daysOfContent: queueStats.daysOfContent.toFixed(1),
        isHealthy: queueHealthCheck.healthy,
        issueCount: queueHealthCheck.issues.length
      })

      // 2. Filter recommendations for high and medium priority platforms only
      const priorityScans = recommendations.filter(rec => 
        rec.priority === 'high' || rec.priority === 'medium'
      )

      // 3. Trigger scans for priority platforms
      const triggeredScans: string[] = []
      const skippedScans: string[] = []
      const errors: string[] = []

      for (const recommendation of priorityScans) {
        try {
          const config = this.getWorkflowConfig(recommendation.platform)
          if (!config) {
            skippedScans.push(`${recommendation.platform}: No workflow configuration found`)
            continue
          }

          // Check if we should trigger this scan based on priority and quota
          const shouldTrigger = await this.shouldTriggerScan(recommendation, config)
          if (!shouldTrigger.should) {
            skippedScans.push(`${recommendation.platform}: ${shouldTrigger.reason}`)
            continue
          }

          // Attempt to trigger the scan
          const triggerResult = await this.triggerPlatformScan(recommendation.platform, config)
          if (triggerResult.success) {
            triggeredScans.push(`${recommendation.platform}: ${triggerResult.method}`)
            await loggingService.logInfo('AutoScanManager', `Successfully triggered ${recommendation.platform} scan`, {
              platform: recommendation.platform,
              priority: recommendation.priority,
              method: triggerResult.method
            })
          } else {
            errors.push(`${recommendation.platform}: ${triggerResult.error}`)
          }

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          errors.push(`${recommendation.platform}: ${errorMessage}`)
          await loggingService.logError('AutoScanManager', `Failed to process ${recommendation.platform} scan`, {
            platform: recommendation.platform
          }, error as Error)
        }
      }

      // 4. Log results
      const result: AutoScanResult = {
        success: triggeredScans.length > 0 || priorityScans.length === 0,
        triggeredScans,
        skippedScans,
        errors,
        queueHealth,
        recommendations
      }

      await loggingService.logInfo('AutoScanManager', 'Auto-scan cycle completed', {
        triggeredCount: triggeredScans.length,
        skippedCount: skippedScans.length,
        errorCount: errors.length,
        success: result.success
      })

      return result

    } catch (error) {
      await loggingService.logError('AutoScanManager', 'Auto-scan cycle failed', {}, error as Error)
      throw error
    }
  }

  /**
   * Get workflow configuration for a platform
   */
  private getWorkflowConfig(platform: string): GitHubWorkflowConfig | null {
    return this.WORKFLOW_CONFIGS.find(config => config.platform === platform) || null
  }

  /**
   * Determine if we should trigger a scan for this platform
   */
  private async shouldTriggerScan(
    recommendation: { platform: string; priority: string; reason: string },
    config: GitHubWorkflowConfig
  ): Promise<{ should: boolean; reason: string }> {
    // Always trigger high priority scans
    if (recommendation.priority === 'high') {
      return { should: true, reason: `High priority: ${recommendation.reason}` }
    }

    // For medium priority, check quota limits
    if (recommendation.priority === 'medium') {
      if (config.quotaLimits?.dailyLimit) {
        // For quota-limited platforms like YouTube, be more conservative
        const currentHour = new Date().getUTCHours()
        if (currentHour % 12 !== 0) { // Only scan every 12 hours for quota-limited platforms
          return { should: false, reason: 'Quota-limited platform - waiting for next 12-hour window' }
        }
      }
      return { should: true, reason: `Medium priority: ${recommendation.reason}` }
    }

    return { should: false, reason: 'Priority too low for auto-triggering' }
  }

  /**
   * Trigger a platform scan via GitHub Actions workflow or direct API call
   */
  private async triggerPlatformScan(
    platform: string, 
    config: GitHubWorkflowConfig
  ): Promise<{ success: boolean; method: string; error?: string }> {
    // Try GitHub Actions workflow first, fallback to direct API call
    
    // Method 1: GitHub Actions workflow_dispatch (preferred for automation)
    if (process.env.GITHUB_TOKEN) {
      try {
        const workflowResult = await this.triggerGitHubWorkflow(config.workflowFile, {
          platform,
          triggeredBy: 'auto-scan-manager'
        })
        
        if (workflowResult.success) {
          return { success: true, method: 'GitHub Actions workflow' }
        }
      } catch (workflowError) {
        await loggingService.logWarning('AutoScanManager', `GitHub workflow trigger failed for ${platform}, trying direct API`, {
          platform,
          error: workflowError instanceof Error ? workflowError.message : 'Unknown'
        })
      }
    }

    // Method 2: Direct API call fallback
    try {
      const apiResult = await this.triggerDirectScan(platform, config)
      if (apiResult.success) {
        return { success: true, method: 'Direct API call' }
      } else {
        return { success: false, error: apiResult.error || 'Direct API call failed' }
      }
    } catch (apiError) {
      return { 
        success: false, 
        error: apiError instanceof Error ? apiError.message : 'Both GitHub workflow and direct API failed' 
      }
    }
  }

  /**
   * Trigger GitHub Actions workflow via workflow_dispatch
   */
  private async triggerGitHubWorkflow(
    workflowFile: string,
    inputs: Record<string, string> = {}
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(
        `${this.GITHUB_API_BASE}/repos/${this.REPO_OWNER}/${this.REPO_NAME}/actions/workflows/${workflowFile}/dispatches`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ref: 'main', // Or your default branch
            inputs
          })
        }
      )

      if (response.ok) {
        return { success: true }
      } else {
        const errorText = await response.text()
        return { success: false, error: `GitHub API error: ${response.status} ${errorText}` }
      }

    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'GitHub workflow trigger failed' 
      }
    }
  }

  /**
   * Trigger scan via direct API call (fallback method)
   */
  private async triggerDirectScan(
    platform: string,
    config: GitHubWorkflowConfig
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const siteUrl = process.env.SITE_URL || process.env.VERCEL_URL
      if (!siteUrl) {
        return { success: false, error: 'No SITE_URL or VERCEL_URL configured' }
      }

      const authToken = process.env.AUTH_TOKEN
      if (!authToken) {
        return { success: false, error: 'No AUTH_TOKEN configured' }
      }

      const response = await fetch(`${siteUrl}${config.apiEndpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          maxPosts: config.defaultMaxPosts,
          triggeredBy: 'auto-scan-manager'
        })
      })

      if (response.ok) {
        const result = await response.json()
        await loggingService.logInfo('AutoScanManager', `Direct API scan completed for ${platform}`, {
          platform,
          totalFound: result.totalFound || 0,
          processed: result.processed || 0
        })
        return { success: true }
      } else {
        const errorText = await response.text()
        return { success: false, error: `API error: ${response.status} ${errorText}` }
      }

    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Direct API call failed' 
      }
    }
  }

  /**
   * Get scan status and recommendations without triggering scans
   */
  async getScanStatus(): Promise<{
    queueHealth: AutoScanResult['queueHealth']
    recommendations: AutoScanResult['recommendations']
    nextScanTime: string
  }> {
    const queueStats = await queueManager.getQueueStats()
    const recommendations = await queueManager.getScanRecommendations()
    const queueHealthCheck = await queueManager.isQueueHealthy()

    const queueHealth = {
      totalApproved: queueStats.totalApproved,
      daysOfContent: queueStats.daysOfContent,
      platformBalance: queueStats.platformPercentages,
      isHealthy: queueHealthCheck.healthy,
      issues: queueHealthCheck.issues
    }

    // Calculate next scan time (runs every 6 hours)
    const now = new Date()
    const nextScanHour = Math.ceil(now.getUTCHours() / 6) * 6
    const nextScan = new Date(now)
    nextScan.setUTCHours(nextScanHour, 0, 0, 0)
    if (nextScan <= now) {
      nextScan.setUTCDate(nextScan.getUTCDate() + 1)
      nextScan.setUTCHours(0, 0, 0, 0)
    }

    return {
      queueHealth,
      recommendations,
      nextScanTime: nextScan.toISOString()
    }
  }

  /**
   * Emergency queue replenishment - triggers all available platforms
   */
  async emergencyReplenishment(): Promise<AutoScanResult> {
    try {
      await loggingService.logWarning('AutoScanManager', 'Emergency queue replenishment triggered')

      const triggeredScans: string[] = []
      const errors: string[] = []

      // Trigger all platforms except quota-limited ones
      for (const config of this.WORKFLOW_CONFIGS) {
        try {
          // Skip quota-limited platforms in emergency mode to avoid hitting limits
          if (config.quotaLimits?.dailyLimit && config.platform === 'youtube') {
            continue
          }

          const result = await this.triggerPlatformScan(config.platform, config)
          if (result.success) {
            triggeredScans.push(`${config.platform}: ${result.method}`)
          } else {
            errors.push(`${config.platform}: ${result.error}`)
          }

          // Small delay between triggers to avoid overwhelming APIs
          await new Promise(resolve => setTimeout(resolve, 1000))

        } catch (error) {
          errors.push(`${config.platform}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }

      // Get final queue state
      const queueStats = await queueManager.getQueueStats()
      const queueHealthCheck = await queueManager.isQueueHealthy()

      const result: AutoScanResult = {
        success: triggeredScans.length > 0,
        triggeredScans,
        skippedScans: [],
        errors,
        queueHealth: {
          totalApproved: queueStats.totalApproved,
          daysOfContent: queueStats.daysOfContent,
          platformBalance: queueStats.platformPercentages,
          isHealthy: queueHealthCheck.healthy,
          issues: queueHealthCheck.issues
        },
        recommendations: [] // Not applicable for emergency mode
      }

      await loggingService.logWarning('AutoScanManager', 'Emergency replenishment completed', {
        triggeredCount: triggeredScans.length,
        errorCount: errors.length
      })

      return result

    } catch (error) {
      await loggingService.logError('AutoScanManager', 'Emergency replenishment failed', {}, error as Error)
      throw error
    }
  }
}

export const autoScanManager = new AutoScanManager()