// Test admin dashboard functionality with the new Supabase fallback
import { queueManager } from '../lib/services/queue-manager'
import { db } from '../lib/db'

async function testDashboardFixes() {
  try {
    console.log('🧪 Testing admin dashboard functionality with Supabase fallback...')
    
    // Test 1: Health check
    console.log('\n1. Testing database health check...')
    const healthResult = await db.healthCheck()
    console.log('✅ Health check result:', healthResult)
    
    // Test 2: QueueManager.getQueueStats()
    console.log('\n2. Testing QueueManager.getQueueStats()...')
    const queueStats = await queueManager.getQueueStats()
    console.log('✅ Queue stats retrieved successfully:')
    console.log('  - Total approved:', queueStats.totalApproved)
    console.log('  - Days of content:', queueStats.daysOfContent)
    console.log('  - Platforms:', Object.keys(queueStats.platforms).length)
    console.log('  - Content types:', Object.keys(queueStats.contentTypes))
    
    // Test 3: Dashboard today's posts query
    console.log('\n3. Testing today\'s posts count...')
    const todaysPostsResult = await db.query(`
      SELECT COUNT(*) as count
      FROM posted_content 
      WHERE DATE(posted_at) = DATE('now')
    `)
    const todaysPosts = parseInt(todaysPostsResult.rows[0]?.count || '0')
    console.log('✅ Today\'s posts count:', todaysPosts)
    
    // Test 4: Upcoming posts query
    console.log('\n4. Testing upcoming posts query...')
    const upcomingPostsResult = await db.query(`
      SELECT 
        cq.id,
        cq.source_platform,
        cq.content_text,
        cq.content_image_url,
        cq.content_video_url
      FROM content_queue cq
      WHERE cq.is_approved = true AND cq.is_posted = false
      ORDER BY cq.confidence_score DESC
      LIMIT 6
    `)
    console.log('✅ Upcoming posts retrieved:', upcomingPostsResult.rows?.length || 0, 'items')
    
    // Test 5: System logging
    console.log('\n5. Testing system logging...')
    await db.query(
      `INSERT INTO system_logs (log_level, message, component, metadata, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      ['info', 'Dashboard test successful', 'test-dashboard-fixes', JSON.stringify({ test: true })]
    )
    console.log('✅ System logging test completed')
    
    console.log('\n🎉 All dashboard functionality tests passed!')
    console.log('The admin dashboard should now work correctly in production.')
    
  } catch (error) {
    console.error('❌ Dashboard test failed:', error.message)
    console.error('Stack:', error.stack)
  } finally {
    await db.disconnect()
  }
}

testDashboardFixes()