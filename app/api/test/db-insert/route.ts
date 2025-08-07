import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Testing direct database insertion...')
    
    // Create test data
    const testData = {
      content_text: 'Test hotdog content from direct insertion',
      content_image_url: 'https://example.com/test-hotdog.jpg',
      content_type: 'image',
      source_platform: 'pixabay',
      original_url: 'https://example.com/test',
      original_author: 'Test Author',
      scraped_at: new Date(),
      content_hash: crypto.createHash('sha256').update('test-content-' + Date.now()).digest('hex')
    }
    
    console.log('📝 Test data prepared:', testData)
    
    // Try direct insertion using the db.query method
    const insertQuery = `
      INSERT INTO content_queue (
        content_text, content_image_url, content_type, 
        source_platform, original_url, original_author, 
        scraped_at, content_hash
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
      RETURNING id, content_text, source_platform
    `
    
    const values = [
      testData.content_text,
      testData.content_image_url,
      testData.content_type,
      testData.source_platform,
      testData.original_url,
      testData.original_author,
      testData.scraped_at,
      testData.content_hash
    ]
    
    console.log('🗃️ Executing query:', insertQuery)
    console.log('📊 Query values:', values)
    
    const result = await db.query(insertQuery, values)
    
    console.log('✅ Direct insertion result:', result.rows[0])
    
    // Verify the insertion worked
    const verifyQuery = 'SELECT COUNT(*) as pixabay_count FROM content_queue WHERE source_platform = $1'
    const verifyResult = await db.query(verifyQuery, ['pixabay'])
    const count = verifyResult.rows[0].pixabay_count
    
    console.log('🔢 Pixabay count after insertion:', count)

    return NextResponse.json({
      success: true,
      message: 'Direct database insertion test completed',
      data: {
        insertedRecord: result.rows[0],
        pixabayCount: count,
        testData
      }
    })

  } catch (error) {
    console.error('❌ Direct insertion failed:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        details: {
          name: error.name,
          code: error.code,
          constraint: error.constraint,
          stack: error.stack
        }
      },
      { status: 500 }
    )
  }
}