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
    const processingStats = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE is_approved = FALSE AND is_posted = FALSE) as pending,
        COUNT(*) FILTER (WHERE is_approved = TRUE AND is_posted = FALSE) as approved,
        COUNT(*) FILTER (WHERE is_posted = TRUE) as posted,
        COUNT(*) FILTER (WHERE admin_notes LIKE '%rejected%') as rejected,
        AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_processing_time
      FROM content_queue
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `)

    const recentActivity = await db.query(`
      SELECT 
        CASE 
          WHEN is_posted = TRUE THEN 'posted'
          WHEN is_approved = TRUE THEN 'approved'
          WHEN admin_notes LIKE '%rejected%' THEN 'rejected'
          ELSE 'pending'
        END as status,
        COUNT(*) as count,
        DATE_TRUNC('hour', updated_at) as hour
      FROM content_queue
      WHERE updated_at > NOW() - INTERVAL '24 hours'
      GROUP BY 
        CASE 
          WHEN is_posted = TRUE THEN 'posted'
          WHEN is_approved = TRUE THEN 'approved'
          WHEN admin_notes LIKE '%rejected%' THEN 'rejected'
          ELSE 'pending'
        END, 
        DATE_TRUNC('hour', updated_at)
      ORDER BY hour DESC
    `)

    const stats = processingStats.rows[0] || {
      pending: 0,
      approved: 0,
      posted: 0,
      rejected: 0,
      avg_processing_time: 0
    }

    return NextResponse.json({
      stats: {
        pending: parseInt(stats.pending) || 0,
        approved: parseInt(stats.approved) || 0,
        posted: parseInt(stats.posted) || 0,
        rejected: parseInt(stats.rejected) || 0,
        avg_processing_time: parseFloat(stats.avg_processing_time) || 0
      },
      recentActivity: recentActivity.rows
    })
  } catch (error) {
    console.error('Error fetching processing stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch processing stats' },
      { status: 500 }
    )
  }
}