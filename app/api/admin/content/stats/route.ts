import { NextRequest, NextResponse } from 'next/server'
import { 
  validateRequestMethod,
  createSuccessResponse,
  createApiError,
  handleApiError
} from '@/lib/api-middleware'
import { db } from '@/lib/db'

async function getContentStatsHandler(request: NextRequest): Promise<NextResponse> {
  validateRequestMethod(request, ['GET'])

  try {
    // Get overall content counts
    const contentCountsResult = await db.query(`
      SELECT 
        COUNT(*) as total_content,
        COUNT(CASE WHEN is_approved = FALSE AND is_posted = FALSE AND (admin_notes IS NULL OR admin_notes NOT LIKE '%Rejected%') THEN 1 END) as pending_content,
        COUNT(CASE WHEN is_approved = TRUE AND is_posted = FALSE THEN 1 END) as approved_content,
        COUNT(CASE WHEN is_approved = FALSE AND is_posted = FALSE AND admin_notes LIKE '%Rejected%' THEN 1 END) as rejected_content,
        COUNT(CASE WHEN is_posted = TRUE THEN 1 END) as posted_content
      FROM content_queue
    `)

    const counts = contentCountsResult.rows[0]

    // Get content by platform
    const platformStatsResult = await db.query(`
      SELECT 
        source_platform,
        COUNT(*) as count
      FROM content_queue
      GROUP BY source_platform
      ORDER BY count DESC
    `)

    const contentByPlatform = platformStatsResult.rows.reduce((acc, row) => {
      acc[row.source_platform] = parseInt(row.count)
      return acc
    }, {})

    // Get content by type
    const typeStatsResult = await db.query(`
      SELECT 
        content_type,
        COUNT(*) as count
      FROM content_queue
      GROUP BY content_type
      ORDER BY count DESC
    `)

    const contentByType = typeStatsResult.rows.reduce((acc, row) => {
      acc[row.content_type] = parseInt(row.count)
      return acc
    }, {})

    // Get recent activity (simulated - you can extend this based on your logging system)
    const recentActivityResult = await db.query(`
      SELECT 
        id,
        CASE 
          WHEN is_posted = TRUE THEN 'Content Posted'
          WHEN is_approved = TRUE THEN 'Content Approved' 
          ELSE 'Content Added'
        END as action,
        id as content_id,
        scraped_at as timestamp,
        CONCAT('Content from ', source_platform, ' - ', LEFT(content_text, 50), '...') as details
      FROM content_queue
      WHERE scraped_at >= NOW() - INTERVAL '7 days'
      ORDER BY scraped_at DESC
      LIMIT 20
    `)

    const recentActivity = recentActivityResult.rows.map(row => ({
      id: row.id.toString(),
      action: row.action,
      content_id: row.content_id,
      timestamp: row.timestamp,
      details: row.details
    }))

    const statsData = {
      totalContent: parseInt(counts.total_content) || 0,
      pendingContent: parseInt(counts.pending_content) || 0,
      approvedContent: parseInt(counts.approved_content) || 0,
      rejectedContent: parseInt(counts.rejected_content) || 0,
      postedContent: parseInt(counts.posted_content) || 0,
      contentByPlatform,
      contentByType,
      recentActivity
    }

    return createSuccessResponse(statsData, 'Content statistics retrieved successfully')

  } catch (error) {
    console.error('Failed to get content statistics:', error)
    throw createApiError('Failed to retrieve content statistics', 500, 'CONTENT_STATS_ERROR')
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    return await getContentStatsHandler(request)
  } catch (error) {
    return await handleApiError(error, request, '/api/admin/content/stats')
  }
}