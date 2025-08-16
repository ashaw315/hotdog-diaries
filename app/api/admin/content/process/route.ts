import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ContentProcessor } from '@/lib/services/content-processor'

export async function POST(request: NextRequest) {
  try {
    const contentProcessor = new ContentProcessor()
    
    const { batchSize = 10, contentId } = await request.json()
    
    if (contentId) {
      const result = await contentProcessor.processContent(contentId)
      
      return NextResponse.json({
        success: true,
        contentId,
        status: result.status,
        analysisResult: result.analysisResult
      })
    } else {
      const result = await contentProcessor.processBatch(batchSize)
      
      return NextResponse.json({
        success: true,
        processed: result.processed,
        approved: result.approved,
        rejected: result.rejected,
        flagged: result.flagged,
        errors: result.errors
      })
    }
  } catch (error) {
    console.error('Error processing content:', error)
    return NextResponse.json(
      { error: 'Failed to process content' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {

    // Get current processing statistics using SQLite syntax
    const processingStatsQuery = `
      SELECT 
        SUM(CASE WHEN content_status = 'discovered' OR content_status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN content_status = 'processing' THEN 1 ELSE 0 END) as processing,
        SUM(CASE WHEN is_approved = 1 THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN content_status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN ca.is_flagged = 1 THEN 1 ELSE 0 END) as flagged
      FROM content_queue cq
      LEFT JOIN content_analysis ca ON cq.id = ca.content_queue_id
    `

    const processingStatsResult = await db.query(processingStatsQuery)
    const stats = processingStatsResult.rows[0] || {}

    // Calculate average processing time using SQLite syntax
    const avgProcessingTimeQuery = `
      SELECT AVG((strftime('%s', cq.updated_at) - strftime('%s', cq.created_at))) as avg_processing_seconds
      FROM content_queue cq
      JOIN content_analysis ca ON cq.id = ca.content_queue_id
      WHERE cq.updated_at IS NOT NULL 
      AND cq.created_at IS NOT NULL
      AND cq.updated_at > cq.created_at
    `

    const avgProcessingTimeResult = await db.query(avgProcessingTimeQuery)
    const avgProcessingSeconds = parseFloat(avgProcessingTimeResult.rows[0]?.avg_processing_seconds) || 34.5

    // Get simplified recent activity (last 6 hours with status counts)
    const recentActivityQuery = `
      SELECT 
        CASE 
          WHEN cq.is_approved = 1 THEN 'approved'
          WHEN cq.content_status = 'rejected' THEN 'rejected'
          WHEN ca.is_flagged = 1 THEN 'flagged'
          ELSE 'pending'
        END as status,
        COUNT(*) as count,
        datetime(cq.updated_at, 'start of hour') as hour
      FROM content_queue cq
      LEFT JOIN content_analysis ca ON cq.id = ca.content_queue_id
      WHERE cq.updated_at >= datetime('now', '-24 hours')
      GROUP BY 
        datetime(cq.updated_at, 'start of hour'),
        CASE 
          WHEN cq.is_approved = 1 THEN 'approved'
          WHEN cq.content_status = 'rejected' THEN 'rejected'
          WHEN ca.is_flagged = 1 THEN 'flagged'
          ELSE 'pending'
        END
      ORDER BY hour DESC
      LIMIT 6
    `

    const recentActivityResult = await db.query(recentActivityQuery)
    const recentActivity = recentActivityResult.rows.map((row: any) => ({
      status: row.status,
      count: parseInt(row.count) || 0,
      hour: row.hour
    }))

    const processingStats = {
      stats: {
        pending: parseInt(stats.pending) || 0,
        processing: parseInt(stats.processing) || 0,
        approved: parseInt(stats.approved) || 0,
        rejected: parseInt(stats.rejected) || 0,
        flagged: parseInt(stats.flagged) || 0,
        avg_processing_time: avgProcessingSeconds
      },
      recentActivity: recentActivity
    }

    return NextResponse.json(processingStats, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    console.error('Error fetching processing stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch processing stats' },
      { status: 500 }
    )
  }
}