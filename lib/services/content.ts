import { ContentQueue, PostedContent, ContentType, SourcePlatform, LogLevel } from '@/types'
import { query, insert, update, deleteFrom } from '@/lib/db-query-builder'
import { generateContentHash } from '@/lib/utils/content-hash'
import { validateContent, CreateContentRequest } from '@/lib/validation/content'
import { logToDatabase } from '@/lib/db'
import { PostedContentHelper } from '@/lib/db-helpers'

export interface CreateContentData {
  content_text?: string
  content_image_url?: string
  content_video_url?: string
  content_type: ContentType
  source_platform: SourcePlatform
  original_url: string
  original_author?: string
  admin_notes?: string
  is_approved?: boolean
}

export interface ContentFilters {
  content_type?: ContentType
  source_platform?: SourcePlatform
  is_posted?: boolean
  is_approved?: boolean
  author?: string
}

export interface PaginationOptions {
  page: number
  limit: number
  orderBy?: string
  orderDirection?: 'ASC' | 'DESC'
}

export interface ContentListResult<T> {
  items: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }
}

export class ContentService {
  /**
   * Create new content and add to queue
   */
  static async createContent(data: CreateContentData): Promise<ContentQueue> {
    // Validate input data
    const validation = validateContent(data as CreateContentRequest)
    if (!validation.isValid) {
      const errorMessage = validation.errors.map(e => `${e.field}: ${e.message}`).join(', ')
      throw new Error(`Validation failed: ${errorMessage}`)
    }

    // Generate content hash for duplicate detection
    const contentHash = generateContentHash({
      content_text: data.content_text,
      content_image_url: data.content_image_url,
      content_video_url: data.content_video_url,
      original_url: data.original_url
    })

    // Check for duplicate content
    const existingContent = await this.findByHash(contentHash)
    if (existingContent) {
      throw new Error(`Duplicate content detected. Existing content ID: ${existingContent.id}`)
    }

    try {
      // Insert new content
      const newContent = await insert('content_queue')
        .values({
          content_text: data.content_text,
          content_image_url: data.content_image_url,
          content_video_url: data.content_video_url,
          content_type: data.content_type,
          source_platform: data.source_platform,
          original_url: data.original_url,
          original_author: data.original_author,
          scraped_at: new Date(),
          content_hash: contentHash,
          is_posted: false,
          is_approved: data.is_approved ?? false,
          admin_notes: data.admin_notes,
          created_at: new Date(),
          updated_at: new Date()
        })
        .first<ContentQueue>()

      if (!newContent) {
        throw new Error('Failed to create content')
      }

      // Log content creation
      await logToDatabase(
        LogLevel.INFO,
        `Content created: ${newContent.id}`,
        'content-service',
        {
          contentId: newContent.id,
          contentType: newContent.content_type,
          sourcePlatform: newContent.source_platform,
          isApproved: newContent.is_approved
        }
      )

      return newContent
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        `Failed to create content: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'content-service',
        { data, error: error instanceof Error ? error.stack : error }
      )
      throw error
    }
  }

  /**
   * Get queued (unposted) content with pagination and filters
   */
  static async getQueuedContent(
    pagination: PaginationOptions,
    filters: ContentFilters = {}
  ): Promise<ContentListResult<ContentQueue>> {
    const { page, limit, orderBy = 'scraped_at', orderDirection = 'DESC' } = pagination
    const offset = (page - 1) * limit

    let queryBuilder = query('content_queue')
      .select(['*'])
      .where('is_posted', '=', false)

    // Apply filters
    if (filters.content_type) {
      queryBuilder = queryBuilder.where('content_type', '=', filters.content_type)
    }
    if (filters.source_platform) {
      queryBuilder = queryBuilder.where('source_platform', '=', filters.source_platform)
    }
    if (filters.is_approved !== undefined) {
      queryBuilder = queryBuilder.where('is_approved', '=', filters.is_approved)
    }
    if (filters.author) {
      queryBuilder = queryBuilder.where('original_author', 'ILIKE', `%${filters.author}%`)
    }

    // Get total count for pagination
    const totalCount = await queryBuilder.count()

    // Get paginated results
    const items = await queryBuilder
      .orderBy(orderBy, orderDirection)
      .limit(limit)
      .offset(offset)
      .execute<ContentQueue>()

    const totalPages = Math.ceil(totalCount / limit)

    return {
      items: items.rows,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    }
  }

  /**
   * Get posted content with pagination and filters
   */
  static async getPostedContent(
    pagination: PaginationOptions,
    filters: ContentFilters = {}
  ): Promise<ContentListResult<any>> {
    const { page, limit, orderBy = 'posted_at', orderDirection = 'DESC' } = pagination
    const offset = (page - 1) * limit

    let queryBuilder = query('posted_content_with_details')
      .select(['*'])

    // Apply filters
    if (filters.content_type) {
      queryBuilder = queryBuilder.where('content_type', '=', filters.content_type)
    }
    if (filters.source_platform) {
      queryBuilder = queryBuilder.where('source_platform', '=', filters.source_platform)
    }
    if (filters.author) {
      queryBuilder = queryBuilder.where('original_author', 'ILIKE', `%${filters.author}%`)
    }

    // Get total count for pagination
    const totalCount = await queryBuilder.count()

    // Get paginated results
    const items = await queryBuilder
      .orderBy(orderBy, orderDirection)
      .limit(limit)
      .offset(offset)
      .execute()

    const totalPages = Math.ceil(totalCount / limit)

    return {
      items: items.rows,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    }
  }

  /**
   * Mark content as posted and create posted_content record
   */
  static async markAsPosted(contentId: number, scheduledTime?: Date): Promise<{
    contentQueue: ContentQueue
    postedContent: PostedContent
  }> {
    try {
      // Verify content exists and is not already posted
      const content = await this.findById(contentId)
      if (!content) {
        throw new Error(`Content with ID ${contentId} not found`)
      }
      if (content.is_posted) {
        throw new Error(`Content with ID ${contentId} is already posted`)
      }

      // Get next post order for today
      const postOrder = await PostedContentHelper.getNextPostOrder()

      // Use transaction to ensure consistency
      const updatedContent = await update('content_queue')
        .set({ 
          is_posted: true, 
          posted_at: new Date(),
          updated_at: new Date()
        })
        .where('id', '=', contentId)
        .first<ContentQueue>()

      if (!updatedContent) {
        throw new Error('Failed to update content as posted')
      }

      // Create posted content record
      const postedContent = await insert('posted_content')
        .values({
          content_queue_id: contentId,
          posted_at: new Date(),
          scheduled_time: scheduledTime,
          post_order: postOrder,
          created_at: new Date(),
          updated_at: new Date()
        })
        .first<PostedContent>()

      if (!postedContent) {
        throw new Error('Failed to create posted content record')
      }

      // Log posting
      await logToDatabase(
        LogLevel.INFO,
        `Content marked as posted: ${contentId}`,
        'content-service',
        {
          contentId,
          postOrder,
          scheduledTime
        }
      )

      return {
        contentQueue: updatedContent,
        postedContent
      }
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        `Failed to mark content as posted: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'content-service',
        { contentId, error: error instanceof Error ? error.stack : error }
      )
      throw error
    }
  }

  /**
   * Delete content from queue
   */
  static async deleteContent(contentId: number): Promise<ContentQueue> {
    try {
      // Check if content exists
      const content = await this.findById(contentId)
      if (!content) {
        throw new Error(`Content with ID ${contentId} not found`)
      }

      // Check if content is already posted
      if (content.is_posted) {
        throw new Error(`Cannot delete posted content with ID ${contentId}`)
      }

      // Delete the content
      const deletedContent = await deleteFrom('content_queue')
        .where('id', '=', contentId)
        .first<ContentQueue>()

      if (!deletedContent) {
        throw new Error('Failed to delete content')
      }

      // Log deletion
      await logToDatabase(
        LogLevel.INFO,
        `Content deleted: ${contentId}`,
        'content-service',
        {
          contentId,
          contentType: deletedContent.content_type,
          sourcePlatform: deletedContent.source_platform
        }
      )

      return deletedContent
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        `Failed to delete content: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'content-service',
        { contentId, error: error instanceof Error ? error.stack : error }
      )
      throw error
    }
  }

  /**
   * Update content in queue
   */
  static async updateContent(
    contentId: number, 
    updates: Partial<CreateContentData>
  ): Promise<ContentQueue> {
    try {
      // Check if content exists
      const content = await this.findById(contentId)
      if (!content) {
        throw new Error(`Content with ID ${contentId} not found`)
      }

      // Check if content is already posted
      if (content.is_posted) {
        throw new Error(`Cannot update posted content with ID ${contentId}`)
      }

      // Regenerate hash if content fields changed
      const updateData: Record<string, any> = { ...updates, updated_at: new Date() }
      
      if (updates.content_text !== undefined || 
          updates.content_image_url !== undefined || 
          updates.content_video_url !== undefined || 
          updates.original_url !== undefined) {
        
        const newHash = generateContentHash({
          content_text: updates.content_text ?? content.content_text,
          content_image_url: updates.content_image_url ?? content.content_image_url,
          content_video_url: updates.content_video_url ?? content.content_video_url,
          original_url: updates.original_url ?? content.original_url
        })

        // Check for duplicate with new hash
        const existingContent = await this.findByHash(newHash)
        if (existingContent && existingContent.id !== contentId) {
          throw new Error(`Duplicate content detected. Existing content ID: ${existingContent.id}`)
        }

        updateData.content_hash = newHash
      }

      // Update the content
      const updatedContent = await update('content_queue')
        .set(updateData)
        .where('id', '=', contentId)
        .first<ContentQueue>()

      if (!updatedContent) {
        throw new Error('Failed to update content')
      }

      // Log update
      await logToDatabase(
        LogLevel.INFO,
        `Content updated: ${contentId}`,
        'content-service',
        {
          contentId,
          updates: Object.keys(updates)
        }
      )

      return updatedContent
    } catch (error) {
      await logToDatabase(
        LogLevel.ERROR,
        `Failed to update content: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'content-service',
        { contentId, updates, error: error instanceof Error ? error.stack : error }
      )
      throw error
    }
  }

  /**
   * Find content by ID
   */
  static async findById(id: number): Promise<ContentQueue | null> {
    return await query('content_queue')
      .where('id', '=', id)
      .first<ContentQueue>()
  }

  /**
   * Find content by hash (for duplicate detection)
   */
  static async findByHash(hash: string): Promise<ContentQueue | null> {
    return await query('content_queue')
      .where('content_hash', '=', hash)
      .first<ContentQueue>()
  }

  /**
   * Get content statistics
   */
  static async getStats(): Promise<{
    totalContent: number
    queuedContent: number
    approvedContent: number
    postedContent: number
    todaysPosts: number
  }> {
    const [total, queued, approved, posted, today] = await Promise.all([
      query('content_queue').count(),
      query('content_queue').where('is_posted', '=', false).count(),
      query('content_queue').where('is_approved', '=', true).count(),
      query('content_queue').where('is_posted', '=', true).count(),
      query('posted_content').where('posted_at', '>=', new Date(new Date().setHours(0, 0, 0, 0))).count()
    ])

    return {
      totalContent: total,
      queuedContent: queued,
      approvedContent: approved,
      postedContent: posted,
      todaysPosts: today
    }
  }

  /**
   * Approve content for posting
   */
  static async approveContent(contentId: number, adminNotes?: string): Promise<ContentQueue> {
    return await this.updateContent(contentId, {
      is_approved: true,
      admin_notes: adminNotes
    })
  }

  /**
   * Reject content (mark as not approved)
   */
  static async rejectContent(contentId: number, adminNotes: string): Promise<ContentQueue> {
    return await this.updateContent(contentId, {
      is_approved: false,
      admin_notes: adminNotes
    })
  }
}