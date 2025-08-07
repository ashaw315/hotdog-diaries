import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing simple Pixabay insertion...')
    
    // First, check which database we're connected to
    const dbInfo = await db.query('SELECT current_database() as db_name, current_user as db_user')
    console.log('📍 Database info:', dbInfo.rows[0])
    
    // Create very simple test data
    const contentHash = crypto.createHash('sha256').update('simple-test-' + Date.now()).digest('hex')
    
    const insertQuery = `
      INSERT INTO content_queue (
        content_text, content_image_url, content_type,
        source_platform, original_url, original_author, 
        scraped_at, content_hash
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
      RETURNING id, content_text, source_platform, created_at
    `
    
    const values = [
      'Simple test hotdog content',
      'https://example.com/simple-test.jpg',
      'image',
      'pixabay',
      'https://example.com/simple-test',
      'Simple Test Author',
      new Date(),
      contentHash
    ]
    
    console.log('🗃️ Inserting simple test record...')
    const insertResult = await db.query(insertQuery, values)
    const insertedRecord = insertResult.rows[0]
    console.log('✅ Insert result:', insertedRecord)
    
    // Immediately try to read it back
    console.log('🔍 Reading back the record...')
    const selectResult = await db.query(
      'SELECT id, content_text, source_platform, created_at FROM content_queue WHERE id = $1',
      [insertedRecord.id]
    )
    
    console.log('📖 Read result:', selectResult.rows[0] || 'NOT FOUND')
    
    // Also check total count
    const countResult = await db.query(
      'SELECT COUNT(*) as count FROM content_queue WHERE source_platform = $1',
      ['pixabay']
    )
    
    const totalCount = countResult.rows[0].count
    console.log('📊 Total Pixabay records:', totalCount)
    
    // Wait a moment and check again
    await new Promise(resolve => setTimeout(resolve, 100))
    
    const recheckResult = await db.query(
      'SELECT id, content_text FROM content_queue WHERE id = $1',
      [insertedRecord.id]
    )
    
    console.log('🔄 Recheck after 100ms:', recheckResult.rows[0] || 'GONE!')
    
    return NextResponse.json({
      success: true,
      data: {
        inserted: insertedRecord,
        immediateRead: selectResult.rows[0] || null,
        totalPixabayCount: totalCount,
        recheckAfter100ms: recheckResult.rows[0] || null,
        stillExists: recheckResult.rows.length > 0,
        databaseInfo: dbInfo.rows[0]
      }
    })

  } catch (error) {
    console.error('❌ Simple test failed:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        details: {
          name: error.name,
          code: error.code,
          stack: error.stack
        }
      },
      { status: 500 }
    )
  }
}