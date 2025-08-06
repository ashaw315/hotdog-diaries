#!/usr/bin/env node

const { spawn } = require('child_process')

const testScript = `
import { db } from './lib/db.js'

async function finalQueueCheck() {
  console.log('📊 Final Content Queue Analysis')
  console.log('=' .repeat(50))
  
  try {
    // Get comprehensive stats after recent scans
    const stats = await db.query(\`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE content_status = 'discovered') as discovered,
        COUNT(*) FILTER (WHERE content_status = 'approved') as approved,
        COUNT(*) FILTER (WHERE content_status = 'rejected') as rejected,
        COUNT(*) FILTER (WHERE content_status = 'posted') as posted,
        COUNT(*) FILTER (WHERE content_status = 'scheduled') as scheduled,
        COUNT(*) FILTER (WHERE is_posted = true) as actually_posted,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as last_hour
      FROM content_queue
    \`)
    
    const data = stats.rows[0]
    console.log('\\n📈 Current Queue Status:')
    console.log(\`  📋 Total items: \${data.total}\`)
    console.log(\`  🔍 Discovered: \${data.discovered}\`)
    console.log(\`  ✅ Approved: \${data.approved}\`)
    console.log(\`  ❌ Rejected: \${data.rejected}\`)
    console.log(\`  ⏰ Scheduled: \${data.scheduled}\`)
    console.log(\`  📤 Posted: \${data.posted} (actually posted: \${data.actually_posted})\`)
    console.log(\`  🆕 Added in last hour: \${data.last_hour}\`)
    
    // Platform breakdown
    const platforms = await db.query(\`
      SELECT 
        source_platform,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE content_status = 'approved') as approved,
        COUNT(*) FILTER (WHERE is_posted = true) as posted,
        MAX(created_at) as latest_content
      FROM content_queue 
      GROUP BY source_platform
      ORDER BY total DESC
    \`)
    
    console.log('\\n🌐 Platform Analysis:')
    platforms.rows.forEach(row => {
      const latest = new Date(row.latest_content).toLocaleString()
      console.log(\`  📡 \${row.source_platform}: \${row.total} total (\${row.approved} approved, \${row.posted} posted)\`)
      console.log(\`     Latest: \${latest}\`)
    })
    
    // Recent hotdog content (show promising items)
    const hotdogContent = await db.query(\`
      SELECT 
        source_platform,
        content_text,
        content_status,
        content_image_url,
        created_at
      FROM content_queue 
      WHERE (
        LOWER(content_text) LIKE '%hotdog%' 
        OR LOWER(content_text) LIKE '%hot dog%'
        OR LOWER(content_text) LIKE '%bratwurst%'
        OR LOWER(content_text) LIKE '%sausage%'
        OR LOWER(content_text) LIKE '%frankfurter%'
      )
      AND created_at > NOW() - INTERVAL '2 hours'
      ORDER BY created_at DESC
      LIMIT 10
    \`)
    
    console.log(\`\\n🌭 Recent Hotdog Content (\${hotdogContent.rows.length} items):\`)
    hotdogContent.rows.forEach((row, i) => {
      const text = row.content_text?.substring(0, 80) + '...' || 'No text'
      const hasImage = row.content_image_url ? '🖼️' : '📝'
      const statusEmoji = row.content_status === 'approved' ? '✅' : 
                          row.content_status === 'rejected' ? '❌' : 
                          row.content_status === 'posted' ? '📤' : '🔍'
      
      console.log(\`  \${i+1}. \${statusEmoji} \${hasImage} [\${row.source_platform}] \${text}\`)
    })
    
    // Check what's ready for posting
    const readyToPost = await db.query(\`
      SELECT COUNT(*) as count
      FROM content_queue 
      WHERE content_status = 'approved' 
        AND is_posted = false
        AND (scheduled_for IS NULL OR scheduled_for <= NOW())
    \`)
    
    console.log(\`\\n📤 Ready for posting: \${readyToPost.rows[0].count} items\`)
    
    // Check posting schedule
    const scheduled = await db.query(\`
      SELECT 
        scheduled_for,
        content_text,
        source_platform
      FROM content_queue 
      WHERE scheduled_for IS NOT NULL 
        AND is_posted = false
      ORDER BY scheduled_for
      LIMIT 5
    \`)
    
    if (scheduled.rows.length > 0) {
      console.log('\\n⏰ Next Scheduled Posts:')
      scheduled.rows.forEach((row, i) => {
        const text = row.content_text?.substring(0, 60) + '...' || 'No text'
        const time = new Date(row.scheduled_for).toLocaleString()
        console.log(\`  \${i+1}. [\${row.source_platform}] \${time} - \${text}\`)
      })
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    process.exit(0)
  }
}

finalQueueCheck()
`

const child = spawn('npx', ['tsx', '--eval', testScript], {
  stdio: 'inherit',
  cwd: process.cwd()
})

child.on('close', (code) => {
  process.exit(code)
})