#!/usr/bin/env tsx

/**
 * Test Script for Posting Service Integration
 * Tests the integration between scheduler and posting service
 */

import { scheduleNextBatch, getUpcomingSchedule } from '../lib/services/schedule-content'
import { postScheduledContentDue, postNextContent, getPostingStats } from '../lib/services/posting-service'
import { db } from '../lib/db'

async function main() {
  try {
    console.log('🧪 Testing Posting Service Integration...\n')
    
    // Connect to database
    await db.connect()
    
    // Test 1: Check current status
    console.log('📊 Current System Status:')
    const statusResult = await db.query(`
      SELECT 
        status,
        COUNT(*) as count,
        COUNT(CASE WHEN scheduled_for IS NOT NULL THEN 1 END) as with_schedule
      FROM content_queue 
      WHERE is_approved = TRUE
      GROUP BY status
      ORDER BY status
    `)
    console.table(statusResult.rows)
    
    // Test 2: Schedule some content if needed
    console.log('\n📅 Ensuring content is scheduled...')
    const scheduleResult = await scheduleNextBatch(2, 6) // 2 days, 6 posts per day
    console.log(`✅ Scheduled ${scheduleResult.summary.totalScheduled} new content items`)
    
    // Test 3: Check upcoming schedule
    console.log('\n📋 Upcoming Scheduled Content:')
    const upcomingSchedule = await getUpcomingSchedule(2)
    
    if (upcomingSchedule.length > 0) {
      console.table(upcomingSchedule.slice(0, 5).map(item => ({
        id: item.id,
        scheduled_for: item.scheduled_for,
        platform: item.source_platform,
        status: item.status,
        content_preview: item.content_text?.substring(0, 30) + '...'
      })))
    } else {
      console.log('No upcoming scheduled content')
    }
    
    // Test 4: Simulate posting scheduled content due
    console.log('\n🎯 Testing Scheduled Content Posting:')
    
    // First, let's manually mark one scheduled item as due
    if (upcomingSchedule.length > 0) {
      const testContent = upcomingSchedule[0]
      const pastTime = new Date(Date.now() - 5 * 60 * 1000).toISOString() // 5 minutes ago
      
      await db.query(`
        UPDATE content_queue 
        SET scheduled_for = ? 
        WHERE id = ?
      `, [pastTime, testContent.id])
      
      console.log(`⏰ Marked content ${testContent.id} as due for posting`)
    }
    
    // Now test the posting service
    const postingResult = await postScheduledContentDue()
    
    console.log('\n📋 Posting Results:')
    console.log(`✅ Total posted: ${postingResult.summary.totalPosted}`)
    if (postingResult.summary.platformDistribution && Object.keys(postingResult.summary.platformDistribution).length > 0) {
      console.log('🎯 Platform distribution:')
      console.table(postingResult.summary.platformDistribution)
    }
    
    if (postingResult.errors.length > 0) {
      console.log('\n⚠️ Errors:')
      postingResult.errors.forEach(error => console.log(`  - ${error}`))
    }
    
    // Test 5: Test manual posting
    console.log('\n🎯 Testing Manual Content Posting:')
    const manualResult = await postNextContent()
    
    if (manualResult.success) {
      console.log(`✅ Manual post successful:`)
      console.log(`  - Content ID: ${manualResult.contentId}`)
      console.log(`  - Platform: ${manualResult.platform}`)
      console.log(`  - Posted at: ${manualResult.postedAt}`)
      console.log(`  - Time slot: ${manualResult.timeSlot}`)
    } else {
      console.log(`❌ Manual post failed: ${manualResult.error}`)
    }
    
    // Test 6: Get posting statistics
    console.log('\n📊 Posting Statistics (last 7 days):')
    const stats = await getPostingStats(7)
    console.log(`Total posted: ${stats.totalPosted}`)
    console.log(`Scheduled posts: ${stats.scheduledPosted}`)
    console.log(`Manual posts: ${stats.manualPosted}`)
    
    if (Object.keys(stats.platformDistribution).length > 0) {
      console.log('\nPlatform distribution:')
      console.table(stats.platformDistribution)
    }
    
    if (stats.dailyBreakdown.length > 0) {
      console.log('\nDaily breakdown:')
      console.table(stats.dailyBreakdown)
    }
    
    // Test 7: Verify final system state
    console.log('\n📊 Final System Status:')
    const finalStatusResult = await db.query(`
      SELECT 
        status,
        COUNT(*) as count,
        COUNT(CASE WHEN scheduled_for IS NOT NULL THEN 1 END) as with_schedule
      FROM content_queue 
      WHERE is_approved = TRUE OR is_posted = TRUE
      GROUP BY status
      ORDER BY status
    `)
    console.table(finalStatusResult.rows)
    
    console.log('\n🎉 Posting integration testing completed successfully!')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  } finally {
    await db.disconnect()
  }
}

// Run test if called directly
// ES module check for direct execution
const isMainModule = process.argv[1] && process.argv[1].includes('test-posting-integration')
if (isMainModule) {
  main()
}

export { main as testPostingIntegration }