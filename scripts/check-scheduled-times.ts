import { db } from '../lib/db'
import { formatISO, addMinutes, subMinutes } from 'date-fns'

async function checkScheduledTimes() {
  try {
    await db.connect()

    // Check what's in scheduled_posts for today
    const slots = await db.query(`
      SELECT 
        id,
        scheduled_post_time,
        scheduled_slot_index,
        status,
        platform,
        content_id
      FROM scheduled_posts
      WHERE DATE(scheduled_post_time) = CURRENT_DATE
      ORDER BY scheduled_post_time ASC
    `)

    console.log('📅 Scheduled slots for today:\n')
    slots.rows.forEach(row => {
      console.log(`Slot ${row.scheduled_slot_index}:`)
      console.log(`  ID: ${row.id}`)
      console.log(`  Time (raw): ${row.scheduled_post_time}`)
      console.log(`  Status: ${row.status}`)
      console.log(`  Platform: ${row.platform}`)
      console.log(`  Content ID: ${row.content_id}`)
      console.log('')
    })

    // Test the time window query
    const now = new Date()
    const windowStart = subMinutes(now, 60)
    const windowEnd = addMinutes(now, 60)

    console.log('\n⏰ Current time window test:')
    console.log(`Now: ${now.toISOString()}`)
    console.log(`Window Start (formatISO): ${formatISO(windowStart)}`)
    console.log(`Window End (formatISO): ${formatISO(windowEnd)}`)
    console.log(`Window Start (toISOString): ${windowStart.toISOString()}`)
    console.log(`Window End (toISOString): ${windowEnd.toISOString()}`)

    // Query with formatISO
    const slotsFormatISO = await db.query(`
      SELECT COUNT(*) as count
      FROM scheduled_posts
      WHERE status = 'pending'
        AND scheduled_post_time >= $1
        AND scheduled_post_time <= $2
    `, [formatISO(windowStart), formatISO(windowEnd)])

    console.log(`\nSlots found with formatISO: ${slotsFormatISO.rows[0].count}`)

    // Query with toISOString
    const slotsToISO = await db.query(`
      SELECT COUNT(*) as count
      FROM scheduled_posts
      WHERE status = 'pending'
        AND scheduled_post_time >= $1
        AND scheduled_post_time <= $2
    `, [windowStart.toISOString(), windowEnd.toISOString()])

    console.log(`Slots found with toISOString: ${slotsToISO.rows[0].count}`)

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await db.disconnect()
  }
}

checkScheduledTimes()
