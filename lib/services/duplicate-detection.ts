import { db, logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'
import { generateContentHash as utilGenerateContentHash, HashableContent } from '@/lib/utils/content-hash'
import crypto from 'crypto'

export interface DuplicateCheckResult {
  isDuplicate: boolean
  originalContentId?: number
  similarityScore: number
  matchType: 'exact' | 'fuzzy' | 'url' | 'image' | 'video' | 'none'
  confidence: number
}

export interface SimilarityMatch {
  contentId: number
  similarity: number
  matchType: 'text' | 'url' | 'image' | 'video'
  matchedField: string
}

export interface DuplicateCluster {
  originalId: number
  duplicateIds: number[]
  clusterSize: number
  similarity: number
  createdAt: Date
}

export class DuplicateDetectionService {
  private static readonly EXACT_MATCH_THRESHOLD = 1.0
  private static readonly FUZZY_MATCH_THRESHOLD = 0.95  // Increased from 0.85
  private static readonly URL_SIMILARITY_THRESHOLD = 0.98  // Increased from 0.9
  private static readonly IMAGE_SIMILARITY_THRESHOLD = 0.98  // Increased from 0.95
  private static readonly VIDEO_SIMILARITY_THRESHOLD = 0.98  // Increased from 0.95

  // Platform-specific repost allowances (in milliseconds)
  private static readonly PLATFORM_REPOST_INTERVALS = {
    'reddit': 30 * 24 * 60 * 60 * 1000,     // 30 days
    'imgur': 14 * 24 * 60 * 60 * 1000,      // 14 days  
    'pixabay': 60 * 24 * 60 * 60 * 1000,    // 60 days (stock photos)
    'youtube': 90 * 24 * 60 * 60 * 1000,    // 90 days
    'tumblr': 14 * 24 * 60 * 60 * 1000,     // 14 days
    'mastodon': 7 * 24 * 60 * 60 * 1000,    // 7 days
    'lemmy': 7 * 24 * 60 * 60 * 1000,       // 7 days
    'default': 7 * 24 * 60 * 60 * 1000      // 7 days default
  }

  async checkForDuplicates(content: any): Promise<DuplicateCheckResult> {
    try {
      await logToDatabase(
        LogLevel.INFO,
        'Starting enhanced duplicate detection',
        'DuplicateDetectionService',
        { contentId: content.id, platform: content.source_platform }
      )

      // Get platform-specific rules
      const repostInterval = DuplicateDetectionService.PLATFORM_REPOST_INTERVALS[content.source_platform] || 
                            DuplicateDetectionService.PLATFORM_REPOST_INTERVALS['default']

      // Generate various hashes for comparison
      const exactHash = this.generateExactHash(content)
      const fuzzyHash = this.generateFuzzyHash(content)
      const urlHash = this.generateUrlHash(content)
      const imageHash = this.generateImageHash(content)
      const videoHash = this.generateVideoHash(content)

      const matchResults = {
        exact: null,
        url: null,
        image: null,
        video: null,
        fuzzy: null
      }

      // Check for exact matches first (always blocking)
      const exactMatch = await this.findExactMatchWithTimeCheck(exactHash, content.id, repostInterval)
      if (exactMatch) {
        return {
          isDuplicate: true,
          originalContentId: exactMatch.id,
          similarityScore: 1.0,
          matchType: 'exact',
          confidence: 1.0
        }
      }

      // Check for URL matches (with time-based allowance)
      const urlMatch = await this.findUrlMatchWithTimeCheck(content.original_url, content.id, repostInterval)
      if (urlMatch) {
        matchResults.url = {
          id: urlMatch.id,
          confidence: DuplicateDetectionService.URL_SIMILARITY_THRESHOLD
        }
      }

      // Check for image matches (with time-based allowance)
      if (content.content_image_url) {
        const imageMatch = await this.findImageMatchWithTimeCheck(imageHash, content.id, repostInterval)
        if (imageMatch) {
          matchResults.image = {
            id: imageMatch.id,
            confidence: DuplicateDetectionService.IMAGE_SIMILARITY_THRESHOLD
          }
        }
      }

      // Check for video matches (with time-based allowance)
      if (content.content_video_url) {
        const videoMatch = await this.findVideoMatchWithTimeCheck(videoHash, content.id, repostInterval)
        if (videoMatch) {
          matchResults.video = {
            id: videoMatch.id,
            confidence: DuplicateDetectionService.VIDEO_SIMILARITY_THRESHOLD
          }
        }
      }

      // Check for fuzzy text matches (with time-based allowance)
      const fuzzyMatches = await this.findFuzzyMatchesWithTimeCheck(content, repostInterval)
      if (fuzzyMatches.length > 0) {
        const bestMatch = fuzzyMatches[0]
        if (bestMatch.similarity >= DuplicateDetectionService.FUZZY_MATCH_THRESHOLD) {
          matchResults.fuzzy = {
            id: bestMatch.contentId,
            confidence: bestMatch.similarity
          }
        }
      }

      // Require multiple indicators to mark as duplicate (not just any single match)
      const activeMatches = Object.values(matchResults).filter(match => match !== null)
      const matchCount = activeMatches.length

      if (matchCount >= 2) {
        // Multiple matches found - likely duplicate
        const bestMatch = activeMatches.reduce((best, current) => 
          current.confidence > best.confidence ? current : best
        )
        
        return {
          isDuplicate: true,
          originalContentId: bestMatch.id,
          similarityScore: bestMatch.confidence,
          matchType: matchCount > 2 ? 'multiple' : 'dual',
          confidence: Math.min(1.0, bestMatch.confidence + (matchCount * 0.05)) // Boost confidence with multiple matches
        }
      } else if (matchCount === 1 && activeMatches[0].confidence > 0.98) {
        // Single very high confidence match
        const match = activeMatches[0]
        return {
          isDuplicate: true,
          originalContentId: match.id,
          similarityScore: match.confidence,
          matchType: 'high_confidence_single',
          confidence: match.confidence
        }
      }

      await logToDatabase(
        LogLevel.INFO,
        'No significant duplicates found',
        'DuplicateDetectionService',
        { contentId: content.id, matchCount, platform: content.source_platform }
      )

      return {
        isDuplicate: false,
        similarityScore: matchCount > 0 ? activeMatches[0].confidence : 0,
        matchType: 'none',
        confidence: 0
      }

    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'Duplicate detection failed',
        'DuplicateDetectionService',
        { 
          contentId: content.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      )

      return {
        isDuplicate: false,
        similarityScore: 0,
        matchType: 'none',
        confidence: 0
      }
    }
  }

  async findSimilarContent(contentId: number, limit: number = 10): Promise<SimilarityMatch[]> {
    try {
      const content = await this.getContentById(contentId)
      if (!content) {
        return []
      }

      const fuzzyMatches = await this.findFuzzyMatches(content, limit)
      
      return fuzzyMatches.map(match => ({
        contentId: match.contentId,
        similarity: match.similarity,
        matchType: match.matchType as 'text' | 'url' | 'image' | 'video',
        matchedField: match.matchType
      }))
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'Failed to find similar content',
        'DuplicateDetectionService',
        { 
          contentId,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      )
      return []
    }
  }

  async getDuplicateClusters(limit: number = 50): Promise<DuplicateCluster[]> {
    try {
      const result = await db.query(`
        SELECT 
          ca.duplicate_of as original_id,
          array_agg(ca.content_queue_id) as duplicate_ids,
          count(ca.content_queue_id) as cluster_size,
          avg(ca.confidence_score) as avg_similarity,
          min(ca.created_at) as created_at
        FROM content_analysis ca
        WHERE ca.duplicate_of IS NOT NULL
        GROUP BY ca.duplicate_of
        HAVING count(ca.content_queue_id) > 1
        ORDER BY count(ca.content_queue_id) DESC, min(ca.created_at) DESC
        LIMIT $1
      `, [limit])

      return result.rows.map(row => ({
        originalId: row.original_id,
        duplicateIds: row.duplicate_ids,
        clusterSize: parseInt(row.cluster_size),
        similarity: parseFloat(row.avg_similarity),
        createdAt: new Date(row.created_at)
      }))
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'Failed to get duplicate clusters',
        'DuplicateDetectionService',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      )
      return []
    }
  }

  async cleanupDuplicates(dryRun: boolean = true): Promise<{
    clustersFound: number
    duplicatesRemoved: number
    errors: string[]
  }> {
    try {
      const clusters = await this.getDuplicateClusters(1000)
      const errors: string[] = []
      let duplicatesRemoved = 0

      for (const cluster of clusters) {
        try {
          if (!dryRun) {
            // Mark duplicates as rejected instead of deleting them
            await db.query(
              'UPDATE content_queue SET is_approved = false WHERE id = ANY($1)',
              [cluster.duplicateIds]
            )
            duplicatesRemoved += cluster.duplicateIds.length
          } else {
            duplicatesRemoved += cluster.duplicateIds.length
          }
        } catch (error) {
          errors.push(`Failed to cleanup cluster ${cluster.originalId}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }

      await logToDatabase(
        LogLevel.INFO,
        `Duplicate cleanup ${dryRun ? 'simulation' : 'execution'} completed`,
        'DuplicateDetectionService',
        { 
          clustersFound: clusters.length,
          duplicatesRemoved,
          errors: errors.length,
          dryRun
        }
      )

      return {
        clustersFound: clusters.length,
        duplicatesRemoved,
        errors
      }
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'Duplicate cleanup failed',
        'DuplicateDetectionService',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      )

      return {
        clustersFound: 0,
        duplicatesRemoved: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      }
    }
  }

  private async findExactMatch(hash: string, excludeId?: number): Promise<any> {
    const result = await db.query(
      `SELECT cq.* FROM content_queue cq
       WHERE cq.content_hash = $1 
       AND ($2::INTEGER IS NULL OR cq.id != $2::INTEGER)
       ORDER BY cq.created_at ASC
       LIMIT 1`,
      [hash, excludeId]
    )

    return result.rows.length > 0 ? result.rows[0] : null
  }

  private async findExactMatchWithTimeCheck(hash: string, excludeId?: number, repostInterval?: number): Promise<any> {
    if (!repostInterval) {
      return this.findExactMatch(hash, excludeId)
    }

    const result = await db.query(
      `SELECT cq.* FROM content_queue cq
       WHERE cq.content_hash = $1 
       AND ($2::INTEGER IS NULL OR cq.id != $2::INTEGER)
       AND cq.scraped_at > NOW() - INTERVAL '${Math.floor(repostInterval / (1000 * 60 * 60 * 24))} days'
       ORDER BY cq.created_at ASC
       LIMIT 1`,
      [hash, excludeId]
    )

    return result.rows.length > 0 ? result.rows[0] : null
  }

  private async findUrlMatchWithTimeCheck(url: string, excludeId?: number, repostInterval?: number): Promise<any> {
    if (!repostInterval) {
      return this.findUrlMatch(this.generateUrlHash({ original_url: url }), excludeId)
    }

    const result = await db.query(
      `SELECT cq.* FROM content_queue cq
       WHERE cq.original_url = $1
       AND ($2::INTEGER IS NULL OR cq.id != $2::INTEGER)
       AND cq.scraped_at > NOW() - INTERVAL '${Math.floor(repostInterval / (1000 * 60 * 60 * 24))} days'
       ORDER BY cq.created_at ASC
       LIMIT 1`,
      [url, excludeId]
    )

    return result.rows.length > 0 ? result.rows[0] : null
  }

  private async findImageMatchWithTimeCheck(imageHash: string, excludeId?: number, repostInterval?: number): Promise<any> {
    if (!repostInterval) {
      return this.findImageMatch(imageHash, excludeId)
    }

    const result = await db.query(
      `SELECT cq.* FROM content_queue cq
       WHERE MD5(cq.content_image_url) = $1 
       AND cq.content_image_url IS NOT NULL
       AND ($2::INTEGER IS NULL OR cq.id != $2::INTEGER)
       AND cq.scraped_at > NOW() - INTERVAL '${Math.floor(repostInterval / (1000 * 60 * 60 * 24))} days'
       ORDER BY cq.created_at ASC
       LIMIT 1`,
      [imageHash, excludeId]
    )

    return result.rows.length > 0 ? result.rows[0] : null
  }

  private async findVideoMatchWithTimeCheck(videoHash: string, excludeId?: number, repostInterval?: number): Promise<any> {
    if (!repostInterval) {
      return this.findVideoMatch(videoHash, excludeId)
    }

    const result = await db.query(
      `SELECT cq.* FROM content_queue cq
       WHERE MD5(cq.content_video_url) = $1 
       AND cq.content_video_url IS NOT NULL
       AND ($2::INTEGER IS NULL OR cq.id != $2::INTEGER)
       AND cq.scraped_at > NOW() - INTERVAL '${Math.floor(repostInterval / (1000 * 60 * 60 * 24))} days'
       ORDER BY cq.created_at ASC
       LIMIT 1`,
      [videoHash, excludeId]
    )

    return result.rows.length > 0 ? result.rows[0] : null
  }

  private async findUrlMatch(urlHash: string, excludeId?: number): Promise<any> {
    const result = await db.query(
      `SELECT cq.* FROM content_queue cq
       WHERE MD5(cq.original_url) = $1 
       AND ($2::INTEGER IS NULL OR cq.id != $2::INTEGER)
       ORDER BY cq.created_at ASC
       LIMIT 1`,
      [urlHash, excludeId]
    )

    return result.rows.length > 0 ? result.rows[0] : null
  }

  private async findImageMatch(imageHash: string, excludeId?: number): Promise<any> {
    const result = await db.query(
      `SELECT cq.* FROM content_queue cq
       WHERE MD5(cq.content_image_url) = $1 
       AND cq.content_image_url IS NOT NULL
       AND ($2::INTEGER IS NULL OR cq.id != $2::INTEGER)
       ORDER BY cq.created_at ASC
       LIMIT 1`,
      [imageHash, excludeId]
    )

    return result.rows.length > 0 ? result.rows[0] : null
  }

  private async findVideoMatch(videoHash: string, excludeId?: number): Promise<any> {
    const result = await db.query(
      `SELECT cq.* FROM content_queue cq
       WHERE MD5(cq.content_video_url) = $1 
       AND cq.content_video_url IS NOT NULL
       AND ($2::INTEGER IS NULL OR cq.id != $2::INTEGER)
       ORDER BY cq.created_at ASC
       LIMIT 1`,
      [videoHash, excludeId]
    )

    return result.rows.length > 0 ? result.rows[0] : null
  }

  private async findFuzzyMatches(content: any, limit: number = 10): Promise<SimilarityMatch[]> {
    if (!content.content_text || content.content_text.length < 20) {
      return []
    }

    const fuzzyHash = this.generateFuzzyHash(content)
    const normalizedText = this.normalizeText(content.content_text)
    
    // Find content with similar fuzzy hashes
    const result = await db.query(
      `SELECT cq.*, ca.similarity_hash
       FROM content_queue cq
       LEFT JOIN content_analysis ca ON cq.id = ca.content_queue_id
       WHERE cq.content_text IS NOT NULL
       AND cq.id != $1
       AND length(cq.content_text) > 20
       ORDER BY cq.created_at DESC
       LIMIT 200`,
      [content.id]
    )

    const matches: SimilarityMatch[] = []

    for (const row of result.rows) {
      const otherNormalizedText = this.normalizeText(row.content_text)
      const similarity = this.calculateTextSimilarity(normalizedText, otherNormalizedText)
      
      if (similarity >= 0.7) {
        matches.push({
          contentId: row.id,
          similarity,
          matchType: 'text'
        })
      }
    }

    // Sort by similarity and return top matches
    matches.sort((a, b) => b.similarity - a.similarity)
    return matches.slice(0, limit)
  }

  private async findFuzzyMatchesWithTimeCheck(content: any, repostInterval?: number, limit: number = 10): Promise<SimilarityMatch[]> {
    if (!content.content_text || content.content_text.length < 20) {
      return []
    }

    if (!repostInterval) {
      return this.findFuzzyMatches(content, limit)
    }

    const normalizedText = this.normalizeText(content.content_text)
    
    // Find content with similar text within the time window
    const result = await db.query(
      `SELECT cq.*, ca.similarity_hash
       FROM content_queue cq
       LEFT JOIN content_analysis ca ON cq.id = ca.content_queue_id
       WHERE cq.content_text IS NOT NULL
       AND cq.id != $1
       AND length(cq.content_text) > 20
       AND cq.scraped_at > NOW() - INTERVAL '${Math.floor(repostInterval / (1000 * 60 * 60 * 24))} days'
       ORDER BY cq.created_at DESC
       LIMIT 200`,
      [content.id]
    )

    const matches: SimilarityMatch[] = []

    for (const row of result.rows) {
      const otherNormalizedText = this.normalizeText(row.content_text)
      const similarity = this.calculateTextSimilarity(normalizedText, otherNormalizedText)
      
      if (similarity >= 0.8) { // Higher threshold for time-based matches
        matches.push({
          contentId: row.id,
          similarity,
          matchType: 'text'
        })
      }
    }

    // Sort by similarity and return top matches
    matches.sort((a, b) => b.similarity - a.similarity)
    return matches.slice(0, limit)
  }

  private async getContentById(id: number): Promise<any> {
    const result = await db.query(
      'SELECT * FROM content_queue WHERE id = $1',
      [id]
    )
    
    return result.rows.length > 0 ? result.rows[0] : null
  }

  private generateExactHash(content: any): string {
    const hashInput = [
      content.content_text || '',
      content.content_image_url || '',
      content.content_video_url || '',
      content.original_url || ''
    ].join('|')

    return crypto.createHash('sha256').update(hashInput).digest('hex')
  }

  private generateFuzzyHash(content: any): string {
    const normalizedText = this.normalizeText(content.content_text || '')
    const hashInput = [
      normalizedText,
      content.content_image_url || '',
      content.content_video_url || ''
    ].join('|')

    return crypto.createHash('md5').update(hashInput).digest('hex')
  }

  private generateUrlHash(content: any): string {
    return crypto.createHash('md5').update(content.original_url || '').digest('hex')
  }

  private generateImageHash(content: any): string {
    return crypto.createHash('md5').update(content.content_image_url || '').digest('hex')
  }

  private generateVideoHash(content: any): string {
    return crypto.createHash('md5').update(content.content_video_url || '').digest('hex')
  }

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    if (!text1 || !text2) return 0
    if (text1 === text2) return 1

    // Use Jaccard similarity for text comparison
    const words1 = new Set(text1.split(/\s+/))
    const words2 = new Set(text2.split(/\s+/))
    
    const intersection = new Set([...words1].filter(x => words2.has(x)))
    const union = new Set([...words1, ...words2])
    
    return intersection.size / union.size
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = []
    const len1 = str1.length
    const len2 = str2.length

    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        if (str1.charAt(i - 1) === str2.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }

    return matrix[len1][len2]
  }

  private calculateLevenshteinSimilarity(str1: string, str2: string): number {
    const maxLength = Math.max(str1.length, str2.length)
    if (maxLength === 0) return 1

    const distance = this.levenshteinDistance(str1, str2)
    return (maxLength - distance) / maxLength
  }

  /**
   * Generate content hash using the utility function
   */
  generateContentHash(content: HashableContent): string {
    return utilGenerateContentHash(content)
  }
}

export const duplicateDetectionService = new DuplicateDetectionService()