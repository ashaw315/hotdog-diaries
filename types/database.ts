/**
 * Database Type Definitions
 * 
 * This file contains all type definitions for database queries and responses
 */

// ========================================
// Database Query Results
// ========================================

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[]
  rowCount: number
  command: string
  oid: number
  fields: QueryField[]
}

export interface QueryField {
  name: string
  tableID: number
  columnID: number
  dataTypeID: number
  dataTypeSize: number
  dataTypeModifier: number
  format: string
}

// ========================================
// Content Queue Types
// ========================================

export interface ContentQueueRow {
  id: number
  content_text: string | null
  content_image_url: string | null
  content_video_url: string | null
  content_type: 'text' | 'image' | 'video' | 'mixed' | 'gif'
  source_platform: 'reddit' | 'youtube' | 'giphy' | 'pixabay' | 'imgur' | 'tumblr' | 'bluesky' | 'lemmy' | 'mastodon' | 'emergency'
  original_url: string
  original_author: string | null
  scraped_at: string
  content_hash: string
  is_posted: boolean
  posted_at: string | null
  is_approved: boolean
  admin_notes: string | null
  created_at: string
  updated_at: string
  confidence_score?: number
  is_rejected?: boolean
  content_status?: 'pending' | 'approved' | 'rejected' | 'posted' | 'discovered'
}

export interface PostedContentRow {
  id: number
  content_queue_id: number
  posted_at: string
  scheduled_time: string | null
  post_order: number
  created_at: string
  updated_at: string
}

// ========================================
// Admin & Authentication Types
// ========================================

export interface AdminUserRow {
  id: number
  username: string
  password_hash: string
  email?: string
  full_name?: string
  is_active: boolean
  last_login: string | null
  created_at: string
  updated_at: string
}

// ========================================
// System Logs Types
// ========================================

export interface SystemLogRow {
  id: number
  log_level: 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  message: string
  component: string
  metadata: Record<string, unknown> | null
  created_at: string
}

// ========================================
// Aggregation Query Results
// ========================================

export interface CountQueryResult {
  count: string | number
  total?: string | number
}

export interface PlatformStatsResult {
  source_platform: string
  content_type: string
  count: string | number
}

export interface ContentStatsResult {
  total_content: string | number
  approved_content: string | number
  ready_to_post: string | number
  posted_content: string | number
  days_of_content?: string | number
}

// ========================================
// Health Check Types
// ========================================

export interface DatabaseHealthCheck {
  connected: boolean
  latency?: number
  error?: string
}

// ========================================
// Database Configuration Types
// ========================================

export interface SqliteDatabaseConfig {
  type: 'sqlite'
  path: string
}

export interface PostgresDatabaseConfig {
  type: 'postgres'
  host: string
  port: number
  database: string
  user?: string
  password?: string
}

export interface VercelPostgresDatabaseConfig {
  type: 'vercel-postgres'
  url: string
  prismaUrl?: string
}

export type DatabaseConfig = SqliteDatabaseConfig | PostgresDatabaseConfig | VercelPostgresDatabaseConfig

// ========================================
// Generic Database Types
// ========================================

export type DatabaseRow = ContentQueueRow | PostedContentRow | AdminUserRow | SystemLogRow

export type WhereClause = Record<string, string | number | boolean | null>

export interface PaginationOptions {
  limit: number
  offset: number
}

export interface OrderByOptions {
  column: string
  direction: 'ASC' | 'DESC'
}

// ========================================
// Type Guards
// ========================================

export function isContentQueueRow(row: unknown): row is ContentQueueRow {
  return (
    typeof row === 'object' &&
    row !== null &&
    'id' in row &&
    'content_type' in row &&
    'source_platform' in row
  )
}

export function isAdminUserRow(row: unknown): row is AdminUserRow {
  return (
    typeof row === 'object' &&
    row !== null &&
    'id' in row &&
    'username' in row &&
    'password_hash' in row
  )
}

export function isQueryResult<T>(result: unknown): result is QueryResult<T> {
  return (
    typeof result === 'object' &&
    result !== null &&
    'rows' in result &&
    'rowCount' in result &&
    Array.isArray((result as QueryResult<T>).rows)
  )
}

// ========================================
// Query Builder Helper Types
// ========================================

export interface SelectQuery {
  select: string[]
  from: string
  where?: WhereClause
  orderBy?: OrderByOptions[]
  limit?: number
  offset?: number
  joins?: JoinClause[]
}

export interface JoinClause {
  type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL'
  table: string
  on: string
}