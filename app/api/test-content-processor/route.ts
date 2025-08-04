import { NextRequest, NextResponse } from 'next/server'
import { contentProcessor } from '@/lib/services/content-processor'

import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { contentId } = await request.json()
    
    if (!contentId) {
      return NextResponse.json(
        { success: false, error: 'Content ID is required' },
        { status: 400 }
      )
    }
    
    console.log(`Testing ContentProcessor for content ID: ${contentId}`)
    
    // First test direct database query
    console.log('Testing direct database query...')
    const directResult = await db.query(
      'SELECT id, substring(content_text, 1, 50) as content_preview FROM content_queue WHERE id = $1',
      [parseInt(contentId)]
    )
    
    console.log('Direct DB query result:', {
      rowCount: directResult.rows.length,
      rows: directResult.rows
    })
    
    // Then test ContentProcessor with lower approval threshold
    const result = await contentProcessor.processContent(parseInt(contentId), {
      autoApprovalThreshold: 0.6  // Lower threshold for testing
    })
    
    console.log('ContentProcessor result:', JSON.stringify(result, null, 2))
    
    return NextResponse.json({
      success: true,
      data: {
        directQuery: {
          rowCount: directResult.rows.length,
          rows: directResult.rows
        },
        contentProcessor: result
      }
    })
    
  } catch (error) {
    console.error('Test ContentProcessor error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}