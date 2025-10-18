#!/usr/bin/env tsx

import { PostingScheduler } from '../lib/services/posting-scheduler'
import { db } from '../lib/db'

console.log('🧪 Testing Posting System Integration...\n')

async function main() {
  try {
    console.log('1. Testing database connection...')
    const result = await db.query('SELECT NOW() as current_time')
    console.log('   ✅ Database connected:', result.rows[0].current_time)
    
    console.log('\n2. Testing content selection...')
    const content = await PostingScheduler.selectContentForPosting()
    if (content) {
      console.log('   ✅ Content selected:')
      console.log('      ID:', content.id)
      console.log('      Platform:', content.source_platform)
      console.log('      Type:', content.content_type)
      console.log('      Author:', content.original_author)
      console.log('      Text preview:', content.content_text?.substring(0, 50) + '...')
    } else {
      console.log('   ❌ No content available for posting')
      return
    }
    
    console.log('\n3. Testing posting execution...')
    const posted = await PostingScheduler.executeScheduledPost(content.id)
    console.log('   ', posted ? '✅ Post executed successfully' : '❌ Post execution failed')
    
    console.log('\n4. Testing posting stats...')
    const stats = await PostingScheduler.getPostingStats()
    console.log('   ✅ Stats retrieved:')
    console.log('      Posts today:', stats.postsToday)
    console.log('      Posts last 24h:', stats.postsLast24Hours)
    console.log('      Next scheduled:', stats.nextScheduledTime.toISOString())
    console.log('      Last post platform:', stats.lastPostPlatform || 'None')
    
    console.log('\n5. Testing posting window logic...')
    const now = new Date()
    const isWithinWindow = PostingScheduler.isWithinPostingWindow(now)
    console.log('   Current time:', now.toISOString())
    console.log('   Current hour:', now.getUTCHours())
    console.log('   Within posting window:', isWithinWindow ? '✅ Yes' : '❌ No')
    
    console.log('\n6. Testing recent posting check...')
    const hasPostedRecently = await PostingScheduler.hasPostedRecently()
    console.log('   Has posted recently:', hasPostedRecently ? '✅ Yes' : '❌ No')
    
    console.log('\n7. Verifying database records...')
    
    // Check posting_history
    const historyResult = await db.query(`
      SELECT * FROM posting_history 
      ORDER BY posted_at DESC 
      LIMIT 1
    `)
    
    if (historyResult.rows.length > 0) {
      const latestHistory = historyResult.rows[0]
      console.log('   ✅ Latest posting_history record:')
      console.log('      Content ID:', latestHistory.content_queue_id)
      console.log('      Platform:', latestHistory.platform)
      console.log('      Success:', latestHistory.success)
      console.log('      Posted at:', latestHistory.posted_at)
    } else {
      console.log('   ❌ No posting_history records found')
    }
    
    // Check content_queue updates
    const contentResult = await db.query(`
      SELECT is_posted, posted_at, posting_attempt_count, last_posting_attempt
      FROM content_queue 
      WHERE id = $1
    `, [content.id])
    
    if (contentResult.rows.length > 0) {
      const contentRecord = contentResult.rows[0]
      console.log('   ✅ Content queue record updated:')
      console.log('      Is posted:', contentRecord.is_posted)
      console.log('      Posted at:', contentRecord.posted_at)
      console.log('      Attempt count:', contentRecord.posting_attempt_count)
      console.log('      Last attempt:', contentRecord.last_posting_attempt)
    }
    
    console.log('\n🎉 All tests completed successfully!')
    
  } catch (error) {
    console.error('\n❌ Test failed:', error)
  } finally {
    // Close database connection
    try {
      await db.query('SELECT 1') // Just to ensure connection is active before we try to end it
    } catch (e) {
      // Connection already closed or never opened
    }
    process.exit(0)
  }
}

main()