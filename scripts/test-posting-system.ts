#!/usr/bin/env tsx

/**
 * Test script to verify the complete posting system
 * Tests: scheduler → scheduled_posts table → posting service → posted_content
 */

import { postFromSchedule, checkPostingHealth } from '../lib/services/posting/schedule-only-poster'
import { db } from '../lib/db'

async function testPostingSystem() {
  console.log('🧪 Testing Complete Posting System\n')
  console.log('=' .repeat(60))

  try {
    // Step 1: Check posting service health
    console.log('\n📊 Step 1: Checking posting service health...')
    const health = await checkPostingHealth()
    console.log('Health status:', health)

    if (!health.healthy) {
      console.error('❌ Posting service is not healthy!')
      console.error('Errors:', health.errors)
      process.exit(1)
    }

    console.log('✅ Posting service is healthy')
    console.log(`   - Pending slots: ${health.pendingSlots}`)
    console.log(`   - Next slot due: ${health.nextSlotDue || 'None'}`)

    // Step 2: Check scheduled_posts table
    console.log('\n📅 Step 2: Checking scheduled_posts table...')
    await db.connect()

    const scheduledResult = await db.query(`
      SELECT
        id, content_id, platform, scheduled_post_time, status, actual_posted_at
      FROM scheduled_posts
      WHERE scheduled_post_time <= datetime('now', '+5 minutes')
      ORDER BY scheduled_post_time ASC
      LIMIT 10
    `)

    console.log(`Found ${scheduledResult.rows?.length || 0} slots due within 5 minutes:`)
    if (scheduledResult.rows) {
      scheduledResult.rows.forEach((row: any) => {
        console.log(`   - Slot ${row.id}: ${row.platform} at ${row.scheduled_post_time} (${row.status})`)
        if (!row.content_id) {
          console.warn(`     ⚠️  WARNING: No content_id assigned!`)
        }
      })
    }

    // Step 3: Test posting from schedule
    console.log('\n🚀 Step 3: Attempting to post from schedule...')
    console.log('Grace period: 5 minutes')

    const postingResult = await postFromSchedule({ graceMinutes: 5 })
    console.log('\nPosting Result:')
    console.log(`   - Success: ${postingResult.success}`)
    console.log(`   - Type: ${postingResult.type}`)

    if (postingResult.type === 'POSTED') {
      console.log('✅ Content posted successfully!')
      console.log(`   - Scheduled Slot ID: ${postingResult.scheduledSlotId}`)
      console.log(`   - Content ID: ${postingResult.contentId}`)
      console.log(`   - Platform: ${postingResult.platform}`)
      console.log(`   - Posted At: ${postingResult.postedAt}`)

      // Verify in posted_content table
      const verifyResult = await db.query(`
        SELECT * FROM posted_content
        WHERE scheduled_post_id = ?
      `, [postingResult.scheduledSlotId])

      if (verifyResult.rows && verifyResult.rows.length > 0) {
        console.log('✅ Verified in posted_content table')
      } else {
        console.error('❌ NOT found in posted_content table - data integrity issue!')
      }
    } else if (postingResult.type === 'NO_SCHEDULED_CONTENT') {
      console.log('ℹ️  No content due for posting at this time')
      console.log('   This is expected if no slots are scheduled within the grace period')
    } else if (postingResult.type === 'EMPTY_SCHEDULE_SLOT') {
      console.warn('⚠️  Schedule slot exists but has no content assigned')
      console.log(`   - Slot ID: ${postingResult.scheduledSlotId}`)
      console.log(`   - Platform: ${postingResult.platform}`)
      console.log('   ACTION REQUIRED: Run scheduler refill to assign content')
    } else if (postingResult.type === 'ERROR') {
      console.error('❌ Posting failed with error:')
      console.error(`   ${postingResult.error}`)
      process.exit(1)
    }

    // Step 4: Summary statistics
    console.log('\n📈 Step 4: System Statistics...')
    const stats = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM scheduled_posts WHERE status = 'pending') as pending,
        (SELECT COUNT(*) FROM scheduled_posts WHERE status = 'posted') as posted,
        (SELECT COUNT(*) FROM scheduled_posts WHERE status = 'posting') as in_progress,
        (SELECT COUNT(*) FROM content_queue WHERE is_approved = 1 AND is_posted = 0) as approved_queue,
        (SELECT COUNT(*) FROM posted_content) as total_posted
    `)

    const stat = stats.rows[0]
    console.log('Scheduled Posts:')
    console.log(`   - Pending: ${stat.pending}`)
    console.log(`   - Posted: ${stat.posted}`)
    console.log(`   - In Progress: ${stat.in_progress}`)
    console.log('\nContent Queue:')
    console.log(`   - Approved & Unposted: ${stat.approved_queue}`)
    console.log(`   - Total Posted (all time): ${stat.total_posted}`)

    // Step 5: Next posting opportunities
    console.log('\n⏰ Step 5: Next Posting Opportunities...')
    const upcoming = await db.query(`
      SELECT
        id, platform, scheduled_post_time, content_id, status
      FROM scheduled_posts
      WHERE status = 'pending'
      ORDER BY scheduled_post_time ASC
      LIMIT 5
    `)

    if (upcoming.rows && upcoming.rows.length > 0) {
      console.log('Next 5 pending slots:')
      upcoming.rows.forEach((row: any, index: number) => {
        const hasContent = row.content_id ? '✓' : '✗'
        console.log(`   ${index + 1}. ${row.scheduled_post_time} - ${row.platform} [${hasContent}]`)
      })
    } else {
      console.log('⚠️  No pending slots found - scheduler needs to run!')
    }

    console.log('\n' + '='.repeat(60))
    console.log('✅ Testing Complete')
    console.log('='.repeat(60))

  } catch (error) {
    console.error('\n❌ Test failed with error:', error)
    console.error(error)
    process.exit(1)
  } finally {
    await db.disconnect()
  }
}

// Run the test
testPostingSystem().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
