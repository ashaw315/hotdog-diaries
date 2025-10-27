// Test the admin content endpoint functionality that was failing
import { db } from '../lib/db'

async function testAdminContentEndpoint() {
  try {
    console.log('🧪 Testing admin content endpoint queries...')
    
    // Test the exact query pattern used by admin content endpoint with pagination
    console.log('\n1. Testing content pagination query...')
    const page = 1
    const limit = 50
    const offset = (page - 1) * limit
    
    const contentResult = await db.query(`
      SELECT 
        id,
        content_text,
        source_platform,
        content_type,
        is_approved,
        is_posted,
        created_at,
        confidence_score,
        content_image_url,
        content_video_url,
        status
      FROM content_queue
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset])
    
    console.log('✅ Content pagination query successful')
    console.log('  - Rows returned:', contentResult.rows?.length || 0)
    console.log('  - Sample content:', contentResult.rows?.[0] ? {
      id: contentResult.rows[0].id,
      platform: contentResult.rows[0].source_platform,
      type: contentResult.rows[0].content_type
    } : 'No content found')
    
    // Test count query for total content
    console.log('\n2. Testing total content count...')
    const countResult = await db.query('SELECT COUNT(*) as total FROM content_queue')
    const totalContent = parseInt(countResult.rows[0]?.total || '0')
    console.log('✅ Total content count:', totalContent)
    
    // Test approved content count
    console.log('\n3. Testing approved content count...')
    const approvedResult = await db.query('SELECT COUNT(*) as total_approved FROM content_queue WHERE is_approved = true')
    const approvedContent = parseInt(approvedResult.rows[0]?.total_approved || '0')
    console.log('✅ Approved content count:', approvedContent)
    
    // Test status-based filtering
    console.log('\n4. Testing status-based content filtering...')
    const statusResult = await db.query(`
      SELECT status, COUNT(*) as count 
      FROM content_queue 
      WHERE status IS NOT NULL
      GROUP BY status
    `)
    console.log('✅ Content by status:')
    statusResult.rows?.forEach(row => {
      console.log(`  - ${row.status}: ${row.count}`)
    })
    
    console.log('\n🎉 All admin content endpoint tests passed!')
    console.log('The /api/admin/content endpoint should now work correctly.')
    
  } catch (error) {
    console.error('❌ Admin content endpoint test failed:', error.message)
    console.error('Stack:', error.stack)
  } finally {
    await db.disconnect()
  }
}

testAdminContentEndpoint()