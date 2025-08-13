import { NextRequest, NextResponse } from 'next/server'
import { ContentProcessor } from '@/lib/services/content-processor'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    console.log('🎨 Testing single Giphy item processing with full debug...')
    
    // Get one specific Giphy item
    const result = await db.query(`
      SELECT * FROM content_queue 
      WHERE source_platform = 'giphy' 
      AND id = 648
      LIMIT 1
    `)
    
    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'No Giphy item found' })
    }
    
    const giphyItem = result.rows[0]
    console.log('🔍 Processing Giphy item:', JSON.stringify(giphyItem, null, 2))
    
    const contentProcessor = new ContentProcessor()
    
    // Check if there's existing analysis
    const existingAnalysis = await db.query(`
      SELECT * FROM content_analysis WHERE content_queue_id = ?
    `, [648])
    
    console.log('📊 Existing analysis:', existingAnalysis.rows.length)
    
    let processingResult
    try {
      processingResult = await contentProcessor.processContent(648, {
        autoApprovalThreshold: 0.55,
        autoRejectionThreshold: 0.25,
        enableDuplicateDetection: true
      })
      console.log('✅ Processing result:', JSON.stringify(processingResult, null, 2))
    } catch (procError) {
      console.error('❌ Processing error:', procError)
      return NextResponse.json({ 
        success: false, 
        error: procError.message,
        stack: procError.stack
      })
    }
    
    // Check final state in database
    const finalAnalysis = await db.query(`
      SELECT * FROM content_analysis WHERE content_queue_id = ?
    `, [648])
    
    const finalContent = await db.query(`
      SELECT * FROM content_queue WHERE id = ?
    `, [648])
    
    return NextResponse.json({
      success: true,
      giphyItem,
      processingResult,
      existingAnalysisCount: existingAnalysis.rows.length,
      finalAnalysisCount: finalAnalysis.rows.length,
      finalAnalysis: finalAnalysis.rows[0] || null,
      finalContent: finalContent.rows[0] || null
    })

  } catch (error) {
    console.error('Debug error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message,
        stack: error.stack
      },
      { status: 500 }
    )
  }
}