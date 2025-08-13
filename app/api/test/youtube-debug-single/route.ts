import { NextRequest, NextResponse } from 'next/server'
import { ContentProcessor } from '@/lib/services/content-processor'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    console.log('🎬 Testing single YouTube item processing...')
    
    // Get one specific YouTube item
    const result = await db.query(`
      SELECT * FROM content_queue 
      WHERE source_platform = 'youtube' 
      ORDER BY id DESC
      LIMIT 1
    `)
    
    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'No YouTube item found' })
    }
    
    const youtubeItem = result.rows[0]
    console.log('🔍 Processing YouTube item:', JSON.stringify(youtubeItem, null, 2))
    
    const contentProcessor = new ContentProcessor()
    
    let processingResult
    try {
      processingResult = await contentProcessor.processContent(youtubeItem.id, {
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
    `, [youtubeItem.id])
    
    return NextResponse.json({
      success: true,
      youtubeItem,
      processingResult,
      finalAnalysis: finalAnalysis.rows[0] || null
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