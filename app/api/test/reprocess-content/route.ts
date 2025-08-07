import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ContentProcessor } from '@/lib/services/content-processor'

export async function POST(request: NextRequest) {
  try {
    const { platforms, hoursBack = 48, dryRun = true } = await request.json().catch(() => ({}))

    // Get content to reprocess
    const whereConditions = ['cq.scraped_at > NOW() - INTERVAL $1 hours']
    const queryParams = [hoursBack]

    if (platforms && platforms.length > 0) {
      whereConditions.push(`cq.source_platform = ANY($${queryParams.length + 1})`)
      queryParams.push(platforms)
    }

    const query = `
      SELECT cq.id, cq.content_text, cq.content_type, cq.source_platform, cq.is_approved
      FROM content_queue cq
      WHERE ${whereConditions.join(' AND ')}
      AND cq.is_approved = false
      ORDER BY cq.scraped_at DESC
      LIMIT 50
    `

    const contentResult = await db.query(query, queryParams)
    const results = []

    for (const content of contentResult.rows) {
      try {
        // Reprocess with new logic
        const result = await ContentProcessor.processContent(content.id)
        
        results.push({
          contentId: content.id,
          platform: content.source_platform,
          contentType: content.content_type,
          textSample: content.content_text?.substring(0, 100) || '',
          oldStatus: content.is_approved ? 'approved' : 'rejected',
          newAction: result.action,
          newConfidence: result.analysis.confidence_score,
          isValidHotdog: result.analysis.is_valid_hotdog,
          processingNotes: result.analysis.processing_notes || []
        })

        // If dry run, don't actually update the database
        if (dryRun) {
          // Rollback any changes made by processContent
          await db.query(`
            UPDATE content_queue 
            SET is_approved = $1
            WHERE id = $2
          `, [content.is_approved, content.id])
        }

      } catch (error) {
        results.push({
          contentId: content.id,
          platform: content.source_platform,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Summary statistics
    const summary = {
      totalProcessed: results.length,
      approvedToApproved: results.filter(r => r.oldStatus === 'approved' && r.newAction === 'approved').length,
      rejectedToApproved: results.filter(r => r.oldStatus === 'rejected' && r.newAction === 'approved').length,
      rejectedToRejected: results.filter(r => r.oldStatus === 'rejected' && r.newAction === 'rejected').length,
      rejectedToFlagged: results.filter(r => r.oldStatus === 'rejected' && r.newAction === 'flagged').length,
      errors: results.filter(r => r.error).length,
      platformBreakdown: results.reduce((acc, r) => {
        if (!r.error) {
          acc[r.platform] = acc[r.platform] || { total: 0, newlyApproved: 0 }
          acc[r.platform].total++
          if (r.oldStatus === 'rejected' && r.newAction === 'approved') {
            acc[r.platform].newlyApproved++
          }
        }
        return acc
      }, {} as Record<string, { total: number, newlyApproved: number }>)
    }

    return NextResponse.json({
      success: true,
      dryRun,
      results,
      summary,
      message: dryRun 
        ? 'Dry run completed - no changes saved to database' 
        : 'Content reprocessing completed',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Content reprocessing error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}