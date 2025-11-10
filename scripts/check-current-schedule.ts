/**
 * Check current schedule state using existing db connection
 */

import { db } from '../lib/db'
import dayjs from 'dayjs'

async function checkCurrentSchedule() {
  console.log('🔍 Checking current schedule state...\n')

  const now = new Date()
  const today = dayjs().format('YYYY-MM-DD')
  const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD')

  // Check all future scheduled_posts
  const result = await db.query(`
    SELECT
      id,
      content_id,
      platform,
      scheduled_post_time,
      status,
      DATE(scheduled_post_time) as schedule_date,
      TO_CHAR(scheduled_post_time, 'HH24:MI') as schedule_time
    FROM scheduled_posts
    WHERE scheduled_post_time >= NOW()
    ORDER BY scheduled_post_time ASC
    LIMIT 50
  `)

  console.log(`Found ${result.rows.length} future scheduled posts\n`)

  // Group by date
  const byDate: Record<string, any[]> = {}
  for (const post of result.rows) {
    const date = post.schedule_date
    if (!byDate[date]) byDate[date] = []
    byDate[date].push(post)
  }

  for (const [date, posts] of Object.entries(byDate).sort()) {
    console.log(`\n📅 ${date} (${posts.length} posts)`)
    for (const post of posts) {
      const statusEmoji = post.status === 'pending' ? '🕒' : post.status === 'posted' ? '✅' : '❌'
      console.log(`   ${statusEmoji} ${post.schedule_time} ${post.platform.padEnd(10)} (Post ${post.id})`)
    }
  }

  // Check how much valid content is available
  const contentResult = await db.query(`
    SELECT COUNT(*) as count, source_platform
    FROM content_queue
    WHERE is_approved = TRUE
      AND is_posted = FALSE
      AND content_text IS NOT NULL
      AND content_text != ''
      AND (content_image_url IS NOT NULL OR content_video_url IS NOT NULL)
    GROUP BY source_platform
    ORDER BY count DESC
  `)

  console.log('\n\n📊 Available Content for Scheduling:')
  let total = 0
  for (const row of contentResult.rows) {
    console.log(`   ${row.source_platform.padEnd(12)}: ${row.count} items`)
    total += parseInt(row.count)
  }
  console.log(`   ${'TOTAL'.padEnd(12)}: ${total} items`)

  console.log('\n\n🎯 Analysis:')
  console.log(`   Target: 6 posts per day`)
  console.log(`   Days to schedule: 2 (today + tomorrow)`)
  console.log(`   Expected total: 12 posts`)
  console.log(`   Actual total: ${result.rows.length} posts`)
  console.log(`   ${byDate[today] ? `Today (${today}): ${byDate[today].length}/6 posts` : `Today: 0/6 posts`}`)
  console.log(`   ${byDate[tomorrow] ? `Tomorrow (${tomorrow}): ${byDate[tomorrow].length}/6 posts` : `Tomorrow: 0/6 posts`}`)

  if (result.rows.length < 12) {
    console.log(`\n   ⚠️ Missing ${12 - result.rows.length} posts`)
    console.log(`   Available content: ${total} items (should be enough)`)
  }
}

checkCurrentSchedule()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
