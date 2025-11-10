import { db } from '../lib/db'

async function checkPlatforms() {
  try {
    await db.connect()
    
    // Check platforms with approved content_status
    const approvedResult = await db.query(`
      SELECT 
        source_platform,
        COUNT(*) as count
      FROM content_queue
      WHERE content_status = 'approved'
      GROUP BY source_platform
      ORDER BY count DESC
    `)
    
    console.log('Platforms with content_status=approved:')
    approvedResult.rows.forEach(row => {
      console.log(`  ${row.source_platform}: ${row.count} items`)
    })
    console.log(`Total: ${approvedResult.rows.length} platforms`)
    
    // Check for bluesky specifically
    const blueskyResult = await db.query(`
      SELECT 
        content_status,
        COUNT(*) as count
      FROM content_queue
      WHERE source_platform = 'bluesky'
      GROUP BY content_status
    `)
    
    console.log('\nBluesky content by status:')
    blueskyResult.rows.forEach(row => {
      console.log(`  ${row.content_status}: ${row.count} items`)
    })
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await db.disconnect()
  }
}

checkPlatforms()
