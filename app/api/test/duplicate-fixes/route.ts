import { NextRequest, NextResponse } from 'next/server'
import { contentProcessor } from '@/lib/services/content-processor'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { action = 'test', hours = 24 } = await request.json().catch(() => ({}))
    
    if (action === 'reprocess') {
      // Reprocess recent content with new duplicate detection logic
      const recentContent = await db.query(`
        SELECT cq.id FROM content_queue cq
        LEFT JOIN content_analysis ca ON cq.id = ca.content_queue_id
        WHERE cq.scraped_at > NOW() - INTERVAL '${hours} hours'
        AND (cq.is_approved = false OR ca.confidence_score = 0 OR ca.confidence_score IS NULL)
        ORDER BY cq.scraped_at DESC
        LIMIT 50
      `)
      
      let processed = 0
      let approved = 0
      let errors = 0
      
      for (const item of recentContent.rows) {
        try {
          const result = await contentProcessor.processContent(item.id)
          processed++
          if (result.action === 'approved') {
            approved++
          }
        } catch (error) {
          errors++
          console.error(`Error processing content ${item.id}:`, error)
        }
      }
      
      return NextResponse.json({
        success: true,
        message: 'Reprocessing completed',
        stats: {
          totalProcessed: processed,
          approved,
          errors,
          approvalRate: processed > 0 ? Math.round((approved / processed) * 100) : 0
        }
      })
    }
    
    // Test mode - check current status
    const stats = await db.query(`
      SELECT 
        source_platform,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_approved = true) as approved,
        COUNT(*) FILTER (WHERE scraped_at > NOW() - INTERVAL '${hours} hours') as recent,
        ROUND(AVG(CASE WHEN is_approved THEN 1.0 ELSE 0.0 END) * 100, 1) as approval_rate,
        COUNT(*) FILTER (WHERE duplicate_of IS NOT NULL) as duplicates,
        COUNT(*) FILTER (WHERE confidence_score = 0) as zero_confidence
      FROM content_queue cq
      LEFT JOIN content_analysis ca ON cq.id = ca.content_queue_id
      WHERE scraped_at > NOW() - INTERVAL '${hours} hours'
      GROUP BY source_platform
      ORDER BY total DESC
    `)
    
    const duplicateAnalysis = await db.query(`
      SELECT 
        'Before fixes' as period,
        COUNT(*) as total_duplicates,
        COUNT(DISTINCT duplicate_of) as unique_originals,
        AVG(confidence_score) as avg_confidence
      FROM content_analysis 
      WHERE duplicate_of IS NOT NULL
      AND created_at < NOW() - INTERVAL '1 hour'
      UNION ALL
      SELECT 
        'After fixes' as period,
        COUNT(*) as total_duplicates,
        COUNT(DISTINCT duplicate_of) as unique_originals,
        AVG(confidence_score) as avg_confidence
      FROM content_analysis 
      WHERE duplicate_of IS NOT NULL
      AND created_at >= NOW() - INTERVAL '1 hour'
    `)
    
    return NextResponse.json({
      success: true,
      message: 'Duplicate detection fixes status',
      data: {
        platformStats: stats.rows,
        duplicateAnalysis: duplicateAnalysis.rows,
        recommendations: {
          needsReprocessing: stats.rows.some(row => parseInt(row.zero_confidence) > 0),
          expectedImprovements: {
            reddit: "Should improve from 10.7% to ~30%",
            pixabay: "Should improve from 20% to ~35%",
            youtube: "Should improve from 0% to ~25%",
            imgur: "Should improve from 0% to ~25%"
          }
        }
      }
    })
    
  } catch (error) {
    console.error('Duplicate fixes test error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get summary of duplicate detection improvements
    const summary = await db.query(`
      SELECT 
        COUNT(*) as total_content,
        COUNT(*) FILTER (WHERE is_approved = true) as approved,
        COUNT(*) FILTER (WHERE duplicate_of IS NOT NULL) as duplicates,
        ROUND(AVG(CASE WHEN is_approved THEN 1.0 ELSE 0.0 END) * 100, 1) as overall_approval_rate,
        COUNT(*) FILTER (WHERE confidence_score > 0.8) as high_confidence,
        COUNT(*) FILTER (WHERE confidence_score = 0) as zero_confidence
      FROM content_queue cq
      LEFT JOIN content_analysis ca ON cq.id = ca.content_queue_id
      WHERE scraped_at > NOW() - INTERVAL '24 hours'
    `)
    
    const processingOrder = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE processing_notes::text LIKE '%Found hotdog term%') as found_hotdog_terms,
        COUNT(*) FILTER (WHERE processing_notes::text LIKE '%No simple hotdog terms found%') as no_hotdog_terms,
        COUNT(*) FILTER (WHERE duplicate_of IS NOT NULL) as marked_duplicates,
        COUNT(*) FILTER (WHERE is_valid_hotdog = true AND duplicate_of IS NULL) as valid_non_duplicates
      FROM content_analysis
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `)
    
    return NextResponse.json({
      success: true,
      fixes_implemented: {
        processing_pipeline: "✅ Filtering now runs BEFORE duplicate detection",
        thresholds_adjusted: "✅ Fuzzy match: 0.85→0.95, URL: 0.9→0.98, Image: 0.95→0.98",
        multiple_matches: "✅ Now requires 2+ indicators or 98%+ confidence for duplicate",
        time_based: "✅ Platform-specific repost intervals (Reddit: 30d, Pixabay: 60d, etc)",
        platform_specific: "✅ Different rules per platform type"
      },
      current_stats: summary.rows[0],
      processing_analysis: processingOrder.rows[0],
      next_steps: [
        "Run POST /api/test/duplicate-fixes with action=reprocess to reprocess recent content",
        "Monitor approval rates over next few scans",
        "Adjust thresholds if needed based on results"
      ]
    })
    
  } catch (error) {
    console.error('Duplicate fixes status error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}