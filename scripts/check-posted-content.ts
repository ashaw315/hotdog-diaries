import { db } from '../lib/db'

async function checkPostedContent() {
  try {
    const countResult = await db.query('SELECT COUNT(*) FROM posted_content')
    console.log('posted_content count:', countResult.rows[0])

    const sampleResult = await db.query(`
      SELECT id, content_queue_id, posted_at, post_order
      FROM posted_content
      ORDER BY posted_at DESC
      LIMIT 5
    `)
    console.log('Sample posted_content:')
    console.log(sampleResult.rows)

    const joinResult = await db.query(`
      SELECT
        cq.id,
        cq.content_text,
        pc.posted_at
      FROM posted_content pc
      JOIN content_queue cq ON pc.content_queue_id = cq.id
      ORDER BY pc.posted_at DESC
      LIMIT 5
    `)
    console.log('Sample with join:')
    console.log(joinResult.rows)
  } catch (error) {
    console.error('Error:', error)
  } finally {
    process.exit(0)
  }
}

checkPostedContent()
