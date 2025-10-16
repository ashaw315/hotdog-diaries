import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { mockAdminDataIfCI } from '../../admin/route-utils'

/**
 * System Metrics Endpoint
 * 
 * Provides boringly reliable observable metrics for monitoring and alerting.
 * No PII, cheap to compute, designed for frequent polling.
 */

interface SystemMetrics {
  timestamp: string
  uptime_seconds: number
  queue_depth_by_platform: Record<string, number>
  posts_today: number
  scans_last_24h: number
  refill_count: number
  errors_last_1h: number
  health_status: 'healthy' | 'degraded' | 'unhealthy'
  version: string
  environment: string
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now()
  
  try {
    // Return mock data for CI/test environments
    const mock = mockAdminDataIfCI('system-metrics')
    if (mock) return NextResponse.json(mock)

    // Calculate uptime (approximate - based on process start)
    const uptimeSeconds = Math.floor(process.uptime())
    
    // Get current timestamp in ISO format
    const timestamp = new Date().toISOString()
    
    // Calculate time boundaries
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000)

    // Initialize metrics
    let queueDepthByPlatform: Record<string, number> = {}
    let postsToday = 0
    let scansLast24h = 0
    let refillCount = 0
    let errorsLastHour = 0
    let healthStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'

    try {
      await db.connect()

      // 1. Queue depth by platform (approved, unposted content)
      const queueDepthQuery = `
        SELECT 
          LOWER(source_platform) as platform,
          COUNT(*) as depth
        FROM content_queue 
        WHERE is_approved = true 
          AND COALESCE(is_posted, false) = false
          AND COALESCE(ingest_priority, 0) >= 0
        GROUP BY LOWER(source_platform)
        ORDER BY depth DESC
      `
      
      const queueResult = await db.query(queueDepthQuery)
      
      if (queueResult.rows) {
        for (const row of queueResult.rows) {
          queueDepthByPlatform[row.platform] = parseInt(row.depth) || 0
        }
      }

      // 2. Posts today (from posted_content table)
      const postsQuery = `
        SELECT COUNT(*) as count
        FROM posted_content 
        WHERE DATE(posted_at) = DATE($1)
      `
      
      const postsResult = await db.query(postsQuery, [todayStart.toISOString()])
      postsToday = parseInt(postsResult.rows?.[0]?.count) || 0

      // 3. Scans last 24h (approximate from content_queue created_at)
      const scansQuery = `
        SELECT COUNT(*) as count
        FROM content_queue 
        WHERE created_at >= $1
      `
      
      const scansResult = await db.query(scansQuery, [last24Hours.toISOString()])
      scansLast24h = parseInt(scansResult.rows?.[0]?.count) || 0

      // 4. Refill count (scheduled content for next 2 days)
      const refillQuery = `
        SELECT COUNT(*) as count
        FROM scheduled_posts 
        WHERE DATE(scheduled_post_time) IN (
          DATE($1), 
          DATE($2)
        )
      `
      
      const tomorrow = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
      const refillResult = await db.query(refillQuery, [
        todayStart.toISOString(),
        tomorrow.toISOString()
      ])
      refillCount = parseInt(refillResult.rows?.[0]?.count) || 0

      // 5. Errors last 1h (from system_logs if available, otherwise estimate)
      try {
        const errorsQuery = `
          SELECT COUNT(*) as count
          FROM system_logs 
          WHERE level IN ('error', 'fatal')
            AND created_at >= $1
        `
        
        const errorsResult = await db.query(errorsQuery, [lastHour.toISOString()])
        errorsLastHour = parseInt(errorsResult.rows?.[0]?.count) || 0
      } catch {
        // system_logs table might not exist, estimate based on other indicators
        errorsLastHour = 0
        
        // Check for obvious issues that would indicate errors
        const totalQueueDepth = Object.values(queueDepthByPlatform).reduce((sum, count) => sum + count, 0)
        
        if (totalQueueDepth < 10) {
          errorsLastHour = 1 // Low queue might indicate scanning issues
        }
        
        if (postsToday === 0 && now.getHours() > 12) {
          errorsLastHour += 1 // No posts by midday might indicate posting issues
        }
      }

      // Determine health status based on metrics
      const totalQueueDepth = Object.values(queueDepthByPlatform).reduce((sum, count) => sum + count, 0)
      
      if (errorsLastHour > 5 || totalQueueDepth < 5) {
        healthStatus = 'unhealthy'
      } else if (errorsLastHour > 0 || totalQueueDepth < 20 || refillCount < 8) {
        healthStatus = 'degraded'
      } else {
        healthStatus = 'healthy'
      }

    } catch (dbError) {
      console.error('Database error in metrics endpoint:', dbError)
      healthStatus = 'unhealthy'
      errorsLastHour = 1
    } finally {
      await db.disconnect()
    }

    // Construct response
    const metrics: SystemMetrics = {
      timestamp,
      uptime_seconds: uptimeSeconds,
      queue_depth_by_platform: queueDepthByPlatform,
      posts_today: postsToday,
      scans_last_24h: scansLast24h,
      refill_count: refillCount,
      errors_last_1h: errorsLastHour,
      health_status: healthStatus,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'unknown'
    }

    const responseTime = Date.now() - startTime

    return NextResponse.json(metrics, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Response-Time': `${responseTime}ms`,
        'X-Metrics-Timestamp': timestamp
      }
    })

  } catch (error) {
    console.error('System metrics error:', error)
    
    // Return minimal error metrics
    const errorMetrics: SystemMetrics = {
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.floor(process.uptime()),
      queue_depth_by_platform: {},
      posts_today: 0,
      scans_last_24h: 0,
      refill_count: 0,
      errors_last_1h: 1,
      health_status: 'unhealthy',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'unknown'
    }

    return NextResponse.json(errorMetrics, {
      status: 200, // Still return 200 to avoid cascading failures
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Metrics-Error': 'true'
      }
    })
  }
}