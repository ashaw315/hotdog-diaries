import { redditScanningService } from './reddit-scanning'
import { youtubeScanningService } from './youtube-scanning'
import { blueskyService } from './bluesky-scanning'
import { giphyScanningService } from './giphy-scanning'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export interface PlatformStatus {
  platform: string
  isEnabled: boolean
  isAuthenticated: boolean
  lastScanTime?: Date
  nextScanTime?: Date
  totalContent: number
  errorRate: number
  healthStatus: 'healthy' | 'warning' | 'error'
}

export interface SocialMediaStats {
  totalPlatforms: number
  activePlatforms: number
  totalContentScanned: number
  totalContentApproved: number
  overallHealthScore: number
  platformStats: PlatformStatus[]
}

export class SocialMediaService {
  private scanningServices = {
    reddit: redditScanningService,
    youtube: youtubeScanningService,
    bluesky: blueskyService,
    giphy: giphyScanningService
  }

  async getAllPlatformStatus(): Promise<SocialMediaStats> {
    try {
      const platformStats: PlatformStatus[] = []
      let activePlatforms = 0

      // Get Reddit status
      try {
        const redditConfig = await this.scanningServices.reddit.getScanConfig()
        const redditConnection = await this.scanningServices.reddit.testConnection()
        
        platformStats.push({
          platform: 'reddit',
          isEnabled: redditConfig.isEnabled,
          isAuthenticated: redditConnection.success,
          lastScanTime: redditConfig.lastScanTime,
          totalContent: 0,
          errorRate: 0,
          healthStatus: redditConnection.success ? 'healthy' : 'error'
        })

        if (redditConfig.isEnabled) activePlatforms++
      } catch (error) {
        platformStats.push({
          platform: 'reddit',
          isEnabled: false,
          isAuthenticated: false,
          totalContent: 0,
          errorRate: 1,
          healthStatus: 'error'
        })
      }

      // Get YouTube status
      try {
        const youtubeConfig = await this.scanningServices.youtube.getScanConfig()
        const youtubeConnection = await this.scanningServices.youtube.testConnection()
        
        platformStats.push({
          platform: 'youtube',
          isEnabled: youtubeConfig.isEnabled,
          isAuthenticated: youtubeConnection.success,
          lastScanTime: youtubeConfig.lastScanTime,
          totalContent: 0,
          errorRate: 0,
          healthStatus: youtubeConnection.success ? 'healthy' : 'warning'
        })

        if (youtubeConfig.isEnabled) activePlatforms++
      } catch (error) {
        platformStats.push({
          platform: 'youtube',
          isEnabled: false,
          isAuthenticated: false,
          totalContent: 0,
          errorRate: 1,
          healthStatus: 'error'
        })
      }



      // Get Bluesky status
      try {
        const blueskyConfig = await this.scanningServices.bluesky.getScanConfig()
        const blueskyConnection = await this.scanningServices.bluesky.testConnection()
        const blueskyStats = await this.scanningServices.bluesky.getScanningStats()
        
        platformStats.push({
          platform: 'bluesky',
          isEnabled: blueskyConfig.isEnabled,
          isAuthenticated: blueskyConnection.success,
          lastScanTime: blueskyConfig.lastScanTime,
          totalContent: blueskyStats.totalPostsFound,
          errorRate: 1 - blueskyStats.successRate,
          healthStatus: blueskyConnection.success ? 'healthy' : 'error'
        })

        if (blueskyConfig.isEnabled) activePlatforms++
      } catch (error) {
        platformStats.push({
          platform: 'bluesky',
          isEnabled: false,
          isAuthenticated: false,
          totalContent: 0,
          errorRate: 1,
          healthStatus: 'error'
        })
      }

      // Get Giphy status
      try {
        const giphyConfig = await this.scanningServices.giphy.getScanConfig()
        const giphyConnection = await this.scanningServices.giphy.testConnection()
        
        platformStats.push({
          platform: 'giphy',
          isEnabled: giphyConfig.isEnabled,
          isAuthenticated: giphyConnection.success,
          lastScanTime: giphyConfig.lastScanTime,
          totalContent: 0,
          errorRate: 0,
          healthStatus: giphyConnection.success ? 'healthy' : 'warning'
        })

        if (giphyConfig.isEnabled) activePlatforms++
      } catch (error) {
        platformStats.push({
          platform: 'giphy',
          isEnabled: false,
          isAuthenticated: false,
          totalContent: 0,
          errorRate: 1,
          healthStatus: 'error'
        })
      }

      const healthyPlatforms = platformStats.filter(p => p.healthStatus === 'healthy').length
      const overallHealthScore = platformStats.length > 0 ? (healthyPlatforms / platformStats.length) * 100 : 0

      return {
        totalPlatforms: platformStats.length,
        activePlatforms,
        totalContentScanned: platformStats.reduce((sum, p) => sum + p.totalContent, 0),
        totalContentApproved: 0,
        overallHealthScore,
        platformStats
      }

    } catch (error) {
      throw new Error(`Failed to get platform status: ${error.message}`)
    }
  }

  async startAllScanning(): Promise<{ success: boolean; message: string; results: any[] }> {
    const results = []

    try {
      // Start Reddit scanning
      try {
        await this.scanningServices.reddit.startAutomatedScanning()
        results.push({ platform: 'reddit', success: true, message: 'Started successfully' })
      } catch (error) {
        results.push({ platform: 'reddit', success: false, message: error.message })
      }

      // Start YouTube scanning
      try {
        await this.scanningServices.youtube.startAutomatedScanning()
        results.push({ platform: 'youtube', success: true, message: 'Started successfully' })
      } catch (error) {
        results.push({ platform: 'youtube', success: false, message: error.message })
      }



      // Start Bluesky scanning
      try {
        await this.scanningServices.bluesky.startAutomatedScanning()
        results.push({ platform: 'bluesky', success: true, message: 'Started successfully' })
      } catch (error) {
        results.push({ platform: 'bluesky', success: false, message: error.message })
      }

      const successCount = results.filter(r => r.success).length

      return {
        success: successCount > 0,
        message: `Started ${successCount}/${results.length} scanning services`,
        results
      }

    } catch (error) {
      return {
        success: false,
        message: `Failed to start scanning services: ${error.message}`,
        results
      }
    }
  }
}

export const socialMediaService = new SocialMediaService()