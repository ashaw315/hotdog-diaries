import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createSimpleClient } from '@/utils/supabase/server'
import { format, subDays } from 'date-fns'

/**
 * Health endpoint for posting source of truth verification
 * 
 * Validates that:
 * 1. All recent posts have corresponding scheduled_posts entries
 * 2. No orphan posts exist in posted_content
 * 3. scheduled_posts table is being used as single source of truth
 * 4. Feature flag ENFORCE_SCHEDULE_SOURCE_OF_TRUTH is active
 */

interface PostingHealthCheck {
  status: 'healthy' | 'warning' | 'error'
  feature_flag_active: boolean
  total_recent_posts: number
  linked_posts: number
  orphan_posts: number
  orphan_percentage: number
  scheduled_posts_count: number
  posting_compliance_score: number
  issues: string[]
  recommendations: string[]
  metadata: {
    check_period_days: number
    check_timestamp: string
    database_type: 'sqlite' | 'supabase'
  }
}

// Database detection
function getDatabaseConfig() {
  const isVercel = !!(process.env.POSTGRES_URL || process.env.DATABASE_URL?.includes('postgres')) && process.env.NODE_ENV === 'production'
  const isSqlite = process.env.NODE_ENV === 'development' && !process.env.USE_POSTGRES_IN_DEV && !process.env.DATABASE_URL?.includes('postgres')
  
  return { isVercel, isSqlite }
}

// Query recent posting statistics
async function getPostingStatistics(checkPeriodDays: number) {
  const { isSqlite } = getDatabaseConfig()
  const cutoffDate = format(subDays(new Date(), checkPeriodDays), 'yyyy-MM-dd')
  
  if (isSqlite) {
    await db.connect()
    try {
      // Get recent posts count
      const totalResult = await db.query(`
        SELECT COUNT(*) as total
        FROM posted_content
        WHERE DATE(posted_at) >= DATE(?)
      `, [cutoffDate])
      
      const totalRecentPosts = totalResult.rows[0]?.total || 0
      
      // Get linked posts count
      const linkedResult = await db.query(`
        SELECT COUNT(*) as linked
        FROM posted_content
        WHERE DATE(posted_at) >= DATE(?)
          AND scheduled_post_id IS NOT NULL
      `, [cutoffDate])
      
      const linkedPosts = linkedResult.rows[0]?.linked || 0
      
      // Get scheduled posts count
      const scheduledResult = await db.query(`
        SELECT COUNT(*) as scheduled
        FROM scheduled_posts
        WHERE DATE(scheduled_post_time) >= DATE(?)
      `, [cutoffDate])
      
      const scheduledPostsCount = scheduledResult.rows[0]?.scheduled || 0
      
      return {
        totalRecentPosts,
        linkedPosts,
        orphanPosts: totalRecentPosts - linkedPosts,
        scheduledPostsCount
      }
    } finally {
      await db.disconnect()
    }
  } else {
    // Supabase
    const supabase = createSimpleClient()
    
    // Get recent posts count
    const { count: totalRecentPosts } = await supabase
      .from('posted_content')
      .select('*', { count: 'exact', head: true })
      .gte('posted_at', cutoffDate + 'T00:00:00Z')
    
    // Get linked posts count
    const { count: linkedPosts } = await supabase
      .from('posted_content')
      .select('*', { count: 'exact', head: true })
      .gte('posted_at', cutoffDate + 'T00:00:00Z')
      .not('scheduled_post_id', 'is', null)
    
    // Get scheduled posts count
    const { count: scheduledPostsCount } = await supabase
      .from('scheduled_posts')
      .select('*', { count: 'exact', head: true })
      .gte('scheduled_post_time', cutoffDate + 'T00:00:00Z')
    
    return {
      totalRecentPosts: totalRecentPosts || 0,
      linkedPosts: linkedPosts || 0,
      orphanPosts: (totalRecentPosts || 0) - (linkedPosts || 0),
      scheduledPostsCount: scheduledPostsCount || 0
    }
  }
}

// Check if feature flag is active
function checkFeatureFlag(): boolean {
  return process.env.ENFORCE_SCHEDULE_SOURCE_OF_TRUTH === 'true'
}

// Perform comprehensive health check
async function performHealthCheck(checkPeriodDays: number): Promise<PostingHealthCheck> {
  const issues: string[] = []
  const recommendations: string[] = []
  
  // Check feature flag
  const featureFlagActive = checkFeatureFlag()
  if (!featureFlagActive) {
    issues.push('ENFORCE_SCHEDULE_SOURCE_OF_TRUTH feature flag is not active')
    recommendations.push('Set ENFORCE_SCHEDULE_SOURCE_OF_TRUTH=true to enforce scheduled_posts as single source of truth')
  }
  
  // Get posting statistics
  const stats = await getPostingStatistics(checkPeriodDays)
  
  // Calculate metrics
  const orphanPercentage = stats.totalRecentPosts > 0 
    ? (stats.orphanPosts / stats.totalRecentPosts) * 100 
    : 0
  
  // Analyze issues
  if (stats.orphanPosts > 0) {
    issues.push(`${stats.orphanPosts} orphan posts found (${orphanPercentage.toFixed(1)}% of recent posts)`)
    recommendations.push('Run backfill job: npx tsx scripts/ops/backfill-post-links.ts --date YYYY-MM-DD --write')
  }
  
  if (stats.scheduledPostsCount === 0) {
    issues.push('No scheduled_posts entries found for the check period')
    recommendations.push('Verify that daily schedule generation is working: npx tsx lib/jobs/schedule-content-production.ts')
  }
  
  if (stats.totalRecentPosts === 0) {
    issues.push('No recent posts found in the check period')
    recommendations.push('Verify that posting system is operational')
  }
  
  // Calculate compliance score (0-100)
  let complianceScore = 100
  if (stats.totalRecentPosts > 0) {
    complianceScore = Math.round((stats.linkedPosts / stats.totalRecentPosts) * 100)
  }
  
  if (!featureFlagActive) {
    complianceScore = Math.min(complianceScore, 75) // Cap at 75% if feature flag inactive
  }
  
  // Determine overall status
  let status: 'healthy' | 'warning' | 'error' = 'healthy'
  if (orphanPercentage > 20 || !featureFlagActive || stats.scheduledPostsCount === 0) {
    status = 'error'
  } else if (orphanPercentage > 5 || complianceScore < 95) {
    status = 'warning'
  }
  
  return {
    status,
    feature_flag_active: featureFlagActive,
    total_recent_posts: stats.totalRecentPosts,
    linked_posts: stats.linkedPosts,
    orphan_posts: stats.orphanPosts,
    orphan_percentage: orphanPercentage,
    scheduled_posts_count: stats.scheduledPostsCount,
    posting_compliance_score: complianceScore,
    issues,
    recommendations,
    metadata: {
      check_period_days: checkPeriodDays,
      check_timestamp: new Date().toISOString(),
      database_type: getDatabaseConfig().isSqlite ? 'sqlite' : 'supabase'
    }
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const checkPeriodDays = parseInt(searchParams.get('days') || '7', 10)
    
    console.log(`🔍 Health check: posting source of truth (${checkPeriodDays} days)`)
    
    const healthCheck = await performHealthCheck(checkPeriodDays)
    
    const responseCode = healthCheck.status === 'healthy' ? 200 : 
                        healthCheck.status === 'warning' ? 200 : 500
    
    console.log(`🔍 Posting health: ${healthCheck.status} (compliance: ${healthCheck.posting_compliance_score}%)`)
    if (healthCheck.issues.length > 0) {
      console.log(`   Issues: ${healthCheck.issues.join(', ')}`)
    }
    
    return NextResponse.json(healthCheck, { 
      status: responseCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    })
    
  } catch (error: any) {
    console.error('❌ Posting health check failed:', error)
    
    return NextResponse.json({
      status: 'error',
      feature_flag_active: false,
      total_recent_posts: 0,
      linked_posts: 0,
      orphan_posts: 0,
      orphan_percentage: 0,
      scheduled_posts_count: 0,
      posting_compliance_score: 0,
      issues: [`Health check failed: ${error.message}`],
      recommendations: ['Contact system administrator to investigate health check failure'],
      metadata: {
        check_period_days: 7,
        check_timestamp: new Date().toISOString(),
        database_type: getDatabaseConfig().isSqlite ? 'sqlite' : 'supabase'
      }
    }, { status: 500 })
  }
}