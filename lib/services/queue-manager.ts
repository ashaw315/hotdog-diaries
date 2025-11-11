import { db } from '@/lib/db'
import { loggingService } from './logging'

export interface QueueStats {
  totalApproved: number
  totalPending: number
  daysOfContent: number
  platforms: Record<string, number>
  contentTypes: Record<string, number>
  needsScanning: boolean
  platformPercentages: Record<string, number>
  contentTypePercentages: Record<string, number>
}

export interface ScanRecommendation {
  platform: string
  priority: 'high' | 'medium' | 'low' | 'skip'
  reason: string
  contentType: string
}

export class QueueManager {
  // Configuration
  private readonly OPTIMAL_QUEUE_DAYS = 7 // Keep 1 week buffer
  private readonly MINIMUM_QUEUE_SIZE = 21 // 7 days * 3 posts
  private readonly MAXIMUM_QUEUE_SIZE = 42 // 14 days * 3 posts
  private readonly POSTS_PER_DAY = 3

  // Content mix targets (for engaging feed)
  private readonly CONTENT_MIX_TARGETS = {
    video: 0.30,    // 30% videos (YouTube, some Reddit)
    gif: 0.25,      // 25% GIFs (Giphy, some Imgur)
    image: 0.40,    // 40% images (Pixabay, Imgur, Reddit)
    text: 0.05      // 5% text posts (Reddit, Bluesky)
  }

  // Platform diversity targets (prevent single-platform dominance)
  private readonly PLATFORM_MIX_TARGETS = {
    reddit: 0.20,      // 20% max from Reddit
    youtube: 0.15,     // 15% from YouTube (videos)
    pixabay: 0.15,     // 15% from Pixabay (high-quality images)
    giphy: 0.15,       // 15% from Giphy (GIFs)
    bluesky: 0.10,     // 10% from Bluesky
    tumblr: 0.10,      // 10% from Tumblr
    imgur: 0.10,       // 10% from Imgur
    lemmy: 0.05        // 5% from Lemmy
  }

  /**
   * Determine if a platform should be scanned based on queue balance
   */
  async shouldScanPlatform(platform: string): Promise<{ should: boolean; reason: string }> {
    try {
      const stats = await this.getQueueStats()

      // 1. Check if we have enough total content
      if (stats.totalApproved >= this.MAXIMUM_QUEUE_SIZE) {
        return {
          should: false,
          reason: `Queue full (${stats.totalApproved} items, ${stats.daysOfContent.toFixed(1)} days). Skipping ${platform} scan.`
        }
      }

      // 2. Check if this platform is over-represented
      const platformPercentage = stats.platformPercentages[platform] || 0
      const targetPercentage = this.PLATFORM_MIX_TARGETS[platform] || 0.05
      
      if (platformPercentage > targetPercentage * 1.5) {
        return {
          should: false,
          reason: `${platform} over-represented (${(platformPercentage * 100).toFixed(1)}% vs ${(targetPercentage * 100).toFixed(1)}% target). Skipping scan.`
        }
      }

      // 3. Check content type balance
      const contentType = this.getPlatformPrimaryContentType(platform)
      const typePercentage = stats.contentTypePercentages[contentType] || 0
      const contentTargetPercentage = this.CONTENT_MIX_TARGETS[contentType] || 0.05

      if (typePercentage > contentTargetPercentage * 1.5) {
        return {
          should: false,
          reason: `${contentType} content sufficient (${(typePercentage * 100).toFixed(1)}% vs ${(contentTargetPercentage * 100).toFixed(1)}% target). Skipping ${platform}.`
        }
      }

      // 4. Prioritize platforms we're lacking
      if (typePercentage < contentTargetPercentage * 0.5) {
        return {
          should: true,
          reason: `Need more ${contentType} content (${(typePercentage * 100).toFixed(1)}% vs ${(contentTargetPercentage * 100).toFixed(1)}% target). Prioritizing ${platform} scan.`
        }
      }

      // 5. Check if we're below minimum queue size
      if (stats.totalApproved < this.MINIMUM_QUEUE_SIZE) {
        return {
          should: true,
          reason: `Queue below minimum (${stats.totalApproved} < ${this.MINIMUM_QUEUE_SIZE}). Need ${platform} content.`
        }
      }

      return {
        should: true,
        reason: `${platform} within acceptable limits. Scanning recommended.`
      }

    } catch (error) {
      await loggingService.logError('QueueManager', `Error checking if should scan ${platform}`, { platform }, error as Error)
      return {
        should: false,
        reason: `Error checking ${platform} scan eligibility`
      }
    }
  }

  /**
   * Get comprehensive queue statistics
   */
  async getQueueStats(): Promise<QueueStats> {
    try {
      // Use Supabase client for production compatibility
      const { supabase } = await import('@/lib/db')

      // Get total approved and pending content
      const { data: allContent, error: contentError } = await supabase
        .from('content_queue')
        .select('is_approved, is_posted, source_platform, content_type, content_image_url, content_video_url')
        .eq('is_posted', false)

      if (contentError) throw contentError

      const totalApproved = allContent?.filter(c => c.is_approved).length || 0
      const totalPending = allContent?.filter(c => !c.is_approved).length || 0

      // Get platform distribution for approved content
      const approvedContent = allContent?.filter(c => c.is_approved && c.source_platform) || []

      const platforms: Record<string, number> = {}
      const platformPercentages: Record<string, number> = {}

      approvedContent.forEach(item => {
        if (item.source_platform) {
          platforms[item.source_platform] = (platforms[item.source_platform] || 0) + 1
        }
      })

      Object.keys(platforms).forEach(platform => {
        platformPercentages[platform] = totalApproved > 0 ? platforms[platform] / totalApproved : 0
      })

      // Get content type distribution from actual content
      const contentTypes: Record<string, number> = { video: 0, gif: 0, image: 0, text: 0 }
      const contentTypePercentages: Record<string, number> = { video: 0, gif: 0, image: 0, text: 0 }

      approvedContent.forEach(item => {
        // Determine content type from actual data
        let type = 'text'
        if (item.content_video_url) {
          type = 'video'
        } else if (item.content_image_url) {
          // Check if it's a GIF
          if (item.content_image_url.includes('.gif') || item.source_platform === 'giphy') {
            type = 'gif'
          } else {
            type = 'image'
          }
        }
        contentTypes[type] = (contentTypes[type] || 0) + 1
      })

      // Calculate percentages
      Object.keys(contentTypes).forEach(type => {
        contentTypePercentages[type] = totalApproved > 0 ? contentTypes[type] / totalApproved : 0
      })

      const daysOfContent = totalApproved / this.POSTS_PER_DAY
      const needsScanning = totalApproved < this.MINIMUM_QUEUE_SIZE

      const stats: QueueStats = {
        totalApproved,
        totalPending,
        daysOfContent,
        platforms,
        contentTypes,
        needsScanning,
        platformPercentages,
        contentTypePercentages
      }

      await loggingService.logInfo('QueueManager', 'Queue statistics calculated', {
        totalApproved,
        daysOfContent: daysOfContent.toFixed(1),
        needsScanning,
        topPlatforms: Object.entries(platforms)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([platform, count]) => `${platform}: ${count}`)
      })

      return stats

    } catch (error) {
      await loggingService.logError('QueueManager', 'Failed to get queue stats', {}, error as Error)
      throw error
    }
  }

  /**
   * Get scan recommendations for all platforms
   */
  async getScanRecommendations(): Promise<ScanRecommendation[]> {
    try {
      const stats = await this.getQueueStats()
      const recommendations: ScanRecommendation[] = []

      // Check each platform
      const platforms = ['reddit', 'youtube', 'pixabay', 'giphy', 'bluesky', 'tumblr', 'imgur', 'lemmy']

      for (const platform of platforms) {
        const { should, reason } = await this.shouldScanPlatform(platform)
        const contentType = this.getPlatformPrimaryContentType(platform)
        
        let priority: 'high' | 'medium' | 'low' | 'skip' = 'skip'
        
        if (should) {
          // Determine priority based on content needs
          const typePercentage = stats.contentTypePercentages[contentType] || 0
          const targetPercentage = this.CONTENT_MIX_TARGETS[contentType] || 0.05
          
          if (typePercentage < targetPercentage * 0.5) {
            priority = 'high'
          } else if (stats.totalApproved < this.MINIMUM_QUEUE_SIZE) {
            priority = 'high'
          } else if (typePercentage < targetPercentage * 0.8) {
            priority = 'medium'
          } else {
            priority = 'low'
          }
        }

        recommendations.push({
          platform,
          priority,
          reason,
          contentType
        })
      }

      // Sort by priority
      const priorityOrder = { high: 0, medium: 1, low: 2, skip: 3 }
      recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

      return recommendations

    } catch (error) {
      await loggingService.logError('QueueManager', 'Failed to get scan recommendations', {}, error as Error)
      throw error
    }
  }

  /**
   * Get the primary content type for a platform
   */
  getPlatformPrimaryContentType(platform: string): string {
    const mapping: Record<string, string> = {
      youtube: 'video',
      giphy: 'gif',
      pixabay: 'image',
      imgur: 'image', // Primarily images but some GIFs
      reddit: 'image', // Mixed but primarily images in our use case
      tumblr: 'image', // Mixed but primarily images
      bluesky: 'text',
      lemmy: 'text'
    }
    return mapping[platform] || 'text'
  }

  /**
   * Get detailed content type from actual content
   */
  async getActualContentTypes(): Promise<Record<string, number>> {
    try {
      const query = `
        SELECT 
          CASE 
            WHEN content_video_url IS NOT NULL THEN 'video'
            WHEN content_image_url IS NOT NULL AND (
              content_image_url LIKE '%.gif' OR 
              source_platform = 'giphy'
            ) THEN 'gif'
            WHEN content_image_url IS NOT NULL THEN 'image'
            ELSE 'text'
          END as content_type,
          COUNT(*) as count
        FROM content_queue
        WHERE is_approved = true AND is_posted = false
        GROUP BY content_type
      `
      
      const result = await db.query(query)
      const contentTypes: Record<string, number> = { video: 0, gif: 0, image: 0, text: 0 }
      
      result.rows.forEach((row: any) => {
        contentTypes[row.content_type] = parseInt(row.count)
      })

      return contentTypes

    } catch (error) {
      await loggingService.logError('QueueManager', 'Failed to get actual content types', {}, error as Error)
      return { video: 0, gif: 0, image: 0, text: 0 }
    }
  }

  /**
   * Check if queue is healthy (good balance and sufficient content)
   */
  async isQueueHealthy(): Promise<{ healthy: boolean; issues: string[] }> {
    try {
      const stats = await this.getQueueStats()
      const issues: string[] = []

      // Check total content
      if (stats.totalApproved < this.MINIMUM_QUEUE_SIZE) {
        issues.push(`Queue too small: ${stats.totalApproved} items (${stats.daysOfContent.toFixed(1)} days) < ${this.MINIMUM_QUEUE_SIZE} minimum`)
      }

      if (stats.totalApproved > this.MAXIMUM_QUEUE_SIZE) {
        issues.push(`Queue too large: ${stats.totalApproved} items (${stats.daysOfContent.toFixed(1)} days) > ${this.MAXIMUM_QUEUE_SIZE} maximum`)
      }

      // Check content type balance
      for (const [type, percentage] of Object.entries(stats.contentTypePercentages)) {
        const target = this.CONTENT_MIX_TARGETS[type] || 0.05
        if (percentage < target * 0.5) {
          issues.push(`Low ${type} content: ${(percentage * 100).toFixed(1)}% < ${(target * 50).toFixed(1)}% minimum`)
        }
        if (percentage > target * 2) {
          issues.push(`High ${type} content: ${(percentage * 100).toFixed(1)}% > ${(target * 200).toFixed(1)}% maximum`)
        }
      }

      // Check platform balance
      for (const [platform, percentage] of Object.entries(stats.platformPercentages)) {
        const target = this.PLATFORM_MIX_TARGETS[platform] || 0.05
        if (percentage > target * 2) {
          issues.push(`${platform} over-represented: ${(percentage * 100).toFixed(1)}% > ${(target * 200).toFixed(1)}% maximum`)
        }
      }

      return {
        healthy: issues.length === 0,
        issues
      }

    } catch (error) {
      await loggingService.logError('QueueManager', 'Failed to check queue health', {}, error as Error)
      return {
        healthy: false,
        issues: ['Error checking queue health']
      }
    }
  }
}

export const queueManager = new QueueManager()