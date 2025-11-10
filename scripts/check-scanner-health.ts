import { db } from '../lib/db'

async function checkScannerHealth() {
  try {
    await db.connect()
    
    // Check what platforms we're configured to scan
    console.log('=== SCANNER CONFIGURATION CHECK ===\n')
    
    // Check recent scans by platform (last 7 days)
    const recentScans = await db.query(`
      SELECT 
        source_platform,
        DATE(created_at) as scan_date,
        COUNT(*) as items_scraped
      FROM content_queue
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY source_platform, DATE(created_at)
      ORDER BY source_platform, scan_date DESC
    `)
    
    console.log('Recent scan activity (last 7 days):')
    const platformActivity: Record<string, any[]> = {}
    recentScans.rows.forEach(row => {
      if (!platformActivity[row.source_platform]) {
        platformActivity[row.source_platform] = []
      }
      platformActivity[row.source_platform].push({
        date: row.scan_date,
        count: row.items_scraped
      })
    })
    
    Object.entries(platformActivity).forEach(([platform, activity]) => {
      console.log(`\n${platform}:`)
      activity.forEach(day => {
        console.log(`  ${day.date}: ${day.count} items`)
      })
    })
    
    // Check total content by platform (all time)
    console.log('\n\n=== TOTAL CONTENT BY PLATFORM (ALL TIME) ===\n')
    const totalByPlatform = await db.query(`
      SELECT 
        source_platform,
        COUNT(*) as total,
        COUNT(CASE WHEN content_status = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN content_status = 'discovered' THEN 1 END) as discovered
      FROM content_queue
      GROUP BY source_platform
      ORDER BY total DESC
    `)
    
    totalByPlatform.rows.forEach(row => {
      console.log(`${row.source_platform}:`)
      console.log(`  Total: ${row.total}`)
      console.log(`  Approved: ${row.approved}`)
      console.log(`  Discovered: ${row.discovered}`)
    })
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await db.disconnect()
  }
}

checkScannerHealth()
