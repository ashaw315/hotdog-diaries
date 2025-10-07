/**
 * Database Schema Utilities
 * Provides dynamic schema detection and column verification for production compatibility
 */

import { db } from '@/lib/db'

// Cache for column information to avoid repeated queries
const schemaCache = new Map<string, string[]>()
const cacheExpiry = 5 * 60 * 1000 // 5 minutes

interface CacheEntry {
  columns: string[]
  timestamp: number
}

const schemaDetailedCache = new Map<string, CacheEntry>()

/**
 * Verify columns that exist in a specific table
 * Uses information_schema for PostgreSQL, pragma for SQLite
 */
export async function verifyTableColumns(table: string): Promise<string[]> {
  try {
    // Check cache first
    const cached = schemaDetailedCache.get(table)
    if (cached && Date.now() - cached.timestamp < cacheExpiry) {
      console.log(`[SchemaUtils] Using cached columns for ${table}`)
      return cached.columns
    }

    console.log(`[SchemaUtils] Fetching columns for table: ${table}`)
    
    // Detect database type
    const isPostgres = process.env.DATABASE_URL?.includes('postgres') || 
                       process.env.POSTGRES_URL || 
                       process.env.NODE_ENV === 'production'
    
    let columns: string[] = []
    
    if (isPostgres) {
      // PostgreSQL query
      const result = await db.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = $1
        AND table_schema = 'public'
        ORDER BY ordinal_position
      `, [table])
      
      columns = result.rows.map((row: any) => row.column_name)
      console.log(`[SchemaUtils] PostgreSQL columns for ${table}:`, columns)
    } else {
      // SQLite fallback
      const result = await db.query(`PRAGMA table_info(${table})`)
      columns = result.rows.map((row: any) => row.name)
      console.log(`[SchemaUtils] SQLite columns for ${table}:`, columns)
    }
    
    // Cache the results
    schemaDetailedCache.set(table, {
      columns,
      timestamp: Date.now()
    })
    
    return columns
  } catch (error) {
    console.error(`[SchemaUtils] Error fetching columns for ${table}:`, error)
    return []
  }
}

/**
 * Check if a specific column exists in a table
 */
export async function columnExists(table: string, column: string): Promise<boolean> {
  const columns = await verifyTableColumns(table)
  return columns.includes(column)
}

/**
 * Build a safe SELECT clause that handles missing columns
 */
export async function buildSafeSelectClause(
  table: string,
  desiredColumns: string[],
  tableAlias?: string
): Promise<string> {
  const existingColumns = await verifyTableColumns(table)
  const prefix = tableAlias ? `${tableAlias}.` : ''
  
  const safeColumns = desiredColumns.map(col => {
    // Handle aliased columns (e.g., 'created_at AS creation_date')
    const baseCol = col.split(' AS ')[0].trim()
    const alias = col.includes(' AS ') ? col.split(' AS ')[1].trim() : null
    
    if (existingColumns.includes(baseCol)) {
      return alias ? `${prefix}${baseCol} AS ${alias}` : `${prefix}${baseCol}`
    } else {
      // Return NULL for missing columns
      console.warn(`[SchemaUtils] Column '${baseCol}' missing in ${table}, using NULL fallback`)
      return alias ? `NULL AS ${alias}` : `NULL AS ${baseCol}`
    }
  })
  
  return safeColumns.join(', ')
}

/**
 * Get all required columns for content_queue with safe fallbacks
 */
export async function getContentQueueColumns(): Promise<{
  existing: string[]
  missing: string[]
  safeSelect: string
}> {
  const requiredColumns = [
    'id',
    'content_text',
    'content_type',
    'source_platform',
    'original_url',
    'original_author',
    'content_image_url',
    'content_video_url',
    'scraped_at',
    'is_posted',
    'is_approved',
    'admin_notes',
    'created_at',
    'updated_at',
    'confidence_score',
    'content_hash',
    'is_rejected'
  ]
  
  const existing = await verifyTableColumns('content_queue')
  const missing = requiredColumns.filter(col => !existing.includes(col))
  const safeSelect = await buildSafeSelectClause('content_queue', requiredColumns, 'cq')
  
  return { existing, missing, safeSelect }
}

/**
 * Verify all admin tables have minimum required structure
 */
export async function verifyAdminSchema(): Promise<{
  valid: boolean
  issues: string[]
  recommendations: string[]
}> {
  const issues: string[] = []
  const recommendations: string[] = []
  
  // Required tables and their critical columns
  const requiredSchema = {
    content_queue: ['id', 'content_text', 'content_type', 'source_platform', 'is_posted', 'is_approved'],
    posted_content: ['id', 'content_queue_id', 'posted_at'],
    admin_users: ['id', 'username', 'password_hash'],
  }
  
  for (const [table, requiredCols] of Object.entries(requiredSchema)) {
    const columns = await verifyTableColumns(table)
    
    if (columns.length === 0) {
      issues.push(`Table '${table}' does not exist`)
      recommendations.push(`CREATE TABLE ${table} ...`)
      continue
    }
    
    for (const col of requiredCols) {
      if (!columns.includes(col)) {
        issues.push(`Column '${col}' missing in table '${table}'`)
        recommendations.push(`ALTER TABLE ${table} ADD COLUMN ${col} ...`)
      }
    }
  }
  
  return {
    valid: issues.length === 0,
    issues,
    recommendations
  }
}

/**
 * Clear schema cache (useful after migrations)
 */
export function clearSchemaCache(): void {
  schemaDetailedCache.clear()
  console.log('[SchemaUtils] Schema cache cleared')
}

/**
 * Get safe WHERE clause conditions based on existing columns
 */
export async function buildSafeWhereClause(
  table: string,
  conditions: Record<string, any>,
  tableAlias?: string
): Promise<{ clause: string; params: any[] }> {
  const columns = await verifyTableColumns(table)
  const prefix = tableAlias ? `${tableAlias}.` : ''
  const validConditions: string[] = []
  const params: any[] = []
  let paramIndex = 1
  
  for (const [col, value] of Object.entries(conditions)) {
    if (columns.includes(col)) {
      if (value === null) {
        validConditions.push(`${prefix}${col} IS NULL`)
      } else if (value === undefined) {
        // Skip undefined values
        continue
      } else {
        validConditions.push(`${prefix}${col} = $${paramIndex}`)
        params.push(value)
        paramIndex++
      }
    } else {
      console.warn(`[SchemaUtils] Skipping WHERE condition for missing column: ${col}`)
    }
  }
  
  return {
    clause: validConditions.length > 0 ? `WHERE ${validConditions.join(' AND ')}` : '',
    params
  }
}