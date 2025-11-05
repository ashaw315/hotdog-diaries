import { db } from './db'
import {
  ContentQueue,
  PostedContent,
  AdminUser,
  SystemLog,
  ContentType,
  SourcePlatform,
  LogLevel
} from '@/types'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

export class ContentQueueHelper {
  static async create(data: {
    content_text?: string
    content_image_url?: string
    content_video_url?: string
    content_type: ContentType
    source_platform: SourcePlatform
    original_url: string
    original_author?: string
    scraped_at?: Date
    is_approved?: boolean
    admin_notes?: string
  }): Promise<ContentQueue> {
    const contentHash = this.generateContentHash(
      data.content_text,
      data.content_image_url,
      data.content_video_url,
      data.original_url
    )

    // Use Supabase client for INSERT to avoid raw SQL fallback issues
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: inserted, error } = await supabase
      .from('content_queue')
      .insert({
        content_text: data.content_text || null,
        content_image_url: data.content_image_url || null,
        content_video_url: data.content_video_url || null,
        content_type: data.content_type,
        source_platform: data.source_platform,
        original_url: data.original_url,
        original_author: data.original_author || null,
        scraped_at: (data.scraped_at || new Date()).toISOString(),
        content_hash: contentHash,
        is_approved: data.is_approved || false,
        admin_notes: data.admin_notes || null
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to insert content: ${error.message}`)
    }

    return inserted as ContentQueue
  }

  static async findById(id: number): Promise<ContentQueue | null> {
    const result = await db.query<ContentQueue>(
      'SELECT * FROM content_queue WHERE id = $1',
      [id]
    )
    return result.rows[0] || null
  }

  static async findByHash(hash: string): Promise<ContentQueue | null> {
    const result = await db.query<ContentQueue>(
      'SELECT * FROM content_queue WHERE content_hash = $1',
      [hash]
    )
    return result.rows[0] || null
  }

  static async findUnposted(limit: number = 10): Promise<ContentQueue[]> {
    const result = await db.query<ContentQueue>(`
      SELECT * FROM content_queue 
      WHERE is_posted = FALSE AND is_approved = TRUE
      ORDER BY scraped_at ASC
      LIMIT $1
    `, [limit])
    return result.rows
  }

  static async markAsPosted(id: number): Promise<ContentQueue> {
    const result = await db.query<ContentQueue>(`
      UPDATE content_queue 
      SET is_posted = TRUE, posted_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id])

    if (result.rows.length === 0) {
      throw new Error(`Content queue item with id ${id} not found`)
    }

    return result.rows[0]
  }

  static async approve(id: number, adminNotes?: string): Promise<ContentQueue> {
    const result = await db.query<ContentQueue>(`
      UPDATE content_queue 
      SET is_approved = TRUE, admin_notes = $2
      WHERE id = $1
      RETURNING *
    `, [id, adminNotes])

    if (result.rows.length === 0) {
      throw new Error(`Content queue item with id ${id} not found`)
    }

    return result.rows[0]
  }

  static async reject(id: number, adminNotes: string): Promise<ContentQueue> {
    const result = await db.query<ContentQueue>(`
      UPDATE content_queue 
      SET is_approved = FALSE, admin_notes = $2
      WHERE id = $1
      RETURNING *
    `, [id, adminNotes])

    if (result.rows.length === 0) {
      throw new Error(`Content queue item with id ${id} not found`)
    }

    return result.rows[0]
  }

  static generateContentHash(
    contentText?: string,
    imageUrl?: string,
    videoUrl?: string,
    originalUrl?: string
  ): string {
    const combined = [contentText, imageUrl, videoUrl, originalUrl]
      .filter(Boolean)
      .join('|')
    return crypto.createHash('sha256').update(combined).digest('hex')
  }

  static async isDuplicate(
    contentText?: string,
    imageUrl?: string,
    videoUrl?: string,
    originalUrl?: string
  ): Promise<boolean> {
    const hash = this.generateContentHash(contentText, imageUrl, videoUrl, originalUrl)
    const existing = await this.findByHash(hash)
    return !!existing
  }
}

export class PostedContentHelper {
  static async create(data: {
    content_queue_id: number
    scheduled_time?: Date
    post_order: number
  }): Promise<PostedContent> {
    const result = await db.query<PostedContent>(`
      INSERT INTO posted_content (content_queue_id, posted_at, scheduled_time, post_order)
      VALUES ($1, NOW(), $2, $3)
      RETURNING *
    `, [data.content_queue_id, data.scheduled_time, data.post_order])

    return result.rows[0]
  }

  static async findById(id: number): Promise<PostedContent | null> {
    const result = await db.query<PostedContent>(
      'SELECT * FROM posted_content WHERE id = $1',
      [id]
    )
    return result.rows[0] || null
  }

  static async findWithContent(limit: number = 10, offset: number = 0): Promise<any[]> {
    const result = await db.query(`
      SELECT * FROM posted_content_with_details
      ORDER BY posted_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset])
    return result.rows
  }

  static async getPostsForToday(): Promise<PostedContent[]> {
    const result = await db.query<PostedContent>(`
      SELECT * FROM posted_content 
      WHERE DATE(posted_at) = CURRENT_DATE
      ORDER BY post_order ASC
    `)
    return result.rows
  }

  static async getNextPostOrder(): Promise<number> {
    const result = await db.query(`
      SELECT COALESCE(MAX(post_order), 0) + 1 as next_order
      FROM posted_content 
      WHERE DATE(posted_at) = CURRENT_DATE
    `)
    return result.rows[0]?.next_order || 1
  }
}

export class AdminUserHelper {
  static async create(username: string, password: string): Promise<AdminUser> {
    const existingUser = await this.findByUsername(username)
    if (existingUser) {
      throw new Error('Username already exists')
    }

    const passwordHash = await bcrypt.hash(password, 10)
    
    const result = await db.query<AdminUser>(`
      INSERT INTO admin_users (username, password_hash)
      VALUES ($1, $2)
      RETURNING *
    `, [username, passwordHash])

    return result.rows[0]
  }

  static async findById(id: number): Promise<AdminUser | null> {
    const result = await db.query<AdminUser>(
      'SELECT * FROM admin_users WHERE id = $1',
      [id]
    )
    return result.rows[0] || null
  }

  static async findByUsername(username: string): Promise<AdminUser | null> {
    const result = await db.query<AdminUser>(
      'SELECT * FROM admin_users WHERE username = $1',
      [username]
    )
    return result.rows[0] || null
  }

  static async validatePassword(username: string, password: string): Promise<AdminUser | null> {
    const user = await this.findByUsername(username)
    if (!user) {
      return null
    }

    const isValid = await bcrypt.compare(password, user.password_hash)
    if (!isValid) {
      return null
    }

    // Update last login
    await db.query(
      'UPDATE admin_users SET last_login = NOW() WHERE id = $1',
      [user.id]
    )

    return user
  }

  static async updatePassword(id: number, newPassword: string): Promise<AdminUser> {
    const passwordHash = await bcrypt.hash(newPassword, 10)
    
    const result = await db.query<AdminUser>(`
      UPDATE admin_users 
      SET password_hash = $2
      WHERE id = $1
      RETURNING *
    `, [id, passwordHash])

    if (result.rows.length === 0) {
      throw new Error(`Admin user with id ${id} not found`)
    }

    return result.rows[0]
  }
}

export class SystemLogHelper {
  static async create(
    level: LogLevel,
    message: string,
    component: string,
    metadata?: Record<string, any>
  ): Promise<SystemLog> {
    const result = await db.query<SystemLog>(`
      INSERT INTO system_logs (log_level, message, component, metadata)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [level, message, component, metadata ? JSON.stringify(metadata) : null])

    return result.rows[0]
  }

  static async findByLevel(level: LogLevel, limit: number = 100): Promise<SystemLog[]> {
    const result = await db.query<SystemLog>(`
      SELECT * FROM system_logs 
      WHERE log_level = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `, [level, limit])
    return result.rows
  }

  static async findByComponent(component: string, limit: number = 100): Promise<SystemLog[]> {
    const result = await db.query<SystemLog>(`
      SELECT * FROM system_logs 
      WHERE component = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `, [component, limit])
    return result.rows
  }

  static async findRecent(limit: number = 50): Promise<SystemLog[]> {
    const result = await db.query<SystemLog>(`
      SELECT * FROM system_logs 
      ORDER BY created_at DESC 
      LIMIT $1
    `, [limit])
    return result.rows
  }

  static async cleanup(olderThanDays: number = 30): Promise<number> {
    const result = await db.query(`
      DELETE FROM system_logs 
      WHERE created_at < NOW() - INTERVAL '${olderThanDays} days'
    `)
    return result.rowCount || 0
  }
}

export async function getSystemStats(): Promise<{
  totalContent: number
  approvedContent: number
  postedContent: number
  todaysPosts: number
  pendingApproval: number
}> {
  const results = await Promise.all([
    db.query('SELECT COUNT(*) as count FROM content_queue'),
    db.query('SELECT COUNT(*) as count FROM content_queue WHERE is_approved = TRUE'),
    db.query('SELECT COUNT(*) as count FROM content_queue WHERE is_posted = TRUE'),
    db.query('SELECT COUNT(*) as count FROM posted_content WHERE DATE(posted_at) = CURRENT_DATE'),
    db.query('SELECT COUNT(*) as count FROM content_queue WHERE is_approved = FALSE AND is_posted = FALSE')
  ])

  return {
    totalContent: parseInt(results[0].rows[0]?.count || '0'),
    approvedContent: parseInt(results[1].rows[0]?.count || '0'),
    postedContent: parseInt(results[2].rows[0]?.count || '0'),
    todaysPosts: parseInt(results[3].rows[0]?.count || '0'),
    pendingApproval: parseInt(results[4].rows[0]?.count || '0')
  }
}