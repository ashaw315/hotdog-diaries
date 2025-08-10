import { ContentType, SourcePlatform } from '@/types'
import { db } from '@/lib/db'

export interface MastodonInstance {
  domain: string
  name: string
  isActive: boolean
  rateLimitPerMinute: number
  lastScanTime?: Date
  errorCount: number
  successCount: number
}

export interface MastodonPost {
  id: string
  text: string
  author: string
  authorId: string
  url: string
  published: Date
  platform: SourcePlatform
  instance: string
  mediaUrls?: string[]
  hashtags: string[]
  mentions: string[]
  boostCount: number
  favouriteCount: number
}

export interface MastodonScanConfig {
  instances: MastodonInstance[]
  searchTerms: string[]
  hashtagsToTrack: string[]
  enabledInstances: string[]
  scanIntervalMinutes: number
  maxPostsPerScan: number
  minEngagementThreshold: number
}

export class MastodonService {
  private config: MastodonScanConfig
  private defaultInstances: MastodonInstance[] = [
    {
      domain: 'mastodon.social',
      name: 'Mastodon Social',
      isActive: true,
      rateLimitPerMinute: 60,
      errorCount: 0,
      successCount: 0
    },
    {
      domain: 'mas.to',
      name: 'Mas.to',
      isActive: true,
      rateLimitPerMinute: 60,
      errorCount: 0,
      successCount: 0
    },
    {
      domain: 'foodie.fm',
      name: 'Foodie FM',
      isActive: true,
      rateLimitPerMinute: 30,
      errorCount: 0,
      successCount: 0
    }
  ]

  private defaultSearchTerms = [
    'hotdog',
    'hot dog',
    'frankfurter',
    'wiener',
    'sausage sandwich'
  ]

  private defaultHashtags = [
    'hotdog',
    'hotdogs',
    'frankfurter',
    'streetfood',
    'food',
    'cooking',
    'foodie'
  ]

  constructor() {
    this.config = {
      instances: this.defaultInstances,
      searchTerms: this.defaultSearchTerms,
      hashtagsToTrack: this.defaultHashtags,
      enabledInstances: ['mastodon.social', 'mas.to'],
      scanIntervalMinutes: 30,
      maxPostsPerScan: 50,
      minEngagementThreshold: 1
    }
  }

  async getConfig(): Promise<MastodonScanConfig> {
    try {
      const result = await db.query(`
        SELECT 
          instances,
          search_terms,
          hashtags_to_track,
          enabled_instances,
          scan_interval_minutes,
          max_posts_per_scan,
          min_engagement_threshold
        FROM mastodon_scan_config 
        ORDER BY updated_at DESC 
        LIMIT 1
      `)

      if (result.rows.length === 0) {
        // Return default config if no database config exists
        return this.config
      }

      const row = result.rows[0]
      return {
        instances: row.instances,
        searchTerms: row.search_terms,
        hashtagsToTrack: row.hashtags_to_track,
        enabledInstances: row.enabled_instances,
        scanIntervalMinutes: row.scan_interval_minutes,
        maxPostsPerScan: row.max_posts_per_scan,
        minEngagementThreshold: row.min_engagement_threshold
      }
    } catch (error) {
      console.error('Failed to load Mastodon config from database:', error)
      // Fallback to default config
      return this.config
    }
  }

  async updateConfig(newConfig: Partial<MastodonScanConfig>): Promise<void> {
    try {
      // Get current config first
      const currentConfig = await this.getConfig()
      const updatedConfig = { ...currentConfig, ...newConfig }

      // Update database
      await db.query(`
        UPDATE mastodon_scan_config SET
          instances = $1,
          search_terms = $2,
          hashtags_to_track = $3,
          enabled_instances = $4,
          scan_interval_minutes = $5,
          max_posts_per_scan = $6,
          min_engagement_threshold = $7,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = (
          SELECT id FROM mastodon_scan_config 
          ORDER BY updated_at DESC 
          LIMIT 1
        )
      `, [
        JSON.stringify(updatedConfig.instances),
        JSON.stringify(updatedConfig.searchTerms),
        JSON.stringify(updatedConfig.hashtagsToTrack),
        JSON.stringify(updatedConfig.enabledInstances),
        updatedConfig.scanIntervalMinutes,
        updatedConfig.maxPostsPerScan,
        updatedConfig.minEngagementThreshold
      ])

      // Update in-memory config as well
      this.config = updatedConfig
    } catch (error) {
      console.error('Failed to update Mastodon config:', error)
      throw error
    }
  }

  async testInstanceConnection(domain: string): Promise<boolean> {
    try {
      const response = await fetch(`https://${domain}/api/v1/instance`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'HotdogDiaries/1.0'
        }
      })

      return response.ok
    } catch (error) {
      console.error(`Failed to connect to ${domain}:`, error)
      return false
    }
  }

  async searchPosts(
    options: { query: string; instance: string; limit?: number }
  ): Promise<MastodonPost[]> {
    const { query, instance, limit = 20 } = options;
    try {
      const searchUrl = `https://${instance}/api/v2/search`
      const params = new URLSearchParams({
        q: query,
        type: 'statuses',
        limit: limit.toString(),
        resolve: 'false'
      })

      const response = await fetch(`${searchUrl}?${params}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'HotdogDiaries/1.0'
        }
      })

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      return this.transformPosts(data.statuses || [], instance)
    } catch (error) {
      console.error(`Search failed on ${instance}:`, error)
      return []
    }
  }

  async getPublicTimeline(
    instance: string, 
    limit: number = 20
  ): Promise<MastodonPost[]> {
    try {
      const timelineUrl = `https://${instance}/api/v1/timelines/public`
      const params = new URLSearchParams({
        limit: limit.toString(),
        local: 'true'
      })

      const response = await fetch(`${timelineUrl}?${params}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'HotdogDiaries/1.0'
        }
      })

      if (!response.ok) {
        throw new Error(`Timeline fetch failed: ${response.status} ${response.statusText}`)
      }

      const posts = await response.json()
      return this.transformPosts(posts, instance)
    } catch (error) {
      console.error(`Timeline fetch failed on ${instance}:`, error)
      return []
    }
  }

  async searchHashtag(
    instance: string, 
    hashtag: string, 
    limit: number = 20
  ): Promise<MastodonPost[]> {
    try {
      const hashtagUrl = `https://${instance}/api/v1/timelines/tag/${hashtag}`
      const params = new URLSearchParams({
        limit: limit.toString()
      })

      const response = await fetch(`${hashtagUrl}?${params}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'HotdogDiaries/1.0'
        }
      })

      if (!response.ok) {
        throw new Error(`Hashtag search failed: ${response.status} ${response.statusText}`)
      }

      const posts = await response.json()
      return this.transformPosts(posts, instance)
    } catch (error) {
      console.error(`Hashtag search failed on ${instance}:`, error)
      return []
    }
  }

  private transformPosts(rawPosts: any[], instance: string): MastodonPost[] {
    return rawPosts
      .filter(post => post && post.content && post.account)
      .map(post => ({
        id: post.id,
        text: this.stripHtml(post.content),
        author: post.account.display_name || post.account.username,
        authorId: post.account.id,
        url: post.url,
        published: new Date(post.created_at),
        platform: SourcePlatform.MASTODON,
        instance,
        mediaUrls: (post.media_attachments || []).map((media: any) => media.url).filter(Boolean),
        hashtags: (post.tags || []).map((tag: any) => tag.name),
        mentions: (post.mentions || []).map((mention: any) => mention.username),
        boostCount: post.reblogs_count || 0,
        favouriteCount: post.favourites_count || 0
      }))
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim()
  }

  async scanForHotdogContent(): Promise<MastodonPost[]> {
    const allPosts: MastodonPost[] = []
    const enabledInstances = this.config.instances.filter(
      instance => this.config.enabledInstances.includes(instance.domain)
    )

    for (const instance of enabledInstances) {
      try {
        // Search for each search term
        for (const term of this.config.searchTerms) {
          const posts = await this.searchPosts({
            instance: instance.domain,
            query: term,
            limit: Math.floor(this.config.maxPostsPerScan / this.config.searchTerms.length)
          })
          allPosts.push(...posts)
        }

        // Search for each hashtag
        for (const hashtag of this.config.hashtagsToTrack) {
          const posts = await this.searchHashtag(
            instance.domain, 
            hashtag, 
            10
          )
          allPosts.push(...posts)
        }

        // Update success count
        const instanceConfig = this.config.instances.find(i => i.domain === instance.domain)
        if (instanceConfig) {
          instanceConfig.successCount++
          instanceConfig.lastScanTime = new Date()
        }

        // Rate limiting - wait between instances
        await new Promise(resolve => setTimeout(resolve, 2000))

      } catch (error) {
        console.error(`Scan failed for ${instance.domain}:`, error)
        
        // Update error count
        const instanceConfig = this.config.instances.find(i => i.domain === instance.domain)
        if (instanceConfig) {
          instanceConfig.errorCount++
        }
      }
    }

    // Filter for quality content
    return this.filterQualityContent(allPosts)
  }

  private filterQualityContent(posts: MastodonPost[]): MastodonPost[] {
    const uniquePosts = new Map<string, MastodonPost>()
    
    for (const post of posts) {
      // Skip if content doesn't actually contain hotdog references
      const contentLower = post.content.toLowerCase()
      const hasHotdogContent = this.config.searchTerms.some(term => 
        contentLower.includes(term.toLowerCase())
      )
      
      if (!hasHotdogContent) continue

      // Skip if engagement is too low
      const totalEngagement = post.stats.favouritesCount + 
                             post.stats.reblogsCount + 
                             post.stats.repliesCount
      
      if (totalEngagement < this.config.minEngagementThreshold) continue

      // Skip if content is too short
      if (post.content.length < 10) continue

      // Use URL as unique key to avoid duplicates
      uniquePosts.set(post.url, post)
    }

    return Array.from(uniquePosts.values())
      .sort((a, b) => {
        const aEngagement = a.stats.favouritesCount + a.stats.reblogsCount
        const bEngagement = b.stats.favouritesCount + b.stats.reblogsCount
        return bEngagement - aEngagement
      })
      .slice(0, this.config.maxPostsPerScan)
  }

  getContentType(post: MastodonPost): ContentType {
    if (post.mediaAttachments.length > 0) {
      const hasImages = post.mediaAttachments.some(media => media.type === 'image')
      const hasVideos = post.mediaAttachments.some(media => media.type === 'video')
      
      if (hasImages && hasVideos) return ContentType.MIXED
      if (hasVideos) return ContentType.VIDEO
      if (hasImages) return ContentType.IMAGE
    }
    
    return ContentType.TEXT
  }

  transformToHotdogPost(post: MastodonPost): any {
    return {
      content_text: post.content,
      content_type: this.getContentType(post),
      source_platform: SourcePlatform.MASTODON,
      original_url: post.url,
      original_author: `${post.author.displayName} (@${post.author.username})`,
      content_image_url: post.mediaAttachments.find(media => media.type === 'image')?.url,
      content_video_url: post.mediaAttachments.find(media => media.type === 'video')?.url,
      scraped_at: new Date(),
      mastodon_data: {
        instance: post.instance,
        postId: post.id,
        author: post.author,
        stats: post.stats,
        tags: post.tags,
        mediaAttachments: post.mediaAttachments
      }
    }
  }

  async getInstanceStats(): Promise<Array<{
    domain: string
    name: string
    isActive: boolean
    lastScanTime?: Date
    errorCount: number
    successCount: number
    successRate: number
  }>> {
    try {
      const config = await this.getConfig()
      return config.instances.map(instance => ({
        domain: instance.domain,
        name: instance.name,
        isActive: instance.isActive,
        lastScanTime: instance.lastScanTime,
        errorCount: instance.errorCount,
        successCount: instance.successCount,
        successRate: instance.successCount + instance.errorCount > 0 
          ? instance.successCount / (instance.successCount + instance.errorCount) 
          : 0
      }))
    } catch (error) {
      console.error('Failed to get instance stats:', error)
      return []
    }
  }

  async getActiveInstances(): Promise<string[]> {
    try {
      const config = await this.getConfig()
      return config.enabledInstances || ['mastodon.social', 'mas.to']
    } catch (error) {
      console.error('Failed to get active instances:', error)
      // Fallback to default instances
      return ['mastodon.social', 'mas.to']
    }
  }
}

export const mastodonService = new MastodonService()