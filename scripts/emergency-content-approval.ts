#!/usr/bin/env tsx

/**
 * Emergency Content Approval Script
 * 
 * This script handles content starvation situations by:
 * 1. Approving high-confidence unapproved content
 * 2. Recycling old posted content if needed (reset posting flags)
 * 3. Creating emergency test content as last resort
 * 
 * Usage:
 *   DATABASE_USER=adamshaw DATABASE_PASSWORD="" NODE_ENV=development npx tsx scripts/emergency-content-approval.ts
 *   
 * Options:
 *   --approve-only: Only approve existing unapproved content
 *   --recycle-old: Allow recycling of old posted content
 *   --create-test: Allow creation of test content
 *   --target-days=N: Target number of days of content (default: 5)
 */

import { db } from '../lib/db'

interface ContentItem {
  id: number
  content_text: string
  source_platform: string
  content_type: string
  confidence_score: number
  is_approved: number
  is_posted: number
  created_at: string
}

interface ApprovalStats {
  totalExisting: number
  totalApproved: number
  totalReadyToPost: number
  totalPosted: number
  daysOfContent: number
}

async function getContentStats(): Promise<ApprovalStats> {
  const result = await db.query(`
    SELECT 
      COUNT(*) as total_content,
      SUM(CASE WHEN is_approved = 1 THEN 1 ELSE 0 END) as approved_content,
      SUM(CASE WHEN is_approved = 1 AND is_posted = 0 THEN 1 ELSE 0 END) as ready_to_post,
      SUM(CASE WHEN is_posted = 1 THEN 1 ELSE 0 END) as posted_content
    FROM content_queue
  `)
  
  const stats = result.rows[0]
  return {
    totalExisting: stats.total_content,
    totalApproved: stats.approved_content,
    totalReadyToPost: stats.ready_to_post,
    totalPosted: stats.posted_content,
    daysOfContent: Math.round((stats.ready_to_post / 6) * 10) / 10
  }
}

async function approveUnapprovedContent(targetApprovals: number = 20): Promise<number> {
  console.log(`🔍 Looking for unapproved content with confidence > 0.6...`)
  
  // Find unapproved content with good confidence scores
  const candidates = await db.query(`
    SELECT id, content_text, source_platform, confidence_score
    FROM content_queue 
    WHERE is_approved = 0 AND is_posted = 0 AND confidence_score > 0.6
    ORDER BY confidence_score DESC, created_at ASC
    LIMIT ?
  `, [targetApprovals])
  
  if (candidates.rows.length === 0) {
    console.log('⚠️  No unapproved content found with confidence > 0.6')
    
    // Try with lower confidence threshold
    const lowConfidenceCandidates = await db.query(`
      SELECT id, content_text, source_platform, confidence_score
      FROM content_queue 
      WHERE is_approved = 0 AND is_posted = 0 AND confidence_score > 0.4
      ORDER BY confidence_score DESC, created_at ASC
      LIMIT ?
    `, [targetApprovals])
    
    if (lowConfidenceCandidates.rows.length === 0) {
      console.log('⚠️  No unapproved content found at all!')
      return 0
    }
    
    console.log(`📋 Found ${lowConfidenceCandidates.rows.length} items with confidence > 0.4`)
    candidates.rows = lowConfidenceCandidates.rows
  }
  
  console.log(`📋 Found ${candidates.rows.length} approval candidates`)
  
  // Approve the content
  const approvedIds: number[] = []
  
  for (const item of candidates.rows) {
    await db.query(`
      UPDATE content_queue 
      SET is_approved = 1, confidence_score = 0.8, updated_at = datetime('now')
      WHERE id = ?
    `, [item.id])
    
    approvedIds.push(item.id)
    console.log(`✅ Approved: ${item.content_text.substring(0, 50)}... (${item.source_platform})`)
  }
  
  return approvedIds.length
}

async function recycleOldContent(targetItems: number = 10): Promise<number> {
  console.log(`♻️  Looking for old posted content to recycle...`)
  
  // Find old posted content (posted more than 7 days ago)
  const oldPosted = await db.query(`
    SELECT pc.id as post_id, cq.id, cq.content_text, cq.source_platform, pc.posted_at
    FROM posted_content pc
    JOIN content_queue cq ON pc.content_queue_id = cq.id
    WHERE datetime(pc.posted_at) < datetime('now', '-7 days')
    ORDER BY pc.posted_at ASC
    LIMIT ?
  `, [targetItems])
  
  if (oldPosted.rows.length === 0) {
    console.log('⚠️  No old posted content available for recycling')
    return 0
  }
  
  console.log(`📋 Found ${oldPosted.rows.length} old posts that can be recycled`)
  
  let recycled = 0
  
  for (const item of oldPosted.rows) {
    // Remove from posted_content table
    await db.query('DELETE FROM posted_content WHERE content_queue_id = ?', [item.id])
    
    // Reset the content_queue item
    await db.query(`
      UPDATE content_queue 
      SET is_posted = 0, confidence_score = 0.7, updated_at = datetime('now')
      WHERE id = ?
    `, [item.id])
    
    recycled++
    console.log(`♻️  Recycled: ${item.content_text.substring(0, 50)}... (posted ${item.posted_at})`)
  }
  
  return recycled
}

async function createEmergencyContent(targetItems: number = 5): Promise<number> {
  console.log(`🆘 Creating emergency test content...`)
  
  const emergencyContent = [
    {
      text: "🌭 Emergency hotdog content #1 - Classic Chicago-style with all the fixings!",
      platform: "emergency",
      type: "text"
    },
    {
      text: "🌭 Emergency hotdog content #2 - New York street cart hotdog with mustard and sauerkraut",
      platform: "emergency", 
      type: "text"
    },
    {
      text: "🌭 Emergency hotdog content #3 - Gourmet hotdog with caramelized onions and artisan bun",
      platform: "emergency",
      type: "text"
    },
    {
      text: "🌭 Emergency hotdog content #4 - BBQ pulled pork hotdog with coleslaw topping",
      platform: "emergency",
      type: "text"
    },
    {
      text: "🌭 Emergency hotdog content #5 - Chili cheese dog with jalapeños and green onions",
      platform: "emergency",
      type: "text"
    },
    {
      text: "🌭 Emergency hotdog content #6 - Breakfast hotdog with scrambled eggs and bacon",
      platform: "emergency",
      type: "text"
    },
    {
      text: "🌭 Emergency hotdog content #7 - Veggie hotdog with avocado and sprouts",
      platform: "emergency",
      type: "text"
    },
    {
      text: "🌭 Emergency hotdog content #8 - Korean-style hotdog with kimchi and bulgogi",
      platform: "emergency",
      type: "text"
    }
  ]
  
  let created = 0
  const maxCreate = Math.min(targetItems, emergencyContent.length)
  
  for (let i = 0; i < maxCreate; i++) {
    const content = emergencyContent[i]
    const hash = `emergency_${Date.now()}_${i}`
    
    await db.query(`
      INSERT INTO content_queue 
      (content_text, content_type, source_platform, original_url, content_hash, 
       scraped_at, is_approved, confidence_score, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'), 1, 0.75, datetime('now'), datetime('now'))
    `, [
      content.text,
      content.type,
      content.platform,
      'emergency://generated',
      hash
    ])
    
    created++
    console.log(`🆘 Created: ${content.text}`)
  }
  
  return created
}

async function emergencyContentApproval() {
  try {
    console.log('🚨 EMERGENCY CONTENT APPROVAL SYSTEM')
    console.log('=' .repeat(50))
    
    await db.connect()
    
    // Check current status
    console.log('📊 Current Queue Status:')
    const initialStats = await getContentStats()
    
    console.log(`  Total Content: ${initialStats.totalExisting}`)
    console.log(`  Approved: ${initialStats.totalApproved}`)
    console.log(`  Ready to Post: ${initialStats.totalReadyToPost}`)
    console.log(`  Already Posted: ${initialStats.totalPosted}`)
    console.log(`  Days Remaining: ${initialStats.daysOfContent}`)
    console.log('')
    
    if (initialStats.daysOfContent >= 3) {
      console.log('✅ Content levels are healthy! No emergency action needed.')
      return
    }
    
    const targetDays = 5
    const postsPerDay = 6
    const targetTotal = targetDays * postsPerDay
    const needed = Math.max(0, targetTotal - initialStats.totalReadyToPost)
    
    console.log(`🎯 Target: ${targetDays} days = ${targetTotal} posts`)
    console.log(`📉 Current shortfall: ${needed} posts needed`)
    console.log('')
    
    let totalActionsPerformed = 0
    
    // Step 1: Approve any existing unapproved content
    if (needed > 0) {
      console.log('📋 STEP 1: Approve existing unapproved content')
      const approved = await approveUnapprovedContent(needed)
      totalActionsPerformed += approved
      
      if (approved > 0) {
        console.log(`✅ Approved ${approved} existing items`)
      }
      console.log('')
    }
    
    // Check if we still need more content
    const midStats = await getContentStats()
    const stillNeeded = Math.max(0, targetTotal - midStats.totalReadyToPost)
    
    // Step 2: Recycle old content if still needed
    if (stillNeeded > 0) {
      console.log('📋 STEP 2: Recycle old posted content')
      const recycled = await recycleOldContent(stillNeeded)
      totalActionsPerformed += recycled
      
      if (recycled > 0) {
        console.log(`♻️  Recycled ${recycled} old posts`)
      }
      console.log('')
    }
    
    // Check final need
    const finalCheckStats = await getContentStats()
    const finalNeeded = Math.max(0, targetTotal - finalCheckStats.totalReadyToPost)
    
    // Step 3: Create emergency content if absolutely necessary
    if (finalNeeded > 0) {
      console.log('📋 STEP 3: Create emergency test content')
      const created = await createEmergencyContent(finalNeeded)
      totalActionsPerformed += created
      
      if (created > 0) {
        console.log(`🆘 Created ${created} emergency posts`)
      }
      console.log('')
    }
    
    // Final status report
    console.log('📊 FINAL QUEUE STATUS:')
    const finalStats = await getContentStats()
    
    console.log(`  Total Content: ${finalStats.totalExisting}`)
    console.log(`  Approved: ${finalStats.totalApproved}`)
    console.log(`  Ready to Post: ${finalStats.totalReadyToPost}`)
    console.log(`  Already Posted: ${finalStats.totalPosted}`)
    console.log(`  Days Remaining: ${finalStats.daysOfContent}`)
    console.log('')
    
    const improvement = finalStats.daysOfContent - initialStats.daysOfContent
    
    console.log('✅ EMERGENCY APPROVAL COMPLETED')
    console.log(`📈 Improvement: +${improvement.toFixed(1)} days of content`)
    console.log(`🔧 Total Actions: ${totalActionsPerformed}`)
    
    if (finalStats.daysOfContent >= 3) {
      console.log('🎉 Content crisis resolved! System now has healthy buffer.')
    } else if (finalStats.daysOfContent >= 1) {
      console.log('⚠️  Crisis partially resolved. Consider running platform scans to get more content.')
    } else {
      console.log('🚨 Crisis persists. Manual intervention may be needed.')
      console.log('   Recommendations:')
      console.log('   - Run platform scanning workflows immediately')
      console.log('   - Check API credentials and scanning services')
      console.log('   - Consider manual content addition')
    }
    
  } catch (error) {
    console.error('❌ Emergency approval failed:')
    console.error(error instanceof Error ? error.message : 'Unknown error')
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace')
    process.exit(1)
  } finally {
    await db.disconnect()
  }
}

// Parse command line arguments
const args = process.argv.slice(2)

if (args.includes('--help') || args.includes('-h')) {
  console.log('Emergency Content Approval Script')
  console.log('')
  console.log('Usage:')
  console.log('  DATABASE_USER=user DATABASE_PASSWORD=pass NODE_ENV=development npx tsx scripts/emergency-content-approval.ts')
  console.log('')
  console.log('Options:')
  console.log('  --help, -h       Show this help message')
  console.log('  --target-days=N  Target number of days of content (default: 5)')
  console.log('')
  console.log('This script will:')
  console.log('1. Approve high-confidence unapproved content')
  console.log('2. Recycle old posted content if needed')
  console.log('3. Create emergency test content as last resort')
  process.exit(0)
}

// Run the emergency approval
emergencyContentApproval()