import { mastodonService, MastodonInstance } from './mastodon'
import { mastodonScanningService } from './mastodon-scanning'

export interface MastodonInstanceHealth {
  domain: string
  name: string
  isOnline: boolean
  responseTime: number
  lastChecked: Date
  errorCount: number
  successCount: number
  uptime: number
  instanceInfo?: {
    version: string
    userCount: number
    statusCount: number
    description: string
  }
}

export interface MastodonSystemHealth {
  overallStatus: 'healthy' | 'warning' | 'error'
  healthScore: number
  instances: MastodonInstanceHealth[]
  scanningService: {
    isRunning: boolean
    lastScanTime?: Date
    totalScans: number
    successRate: number
  }
  alerts: Array<{
    level: 'info' | 'warning' | 'error'
    message: string
    timestamp: Date
    instance?: string
  }>
}

export class MastodonMonitoringService {
  private healthCheckInterval?: NodeJS.Timer
  private instanceHealthCache = new Map<string, MastodonInstanceHealth>()
  private alerts: Array<{
    level: 'info' | 'warning' | 'error'
    message: string
    timestamp: Date
    instance?: string
  }> = []

  async startHealthMonitoring(): Promise<void> {
    console.log('Starting Mastodon health monitoring...')
    
    // Run initial health check
    await this.performHealthCheck()

    // Schedule recurring health checks every 5 minutes
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck()
    }, 5 * 60 * 1000)
  }

  async stopHealthMonitoring(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = undefined
      console.log('Stopped Mastodon health monitoring')
    }
  }

  async performHealthCheck(): Promise<MastodonSystemHealth> {
    const config = await mastodonService.getConfig()
    const instanceHealthResults: MastodonInstanceHealth[] = []

    // Check each instance
    for (const instance of config.instances) {
      const health = await this.checkInstanceHealth(instance)
      instanceHealthResults.push(health)
      this.instanceHealthCache.set(instance.domain, health)
    }

    // Get scanning service status
    const scanningStats = await mastodonScanningService.getScanningStats()
    
    const scanningService = {
      isRunning: mastodonScanningService.isCurrentlyScanning(),
      lastScanTime: scanningStats.lastScanTime,
      totalScans: scanningStats.totalScans,
      successRate: scanningStats.successRate
    }

    // Calculate overall health
    const healthScore = this.calculateHealthScore(instanceHealthResults, scanningService)
    const overallStatus = this.determineOverallStatus(healthScore)

    // Generate alerts
    this.updateAlerts(instanceHealthResults, scanningService)

    const systemHealth: MastodonSystemHealth = {
      overallStatus,
      healthScore,
      instances: instanceHealthResults,
      scanningService,
      alerts: this.alerts.slice(-10) // Keep last 10 alerts
    }

    return systemHealth
  }

  private async checkInstanceHealth(instance: MastodonInstance): Promise<MastodonInstanceHealth> {
    const startTime = Date.now()
    const health: MastodonInstanceHealth = {
      domain: instance.domain,
      name: instance.name,
      isOnline: false,
      responseTime: 0,
      lastChecked: new Date(),
      errorCount: instance.errorCount,
      successCount: instance.successCount,
      uptime: 0
    }

    try {
      // Test basic connectivity
      const response = await fetch(`https://${instance.domain}/api/v1/instance`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'HotdogDiaries/1.0'
        },
        signal: AbortSignal.timeout(10000) // 10 second timeout
      })

      health.responseTime = Date.now() - startTime
      health.isOnline = response.ok

      if (response.ok) {
        const instanceInfo = await response.json()
        health.instanceInfo = {
          version: instanceInfo.version || 'unknown',
          userCount: instanceInfo.stats?.user_count || 0,
          statusCount: instanceInfo.stats?.status_count || 0,
          description: instanceInfo.description || ''
        }
      }

    } catch (error) {
      health.responseTime = Date.now() - startTime
      health.isOnline = false
      console.error(`Health check failed for ${instance.domain}:`, error)
    }

    // Calculate uptime percentage
    const totalChecks = health.errorCount + health.successCount
    health.uptime = totalChecks > 0 ? health.successCount / totalChecks : 0

    return health
  }

  private calculateHealthScore(
    instances: MastodonInstanceHealth[], 
    scanningService: any
  ): number {
    let score = 0
    const weights = {
      instanceHealth: 0.6,
      scanningService: 0.4
    }

    // Instance health score (60%)
    if (instances.length > 0) {
      const onlineInstances = instances.filter(i => i.isOnline).length
      const avgResponseTime = instances.reduce((sum, i) => sum + i.responseTime, 0) / instances.length
      const avgUptime = instances.reduce((sum, i) => sum + i.uptime, 0) / instances.length

      const onlineScore = (onlineInstances / instances.length) * 100
      const responseScore = Math.max(0, 100 - (avgResponseTime / 100)) // Penalty for slow responses
      const uptimeScore = avgUptime * 100

      score += weights.instanceHealth * (onlineScore * 0.4 + responseScore * 0.3 + uptimeScore * 0.3)
    }

    // Scanning service score (40%)
    if (scanningService.totalScans > 0) {
      const scanningHealthScore = scanningService.successRate * 100
      score += weights.scanningService * scanningHealthScore
    } else {
      // If no scans yet, give neutral score
      score += weights.scanningService * 50
    }

    return Math.round(score)
  }

  private determineOverallStatus(healthScore: number): 'healthy' | 'warning' | 'error' {
    if (healthScore >= 80) return 'healthy'
    if (healthScore >= 60) return 'warning'
    return 'error'
  }

  private updateAlerts(
    instances: MastodonInstanceHealth[], 
    scanningService: any
  ): void {
    const now = new Date()

    // Check for offline instances
    for (const instance of instances) {
      if (!instance.isOnline) {
        this.addAlert('error', `Instance ${instance.domain} is offline`, now, instance.domain)
      } else if (instance.responseTime > 5000) {
        this.addAlert('warning', `Instance ${instance.domain} is responding slowly (${instance.responseTime}ms)`, now, instance.domain)
      }
    }

    // Check scanning service
    if (scanningService.totalScans > 0 && scanningService.successRate < 0.5) {
      this.addAlert('error', `Scanning success rate is low (${Math.round(scanningService.successRate * 100)}%)`, now)
    }

    // Check if scanning is stalled
    if (scanningService.lastScanTime) {
      const timeSinceLastScan = now.getTime() - scanningService.lastScanTime.getTime()
      const twoHoursInMs = 2 * 60 * 60 * 1000
      
      if (timeSinceLastScan > twoHoursInMs) {
        this.addAlert('warning', 'No scans performed in the last 2 hours', now)
      }
    }

    // Keep only recent alerts (last 24 hours)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    this.alerts = this.alerts.filter(alert => alert.timestamp > oneDayAgo)
  }

  private addAlert(
    level: 'info' | 'warning' | 'error',
    message: string,
    timestamp: Date,
    instance?: string
  ): void {
    // Avoid duplicate alerts
    const recentAlert = this.alerts.find(alert => 
      alert.message === message && 
      alert.instance === instance &&
      timestamp.getTime() - alert.timestamp.getTime() < 30 * 60 * 1000 // 30 minutes
    )

    if (!recentAlert) {
      this.alerts.push({ level, message, timestamp, instance })
    }
  }

  async getSystemHealth(): Promise<MastodonSystemHealth> {
    return await this.performHealthCheck()
  }

  async getInstanceHealth(domain: string): Promise<MastodonInstanceHealth | null> {
    return this.instanceHealthCache.get(domain) || null
  }

  async testInstanceConnection(domain: string): Promise<{
    isOnline: boolean
    responseTime: number
    error?: string
    instanceInfo?: any
  }> {
    const startTime = Date.now()
    
    try {
      const response = await fetch(`https://${domain}/api/v1/instance`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'HotdogDiaries/1.0'
        },
        signal: AbortSignal.timeout(10000)
      })

      const responseTime = Date.now() - startTime
      
      if (response.ok) {
        const instanceInfo = await response.json()
        return {
          isOnline: true,
          responseTime,
          instanceInfo
        }
      } else {
        return {
          isOnline: false,
          responseTime,
          error: `HTTP ${response.status}: ${response.statusText}`
        }
      }
    } catch (error) {
      return {
        isOnline: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async getHealthSummary(): Promise<{
    totalInstances: number
    onlineInstances: number
    averageResponseTime: number
    overallUptime: number
    recentAlertCount: number
    scanningStatus: 'active' | 'inactive' | 'error'
  }> {
    const health = await this.getSystemHealth()
    
    const onlineInstances = health.instances.filter(i => i.isOnline).length
    const avgResponseTime = health.instances.length > 0 
      ? health.instances.reduce((sum, i) => sum + i.responseTime, 0) / health.instances.length
      : 0
    const avgUptime = health.instances.length > 0
      ? health.instances.reduce((sum, i) => sum + i.uptime, 0) / health.instances.length
      : 0

    const recentAlerts = health.alerts.filter(alert => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
      return alert.timestamp > oneHourAgo
    })

    let scanningStatus: 'active' | 'inactive' | 'error' = 'inactive'
    if (health.scanningService.isRunning) {
      scanningStatus = 'active'
    } else if (health.scanningService.totalScans > 0 && health.scanningService.successRate < 0.5) {
      scanningStatus = 'error'
    }

    return {
      totalInstances: health.instances.length,
      onlineInstances,
      averageResponseTime: Math.round(avgResponseTime),
      overallUptime: Math.round(avgUptime * 100),
      recentAlertCount: recentAlerts.length,
      scanningStatus
    }
  }
}

export const mastodonMonitoringService = new MastodonMonitoringService()