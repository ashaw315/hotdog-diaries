import { NextRequest, NextResponse } from 'next/server'
import { createSimpleClient } from '@/utils/supabase/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  console.log('🤖 Auto-approval API triggered...')
  
  try {
    // Auth check for GitHub Actions
    const authHeader = request.headers.get('authorization')
    const isAuthenticated = authHeader === `Bearer ${process.env.AUTH_TOKEN}`
    
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isDevelopment = process.env.NODE_ENV === 'development'
    
    // Parse request options
    const body = await request.json().catch(() => ({}))
    const { 
      forceApproval = false,
      maxItems = 200,
      minConfidenceScore = 0.4 
    } = body

    console.log('🔧 Auto-approval options:', { forceApproval, maxItems, minConfidenceScore })

    // Run progressive auto-approval logic
    const approvalResults = await runProgressiveAutoApproval(maxItems, minConfidenceScore, forceApproval)
    
    // Get updated queue statistics
    let updatedStats
    if (isDevelopment) {
      await db.connect()
      const stats = await db.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN is_approved = ? THEN 1 ELSE 0 END) as approved,
          SUM(CASE WHEN is_posted = ? AND is_approved = ? THEN 1 ELSE 0 END) as ready_to_post,
          SUM(CASE WHEN is_approved = ? AND is_posted = ? THEN 1 ELSE 0 END) as pending_approval
        FROM content_queue
      `, [1, 0, 1, 0, 0])
      
      const row = stats.rows[0]
      updatedStats = {
        total: row?.total || 0,
        approved: row?.approved || 0,
        readyToPost: row?.ready_to_post || 0,
        pendingApproval: row?.pending_approval || 0,
        daysOfContent: Math.floor((row?.ready_to_post || 0) / 6)
      }
    } else {
      const supabase = createSimpleClient()
      const { data: queueData } = await supabase
        .from('content_queue')
        .select('is_approved, is_posted')
      
      updatedStats = {
        total: queueData?.length || 0,
        approved: queueData?.filter(c => c.is_approved).length || 0,
        readyToPost: queueData?.filter(c => c.is_approved && !c.is_posted).length || 0,
        pendingApproval: queueData?.filter(c => !c.is_approved && !c.is_posted).length || 0,
        daysOfContent: Math.floor((queueData?.filter(c => c.is_approved && !c.is_posted).length || 0) / 6)
      }
    }

    const success = approvalResults.total > 0
    
    console.log(`✅ Auto-approval complete: ${approvalResults.total} items approved`)
    
    return NextResponse.json({
      success,
      message: success 
        ? `Auto-approved ${approvalResults.total} items successfully`
        : 'No items needed approval',
      approvalResults,
      updatedStats,
      recommendations: generateRecommendations(updatedStats),
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Auto-approval failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Auto-approval failed',
      approvalResults: { immediate: 0, aged24h: 0, aged48h: 0, aged72h: 0, balanced: 0, total: 0 }
    }, { status: 500 })
  }
}

// GET endpoint for checking approval status
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const isAuthenticated = authHeader === `Bearer ${process.env.AUTH_TOKEN}`
    
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isDevelopment = process.env.NODE_ENV === 'development'
    
    let approvalCandidates
    if (isDevelopment) {
      await db.connect()
      
      const highQuality = await db.query(`
        SELECT COUNT(*) as count FROM content_queue 
        WHERE is_approved = false AND is_posted = false AND confidence_score >= 0.8
      `)
      
      const mediumQuality = await db.query(`
        SELECT COUNT(*) as count FROM content_queue 
        WHERE is_approved = false AND is_posted = false AND confidence_score >= 0.6 AND confidence_score < 0.8
      `)
      
      const aged24h = await db.query(`
        SELECT COUNT(*) as count FROM content_queue 
        WHERE is_approved = false AND is_posted = false AND confidence_score >= 0.6 
        AND created_at <= datetime('now', '-1 day')
      `)
      
      const aged48h = await db.query(`
        SELECT COUNT(*) as count FROM content_queue 
        WHERE is_approved = false AND is_posted = false AND confidence_score >= 0.5
        AND created_at <= datetime('now', '-2 day')
      `)
      
      const aged72h = await db.query(`
        SELECT COUNT(*) as count FROM content_queue 
        WHERE is_approved = false AND is_posted = false AND confidence_score >= 0.4
        AND created_at <= datetime('now', '-3 day')
      `)
      
      approvalCandidates = {
        immediateHighQuality: highQuality.rows[0]?.count || 0,
        mediumQuality: mediumQuality.rows[0]?.count || 0,
        aged24h: aged24h.rows[0]?.count || 0,
        aged48h: aged48h.rows[0]?.count || 0,
        aged72h: aged72h.rows[0]?.count || 0
      }
    } else {
      // Supabase version would be more complex, implementing basic version
      approvalCandidates = {
        immediateHighQuality: 0,
        mediumQuality: 0,
        aged24h: 0,
        aged48h: 0,
        aged72h: 0
      }
    }
    
    const totalCandidates = Object.values(approvalCandidates).reduce((sum: number, count: any) => sum + count, 0)
    
    return NextResponse.json({
      success: true,
      approvalCandidates,
      totalCandidates,
      estimation: {
        wouldApprove: totalCandidates,
        additionalDays: Math.floor(totalCandidates / 6),
        recommendedAction: totalCandidates > 50 ? 'Run auto-approval' : 'Approval not needed'
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check approval status'
    }, { status: 500 })
  }
}

// Core progressive auto-approval logic
async function runProgressiveAutoApproval(maxItems: number, minConfidenceScore: number, forceApproval: boolean) {
  console.log('🤖 Running progressive auto-approval...')
  
  const isDevelopment = process.env.NODE_ENV === 'development'
  const now = new Date()
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000)
  const threeDaysAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000)
  
  let totalApproved = 0
  const results = { immediate: 0, aged24h: 0, aged48h: 0, aged72h: 0, balanced: 0 }
  
  if (isDevelopment) {
    await db.connect()
    
    // 1. Immediately approve high-quality content (confidence >= 0.8)
    const immediateResult = await db.query(`
      UPDATE content_queue 
      SET is_approved = ?, 
          admin_notes = ?,
          updated_at = ?
      WHERE is_approved = ? 
        AND is_posted = ?
        AND confidence_score >= ?
      ${!forceApproval ? `AND id IN (SELECT id FROM content_queue WHERE is_approved = false AND is_posted = false AND confidence_score >= 0.8 LIMIT ${Math.floor(maxItems * 0.3)})` : ''}
    `, [1, 'Auto-approved - high quality (≥0.8)', now.toISOString(), 0, 0, 0.8])
    
    results.immediate = immediateResult.rowCount || 0
    totalApproved += results.immediate
    
    // 2. Approve medium-quality content after 24 hours
    const aged24Result = await db.query(`
      UPDATE content_queue 
      SET is_approved = ?, 
          admin_notes = ?,
          updated_at = ?
      WHERE is_approved = ? 
        AND is_posted = ?
        AND confidence_score >= ?
        AND created_at <= ?
      ${!forceApproval ? `AND id IN (SELECT id FROM content_queue WHERE is_approved = false AND is_posted = false AND confidence_score >= 0.6 AND created_at <= ? LIMIT ${Math.floor(maxItems * 0.25)})` : ''}
    `, [1, 'Auto-approved - aged 24h + medium quality (≥0.6)', now.toISOString(), 0, 0, 0.6, oneDayAgo.toISOString(), ...(forceApproval ? [] : [oneDayAgo.toISOString()])])
    
    results.aged24h = aged24Result.rowCount || 0
    totalApproved += results.aged24h
    
    // 3. Approve decent content after 48 hours
    const aged48Result = await db.query(`
      UPDATE content_queue 
      SET is_approved = ?, 
          admin_notes = ?,
          updated_at = ?
      WHERE is_approved = ? 
        AND is_posted = ?
        AND confidence_score >= ?
        AND created_at <= ?
      ${!forceApproval ? `AND id IN (SELECT id FROM content_queue WHERE is_approved = false AND is_posted = false AND confidence_score >= 0.5 AND created_at <= ? LIMIT ${Math.floor(maxItems * 0.25)})` : ''}
    `, [1, 'Auto-approved - aged 48h + decent quality (≥0.5)', now.toISOString(), 0, 0, 0.5, twoDaysAgo.toISOString(), ...(forceApproval ? [] : [twoDaysAgo.toISOString()])])
    
    results.aged48h = aged48Result.rowCount || 0
    totalApproved += results.aged48h
    
    // 4. Approve any non-spam content after 72 hours
    const aged72Result = await db.query(`
      UPDATE content_queue 
      SET is_approved = ?, 
          admin_notes = ?,
          updated_at = ?
      WHERE is_approved = ? 
        AND is_posted = ?
        AND confidence_score >= ?
        AND created_at <= ?
      ${!forceApproval ? `AND id IN (SELECT id FROM content_queue WHERE is_approved = false AND is_posted = false AND confidence_score >= ${minConfidenceScore} AND created_at <= ? LIMIT ${Math.floor(maxItems * 0.2)})` : ''}
    `, [1, `Auto-approved - aged 72h + non-spam (≥${minConfidenceScore})`, now.toISOString(), 0, 0, minConfidenceScore, threeDaysAgo.toISOString(), ...(forceApproval ? [] : [threeDaysAgo.toISOString()])])
    
    results.aged72h = aged72Result.rowCount || 0
    totalApproved += results.aged72h
    
    // 5. Platform-balanced approval
    const platformBalanceResult = await runBalancedPlatformApproval(maxItems * 0.1, minConfidenceScore)
    results.balanced = platformBalanceResult
    totalApproved += results.balanced
    
  } else {
    // Supabase implementation would be more complex
    console.log('⚠️ Production auto-approval not fully implemented for Supabase yet')
  }
  
  console.log(`🎉 Progressive approval complete: ${totalApproved} total items approved`)
  console.log('📊 Breakdown:', results)
  
  return {
    ...results,
    total: totalApproved
  }
}

// Balanced platform approval
async function runBalancedPlatformApproval(maxPerPlatform: number, minConfidenceScore: number) {
  const platforms = ['youtube', 'reddit', 'giphy', 'imgur', 'bluesky', 'pixabay', 'lemmy', 'tumblr']
  let totalApproved = 0
  
  for (const platform of platforms) {
    try {
      const result = await db.query(`
        UPDATE content_queue 
        SET is_approved = ?, 
            admin_notes = ?,
            updated_at = ?
        WHERE is_approved = ? 
          AND is_posted = ?
          AND source_platform = ?
          AND confidence_score >= ?
          AND id IN (
            SELECT id FROM content_queue 
            WHERE is_approved = ? 
              AND is_posted = ?
              AND source_platform = ? 
              AND confidence_score >= ?
            ORDER BY confidence_score DESC 
            LIMIT ?
          )
      `, [1, `Auto-approved for platform balance (${platform})`, new Date().toISOString(), 0, 0, platform, minConfidenceScore, 0, 0, platform, minConfidenceScore, Math.floor(maxPerPlatform)])
      
      totalApproved += result.rowCount || 0
    } catch (error) {
      console.error(`Platform approval failed for ${platform}:`, error)
    }
  }
  
  return totalApproved
}

// Generate recommendations based on queue status
function generateRecommendations(stats: any): string[] {
  const recommendations = []
  
  if (stats.daysOfContent < 7) {
    recommendations.push('URGENT: Run comprehensive content scanning')
  } else if (stats.daysOfContent < 14) {
    recommendations.push('Run additional platform scanning')
  }
  
  if (stats.pendingApproval > 100) {
    recommendations.push('High volume of pending approval - consider running auto-approval more frequently')
  } else if (stats.pendingApproval < 20) {
    recommendations.push('Content pipeline healthy - maintain current scanning frequency')
  }
  
  if (stats.daysOfContent > 30) {
    recommendations.push('Abundant content - consider reducing scanning frequency to save API costs')
  }
  
  return recommendations
}