#!/usr/bin/env node

const { spawn } = require('child_process')

const testScript = `
import { db } from './lib/db.js'

async function run30MinuteAutomationTest() {
  console.log('🤖 Starting 30-Minute Automation Test')
  console.log('=' .repeat(50))
  console.log(\`Test started at: \${new Date().toLocaleString()}\`)
  console.log('This will monitor the complete automation flow for 30 minutes\\n')
  
  let testStartTime = Date.now()
  let monitoringInterval
  let checkCount = 0
  let initialStats = {}
  
  try {
    // 1. Record initial system state
    console.log('📊 Recording Initial System State...')
    const initialQuery = await db.query(\`
      SELECT 
        content_status,
        COUNT(*) as count
      FROM content_queue
      GROUP BY content_status
    \`)
    
    initialQuery.rows.forEach(row => {
      initialStats[row.content_status] = parseInt(row.count)
    })
    
    console.log('Initial content status:')
    Object.entries(initialStats).forEach(([status, count]) => {
      const emoji = {
        'discovered': '🔍',
        'approved': '✅', 
        'scheduled': '⏰',
        'posted': '📤',
        'rejected': '❌'
      }[status] || '❓'
      console.log(\`  \${emoji} \${status}: \${count}\`)
    })
    
    // 2. Check for overdue posts and process them
    console.log('\\n⚡ Processing Overdue Posts...')
    const overdueQuery = await db.query(\`
      SELECT id, content_text, scheduled_for
      FROM content_queue 
      WHERE content_status = 'scheduled' 
        AND scheduled_for <= NOW()
      ORDER BY scheduled_for ASC
      LIMIT 5
    \`)
    
    if (overdueQuery.rows.length > 0) {
      console.log(\`Found \${overdueQuery.rows.length} overdue posts. Processing...\`)
      
      for (const post of overdueQuery.rows) {
        try {
          await db.query(\`
            UPDATE content_queue 
            SET content_status = 'posted',
                is_posted = true,
                posted_at = NOW()
            WHERE id = $1
          \`, [post.id])
          
          const text = post.content_text?.substring(0, 50) + '...' || 'No text'
          console.log(\`  ✅ Posted overdue item ID \${post.id}: \${text}\`)
        } catch (error) {
          console.log(\`  ❌ Failed to post ID \${post.id}: \${error.message}\`)
        }
      }
    } else {
      console.log('No overdue posts found.')
    }
    
    // 3. Schedule some approved content 
    console.log('\\n📅 Scheduling Approved Content...')
    const unscheduledQuery = await db.query(\`
      SELECT id, content_text
      FROM content_queue 
      WHERE content_status = 'approved' 
        AND scheduled_for IS NULL
      ORDER BY created_at ASC
      LIMIT 6
    \`)
    
    if (unscheduledQuery.rows.length > 0) {
      console.log(\`Found \${unscheduledQuery.rows.length} approved items to schedule...\`)
      
      const mealTimes = ['08:00', '10:00', '12:00', '15:00', '18:00', '20:00']
      const today = new Date()
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      
      for (let i = 0; i < Math.min(unscheduledQuery.rows.length, 6); i++) {
        const post = unscheduledQuery.rows[i]
        const mealTime = mealTimes[i]
        const scheduledTime = new Date(\`\${tomorrow.toISOString().split('T')[0]}T\${mealTime}:00.000Z\`)
        
        try {
          await db.query(\`
            UPDATE content_queue 
            SET content_status = 'scheduled',
                scheduled_for = $2
            WHERE id = $1
          \`, [post.id, scheduledTime])
          
          const text = post.content_text?.substring(0, 40) + '...' || 'No text'
          console.log(\`  ⏰ Scheduled ID \${post.id} for \${scheduledTime.toLocaleString()}: \${text}\`)
        } catch (error) {
          console.log(\`  ❌ Failed to schedule ID \${post.id}: \${error.message}\`)
        }
      }
    } else {
      console.log('No unscheduled approved content found.')
    }
    
    // 4. Start monitoring loop
    console.log('\\n🔄 Starting Continuous Monitoring...')
    console.log('Monitoring will run for 30 minutes, checking every 2 minutes.\\n')
    
    const monitoringLoop = async () => {
      checkCount++
      const elapsed = Math.round((Date.now() - testStartTime) / 1000 / 60)
      
      console.log(\`\\n📊 Check #\${checkCount} (\${elapsed} minutes elapsed):\`)
      console.log(\`Time: \${new Date().toLocaleString()}\`)
      
      try {
        // Check current system state
        const currentQuery = await db.query(\`
          SELECT 
            content_status,
            COUNT(*) as count
          FROM content_queue
          GROUP BY content_status
        \`)
        
        const currentStats = {}
        currentQuery.rows.forEach(row => {
          currentStats[row.content_status] = parseInt(row.count)
        })
        
        // Show changes from initial state
        console.log('Status changes from start:')
        const allStatuses = new Set([...Object.keys(initialStats), ...Object.keys(currentStats)])
        
        allStatuses.forEach(status => {
          const initial = initialStats[status] || 0
          const current = currentStats[status] || 0
          const change = current - initial
          const changeStr = change > 0 ? \`+\${change}\` : change.toString()
          const emoji = {
            'discovered': '🔍',
            'approved': '✅',
            'scheduled': '⏰', 
            'posted': '📤',
            'rejected': '❌'
          }[status] || '❓'
          
          console.log(\`  \${emoji} \${status}: \${current} (\${changeStr})\`)
        })
        
        // Check recent activity
        const recentActivity = await db.query(\`
          SELECT 
            content_status,
            COUNT(*) as count
          FROM content_queue
          WHERE updated_at > NOW() - INTERVAL '2 minutes'
          GROUP BY content_status
        \`)
        
        if (recentActivity.rows.length > 0) {
          console.log('Recent activity (last 2 minutes):')
          recentActivity.rows.forEach(row => {
            console.log(\`  📈 \${row.count} items moved to \${row.content_status}\`)
          })
        } else {
          console.log('No recent activity detected.')
        }
        
        // Check overdue items
        const overdueCheck = await db.query(\`
          SELECT COUNT(*) as count
          FROM content_queue
          WHERE content_status = 'scheduled' AND scheduled_for <= NOW()
        \`)
        
        const overdueCount = parseInt(overdueCheck.rows[0].count)
        if (overdueCount > 0) {
          console.log(\`⚠️  \${overdueCount} posts are overdue for posting\`)
        }
        
        // Check upcoming scheduled posts
        const upcomingQuery = await db.query(\`
          SELECT 
            id,
            content_text,
            scheduled_for
          FROM content_queue
          WHERE content_status = 'scheduled' 
            AND scheduled_for > NOW()
            AND scheduled_for <= NOW() + INTERVAL '4 hours'
          ORDER BY scheduled_for ASC
          LIMIT 3
        \`)
        
        if (upcomingQuery.rows.length > 0) {
          console.log('Next scheduled posts:')
          upcomingQuery.rows.forEach((row, i) => {
            const time = new Date(row.scheduled_for).toLocaleString()
            const text = row.content_text?.substring(0, 30) + '...' || 'No text'
            console.log(\`  \${i+1}. \${time}: \${text}\`)
          })
        }
        
      } catch (error) {
        console.log(\`❌ Monitoring check failed: \${error.message}\`)
      }
      
      // Check if we should continue
      const totalElapsed = (Date.now() - testStartTime) / 1000 / 60
      if (totalElapsed >= 30) {
        console.log(\`\\n⏰ 30 minutes completed. Ending monitoring.\\n\`)
        clearInterval(monitoringInterval)
        
        // Final summary
        await provideFinalSummary()
        process.exit(0)
      }
    }
    
    // Start monitoring every 2 minutes (120000ms)
    monitoringInterval = setInterval(monitoringLoop, 120000)
    
    // Run first check immediately
    await monitoringLoop()
    
  } catch (error) {
    console.error('❌ Automation test failed:', error.message)
    console.error(error.stack)
    if (monitoringInterval) {
      clearInterval(monitoringInterval)
    }
    process.exit(1)
  }
  
  async function provideFinalSummary() {
    console.log('🏁 30-Minute Automation Test Summary')
    console.log('=' .repeat(50))
    
    try {
      // Final state
      const finalQuery = await db.query(\`
        SELECT 
          content_status,
          COUNT(*) as count
        FROM content_queue
        GROUP BY content_status
      \`)
      
      const finalStats = {}
      finalQuery.rows.forEach(row => {
        finalStats[row.content_status] = parseInt(row.count)
      })
      
      console.log('📊 Final Results:')
      console.log('\\nContent status changes during test:')
      
      const allStatuses = new Set([...Object.keys(initialStats), ...Object.keys(finalStats)])
      let totalChanges = 0
      
      allStatuses.forEach(status => {
        const initial = initialStats[status] || 0
        const final = finalStats[status] || 0
        const change = final - initial
        totalChanges += Math.abs(change)
        const changeStr = change > 0 ? \`+\${change}\` : change.toString()
        const emoji = {
          'discovered': '🔍',
          'approved': '✅',
          'scheduled': '⏰',
          'posted': '📤', 
          'rejected': '❌'
        }[status] || '❓'
        
        console.log(\`  \${emoji} \${status}: \${initial} → \${final} (\${changeStr})\`)
      })
      
      // Activity summary
      const activityQuery = await db.query(\`
        SELECT 
          COUNT(*) FILTER (WHERE updated_at > NOW() - INTERVAL '30 minutes') as total_updates,
          COUNT(*) FILTER (WHERE posted_at > NOW() - INTERVAL '30 minutes') as new_posts,
          COUNT(*) FILTER (WHERE content_status = 'scheduled' AND updated_at > NOW() - INTERVAL '30 minutes') as new_scheduled
        FROM content_queue
      \`)
      
      const activity = activityQuery.rows[0]
      
      console.log(\`\\n📈 Activity Summary:\`)
      console.log(\`  Total item updates: \${activity.total_updates}\`)
      console.log(\`  New posts published: \${activity.new_posts}\`)
      console.log(\`  New items scheduled: \${activity.new_scheduled}\`)
      console.log(\`  Total status changes: \${totalChanges}\`)
      
      console.log(\`\\n⏱️  Test Duration: 30 minutes\`)
      console.log(\`  Monitoring checks performed: \${checkCount}\`)
      
      // Assessment
      console.log(\`\\n🎯 Automation Assessment:\`)
      
      if (parseInt(activity.new_posts) > 0) {
        console.log(\`  ✅ Active posting: \${activity.new_posts} posts published during test\`)
      } else {
        console.log(\`  ⚠️  No posts were published during the 30-minute test period\`)
      }
      
      if (parseInt(activity.new_scheduled) > 0) {
        console.log(\`  ✅ Active scheduling: \${activity.new_scheduled} items scheduled\`)
      } else {
        console.log(\`  ⚠️  No new items were scheduled during test\`)
      }
      
      if (totalChanges > 0) {
        console.log(\`  ✅ System activity: \${totalChanges} total status changes detected\`)
      } else {
        console.log(\`  ⚠️  Limited system activity during test period\`)
      }
      
      const score = (
        (parseInt(activity.new_posts) > 0 ? 1 : 0) +
        (parseInt(activity.new_scheduled) > 0 ? 1 : 0) +
        (totalChanges > 0 ? 1 : 0)
      ) / 3
      
      console.log(\`\\n📊 Automation Score: \${(score * 100).toFixed(0)}%\`)
      
      if (score >= 0.67) {
        console.log(\`🎉 GOOD: Automation system is actively working\`)
      } else if (score >= 0.34) {
        console.log(\`⚠️  FAIR: Some automation activity, but limited\`)
      } else {
        console.log(\`❌ POOR: Little to no automation activity detected\`)
      }
      
    } catch (error) {
      console.log(\`❌ Failed to generate final summary: \${error.message}\`)
    }
  }
}

run30MinuteAutomationTest()
`

const child = spawn('npx', ['tsx', '--eval', testScript], {
  stdio: 'inherit',
  cwd: process.cwd()
})

child.on('close', (code) => {
  process.exit(code)
})