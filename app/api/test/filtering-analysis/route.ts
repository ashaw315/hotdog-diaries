import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Platform approval statistics
    const platformStats = await db.query(`
      SELECT 
        source_platform as platform,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_approved = true) as approved,
        ROUND(AVG(CASE WHEN is_approved THEN 1.0 ELSE 0.0 END) * 100, 1) as approval_rate_pct,
        COUNT(*) FILTER (WHERE content_type = 'video') as videos,
        COUNT(*) FILTER (WHERE content_type = 'image') as images,
        COUNT(*) FILTER (WHERE content_type = 'text') as text_posts
      FROM content_queue 
      GROUP BY source_platform 
      ORDER BY total DESC;
    `)
    
    // Content analysis patterns
    const analysisPatterns = await db.query(`
      SELECT 
        ca.is_spam,
        ca.is_inappropriate,
        ca.is_unrelated,
        ca.is_valid_hotdog,
        ROUND(ca.confidence_score::numeric, 2) as confidence_score,
        COUNT(*) as count,
        ROUND(AVG(CASE WHEN cq.is_approved THEN 1.0 ELSE 0.0 END) * 100, 1) as approval_rate
      FROM content_analysis ca 
      JOIN content_queue cq ON ca.content_queue_id = cq.id 
      GROUP BY ca.is_spam, ca.is_inappropriate, ca.is_unrelated, ca.is_valid_hotdog, ROUND(ca.confidence_score::numeric, 2)
      ORDER BY count DESC 
      LIMIT 20;
    `)
    
    // Rejection reason breakdown
    const rejectionBreakdown = await db.query(`
      SELECT 'duplicates' as rejection_type, COUNT(*) as count 
      FROM content_analysis WHERE duplicate_of IS NOT NULL
      UNION ALL
      SELECT 'low_confidence' as rejection_type, COUNT(*) as count 
      FROM content_analysis WHERE confidence_score < 0.3
      UNION ALL
      SELECT 'unrelated' as rejection_type, COUNT(*) as count 
      FROM content_analysis WHERE is_unrelated = true
      UNION ALL
      SELECT 'spam' as rejection_type, COUNT(*) as count 
      FROM content_analysis WHERE is_spam = true
      UNION ALL
      SELECT 'inappropriate' as rejection_type, COUNT(*) as count 
      FROM content_analysis WHERE is_inappropriate = true
      ORDER BY count DESC;
    `)
    
    // Sample of rejected content with reasons
    const rejectedSamples = await db.query(`
      SELECT 
        cq.content_text,
        cq.source_platform,
        ca.is_spam,
        ca.is_inappropriate,
        ca.is_unrelated,
        ca.is_valid_hotdog,
        ca.confidence_score,
        ca.processing_notes,
        ca.duplicate_of
      FROM content_queue cq
      JOIN content_analysis ca ON ca.content_queue_id = cq.id
      WHERE cq.is_approved = false
      ORDER BY cq.created_at DESC
      LIMIT 10;
    `)
    
    // Confidence score distribution
    const confidenceDistribution = await db.query(`
      SELECT 
        CASE 
          WHEN confidence_score >= 0.8 THEN '0.8-1.0 (High)'
          WHEN confidence_score >= 0.6 THEN '0.6-0.8 (Medium-High)'
          WHEN confidence_score >= 0.4 THEN '0.4-0.6 (Medium)'
          WHEN confidence_score >= 0.2 THEN '0.2-0.4 (Low)'
          ELSE '0.0-0.2 (Very Low)'
        END as confidence_range,
        COUNT(*) as count,
        ROUND(AVG(CASE WHEN cq.is_approved THEN 1.0 ELSE 0.0 END) * 100, 1) as approval_rate
      FROM content_analysis ca
      JOIN content_queue cq ON ca.content_queue_id = cq.id
      GROUP BY 
        CASE 
          WHEN confidence_score >= 0.8 THEN '0.8-1.0 (High)'
          WHEN confidence_score >= 0.6 THEN '0.6-0.8 (Medium-High)'
          WHEN confidence_score >= 0.4 THEN '0.4-0.6 (Medium)'
          WHEN confidence_score >= 0.2 THEN '0.2-0.4 (Low)'
          ELSE '0.0-0.2 (Very Low)'
        END
      ORDER BY MIN(confidence_score) DESC;
    `)

    return NextResponse.json({
      success: true,
      data: {
        platformStats: platformStats.rows,
        analysisPatterns: analysisPatterns.rows,
        rejectionBreakdown: rejectionBreakdown.rows,
        rejectedSamples: rejectedSamples.rows,
        confidenceDistribution: confidenceDistribution.rows
      }
    })

  } catch (error) {
    console.error('Filtering analysis error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}