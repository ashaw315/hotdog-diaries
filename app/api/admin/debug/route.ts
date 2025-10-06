import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  console.log('[AdminDebugAPI] Debug endpoint called')
  
  const debugData: any = {
    timestamp: new Date().toISOString(),
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV,
      database: {
        hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
        hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
        hasPostgresUrl: Boolean(process.env.POSTGRES_URL),
        databaseUrlType: process.env.DATABASE_URL?.includes('supabase') ? 'supabase' :
                        process.env.DATABASE_URL?.includes('postgres') ? 'postgres' : 
                        process.env.DATABASE_URL?.includes('sqlite') ? 'sqlite' : 'unknown'
      }
    },
    dbConnection: null,
    tables: [],
    rowCounts: {},
    metrics: {},
    errors: []
  }

  try {
    // Test database connection
    console.log('[AdminDebugAPI] Testing database connection...')
    const healthCheck = await db.healthCheck()
    debugData.dbConnection = {
      connected: healthCheck.connected,
      latency: healthCheck.latency,
      error: healthCheck.error
    }

    if (healthCheck.connected) {
      console.log('[AdminDebugAPI] Database connected, checking tables...')
      
      // Check which tables exist
      try {
        const tableCheckQueries = [
          { name: 'content_queue', query: 'SELECT COUNT(*) as count FROM content_queue' },
          { name: 'posted_content', query: 'SELECT COUNT(*) as count FROM posted_content' },
          { name: 'admin_users', query: 'SELECT COUNT(*) as count FROM admin_users' },
          { name: 'system_logs', query: 'SELECT COUNT(*) as count FROM system_logs' }
        ]

        for (const table of tableCheckQueries) {
          try {
            console.log(`[AdminDebugAPI] Checking table: ${table.name}`)
            const result = await db.query(table.query)
            debugData.tables.push(table.name)
            debugData.rowCounts[table.name] = parseInt(result.rows[0]?.count || '0')
          } catch (error) {
            console.error(`[AdminDebugAPI] Table ${table.name} check failed:`, error.message)
            debugData.errors.push(`Table ${table.name}: ${error.message}`)
          }
        }

        // Get content metrics if content_queue exists
        if (debugData.tables.includes('content_queue')) {
          console.log('[AdminDebugAPI] Fetching content metrics...')
          try {
            // Platform distribution
            const platformQuery = `
              SELECT source_platform, COUNT(*) as count
              FROM content_queue
              GROUP BY source_platform
              ORDER BY count DESC
            `
            const platformResult = await db.query(platformQuery)
            debugData.metrics.platforms = platformResult.rows.reduce((acc, row) => {
              acc[row.source_platform] = parseInt(row.count)
              return acc
            }, {})

            // Content status distribution
            const statusQuery = `
              SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN is_approved = true THEN 1 END) as approved,
                COUNT(CASE WHEN is_posted = true THEN 1 END) as posted,
                COUNT(CASE WHEN is_approved = false AND is_posted = false THEN 1 END) as pending
              FROM content_queue
            `
            const statusResult = await db.query(statusQuery)
            if (statusResult.rows.length > 0) {
              const row = statusResult.rows[0]
              debugData.metrics.contentStatus = {
                total: parseInt(row.total),
                approved: parseInt(row.approved),
                posted: parseInt(row.posted),
                pending: parseInt(row.pending)
              }
            }

            // Recent activity
            const recentQuery = `
              SELECT created_at, source_platform, content_type
              FROM content_queue
              ORDER BY created_at DESC
              LIMIT 5
            `
            const recentResult = await db.query(recentQuery)
            debugData.metrics.recentContent = recentResult.rows

          } catch (error) {
            console.error('[AdminDebugAPI] Metrics collection failed:', error)
            debugData.errors.push(`Metrics collection: ${error.message}`)
          }
        }

        // Check posted content if table exists
        if (debugData.tables.includes('posted_content')) {
          console.log('[AdminDebugAPI] Checking posted content...')
          try {
            const postedQuery = `
              SELECT 
                COUNT(*) as total_posts,
                MAX(posted_at) as last_post,
                COUNT(CASE WHEN DATE(posted_at) = CURRENT_DATE THEN 1 END) as posts_today
              FROM posted_content
              WHERE posted_at IS NOT NULL
            `
            const postedResult = await db.query(postedQuery)
            if (postedResult.rows.length > 0) {
              const row = postedResult.rows[0]
              debugData.metrics.posting = {
                totalPosts: parseInt(row.total_posts),
                lastPost: row.last_post,
                postsToday: parseInt(row.posts_today)
              }
            }
          } catch (error) {
            console.error('[AdminDebugAPI] Posted content check failed:', error)
            debugData.errors.push(`Posted content check: ${error.message}`)
          }
        }

      } catch (error) {
        console.error('[AdminDebugAPI] Table checking failed:', error)
        debugData.errors.push(`Table checking: ${error.message}`)
      }
    } else {
      debugData.errors.push('Database connection failed')
    }

  } catch (error) {
    console.error('[AdminDebugAPI] Debug endpoint error:', error)
    debugData.errors.push(`Debug endpoint: ${error.message}`)
  }

  // Calculate health score
  let healthScore = 0
  if (debugData.dbConnection?.connected) healthScore += 30
  if (debugData.tables.length >= 3) healthScore += 30
  if (debugData.rowCounts.content_queue > 0) healthScore += 20
  if (debugData.errors.length === 0) healthScore += 20

  debugData.healthScore = healthScore
  debugData.status = healthScore >= 80 ? 'healthy' : healthScore >= 50 ? 'warning' : 'critical'

  console.log(`[AdminDebugAPI] Debug complete. Health score: ${healthScore}/100`)

  return NextResponse.json(debugData, { 
    status: 200,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  })
}