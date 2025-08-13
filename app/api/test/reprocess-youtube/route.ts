import { NextRequest, NextResponse } from 'next/server'
import { ContentProcessor } from '@/lib/services/content-processor'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    console.log('🎬 Reprocessing existing YouTube content...')
    
    // Get all YouTube items
    const result = await db.query(`
      SELECT id, content_text, content_type, source_platform
      FROM content_queue 
      WHERE source_platform = 'youtube'
      ORDER BY id DESC
      LIMIT 10
    `)
    
    console.log(`Found ${result.rows.length} YouTube items to reprocess`)
    
    const contentProcessor = new ContentProcessor()
    const processed = []
    
    for (const row of result.rows) {
      try {
        console.log(`Processing YouTube item ${row.id}: "${row.content_text}"`)
        
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
      message: `Reprocessed ${total} YouTube items`,
      results: {
        total,
        approved,
        approvalRate: `${approvalRate}%`,
        processed
      }
    })

  } catch (error) {
    console.error('YouTube reprocessing error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}