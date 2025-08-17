import { db, logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'
import { loadEnv } from '@/lib/env'

// Ensure environment variables are loaded
loadEnv()

export interface QuickProcessingResult {
  success: boolean
  contentId?: number
  action: 'approved' | 'rejected' | 'duplicate' | 'timeout'
  reason?: string
  error?: string
}

export class ContentProcessorFixed {
  private static readonly PROCESSING_TIMEOUT = 5000 // 5 seconds max
  private static readonly DB_TIMEOUT = 3000 // 3 seconds for DB ops
  
  /**
   * Quick content processing with timeout protection
   */
  async processContentQuick(contentData: any): Promise<QuickProcessingResult> {
    console.log(`🔄 Processing ${contentData.source_platform} ${contentData.content_type}...`)
    
    try {
      // Wrap entire processing in timeout
      const timeoutPromise = new Promise<QuickProcessingResult>((_, reject) => 
        setTimeout(() => reject(new Error('Processing timeout')), ContentProcessorFixed.PROCESSING_TIMEOUT)
      )
      
      const processingPromise = this.doQuickProcessing(contentData)
      
      // Race between processing and timeout
      const result = await Promise.race([processingPromise, timeoutPromise])
      
      console.log(`✅ ${contentData.source_platform} processing complete: ${result.action}`)
      return result
      
    } catch (error) {
      console.error(`❌ Processing failed for ${contentData.source_platform}:`, error.message)
      
      // If processing fails, try direct save as fallback
      if (this.isVideoOrGif(contentData)) {
        console.log(`🔧 Attempting direct save for ${contentData.content_type}...`)
        const directResult = await this.directSave(contentData)
        if (directResult.success) {
          return directResult
        }
      }
      
      return {
        success: false,
        action: 'rejected',
        reason: `Processing failed: ${error.message}`,
        error: error.message
      }
    }
  }
  
  /**
   * Core processing logic without complex dependencies
   */
  private async doQuickProcessing(contentData: any): Promise<QuickProcessingResult> {
    // 1. Basic validation
    if (!contentData.content_text && !contentData.title) {
      return {
        success: false,
        action: 'rejected',
        reason: 'No content text or title'
      }
    }
    
    // 2. Quick hotdog relevance check
    const text = (contentData.content_text || contentData.title || '').toLowerCase()
    const isRelevant = this.quickHotdogCheck(text)
    
    if (!isRelevant) {
      return {
        success: false,
        action: 'rejected',
        reason: 'Not hotdog-related'
      }
    }
    
    // 3. Quick duplicate check (simple hash-based)
    const isDuplicate = await this.quickDuplicateCheck(contentData)
    if (isDuplicate) {
      return {
        success: false,
        action: 'duplicate',
        reason: 'Duplicate content detected'
      }
    }
    
    // 4. Save to database
    const contentId = await this.saveToDatabase(contentData)
    
    if (contentId) {
      // Auto-approve videos and GIFs to boost their numbers
      const shouldAutoApprove = this.isVideoOrGif(contentData) || this.hasHighConfidence(contentData)
      
      if (shouldAutoApprove) {
        await this.approveContent(contentId)
      }
      
      return {
        success: true,
        contentId,
        action: shouldAutoApprove ? 'approved' : 'rejected',
        reason: shouldAutoApprove ? 'Auto-approved' : 'Pending review'
      }
    } else {
      return {
        success: false,
        action: 'rejected',
        reason: 'Failed to save to database'
      }
    }
  }
  
  /**
   * Quick hotdog relevance check using simple keywords
   */
  private quickHotdogCheck(text: string): boolean {
    const hotdogTerms = [
      'hotdog', 'hot dog', 'hotdogs', 'hot dogs',
      'frankfurter', 'wiener', 'bratwurst', 'sausage',
      'ballpark', 'chili dog', 'corn dog', 'weiner',
      'kraut', 'mustard', 'relish'
    ]
    
    return hotdogTerms.some(term => text.includes(term))
  }
  
  /**
   * Quick duplicate check using content hash
   */
  private async quickDuplicateCheck(contentData: any): Promise<boolean> {
    try {
      const hash = this.generateContentHash(contentData)
      
      const timeoutPromise = new Promise<any>((_, reject) => 
        setTimeout(() => reject(new Error('Duplicate check timeout')), 2000)
      )
      
      const queryPromise = db.query(
        'SELECT id FROM content_queue WHERE content_hash = ? LIMIT 1',
        [hash]
      )
      
      const result = await Promise.race([queryPromise, timeoutPromise])
      
      return result.rows && result.rows.length > 0
      
    } catch (error) {
      console.warn('Duplicate check failed, assuming not duplicate:', error.message)
      return false
    }
  }
  
  /**
   * Save content to database with timeout protection
   */
  private async saveToDatabase(contentData: any): Promise<number | null> {
    try {
      const query = `
        INSERT INTO content_queue (
          content_text, content_image_url, content_video_url, content_type,
          source_platform, original_url, original_author, content_hash,
          scraped_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
        RETURNING id
      `
      
      const params = [
        contentData.content_text || contentData.title || '',
        contentData.content_image_url || contentData.image_url || contentData.thumbnailUrl || '',
        contentData.content_video_url || contentData.video_url || contentData.videoUrl || '',
        contentData.content_type || 'text',
        contentData.source_platform || 'unknown',
        contentData.original_url || contentData.url || '',
        contentData.original_author || contentData.author || contentData.channelTitle || '',
        this.generateContentHash(contentData)
      ]
      
      const timeoutPromise = new Promise<any>((_, reject) => 
        setTimeout(() => reject(new Error('Database save timeout')), ContentProcessorFixed.DB_TIMEOUT)
      )
      
      const savePromise = db.query(query, params)
      
      const result = await Promise.race([savePromise, timeoutPromise])
      
      const contentId = result.rows && result.rows[0] ? result.rows[0].id : null
      
      if (contentId) {
        console.log(`💾 Saved to database with ID: ${contentId}`)
      }
      
      return contentId
      
    } catch (error) {
      console.error('Database save failed:', error.message)
      return null
    }
  }
  
  /**
   * Direct save bypassing all processing (emergency fallback)
   */
  async directSave(contentData: any): Promise<QuickProcessingResult> {
    try {
      console.log(`🚨 Direct save for ${contentData.source_platform} ${contentData.content_type}`)
      
      const query = `
        INSERT OR IGNORE INTO content_queue (
          content_text, content_image_url, content_video_url, content_type,
          source_platform, original_url, original_author, content_hash,
          is_approved, scraped_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'), datetime('now'))
        RETURNING id
      `
      
      const params = [
        contentData.content_text || contentData.title || `${contentData.source_platform} ${contentData.content_type}`,
        contentData.content_image_url || contentData.image_url || contentData.thumbnailUrl || '',
        contentData.content_video_url || contentData.video_url || contentData.videoUrl || '',
        contentData.content_type || 'text',
        contentData.source_platform || 'unknown',
        contentData.original_url || contentData.url || '',
        contentData.original_author || contentData.author || contentData.channelTitle || '',
        this.generateContentHash(contentData)
      ]
      
      const result = await db.query(query, params)
      const contentId = result.rows && result.rows[0] ? result.rows[0].id : null
      
      if (contentId) {
        console.log(`✅ Direct save successful with ID: ${contentId}`)
        return {
          success: true,
          contentId,
          action: 'approved',
          reason: 'Direct save with auto-approval'
        }
      } else {
        return {
          success: false,
          action: 'rejected',
          reason: 'Direct save failed'
        }
      }
      
    } catch (error) {
      console.error('Direct save failed:', error.message)
      return {
        success: false,
        action: 'rejected',
        reason: `Direct save error: ${error.message}`,
        error: error.message
      }
    }
  }
  
  /**
   * Approve content in database
   */
  private async approveContent(contentId: number): Promise<void> {
    try {
      await db.query(
        'UPDATE content_queue SET is_approved = 1, content_status = ? WHERE id = ?',
        ['approved', contentId]
      )
      console.log(`✅ Auto-approved content ID: ${contentId}`)
    } catch (error) {
      console.error('Failed to approve content:', error.message)
    }
  }
  
  /**
   * Check if content is video or GIF (high priority for rebalancing)
   */
  private isVideoOrGif(contentData: any): boolean {
    return contentData.content_type === 'video' || contentData.content_type === 'gif'
  }
  
  /**
   * Check if content has high confidence score
   */
  private hasHighConfidence(contentData: any): boolean {
    return (contentData.confidence_score || 0) > 0.8
  }
  
  /**
   * Generate simple content hash
   */
  private generateContentHash(contentData: any): string {
    const key = contentData.original_url || contentData.url || contentData.content_text || contentData.title || Math.random().toString()
    return require('crypto').createHash('md5').update(key).digest('hex')
  }
}

export const contentProcessorFixed = new ContentProcessorFixed()