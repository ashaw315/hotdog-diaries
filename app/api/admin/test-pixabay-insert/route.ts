import { NextRequest, NextResponse } from 'next/server'
import { createSimpleClient } from '@/utils/supabase/server'

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString())
      if (decoded.username !== 'admin' || decoded.id !== 1) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    } catch (e) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createSimpleClient()
    
    // Create a simple test record
    const testData = {
      content_text: 'Test Pixabay Image',
      content_image_url: 'https://pixabay.com/test-image.jpg',
      content_video_url: null,
      content_type: 'image',
      source_platform: 'pixabay',
      original_url: 'https://pixabay.com/test-page',
      original_author: 'Test User',
      content_hash: `test_pixabay_${Date.now()}_${Math.random()}`,
      content_status: 'discovered',
      confidence_score: 0.9,
      is_approved: true,
      is_rejected: false,
      is_posted: false,
      scraped_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    console.log('🧪 Testing Pixabay insert with data:', testData)

    const { data, error } = await supabase
      .from('content_queue')
      .insert(testData)
      .select('id')
      .single()

    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Insert failed',
        details: {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        },
        testData
      })
    } else {
      return NextResponse.json({
        success: true,
        message: 'Test Pixabay insert successful!',
        insertedId: data.id,
        testData
      })
    }

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}