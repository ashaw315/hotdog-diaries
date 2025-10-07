import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { errorHandler } from '@/lib/utils/errorHandler'

export async function GET(request: NextRequest) {
  console.log('[AdminMetricsAPI] GET /api/admin/metrics request received')
  
  try {
    // Check database connection
    const healthCheck = await db.healthCheck()
    console.log('[AdminMetricsAPI] Database health:', healthCheck)
    
    if (!healthCheck.connected) {
      return NextResponse.json({
        error: 'Database connection failed',
        details: healthCheck.error
      }, { status: 500 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'dashboard' // dashboard, platforms, detailed

    console.log(`[AdminMetricsAPI] Metrics type requested: ${type}`)

    let metricsData: any = {}

    if (type === 'dashboard' || type === 'all') {
      // Dashboard overview metrics
      try {
        console.log('[AdminMetricsAPI] Fetching dashboard metrics...')
        
        // Platform distribution
        const platformQuery = `
          SELECT 
            source_platform,
            COUNT(*) as total_count,
            COUNT(CASE WHEN is_approved = true THEN 1 END) as approved_count,
            COUNT(CASE WHEN is_posted = true THEN 1 END) as posted_count,
            AVG(CASE WHEN confidence_score IS NOT NULL THEN confidence_score ELSE 0.5 END) as avg_confidence
          FROM content_queue
          GROUP BY source_platform
          ORDER BY total_count DESC
        `
        const platformResult = await db.query(platformQuery)
        
        const platforms = platformResult.rows.map(row => ({
          platform: row.source_platform,
          totalCount: parseInt(row.total_count),
          approvedCount: parseInt(row.approved_count),
          postedCount: parseInt(row.posted_count),
          avgConfidence: parseFloat(row.avg_confidence || '0.5')
        }))

        // Overall stats
        const statsQuery = `
          SELECT 
            COUNT(*) as total_content,
            COUNT(CASE WHEN is_approved = true THEN 1 END) as approved_content,
            COUNT(CASE WHEN is_posted = true THEN 1 END) as posted_content,
            COUNT(CASE WHEN is_approved = false AND is_posted = false THEN 1 END) as pending_content,
            COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END) as content_today
          FROM content_queue
        `
        const statsResult = await db.query(statsQuery)
        const stats = statsResult.rows[0]

        // Posted content metrics (check if posted_content table exists)
        let postingMetrics = { totalPosts: 0, postsToday: 0, lastPost: null }
        try {
          const postingQuery = `
            SELECT 
              COUNT(*) as total_posts,
              COUNT(CASE WHEN DATE(posted_at) = CURRENT_DATE THEN 1 END) as posts_today,
              MAX(posted_at) as last_post
            FROM posted_content
            WHERE posted_at IS NOT NULL
          `
          const postingResult = await db.query(postingQuery)
          if (postingResult.rows.length > 0) {
            postingMetrics = {
              totalPosts: parseInt(postingResult.rows[0].total_posts),
              postsToday: parseInt(postingResult.rows[0].posts_today),
              lastPost: postingResult.rows[0].last_post
            }
          }
        } catch (error) {
          console.warn('[AdminMetricsAPI] posted_content table not available, using defaults')
        }

        metricsData = {
          platforms,
          overview: {
            totalContent: parseInt(stats.total_content),
            approvedContent: parseInt(stats.approved_content),
            postedContent: parseInt(stats.posted_content),
            pendingContent: parseInt(stats.pending_content),
            contentToday: parseInt(stats.content_today)
          },
          posting: postingMetrics,
          lastUpdated: new Date().toISOString()
        }

        console.log(`[AdminMetricsAPI] Dashboard metrics collected: ${platforms.length} platforms`)

      } catch (error) {
        console.error('[AdminMetricsAPI] Error fetching dashboard metrics:', error)
        return NextResponse.json({
          error: 'Failed to fetch dashboard metrics',
          details: error.message
        }, { status: 500 })
      }
    }

    if (type === 'platforms' || type === 'all') {
      // Detailed platform metrics
      try {
        console.log('[AdminMetricsAPI] Fetching detailed platform metrics...')
        
        const detailedQuery = `
          SELECT 
            source_platform,
            content_type,
            COUNT(*) as count,
            AVG(CASE WHEN confidence_score IS NOT NULL THEN confidence_score ELSE 0.5 END) as avg_confidence,
            MAX(created_at) as latest_content
          FROM content_queue
          GROUP BY source_platform, content_type
          ORDER BY source_platform, count DESC
        `
        const detailedResult = await db.query(detailedQuery)
        
        const platformDetails = detailedResult.rows.map(row => ({
          platform: row.source_platform,
          contentType: row.content_type,
          count: parseInt(row.count),
          avgConfidence: parseFloat(row.avg_confidence || '0.5'),
          latestContent: row.latest_content
        }))

        if (type === 'platforms') {
          metricsData = { platformDetails }
        } else {
          metricsData.platformDetails = platformDetails
        }

        console.log(`[AdminMetricsAPI] Platform details collected: ${platformDetails.length} entries`)

      } catch (error) {
        console.error('[AdminMetricsAPI] Error fetching platform metrics:', error)
        return NextResponse.json({
          error: 'Failed to fetch platform metrics',
          details: error.message
        }, { status: 500 })
      }
    }

    console.log('[AdminMetricsAPI] Metrics collection completed successfully')
    
    return NextResponse.json({
      success: true,
      data: metricsData,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('[AdminMetricsAPI] Metrics API error:', error)
    return NextResponse.json({
      error: 'Failed to fetch metrics',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, value, unit, tags, metadata } = body

    if (!name || value === undefined || !unit) {
      return NextResponse.json(
        { error: 'Missing required fields: name, value, unit' },
        { status: 400 }
      )
    }

    // TODO: Implement metricsService or remove this endpoint
    console.log('[AdminMetricsAPI] Custom metric recording not yet implemented:', { name, value, unit, tags, metadata })
    
    return NextResponse.json({ 
      success: true, 
      message: 'Metric recording endpoint - implementation pending' 
    })
  } catch (error) {
    return errorHandler(error, 500, { operation: 'record_custom_metric' })
  }
}