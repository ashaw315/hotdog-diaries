import { db } from '../lib/db'

async function checkLastPosted() {
  try {
    await db.connect()

    // Check last posted content
    const lastPosted = await db.query(`
      SELECT
        pc.id,
        pc.posted_at,
        pc.platform,
        pc.content_queue_id,
        pc.scheduled_post_id,
        sp.scheduled_post_time,
        sp.status as scheduled_status
      FROM posted_content pc
      LEFT JOIN scheduled_posts sp ON sp.id = pc.scheduled_post_id
      ORDER BY pc.posted_at DESC
      LIMIT 5
    `)

    console.log('📅 Last 5 posts:\n')
    lastPosted.rows.forEach(row => {
      console.log(`Posted at: ${row.posted_at}`)
      console.log(`  Platform: ${row.platform}`)
      console.log(`  Content ID: ${row.content_queue_id}`)
      console.log(`  Scheduled for: ${row.scheduled_post_time}`)
      console.log(`  Scheduled status: ${row.scheduled_status}`)
      console.log('')
    })

    // Check current pending slots
    const pendingSlots = await db.query(`
      SELECT
        id,
        scheduled_post_time,
        platform,
        content_id,
        status,
        created_at
      FROM scheduled_posts
      WHERE status = 'pending'
      ORDER BY scheduled_post_time ASC
      LIMIT 10
    `)

    console.log(`\n🕒 Next ${pendingSlots.rows.length} pending slots:\n`)
    pendingSlots.rows.forEach(row => {
      console.log(`Slot ${row.id}:`)
      console.log(`  Scheduled for: ${row.scheduled_post_time}`)
      console.log(`  Platform: ${row.platform}`)
      console.log(`  Content ID: ${row.content_id}`)
      console.log(`  Created at: ${row.created_at}`)
      console.log('')
    })

    // Check for any failed slots
    const failedSlots = await db.query(`
      SELECT
        id,
        scheduled_post_time,
        platform,
        content_id,
        status,
        reasoning
      FROM scheduled_posts
      WHERE status = 'failed'
      ORDER BY scheduled_post_time DESC
      LIMIT 5
    `)

    if (failedSlots.rows.length > 0) {
      console.log(`\n❌ Recent failed slots:\n`)
      failedSlots.rows.forEach(row => {
        console.log(`Slot ${row.id}:`)
        console.log(`  Scheduled for: ${row.scheduled_post_time}`)
        console.log(`  Platform: ${row.platform}`)
        console.log(`  Content ID: ${row.content_id}`)
        console.log(`  Reason: ${row.reasoning}`)
        console.log('')
      })
    }

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await db.disconnect()
  }
}

checkLastPosted()
