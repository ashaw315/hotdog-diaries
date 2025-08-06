import { SocialMediaService, PlatformStatus, SocialMediaStats } from '@/lib/services/social-media'

// Mock dependencies
jest.mock('@/lib/services/reddit-scanning')
jest.mock('@/lib/services/mastodon-scanning') 
jest.mock('@/lib/services/mastodon-monitoring')
jest.mock('@/lib/services/flickr-scanning')
jest.mock('@/lib/services/youtube-scanning')
jest.mock('@/lib/db', () => ({
  logToDatabase: jest.fn().mockResolvedValue(undefined)
}))

import { redditScanningService } from '@/lib/services/reddit-scanning'
import { mastodonScanningService } from '@/lib/services/mastodon-scanning'
import { flickrScanningService } from '@/lib/services/flickr-scanning'
import { youtubeScanningService } from '@/lib/services/youtube-scanning'

const mockRedditService = redditScanningService as jest.Mocked<typeof redditScanningService>
const mockMastodonService = mastodonScanningService as jest.Mocked<typeof mastodonScanningService>
const mockFlickrService = flickrScanningService as jest.Mocked<typeof flickrScanningService>
const mockYoutubeService = youtubeScanningService as jest.Mocked<typeof youtubeScanningService>

// Mock mastodon monitoring service
jest.mock('@/lib/services/mastodon-monitoring', () => ({
  mastodonMonitoringService: {
    getHealthSummary: jest.fn().mockResolvedValue({
      onlineInstances: 2,
      scanningStatus: 'active'
    })
  }
}))

describe('SocialMediaService', () => {
  let socialMediaService: SocialMediaService

  beforeEach(() => {
    jest.clearAllMocks()
    socialMediaService = new SocialMediaService()

    // Default mock implementations
    mockRedditService.getScanConfig = jest.fn().mockResolvedValue({ isEnabled: true, lastScanTime: new Date() })
    mockRedditService.testConnection = jest.fn().mockResolvedValue({ success: true, message: 'Connected' })
    
    mockMastodonService.getScanningStats = jest.fn().mockResolvedValue({ 
      lastScanTime: new Date(),
      totalPostsFound: 10,
      successRate: 0.9
    })
    
    mockFlickrService.getScanConfig = jest.fn().mockResolvedValue({ isEnabled: false, lastScanTime: null })
    mockFlickrService.testConnection = jest.fn().mockResolvedValue({ success: false, message: 'Not configured' })
    
    mockYoutubeService.getScanConfig = jest.fn().mockResolvedValue({ isEnabled: false, lastScanTime: null })
    mockYoutubeService.testConnection = jest.fn().mockResolvedValue({ success: false, message: 'Not configured' })
  })

  describe('getAllPlatformStatus', () => {
    it('should return status for all active platforms', async () => {
      const result = await socialMediaService.getAllPlatformStatus()

      expect(result).toHaveProperty('totalPlatforms')
      expect(result).toHaveProperty('activePlatforms')
      expect(result).toHaveProperty('platformStats')
      expect(Array.isArray(result.platformStats)).toBe(true)
      
      // Should have Reddit enabled and Mastodon with instances (making 2 active platforms)
      const activePlatforms = result.platformStats.filter(p => p.isEnabled)
      expect(activePlatforms.length).toBeGreaterThanOrEqual(2)
    })

    it('should handle individual platform errors gracefully', async () => {
      mockRedditService.getScanConfig.mockRejectedValue(new Error('Redis error'))

      const result = await socialMediaService.getAllPlatformStatus()

      expect(result.platformStats).toBeDefined()
      // Should still return data for other platforms even if one fails
      expect(result.platformStats.length).toBeGreaterThan(0)
    })

    it('should calculate correct totals', async () => {
      const result = await socialMediaService.getAllPlatformStatus()

      const activePlatforms = result.platformStats.filter(p => p.isEnabled).length
      expect(result.activePlatforms).toBe(activePlatforms)
      expect(result.totalPlatforms).toBe(result.platformStats.length)
    })
  })

  describe('platform integration', () => {
    it('should test all expected platforms', async () => {
      const result = await socialMediaService.getAllPlatformStatus()

      const platforms = result.platformStats.map(p => p.platform)
      expect(platforms).toContain('reddit')
      expect(platforms).toContain('mastodon')
      expect(platforms).toContain('flickr') 
      expect(platforms).toContain('youtube')
      
      // Should not contain removed platforms
      expect(platforms).not.toContain('instagram')
      expect(platforms).not.toContain('tiktok')
    })
  })
})