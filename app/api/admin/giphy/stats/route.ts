import { NextRequest, NextResponse } from 'next/server'
import { giphyScanningService } from '@/lib/services/giphy-scanning'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Authentication is handled by middleware
    // User info is available in headers if needed: x-user-id, x-username

    const apiKey = process.env.GIPHY_API_KEY
    const mode = apiKey ? 'api' : 'mock'

    // Get scan configuration
    const config = await giphyScanningService.getScanConfig()

    // Get content statistics from database
    const contentStatsQuery = `
      SELECT 
        COUNT(*) as total_content,
        COUNT(CASE WHEN is_approved = true THEN 1 END) as approved_content,
        COUNT(CASE WHEN is_approved = false THEN 1 END) as rejected_content,
        COUNT(CASE WHEN is_approved IS NULL THEN 1 END) as pending_content,
        COUNT(CASE WHEN is_posted = true THEN 1 END) as posted_content,
        AVG(confidence_score) as avg_confidence_score,
        MAX(created_at) as last_content_added
      FROM content_queue 
      WHERE source_platform = 'giphy'
    `

    const contentStatsResult = await db.query(contentStatsQuery)
    const contentStats = contentStatsResult.rows[0]

    // Get recent activity (last 7 days)
    const recentActivityQuery = `
      SELECT 
        created_at::date as date,
        COUNT(*) as content_count,
        COUNT(CASE WHEN is_approved = true THEN 1 END) as approved_count
      FROM content_queue 
      WHERE source_platform = 'giphy' 
        AND created_at > NOW() - INTERVAL '$1 days'
      GROUP BY created_at::date
      ORDER BY date DESC
    `

    const recentActivityResult = await db.query(recentActivityQuery)
    const recentActivity = recentActivityResult.rows

    // Get popular search terms from content metadata
    const searchTermsQuery = `
      SELECT 
        UNNEST(string_to_array(content_metadata ->> 'searchTerms', ',')) as term,
        COUNT(*) as usage_count
      FROM content_queue 
      WHERE source_platform = 'giphy'
        AND content_metadata ->> 'searchTerms' IS NOT NULL
      GROUP BY term
      ORDER BY usage_count DESC
      LIMIT 10
    `

    const searchTermsResult = await db.query(searchTermsQuery).catch(() => ({ rows: [] }))
    const popularSearchTerms = searchTermsResult.rows

    const stats = {
      platform: 'giphy',
      timestamp: new Date().toISOString(),
      mode,
      configuration: {
        isEnabled: config.isEnabled,
        scanInterval: config.scanInterval,
        maxGifsPerScan: config.maxGifsPerScan,
        searchTermsCount: config.searchTerms.length,
        lastScanTime: config.lastScanTime,
        rateLimits: {
          hourlyUsed: config.hourlyRequestCount || 0,
          dailyUsed: config.dailyRequestCount || 0,
          hourlyLimit: 42,
          dailyLimit: 1000,
          lastReset: config.lastRequestReset
        }
      },
      content: {
        total: parseInt(contentStats.total_content || '0'),
        approved: parseInt(contentStats.approved_content || '0'),
        rejected: parseInt(contentStats.rejected_content || '0'),
        pending: parseInt(contentStats.pending_content || '0'),
        posted: parseInt(contentStats.posted_content || '0'),
        averageConfidenceScore: parseFloat(contentStats.avg_confidence_score || '0'),
        lastContentAdded: contentStats.last_content_added
      },
      performance: {
        approvalRate: contentStats.total_content > 0 
          ? Math.round((contentStats.approved_content / contentStats.total_content) * 100) 
          : 0,
        rejectionRate: contentStats.total_content > 0 
          ? Math.round((contentStats.rejected_content / contentStats.total_content) * 100) 
          : 0,
        postingRate: contentStats.approved_content > 0 
          ? Math.round((contentStats.posted_content / contentStats.approved_content) * 100) 
          : 0
      },
      recentActivity: recentActivity.map(row => ({
        date: row.date,
        contentAdded: parseInt(row.content_count),
        contentApproved: parseInt(row.approved_count)
      })),
      popularSearchTerms: popularSearchTerms.map(row => ({
        term: row.term?.trim(),
        usageCount: parseInt(row.usage_count)
      })).filter(item => item.term && item.term.length > 0)
    }

    return NextResponse.json({
      success: true,
      data: stats,
      message: `Giphy statistics retrieved successfully (${mode} mode)`
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        message: 'Failed to retrieve Giphy statistics'
      },
      { status: 500 }
    )
  }
}