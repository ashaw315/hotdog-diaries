import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Simple check: What's in the database by platform recently
    const platformStats = await db.query(`
      SELECT 
        cq.source_platform,
        COUNT(*) as total_content,
        COUNT(*) FILTER (WHERE cq.is_approved = true) as approved_content,
        ROUND(100.0 * COUNT(*) FILTER (WHERE cq.is_approved = true) / COUNT(*), 1) as approval_rate,
        COUNT(ca.id) as has_analysis,
        COUNT(*) FILTER (WHERE ca.is_valid_hotdog = true) as valid_hotdog_count
      FROM content_queue cq
      LEFT JOIN content_analysis ca ON ca.content_queue_id = cq.id
      WHERE cq.scraped_at > NOW() - INTERVAL '48 hours'
      GROUP BY cq.source_platform
      ORDER BY approval_rate DESC;
    `)

    // Sample of rejected content to see what we're getting
    const rejectedSamples = await db.query(`
      SELECT 
        cq.source_platform,
        cq.content_type,
        LEFT(cq.content_text, 100) as sample_text,
        cq.content_image_url IS NOT NULL as has_image,
        cq.scraped_at
      FROM content_queue cq
      WHERE cq.scraped_at > NOW() - INTERVAL '24 hours'
      AND cq.is_approved = false
      ORDER BY cq.source_platform, cq.scraped_at DESC
      LIMIT 15;
    `)

    // Check if content_analysis records are being created
    const analysisStatus = await db.query(`
      SELECT 
        'total_content' as type,
        COUNT(*) as count
      FROM content_queue cq
      WHERE cq.scraped_at > NOW() - INTERVAL '24 hours'
      
      UNION ALL
      
      SELECT 
        'has_analysis' as type,
        COUNT(ca.id) as count
      FROM content_queue cq
      LEFT JOIN content_analysis ca ON ca.content_queue_id = cq.id
      WHERE cq.scraped_at > NOW() - INTERVAL '24 hours'
      AND ca.id IS NOT NULL
      
      UNION ALL
      
      SELECT 
        'valid_hotdog' as type,
        COUNT(ca.id) as count
      FROM content_queue cq
      LEFT JOIN content_analysis ca ON ca.content_queue_id = cq.id
      WHERE cq.scraped_at > NOW() - INTERVAL '24 hours'
      AND ca.is_valid_hotdog = true
    `)

    // Check platform breakdown for zero-approval platforms
    const zeroPlatformSamples = await db.query(`
      SELECT 
        cq.source_platform,
        cq.content_type,
        LEFT(cq.content_text, 150) as sample_text,
        cq.original_url,
        ca.is_valid_hotdog,
        ca.confidence_score
      FROM content_queue cq
      LEFT JOIN content_analysis ca ON ca.content_queue_id = cq.id
      WHERE cq.source_platform IN ('imgur', 'tumblr', 'lemmy')
      AND cq.scraped_at > NOW() - INTERVAL '7 days'
      ORDER BY cq.source_platform, cq.scraped_at DESC
      LIMIT 10;
    `)

    return NextResponse.json({
      success: true,
      analysis: {
        platformStats: platformStats.rows,
        rejectedSamples: rejectedSamples.rows,
        analysisStatus: analysisStatus.rows,
        zeroPlatformSamples: zeroPlatformSamples.rows
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Approval analysis error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}