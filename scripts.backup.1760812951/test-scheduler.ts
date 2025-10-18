#!/usr/bin/env tsx

/**
 * Test Script for Content Scheduler Service
 * Validates the intelligent scheduling functionality
 */

import { scheduleNextBatch, getUpcomingSchedule, cancelScheduledContent } from '../lib/services/schedule-content'
import { db } from '../lib/db'

async function main() {
  try {
    console.log('🧪 Testing Content Scheduler Service...\n')
    
    // Connect to database
    await db.connect()
    
    // Test 1: Check current queue status
    console.log('📊 Current Queue Status:')
    const queueStatus = await db.query(`
      SELECT 
        status,
        COUNT(*) as count,
        COUNT(CASE WHEN scheduled_for IS NOT NULL THEN 1 END) as with_schedule
      FROM content_queue 
      WHERE is_approved = TRUE
      GROUP BY status
    `)
    console.table(queueStatus.rows)
    
    // Test 2: Run scheduler for next 3 days
    console.log('\n🗓️ Testing Scheduler (3 days ahead):')
    const scheduleResult = await scheduleNextBatch(3, 6)
    
    console.log('\n📋 Scheduling Results:')
    console.log(`✅ Total scheduled: ${scheduleResult.summary.totalScheduled}`)
    console.log(`📅 Days scheduled: ${scheduleResult.summary.totalDays}`)
    console.log(`🎯 Platform distribution:`)
    console.table(scheduleResult.summary.platformDistribution)
    
    if (scheduleResult.errors.length > 0) {
      console.log('\n⚠️ Errors/Warnings:')
      scheduleResult.errors.forEach(error => console.log(`  - ${error}`))
    }
    
    // Test 3: View upcoming schedule
    console.log('\n📅 Upcoming Schedule (next 7 days):')
    const upcomingSchedule = await getUpcomingSchedule(7)
    
    if (upcomingSchedule.length > 0) {
      const scheduleTable = upcomingSchedule.map(item => ({
        id: item.id,
        scheduled_for: item.scheduled_for,
        platform: item.source_platform,
        content_preview: item.content_text?.substring(0, 40) + '...',
        status: item.status
      }))
      console.table(scheduleTable)
    } else {
      console.log('No scheduled content found')
    }
    
    // Test 4: Platform diversity analysis
    console.log('\n🎯 Platform Diversity Analysis:')
    const diversityAnalysis = await db.query(`
      WITH scheduled_by_date AS (
        SELECT 
          DATE(scheduled_for) as schedule_date,
          source_platform,
          COUNT(*) as posts_count
        FROM content_queue
        WHERE status = 'scheduled' AND scheduled_for IS NOT NULL
        GROUP BY DATE(scheduled_for), source_platform
      ),
      date_platform_counts AS (
        SELECT 
          schedule_date,
          COUNT(DISTINCT source_platform) as unique_platforms,
          COUNT(*) as total_posts
        FROM scheduled_by_date
        GROUP BY schedule_date
      )
      SELECT 
        schedule_date,
        unique_platforms,
        total_posts,
        ROUND(unique_platforms * 100.0 / total_posts, 1) as diversity_score
      FROM date_platform_counts
      ORDER BY schedule_date
    `)
    
    if (diversityAnalysis.rows.length > 0) {
      console.table(diversityAnalysis.rows)
    } else {
      console.log('No scheduled content for diversity analysis')
    }
    
    // Test 5: Time distribution analysis
    console.log('\n⏰ Time Distribution Analysis:')
    const timeAnalysis = await db.query(`
      SELECT 
        strftime('%H:%M', scheduled_for) as posting_time,
        COUNT(*) as posts_count,
        GROUP_CONCAT(DISTINCT source_platform) as platforms
      FROM content_queue
      WHERE status = 'scheduled' AND scheduled_for IS NOT NULL
      GROUP BY strftime('%H:%M', scheduled_for)
      ORDER BY posting_time
    `)
    
    if (timeAnalysis.rows.length > 0) {
      console.table(timeAnalysis.rows)
    } else {
      console.log('No scheduled content for time analysis')
    }
    
    console.log('\n🎉 Scheduler testing completed successfully!')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  } finally {
    await db.disconnect()
  }
}

// Run test if called directly
if (require.main === module) {
  main()
}

export { main as testScheduler }