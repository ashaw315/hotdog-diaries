import { redditScanningService } from './reddit-scanning'
import { youtubeScanningService } from './youtube-scanning'
import { flickrScanningService } from './flickr-scanning'
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
    flickr: flickrScanningService
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

      // Get Flickr status
      try {
        const flickrConfig = await this.scanningServices.flickr.getScanConfig()
        const flickrConnection = await this.scanningServices.flickr.testConnection()
        
        platformStats.push({
          platform: 'flickr',
          isEnabled: flickrConfig.isEnabled,
          isAuthenticated: flickrConnection.success,
          lastScanTime: flickrConfig.lastScanTime,
          totalContent: 0,
          errorRate: 0,
          healthStatus: flickrConnection.success ? 'healthy' : 'warning'
        })

        if (flickrConfig.isEnabled) activePlatforms++
      } catch (error) {
        platformStats.push({
          platform: 'flickr',
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
        totalContentScanned: 0,
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

      // Start Flickr scanning
      try {
        await this.scanningServices.flickr.startAutomatedScanning()
        results.push({ platform: 'flickr', success: true, message: 'Started successfully' })
      } catch (error) {
        results.push({ platform: 'flickr', success: false, message: error.message })
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