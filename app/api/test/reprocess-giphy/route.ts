import { NextRequest, NextResponse } from 'next/server'
import { ContentProcessor } from '@/lib/services/content-processor'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    console.log('🎨 Reprocessing existing Giphy content with improved scoring...')
    
    // Get all unprocessed Giphy items
    const result = await db.query(`
      SELECT cq.id, cq.content_text, cq.content_type, cq.source_platform
      FROM content_queue cq
      LEFT JOIN content_analysis ca ON ca.content_queue_id = cq.id
      WHERE cq.source_platform = 'giphy'
      AND (ca.id IS NULL OR ca.confidence_score < 0.5)
      ORDER BY cq.id DESC
      LIMIT 15
    `)
    
    console.log(`Found ${result.rows.length} Giphy items to reprocess`)
    
    const contentProcessor = new ContentProcessor()
    const processed = []
    
    for (const row of result.rows) {
      try {
        console.log(`Processing Giphy item ${row.id}: "${row.content_text}"`)
        
        const processingResult = await contentProcessor.processContent(row.id, {
          autoApprovalThreshold: 0.55, // Use default threshold
          autoRejectionThreshold: 0.25,
          enableDuplicateDetection: true
        })
        
        processed.push({
          id: row.id,
          content_text: row.content_text,
          success: processingResult.success,
          action: processingResult.action,
          confidence: processingResult.confidence_score,
          approved: processingResult.action === 'approved'
        })
        
        console.log(`✅ Processed ${row.id}: ${processingResult.action} (confidence: ${processingResult.confidence_score})`)
        
      } catch (error) {
        console.error(`❌ Error processing ${row.id}:`, error)
        processed.push({
          id: row.id,
          content_text: row.content_text,
          success: false,
          error: error.message
        })
      }
    }
    
    const approved = processed.filter(p => p.approved).length
    const total = processed.length
    const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0
    
    return NextResponse.json({
      success: true,
      message: `Reprocessed ${total} Giphy items`,
      results: {
        total,
        approved,
        approvalRate: `${approvalRate}%`,
        processed
      }
    })

  } catch (error) {
    console.error('Giphy reprocessing error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}