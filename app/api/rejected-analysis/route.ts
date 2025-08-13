import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Get rejected items
    const rejectedItems = await db.query(`
      SELECT 
        cq.id,
        cq.source_platform,
        cq.content_text,
        cq.is_approved,
        ca.confidence_score,
        ca.is_valid_hotdog,
        ca.is_spam,
        ca.is_inappropriate,
        ca.is_unrelated,
        ca.processing_notes,
        cq.content_status,
        cq.scraped_at
      FROM content_queue cq
      LEFT JOIN content_analysis ca ON ca.content_queue_id = cq.id
      WHERE cq.is_approved = 0 OR ca.confidence_score < 0.6
      ORDER BY cq.scraped_at DESC
      LIMIT 15
    `)

    // Get platform statistics
    const platformStats = await db.query(`
      SELECT 
        cq.source_platform,
        COUNT(*) as total,
        SUM(CASE WHEN cq.is_approved = 0 THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN cq.is_approved = 1 THEN 1 ELSE 0 END) as approved,
        AVG(ca.confidence_score) as avg_confidence,
        ROUND(100.0 * SUM(CASE WHEN cq.is_approved = 0 THEN 1 ELSE 0 END) / COUNT(*), 1) as rejection_rate
      FROM content_queue cq
      LEFT JOIN content_analysis ca ON ca.content_queue_id = cq.id
      GROUP BY cq.source_platform
      ORDER BY rejection_rate DESC
    `)

    return NextResponse.json({
      success: true,
      rejectedItems: rejectedItems.rows,
      platformStats: platformStats.rows,
      message: `Found ${rejectedItems.rows.length} rejected items across ${platformStats.rows.length} platforms`
    })
    
  } catch (error) {
    console.error('Error fetching rejected content analysis:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}