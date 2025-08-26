#!/usr/bin/env node
import { db } from '../lib/db'

interface PlatformStatus {
  platform: string
  total_content: number
  approved_content: number
  ready_to_post: number
  posted_content: number
  avg_confidence: number
  needs_scanning: boolean
}

async function emergencyPlatformRebalance() {
  console.log('🚨 EMERGENCY PLATFORM REBALANCE STARTING...')
  console.log('=' .repeat(50))
  
  try {
    await db.connect()
    
    // 1. Analyze current platform content distribution
    console.log('📊 Analyzing current platform distribution...')
    
    const allPlatforms = ['reddit', 'youtube', 'giphy', 'imgur', 'bluesky', 'pixabay', 'lemmy', 'tumblr']
    const platformStatus: PlatformStatus[] = []
    
    for (const platform of allPlatforms) {
      const totalResult = await db.query(
        'SELECT COUNT(*) as count FROM content_queue WHERE source_platform = ?', 
        [platform]
      )
      
      const approvedResult = await db.query(
        'SELECT COUNT(*) as count FROM content_queue WHERE source_platform = ? AND is_approved = 1', 
        [platform]
      )
      
      const readyResult = await db.query(
        'SELECT COUNT(*) as count FROM content_queue WHERE source_platform = ? AND is_approved = 1 AND is_posted = 0', 
        [platform]
      )
      
      const postedResult = await db.query(
        'SELECT COUNT(*) as count FROM content_queue WHERE source_platform = ? AND is_posted = 1', 
        [platform]
      )
      
      const confResult = await db.query(
        'SELECT AVG(confidence_score) as avg FROM content_queue WHERE source_platform = ?', 
        [platform]
      )
      
      const total = totalResult.rows[0]?.count || 0
      const approved = approvedResult.rows[0]?.count || 0
      const ready = readyResult.rows[0]?.count || 0
      const posted = postedResult.rows[0]?.count || 0
      const avgConf = confResult.rows[0]?.avg || 0
      
      platformStatus.push({
        platform,
        total_content: total,
        approved_content: approved,
        ready_to_post: ready,
        posted_content: posted,
        avg_confidence: avgConf,
        needs_scanning: total === 0
      })
    }
    
    // 2. Display current status
    console.log('\n📋 CURRENT PLATFORM STATUS:')
    console.log('Platform'.padEnd(12) + 'Total'.padEnd(8) + 'Approved'.padEnd(10) + 'Ready'.padEnd(8) + 'Posted'.padEnd(8) + 'Avg Score'.padEnd(10) + 'Status')
    console.log('-'.repeat(70))
    
    for (const status of platformStatus) {
      const statusText = status.needs_scanning ? '❌ NEEDS SCAN' : 
                        status.ready_to_post === 0 ? '⚠️ NO READY' : 
                        status.ready_to_post < 3 ? '⚠️ LOW READY' : '✅ HEALTHY'
      
      console.log(
        status.platform.padEnd(12) + 
        status.total_content.toString().padEnd(8) +
        status.approved_content.toString().padEnd(10) +
        status.ready_to_post.toString().padEnd(8) +
        status.posted_content.toString().padEnd(8) +
        status.avg_confidence.toFixed(2).padEnd(10) +
        statusText
      )
    }
    
    // 3. Identify critical issues
    console.log('\n🚨 CRITICAL ISSUES IDENTIFIED:')
    
    const platformsNeedingScanning = platformStatus.filter(p => p.needs_scanning)
    const platformsNeedingApproval = platformStatus.filter(p => p.total_content > 0 && p.ready_to_post === 0)
    const platformsLowContent = platformStatus.filter(p => p.ready_to_post > 0 && p.ready_to_post < 3)
    const healthyPlatforms = platformStatus.filter(p => p.ready_to_post >= 3)
    
    console.log(`❌ ${platformsNeedingScanning.length} platforms need content scanning: ${platformsNeedingScanning.map(p => p.platform).join(', ')}`)
    console.log(`⚠️ ${platformsNeedingApproval.length} platforms need content approval: ${platformsNeedingApproval.map(p => p.platform).join(', ')}`)
    console.log(`⚠️ ${platformsLowContent.length} platforms have low ready content: ${platformsLowContent.map(p => p.platform).join(', ')}`)
    console.log(`✅ ${healthyPlatforms.length} platforms are healthy: ${healthyPlatforms.map(p => p.platform).join(', ')}`)
    
    // 4. Analyze posting violations
    console.log('\n🔍 ANALYZING RECENT POSTING VIOLATIONS...')
    
    const recentPostsResult = await db.query(`
      SELECT 
        pc.id,
        pc.posted_at,
        cq.source_platform,
        LAG(cq.source_platform) OVER (ORDER BY pc.posted_at DESC) as prev_platform
      FROM posted_content pc
      JOIN content_queue cq ON pc.content_queue_id = cq.id
      ORDER BY pc.posted_at DESC
      LIMIT 15
    `)
    
    const recentPosts = recentPostsResult.rows || []
    let violations = 0
    let consecutivePixabay = 0
    let currentStreak = 0
    
    console.log('\nRecent Posting Pattern:')
    console.log('Post ID'.padEnd(10) + 'Posted At'.padEnd(25) + 'Platform'.padEnd(12) + 'Violation')
    console.log('-'.repeat(60))
    
    for (const post of recentPosts) {
      const isViolation = post.source_platform === post.prev_platform
      if (isViolation) violations++
      
      if (post.source_platform === 'pixabay') {
        currentStreak++
        consecutivePixabay = Math.max(consecutivePixabay, currentStreak)
      } else {
        currentStreak = 0
      }
      
      console.log(
        post.id.toString().padEnd(10) +
        new Date(post.posted_at).toLocaleString().padEnd(25) +
        post.source_platform.padEnd(12) +
        (isViolation ? '❌ VIOLATION' : '✅ OK')
      )
    }
    
    console.log(`\n🚨 VIOLATION SUMMARY:`)
    console.log(`Total violations: ${violations}`)
    console.log(`Max consecutive Pixabay posts: ${consecutivePixabay}`)
    console.log(`Violation rate: ${((violations / recentPosts.length) * 100).toFixed(1)}%`)
    
    // 5. Generate emergency action plan
    console.log('\n🚀 EMERGENCY ACTION PLAN:')
    console.log('=' .repeat(50))
    
    const actionPlan = []
    
    // Priority 1: Scan missing platforms
    if (platformsNeedingScanning.length > 0) {
      actionPlan.push(`1. URGENT: Scan missing platforms`)
      platformsNeedingScanning.forEach(p => {
        actionPlan.push(`   - Scan ${p.platform} for hotdog content`)
      })
    }
    
    // Priority 2: Approve existing content
    if (platformsNeedingApproval.length > 0) {
      actionPlan.push(`2. HIGH: Approve existing content`)
      platformsNeedingApproval.forEach(p => {
        actionPlan.push(`   - Review and approve ${p.total_content} items from ${p.platform}`)
      })
    }
    
    // Priority 3: Boost low-content platforms  
    if (platformsLowContent.length > 0) {
      actionPlan.push(`3. MEDIUM: Boost low-content platforms`)
      platformsLowContent.forEach(p => {
        actionPlan.push(`   - Add more content to ${p.platform} (currently ${p.ready_to_post} ready)`)
      })
    }
    
    // Priority 4: Fix diversity algorithm
    actionPlan.push(`4. CRITICAL: Fix posting diversity`)
    actionPlan.push(`   - Ensure useDiverseSelection=true in all posting endpoints`)
    actionPlan.push(`   - Add emergency fallback when no diverse content available`)
    actionPlan.push(`   - Implement strict "no consecutive same platform" rule`)
    
    actionPlan.forEach(action => console.log(action))
    
    // 6. Generate recommended scanning commands
    console.log('\n📝 RECOMMENDED SCANNING COMMANDS:')
    console.log('=' .repeat(50))
    
    const scanCommands = [
      'curl -X POST "$SITE_URL/api/admin/scan-youtube-now" -H "Authorization: Bearer $AUTH_TOKEN"',
      'curl -X POST "$SITE_URL/api/admin/scan-reddit-now" -H "Authorization: Bearer $AUTH_TOKEN"', 
      'curl -X POST "$SITE_URL/api/admin/scan-giphy-now" -H "Authorization: Bearer $AUTH_TOKEN"',
      'curl -X POST "$SITE_URL/api/admin/scan-imgur-now" -H "Authorization: Bearer $AUTH_TOKEN"',
      'curl -X POST "$SITE_URL/api/admin/scan-bluesky-now" -H "Authorization: Bearer $AUTH_TOKEN"'
    ]
    
    scanCommands.forEach((cmd, i) => {
      console.log(`${i + 1}. ${cmd}`)
    })
    
    // 7. Summary and next steps
    console.log('\n📊 SUMMARY:')
    console.log('=' .repeat(50))
    console.log(`✅ Analysis completed successfully`)
    console.log(`🚨 Critical platforms missing: ${platformsNeedingScanning.length}`)
    console.log(`⚠️ Platforms needing approval: ${platformsNeedingApproval.length}`)
    console.log(`📈 Diversity violations: ${violations} out of ${recentPosts.length} recent posts`)
    console.log(`💡 Primary cause: Content scarcity, not algorithm failure`)
    
    console.log('\n🎯 NEXT STEPS:')
    console.log(`1. Run scanning for missing platforms immediately`)
    console.log(`2. Approve content from existing platforms`) 
    console.log(`3. Test posting with improved content availability`)
    console.log(`4. Monitor platform diversity in next 24 hours`)
    
    return {
      platformStatus,
      violations,
      consecutivePixabay,
      actionPlan,
      scanCommands
    }
    
  } catch (error) {
    console.error('❌ Emergency rebalance failed:', error)
    throw error
  } finally {
    await db.disconnect()
  }
}

// Run if called directly
if (require.main === module) {
  emergencyPlatformRebalance()
    .then(() => {
      console.log('\n✅ Emergency platform rebalance analysis complete!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Analysis failed:', error)
      process.exit(1)
    })
}

export { emergencyPlatformRebalance }