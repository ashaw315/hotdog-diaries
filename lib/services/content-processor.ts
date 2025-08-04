import { db, logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'
import { filteringService, ContentAnalysis } from './filtering'
import { duplicateDetectionService } from './duplicate-detection'
import { loggingService } from './logging'
import { metricsService } from './metrics'
import { errorHandler } from '@/lib/middleware/error-handler'
import crypto from 'crypto'

export interface ContentProcessingResult {
  success: boolean
  contentId: number
  action: 'approved' | 'rejected' | 'flagged' | 'duplicate'
  analysis: ContentAnalysis
  reason?: string
  duplicateOf?: number
}

export interface ProcessingConfig {
  autoApprovalThreshold: number
  autoRejectionThreshold: number
  requireManualReview: boolean
  enableDuplicateDetection: boolean
  enableSpamFilter: boolean
  enableInappropriateFilter: boolean
  enableUnrelatedFilter: boolean
  enableRequiredTermsCheck: boolean
}

export interface ContentValidation {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export interface ProcessingQueue {
  id: number
  content_queue_id: number
  priority: 'high' | 'medium' | 'low'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  attempts: number
  last_error?: string
  created_at: Date
  updated_at: Date
}

export class ContentProcessor {
  private static readonly DEFAULT_CONFIG: ProcessingConfig = {
    autoApprovalThreshold: 0.8,
    autoRejectionThreshold: 0.3,
    requireManualReview: false,
    enableDuplicateDetection: true,
    enableSpamFilter: true,
    enableInappropriateFilter: true,
    enableUnrelatedFilter: true,
    enableRequiredTermsCheck: true
  }

  private static readonly MAX_PROCESSING_ATTEMPTS = 3
  private static readonly BATCH_SIZE = 50

  async processContent(contentId: number, config?: Partial<ProcessingConfig>): Promise<ContentProcessingResult> {
    const processingConfig = { ...ContentProcessor.DEFAULT_CONFIG, ...config }
    const startTime = Date.now()
    
    try {
      // Log with new monitoring system
      await loggingService.logInfo('ContentProcessor', 'Starting content processing', {
        contentId,
        config: processingConfig
      })

      // Record processing start metric
      await metricsService.recordCustomMetric(
        'content_processing_started',
        1,
        'count',
        { contentId: contentId.toString() }
      )

      // Get content from database
      const content = await this.getContentById(contentId)
      if (!content) {
        throw new Error(`Content with ID ${contentId} not found`)
      }

      // Validate content format
      const validation = await this.validateContent(content)
      if (!validation.isValid) {
        return {
          success: false,
          contentId,
          action: 'rejected',
          analysis: this.createEmptyAnalysis(),
          reason: `Validation failed: ${validation.errors.join(', ')}`
        }
      }

      // Check for duplicates first
      let duplicateOf: number | undefined
      if (processingConfig.enableDuplicateDetection) {
        const duplicateCheck = await duplicateDetectionService.checkForDuplicates(content)
        if (duplicateCheck.isDuplicate && duplicateCheck.originalContentId) {
          duplicateOf = duplicateCheck.originalContentId
          
          // Mark as duplicate
          await this.saveContentAnalysis(contentId, {
            ...this.createEmptyAnalysis(),
            duplicate_of: duplicateOf
          })

          await logToDatabase(
            LogLevel.INFO,
            'Duplicate content detected',
            'ContentProcessor',
            { contentId, duplicateOf }
          )

          return {
            success: true,
            contentId,
            action: 'duplicate',
            analysis: this.createEmptyAnalysis(),
            reason: 'Duplicate content detected',
            duplicateOf
          }
        }
      }

      // Run content analysis
      const analysis = await filteringService.isValidHotdogContent(content)
      analysis.content_id = contentId

      // Apply configuration filters
      if (!processingConfig.enableSpamFilter) {
        analysis.is_spam = false
      }
      if (!processingConfig.enableInappropriateFilter) {
        analysis.is_inappropriate = false
      }
      if (!processingConfig.enableUnrelatedFilter) {
        analysis.is_unrelated = false
      }
      if (!processingConfig.enableRequiredTermsCheck) {
        analysis.is_valid_hotdog = true
      }

      // Determine action based on analysis and thresholds
      const action = this.determineAction(analysis, processingConfig)
      
      // Update content status based on action
      await this.updateContentStatus(contentId, action, analysis)
      
      // Save analysis to database
      await this.saveContentAnalysis(contentId, analysis)

      // Record successful processing metrics
      const duration = Date.now() - startTime
      await metricsService.recordContentProcessingMetric(
        'content_processing',
        duration,
        true,
        1,
        {
          action,
          confidence: analysis.confidence_score,
          isValidHotdog: analysis.is_valid_hotdog
        }
      )

      await loggingService.logInfo('ContentProcessor', 'Content processing completed', {
        contentId,
        action,
        confidence: analysis.confidence_score,
        isValidHotdog: analysis.is_valid_hotdog,
        duration
      })

      return {
        success: true,
        contentId,
        action,
        analysis,
        reason: this.getActionReason(action, analysis)
      }

    } catch (error) {
      // Record failed processing metrics
      const duration = Date.now() - startTime
      await metricsService.recordContentProcessingMetric(
        'content_processing',
        duration,
        false,
        0,
        {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      )

      await loggingService.logError('ContentProcessor', 'Content processing failed', {
        contentId,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error'
      }, error as Error)

      return {
        success: false,
        contentId,
        action: 'rejected',
        analysis: this.createEmptyAnalysis(),
        reason: `Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  async processBatch(contentIds: number[], config?: Partial<ProcessingConfig>): Promise<ContentProcessingResult[]> {
    const results: ContentProcessingResult[] = []
    const batchSize = Math.min(contentIds.length, ContentProcessor.BATCH_SIZE)
    const startTime = Date.now()
    
    await loggingService.logInfo('ContentProcessor', 'Starting batch processing', {
      totalItems: contentIds.length,
      batchSize
    })

    // Record batch processing start
    await metricsService.recordCustomMetric(
      'batch_processing_started',
      contentIds.length,
      'count'
    )

    for (let i = 0; i < contentIds.length; i += batchSize) {
      const batch = contentIds.slice(i, i + batchSize)
      const batchPromises = batch.map(id => this.processContent(id, config))
      
      try {
        const batchResults = await Promise.allSettled(batchPromises)
        
        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            results.push(result.value)
          } else {
            results.push({
              success: false,
              contentId: 0,
              action: 'rejected',
              analysis: this.createEmptyAnalysis(),
              reason: `Batch processing failed: ${result.reason}`
            })
          }
        }
      } catch (error) {
        await logToDatabase(
          LogLevel.ERROR,
          'Batch processing failed',
          'ContentProcessor',
          { 
            batchStart: i,
            batchSize: batch.length,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        )
      }
    }

    // Record batch processing completion metrics
    const duration = Date.now() - startTime
    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    await metricsService.recordContentProcessingMetric(
      'batch_processing',
      duration,
      failed === 0,
      results.length,
      {
        successful,
        failed,
        batchSize
      }
    )

    await loggingService.logInfo('ContentProcessor', 'Batch processing completed', {
      totalProcessed: results.length,
      successful,
      failed,
      duration
    })

    return results
  }

  async addToProcessingQueue(contentId: number, priority: 'high' | 'medium' | 'low' = 'medium'): Promise<void> {
    try {
      await db.query(
        `INSERT INTO processing_queue (content_queue_id, priority, status, attempts, created_at, updated_at)
         VALUES ($1, $2, 'pending', 0, NOW(), NOW())`,
        [contentId, priority]
      )

      await logToDatabase(
        LogLevel.INFO,
        'Content added to processing queue',
        'ContentProcessor',
        { contentId, priority }
      )
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'Failed to add content to processing queue',
        'ContentProcessor',
        { 
          contentId, 
          priority,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      )
      throw error
    }
  }

  async processQueue(maxItems: number = 100): Promise<ContentProcessingResult[]> {
    try {
      // Get pending items from queue
      const queueItems = await db.query<ProcessingQueue>(
        `SELECT * FROM processing_queue 
         WHERE status = 'pending' 
         AND attempts < $1
         ORDER BY 
           CASE priority 
             WHEN 'high' THEN 1 
             WHEN 'medium' THEN 2 
             WHEN 'low' THEN 3 
           END,
           created_at ASC
         LIMIT $2`,
        [ContentProcessor.MAX_PROCESSING_ATTEMPTS, maxItems]
      )

      if (queueItems.rows.length === 0) {
        return []
      }

      const results: ContentProcessingResult[] = []

      for (const item of queueItems.rows) {
        try {
          // Mark as processing
          await db.query(
            `UPDATE processing_queue 
             SET status = 'processing', attempts = attempts + 1, updated_at = NOW() 
             WHERE id = $1`,
            [item.id]
          )

          // Process content
          const result = await this.processContent(item.content_queue_id)
          results.push(result)

          // Mark as completed
          await db.query(
            `UPDATE processing_queue 
             SET status = 'completed', updated_at = NOW() 
             WHERE id = $1`,
            [item.id]
          )

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          
          // Mark as failed or retry
          const status = item.attempts + 1 >= ContentProcessor.MAX_PROCESSING_ATTEMPTS ? 'failed' : 'pending'
          
          await db.query(
            `UPDATE processing_queue 
             SET status = $1, last_error = $2, updated_at = NOW() 
             WHERE id = $3`,
            [status, errorMessage, item.id]
          )

          await logToDatabase(
            LogLevel.ERROR,
            'Queue item processing failed',
            'ContentProcessor',
            { 
              queueId: item.id,
              contentId: item.content_queue_id,
              attempt: item.attempts + 1,
              error: errorMessage
            }
          )
        }
      }

      return results
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'Queue processing failed',
        'ContentProcessor',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      )
      return []
    }
  }

  async getProcessingStats(): Promise<{
    queueSize: number
    pendingItems: number
    processingItems: number
    failedItems: number
    averageProcessingTime: number
  }> {
    try {
      const result = await db.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'pending') as pending,
          COUNT(*) FILTER (WHERE status = 'processing') as processing,
          COUNT(*) FILTER (WHERE status = 'failed') as failed,
          AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_processing_time
        FROM processing_queue
        WHERE created_at >= NOW() - INTERVAL '24 hours'
      `)

      const stats = result.rows[0]
      
      return {
        queueSize: parseInt(stats.total),
        pendingItems: parseInt(stats.pending),
        processingItems: parseInt(stats.processing),
        failedItems: parseInt(stats.failed),
        averageProcessingTime: parseFloat(stats.avg_processing_time) || 0
      }
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        'Failed to get processing stats',
        'ContentProcessor',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      )
      
      return {
        queueSize: 0,
        pendingItems: 0,
        processingItems: 0,
        failedItems: 0,
        averageProcessingTime: 0
      }
    }
  }

  async validateContent(content: any): Promise<ContentValidation> {
    const errors: string[] = []
    const warnings: string[] = []

    // Required fields
    if (!content.original_url) {
      errors.push('Original URL is required')
    }

    if (!content.content_text && !content.content_image_url && !content.content_video_url) {
      errors.push('At least one content field (text, image, or video) is required')
    }

    if (!content.source_platform) {
      errors.push('Source platform is required')
    }

    // URL validation
    if (content.original_url && !this.isValidUrl(content.original_url)) {
      errors.push('Invalid original URL format')
    }

    if (content.content_image_url && !this.isValidUrl(content.content_image_url)) {
      errors.push('Invalid image URL format')
    }

    if (content.content_video_url && !this.isValidUrl(content.content_video_url)) {
      errors.push('Invalid video URL format')
    }

    // Content validation
    if (content.content_text) {
      if (content.content_text.length < 10) {
        warnings.push('Content text is very short')
      }

      if (content.content_text.length > 5000) {
        warnings.push('Content text is very long')
      }
    }

    // Platform validation
    const validPlatforms = ['reddit', 'instagram', 'facebook', 'tiktok']
    if (content.source_platform && !validPlatforms.includes(content.source_platform)) {
      errors.push(`Invalid source platform: ${content.source_platform}`)
    }

    // Author validation
    if (content.original_author && content.original_author.length > 255) {
      warnings.push('Author name is very long')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  private async getContentById(id: number): Promise<any> {
    try {
      console.log(`ContentProcessor: Getting content by ID ${id}`)
      const result = await db.query(
        'SELECT * FROM content_queue WHERE id = $1',
        [id]
      )
      
      console.log(`ContentProcessor: Query result - found ${result.rows.length} rows`)
      if (result.rows.length > 0) {
        console.log(`ContentProcessor: Found content:`, {
          id: result.rows[0].id,
          content_text: result.rows[0].content_text?.substring(0, 50)
        })
      }
      
      return result.rows.length > 0 ? result.rows[0] : null
    } catch (error) {
      console.error(`ContentProcessor: Error getting content by ID ${id}:`, error)
      throw error
    }
  }

  private determineAction(analysis: ContentAnalysis, config: ProcessingConfig): 'approved' | 'rejected' | 'flagged' {
    // Immediate rejection criteria
    if (analysis.is_spam || analysis.is_inappropriate) {
      return 'rejected'
    }

    // Flag for manual review if unrelated
    if (analysis.is_unrelated) {
      return 'flagged'
    }

    // Check confidence thresholds
    if (analysis.confidence_score >= config.autoApprovalThreshold && analysis.is_valid_hotdog) {
      return 'approved'
    }

    if (analysis.confidence_score <= config.autoRejectionThreshold) {
      return 'rejected'
    }

    // Flag for manual review if in between thresholds or manual review is required
    if (config.requireManualReview) {
      return 'flagged'
    }

    // Default to flagged for manual review
    return 'flagged'
  }

  private async updateContentStatus(contentId: number, action: 'approved' | 'rejected' | 'flagged' | 'duplicate', analysis: ContentAnalysis): Promise<void> {
    let isApproved = false
    let isFlagged = false

    switch (action) {
      case 'approved':
        isApproved = true
        break
      case 'rejected':
        isApproved = false
        break
      case 'flagged':
        isFlagged = true
        break
      case 'duplicate':
        isApproved = false
        break
    }

    await db.query(
      `UPDATE content_queue 
       SET is_approved = $1, updated_at = NOW() 
       WHERE id = $2`,
      [isApproved, contentId]
    )

    // Update analysis with flagged status
    if (isFlagged) {
      analysis.is_flagged = true
      analysis.flagged_reason = this.getActionReason(action, analysis)
    }
  }

  private async saveContentAnalysis(contentId: number, analysis: ContentAnalysis): Promise<void> {
    await db.query(
      `INSERT INTO content_analysis (
        content_queue_id, is_spam, is_inappropriate, is_unrelated, is_valid_hotdog,
        confidence_score, flagged_patterns, processing_notes, similarity_hash,
        duplicate_of, filter_results, is_flagged, flagged_reason, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
      ON CONFLICT (content_queue_id) 
      DO UPDATE SET
        is_spam = EXCLUDED.is_spam,
        is_inappropriate = EXCLUDED.is_inappropriate,
        is_unrelated = EXCLUDED.is_unrelated,
        is_valid_hotdog = EXCLUDED.is_valid_hotdog,
        confidence_score = EXCLUDED.confidence_score,
        flagged_patterns = EXCLUDED.flagged_patterns,
        processing_notes = EXCLUDED.processing_notes,
        similarity_hash = EXCLUDED.similarity_hash,
        duplicate_of = EXCLUDED.duplicate_of,
        filter_results = EXCLUDED.filter_results,
        is_flagged = EXCLUDED.is_flagged,
        flagged_reason = EXCLUDED.flagged_reason,
        updated_at = NOW()`,
      [
        contentId,
        analysis.is_spam,
        analysis.is_inappropriate,
        analysis.is_unrelated,
        analysis.is_valid_hotdog,
        analysis.confidence_score,
        analysis.flagged_patterns,
        analysis.processing_notes,
        analysis.similarity_hash,
        analysis.duplicate_of,
        JSON.stringify({
          is_spam: analysis.is_spam,
          is_inappropriate: analysis.is_inappropriate,
          is_unrelated: analysis.is_unrelated,
          is_valid_hotdog: analysis.is_valid_hotdog,
          confidence_score: analysis.confidence_score
        }),
        analysis.is_flagged || false,
        analysis.flagged_reason || null
      ]
    )
  }

  private getActionReason(action: 'approved' | 'rejected' | 'flagged' | 'duplicate', analysis: ContentAnalysis): string {
    switch (action) {
      case 'approved':
        return 'Content passed all filters and meets quality standards'
      case 'rejected':
        if (analysis.is_spam) return 'Content detected as spam'
        if (analysis.is_inappropriate) return 'Content contains inappropriate material'
        if (analysis.confidence_score < 0.3) return 'Content has low confidence score'
        return 'Content failed quality checks'
      case 'flagged':
        if (analysis.is_unrelated) return 'Content may be unrelated to hotdogs'
        if (analysis.confidence_score < 0.8) return 'Content requires manual review due to low confidence'
        return 'Content flagged for manual review'
      case 'duplicate':
        return 'Content identified as duplicate'
      default:
        return 'Unknown action'
    }
  }

  private createEmptyAnalysis(): ContentAnalysis {
    return {
      is_spam: false,
      is_inappropriate: false,
      is_unrelated: false,
      is_valid_hotdog: false,
      confidence_score: 0,
      flagged_patterns: [],
      processing_notes: [],
      similarity_hash: ''
    }
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  generateContentHash(content: any): string {
    const hashInput = [
      content.content_text || '',
      content.content_image_url || '',
      content.content_video_url || '',
      content.original_url || ''
    ].join('|')

    return crypto.createHash('sha256').update(hashInput).digest('hex')
  }
}

export const contentProcessor = new ContentProcessor()