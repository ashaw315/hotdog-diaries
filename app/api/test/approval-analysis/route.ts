import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // See WHY content is being rejected
    const rejectedSamples = await db.query(`
      SELECT 
        cq.source_platform,
        cq.content_type,
        cq.is_approved,
        ca.confidence_score,
        LEFT(cq.content_text, 100) as sample_text,
        cq.content_image_url IS NOT NULL as has_image,
        cq.content_video_url IS NOT NULL as has_video,
        cq.scraped_at
      FROM content_queue cq
      LEFT JOIN content_analysis ca ON ca.content_queue_id = cq.id
      WHERE cq.scraped_at > NOW() - INTERVAL '24 hours'
      AND cq.is_approved = false
      ORDER BY cq.source_platform, cq.scraped_at DESC
      LIMIT 30;
    `)

    // Check confidence scores by platform
    const confidenceByPlatform = await db.query(`
      SELECT 
        cq.source_platform,
        COUNT(*) as total,
        ROUND(AVG(ca.confidence_score), 3) as avg_confidence,
        MIN(ca.confidence_score) as min_confidence,
        MAX(ca.confidence_score) as max_confidence,
        COUNT(*) FILTER (WHERE ca.confidence_score > 0.65) as should_be_approved_65,
        COUNT(*) FILTER (WHERE ca.confidence_score > 0.5) as should_be_approved_50,
        COUNT(*) FILTER (WHERE cq.is_approved = true) as actually_approved,
        ROUND(100.0 * COUNT(*) FILTER (WHERE cq.is_approved = true) / COUNT(*), 1) as approval_rate,
        COUNT(ca.id) as has_analysis
      FROM content_queue cq
      LEFT JOIN content_analysis ca ON ca.content_queue_id = cq.id
      WHERE cq.scraped_at > NOW() - INTERVAL '48 hours'
      GROUP BY cq.source_platform
      ORDER BY approval_rate DESC;
    `)

    // Specific check for 0% platforms
    const zeroPlatforms = await db.query(`
      SELECT 
        cq.source_platform,
        cq.content_type,
        cq.confidence_score,
        ca.is_valid_hotdog,
        LEFT(cq.content_text, 200) as sample,
        cq.original_url,
        cq.scraped_at
      FROM content_queue cq
      LEFT JOIN content_analysis ca ON ca.content_queue_id = cq.id
      WHERE cq.source_platform IN ('imgur', 'tumblr', 'lemmy')
      AND cq.scraped_at > NOW() - INTERVAL '7 days'
      ORDER BY cq.source_platform, cq.scraped_at DESC
      LIMIT 20;
    `)

    // Check if analysis is being created
    const analysisStatus = await db.query(`
      SELECT 
        cq.source_platform,
        COUNT(*) as total_content,
        COUNT(ca.id) as has_analysis,
        COUNT(ca.id) FILTER (WHERE ca.is_valid_hotdog = true) as valid_hotdog,
        COUNT(ca.id) FILTER (WHERE ca.confidence_score > 0.5) as high_confidence
      FROM content_queue cq
      LEFT JOIN content_analysis ca ON ca.content_queue_id = cq.id
      WHERE cq.scraped_at > NOW() - INTERVAL '48 hours'
      GROUP BY cq.source_platform
      ORDER BY cq.source_platform;
    `)

    // Check content processor approval logic
    const approvalMismatch = await db.query(`
      SELECT 
        cq.source_platform,
        ca.confidence_score,
        cq.is_approved,
        ca.is_valid_hotdog,
        CASE 
          WHEN ca.confidence_score >= 0.65 AND cq.is_approved = false THEN 'Should be approved but rejected'
          WHEN ca.confidence_score < 0.3 AND cq.is_approved = true THEN 'Should be rejected but approved'
          ELSE 'Correct'
        END as approval_status
      FROM content_queue cq
      LEFT JOIN content_analysis ca ON ca.content_queue_id = cq.id
      WHERE cq.scraped_at > NOW() - INTERVAL '48 hours'
      AND ca.confidence_score IS NOT NULL
      AND (
        (ca.confidence_score >= 0.65 AND cq.is_approved = false) OR
        (ca.confidence_score < 0.3 AND cq.is_approved = true)
      )
      ORDER BY cq.source_platform, ca.confidence_score DESC
      LIMIT 20;
    `)

    return NextResponse.json({
      success: true,
      analysis: {
        rejectedSamples: rejectedSamples.rows,
        confidenceByPlatform: confidenceByPlatform.rows,
        zeroPlatforms: zeroPlatforms.rows,
        analysisStatus: analysisStatus.rows,
        approvalMismatch: approvalMismatch.rows
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