import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createSimpleClient } from '@/utils/supabase/server'
import { getEasternDateString, getEasternDateRange } from '@/lib/utils/time-helpers'

interface DiversityMetrics {
  date: string
  overallScore: number
  platformBalance: {
    distribution: Record<string, number>
    variance: number
    dominantPlatform: string
    dominantPercentage: number
  }
  temporalAnalysis: {
    consecutivePlatforms: number
    averageSpacing: number
    maxSpacing: number
    minSpacing: number
  }
  contentTypes: {
    distribution: Record<string, number>
    alternationScore: number
  }
  alerts: DiversityAlert[]
  recommendations: string[]
}

interface DiversityAlert {
  severity: 'low' | 'medium' | 'high' | 'critical'
  type: 'platform_dominance' | 'consecutive_posts' | 'poor_spacing' | 'type_imbalance' | 'score_drop'
  message: string
  affectedSlots?: number[]
  threshold?: number
  actual?: number
}

interface HistoricalComparison {
  currentScore: number
  yesterdayScore: number
  weekAverageScore: number
  scoreTrend: 'improving' | 'stable' | 'declining'
  dropPercentage: number
}

/**
 * Get database client with environment detection
 */
async function getDbClient() {
  const isVercel = !!(process.env.POSTGRES_URL || process.env.DATABASE_URL?.includes('postgres')) && process.env.NODE_ENV === 'production'
  const isSqlite = process.env.NODE_ENV === 'development' && !process.env.USE_POSTGRES_IN_DEV && !process.env.DATABASE_URL?.includes('postgres')
  
  if (isSqlite) {
    await db.connect()
    return { db, type: 'sqlite' as const }
  } else {
    const supabase = createSimpleClient()
    return { db: supabase, type: 'supabase' as const }
  }
}

/**
 * Get scheduled posts for date range with platform and content info
 */
async function getScheduledPosts(startDate: string, endDate: string) {
  const { db: dbClient, type } = await getDbClient()
  
  try {
    if (type === 'sqlite') {
      const result = await db.query(`
        SELECT 
          sp.scheduled_slot_index,
          sp.platform,
          sp.content_type,
          sp.scheduled_post_time,
          sp.actual_posted_at,
          DATE(sp.scheduled_post_time) as schedule_date,
          cq.confidence_score
        FROM scheduled_posts sp
        LEFT JOIN content_queue cq ON sp.content_id = cq.id
        WHERE DATE(sp.scheduled_post_time) BETWEEN ? AND ?
        ORDER BY sp.scheduled_post_time ASC
      `, [startDate, endDate])
      
      return result.rows || []
    } else {
      // Supabase - try scheduled_day first, fallback to time range
      try {
        const { data, error } = await dbClient
          .from('scheduled_posts')
          .select(`
            scheduled_slot_index,
            platform,
            content_type,
            scheduled_post_time,
            actual_posted_at,
            scheduled_day,
            content_queue!inner(confidence_score)
          `)
          .gte('scheduled_day', startDate)
          .lte('scheduled_day', endDate)
          .order('scheduled_post_time', { ascending: true })
        
        if (error) throw error
        
        return (data || []).map(row => ({
          scheduled_slot_index: row.scheduled_slot_index,
          platform: row.platform,
          content_type: row.content_type,
          scheduled_post_time: row.scheduled_post_time,
          actual_posted_at: row.actual_posted_at,
          schedule_date: row.scheduled_day,
          confidence_score: row.content_queue?.confidence_score || 0.5
        }))
      } catch (e: any) {
        // Fallback to time range query
        const startUtc = new Date(startDate + 'T00:00:00-05:00').toISOString()
        const endUtc = new Date(endDate + 'T23:59:59-05:00').toISOString()
        
        const { data, error } = await dbClient
          .from('scheduled_posts')
          .select(`
            scheduled_slot_index,
            platform,
            content_type,
            scheduled_post_time,
            actual_posted_at,
            content_queue!inner(confidence_score)
          `)
          .gte('scheduled_post_time', startUtc)
          .lte('scheduled_post_time', endUtc)
          .order('scheduled_post_time', { ascending: true })
        
        if (error) throw error
        
        return (data || []).map(row => ({
          scheduled_slot_index: row.scheduled_slot_index,
          platform: row.platform,
          content_type: row.content_type,
          scheduled_post_time: row.scheduled_post_time,
          actual_posted_at: row.actual_posted_at,
          schedule_date: new Date(row.scheduled_post_time).toISOString().split('T')[0],
          confidence_score: row.content_queue?.confidence_score || 0.5
        }))
      }
    }
  } finally {
    if (type === 'sqlite') {
      await db.disconnect()
    }
  }
}

/**
 * Calculate platform balance metrics
 */
function calculatePlatformBalance(posts: any[]) {
  const distribution = posts.reduce((acc, post) => {
    acc[post.platform] = (acc[post.platform] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  
  const platforms = Object.keys(distribution)
  const counts = Object.values(distribution)
  const totalPosts = posts.length
  
  if (totalPosts === 0) {
    return {
      distribution: {},
      variance: 0,
      dominantPlatform: '',
      dominantPercentage: 0
    }
  }
  
  // Calculate variance
  const avgCount = totalPosts / platforms.length
  const variance = counts.reduce((acc, count) => acc + Math.pow(count - avgCount, 2), 0) / platforms.length
  
  // Find dominant platform
  const maxCount = Math.max(...counts)
  const dominantPlatform = Object.entries(distribution).find(([_, count]) => count === maxCount)?.[0] || ''
  const dominantPercentage = (maxCount / totalPosts) * 100
  
  return {
    distribution,
    variance,
    dominantPlatform,
    dominantPercentage
  }
}

/**
 * Calculate temporal spacing analysis
 */
function calculateTemporalAnalysis(posts: any[]) {
  if (posts.length < 2) {
    return {
      consecutivePlatforms: 0,
      averageSpacing: 0,
      maxSpacing: 0,
      minSpacing: 0
    }
  }
  
  let consecutivePlatforms = 0
  const spacings: Record<string, number[]> = {}
  
  // Track consecutive platforms
  for (let i = 1; i < posts.length; i++) {
    if (posts[i].platform === posts[i - 1].platform) {
      consecutivePlatforms++
    }
  }
  
  // Track spacing between same platform posts
  posts.forEach((post, index) => {
    if (!spacings[post.platform]) spacings[post.platform] = []
    spacings[post.platform].push(index)
  })
  
  const allSpacings: number[] = []
  Object.values(spacings).forEach(indices => {
    for (let i = 1; i < indices.length; i++) {
      allSpacings.push(indices[i] - indices[i - 1])
    }
  })
  
  const averageSpacing = allSpacings.length > 0 ? allSpacings.reduce((a, b) => a + b, 0) / allSpacings.length : 0
  const maxSpacing = allSpacings.length > 0 ? Math.max(...allSpacings) : 0
  const minSpacing = allSpacings.length > 0 ? Math.min(...allSpacings) : 0
  
  return {
    consecutivePlatforms,
    averageSpacing,
    maxSpacing,
    minSpacing
  }
}

/**
 * Calculate content type alternation score
 */
function calculateContentTypeMetrics(posts: any[]) {
  const distribution = posts.reduce((acc, post) => {
    const type = post.content_type || 'text'
    acc[type] = (acc[type] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  
  // Calculate alternation score (penalize consecutive same types)
  let alternationScore = 100
  for (let i = 1; i < posts.length; i++) {
    const currentType = posts[i].content_type || 'text'
    const previousType = posts[i - 1].content_type || 'text'
    
    if (currentType === previousType) {
      alternationScore -= 5 // 5 point penalty per consecutive same type
    }
  }
  
  return {
    distribution,
    alternationScore: Math.max(0, alternationScore)
  }
}

/**
 * Generate diversity alerts based on thresholds
 */
function generateAlerts(
  platformBalance: ReturnType<typeof calculatePlatformBalance>,
  temporalAnalysis: ReturnType<typeof calculateTemporalAnalysis>,
  contentTypes: ReturnType<typeof calculateContentTypeMetrics>,
  totalPosts: number
): DiversityAlert[] {
  const alerts: DiversityAlert[] = []
  
  // Platform dominance alert
  if (platformBalance.dominantPercentage > 50) {
    alerts.push({
      severity: platformBalance.dominantPercentage > 70 ? 'critical' : 'high',
      type: 'platform_dominance',
      message: `${platformBalance.dominantPlatform} dominates with ${platformBalance.dominantPercentage.toFixed(1)}% of posts`,
      threshold: 50,
      actual: platformBalance.dominantPercentage
    })
  }
  
  // Consecutive posts alert
  const consecutivePercentage = (temporalAnalysis.consecutivePlatforms / totalPosts) * 100
  if (consecutivePercentage > 20) {
    alerts.push({
      severity: consecutivePercentage > 40 ? 'high' : 'medium',
      type: 'consecutive_posts',
      message: `${temporalAnalysis.consecutivePlatforms} consecutive same-platform posts (${consecutivePercentage.toFixed(1)}%)`,
      threshold: 20,
      actual: consecutivePercentage
    })
  }
  
  // Poor spacing alert
  if (temporalAnalysis.averageSpacing < 2 && totalPosts > 6) {
    alerts.push({
      severity: temporalAnalysis.averageSpacing < 1 ? 'high' : 'medium',
      type: 'poor_spacing',
      message: `Average platform spacing is only ${temporalAnalysis.averageSpacing.toFixed(1)} slots`,
      threshold: 2,
      actual: temporalAnalysis.averageSpacing
    })
  }
  
  // Content type imbalance
  if (contentTypes.alternationScore < 70) {
    alerts.push({
      severity: contentTypes.alternationScore < 50 ? 'high' : 'medium',
      type: 'type_imbalance',
      message: `Poor content type alternation (score: ${contentTypes.alternationScore}/100)`,
      threshold: 70,
      actual: contentTypes.alternationScore
    })
  }
  
  return alerts
}

/**
 * Generate recommendations based on metrics
 */
function generateRecommendations(
  platformBalance: ReturnType<typeof calculatePlatformBalance>,
  temporalAnalysis: ReturnType<typeof calculateTemporalAnalysis>,
  alerts: DiversityAlert[]
): string[] {
  const recommendations: string[] = []
  
  if (alerts.some(a => a.type === 'platform_dominance')) {
    recommendations.push(`Reduce ${platformBalance.dominantPlatform} posts and increase underrepresented platforms`)
  }
  
  if (alerts.some(a => a.type === 'consecutive_posts')) {
    recommendations.push('Implement stricter platform spacing rules in scheduler')
  }
  
  if (alerts.some(a => a.type === 'poor_spacing')) {
    recommendations.push('Increase minimum spacing between same-platform posts')
  }
  
  if (alerts.some(a => a.type === 'type_imbalance')) {
    recommendations.push('Improve content type alternation between image/video/text posts')
  }
  
  if (platformBalance.variance > 2) {
    recommendations.push('Balance platform distribution more evenly across daily slots')
  }
  
  if (temporalAnalysis.minSpacing === 0) {
    recommendations.push('Eliminate adjacent same-platform posts entirely')
  }
  
  return recommendations
}

/**
 * Calculate overall diversity score
 */
function calculateOverallScore(
  platformBalance: ReturnType<typeof calculatePlatformBalance>,
  temporalAnalysis: ReturnType<typeof calculateTemporalAnalysis>,
  contentTypes: ReturnType<typeof calculateContentTypeMetrics>,
  totalPosts: number
): number {
  if (totalPosts === 0) return 0
  
  // Platform diversity score (0-40 points)
  const platformScore = Math.max(0, 40 - (platformBalance.variance * 5))
  
  // Temporal diversity score (0-30 points)
  const consecutiveRatio = temporalAnalysis.consecutivePlatforms / totalPosts
  const temporalScore = Math.max(0, 30 - (consecutiveRatio * 100))
  
  // Content type score (0-30 points)
  const typeScore = (contentTypes.alternationScore / 100) * 30
  
  return Math.round(platformScore + temporalScore + typeScore)
}

/**
 * Get historical comparison data
 */
async function getHistoricalComparison(currentScore: number, date: string): Promise<HistoricalComparison> {
  try {
    const yesterday = new Date(date)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]
    
    const weekAgo = new Date(date)
    weekAgo.setDate(weekAgo.getDate() - 7)
    const weekAgoStr = weekAgo.toISOString().split('T')[0]
    
    // Get yesterday's posts
    const yesterdayPosts = await getScheduledPosts(yesterdayStr, yesterdayStr)
    const yesterdayPlatformBalance = calculatePlatformBalance(yesterdayPosts)
    const yesterdayTemporalAnalysis = calculateTemporalAnalysis(yesterdayPosts)
    const yesterdayContentTypes = calculateContentTypeMetrics(yesterdayPosts)
    const yesterdayScore = calculateOverallScore(
      yesterdayPlatformBalance,
      yesterdayTemporalAnalysis,
      yesterdayContentTypes,
      yesterdayPosts.length
    )
    
    // Get week's posts for average
    const weekPosts = await getScheduledPosts(weekAgoStr, date)
    const weekPlatformBalance = calculatePlatformBalance(weekPosts)
    const weekTemporalAnalysis = calculateTemporalAnalysis(weekPosts)
    const weekContentTypes = calculateContentTypeMetrics(weekPosts)
    const weekAverageScore = calculateOverallScore(
      weekPlatformBalance,
      weekTemporalAnalysis,
      weekContentTypes,
      weekPosts.length
    )
    
    const dropPercentage = yesterdayScore > 0 ? ((yesterdayScore - currentScore) / yesterdayScore) * 100 : 0
    
    let scoreTrend: 'improving' | 'stable' | 'declining'
    if (currentScore > yesterdayScore + 5) {
      scoreTrend = 'improving'
    } else if (currentScore < yesterdayScore - 5) {
      scoreTrend = 'declining'
    } else {
      scoreTrend = 'stable'
    }
    
    return {
      currentScore,
      yesterdayScore,
      weekAverageScore,
      scoreTrend,
      dropPercentage
    }
    
  } catch (error) {
    console.error('Error getting historical comparison:', error)
    return {
      currentScore,
      yesterdayScore: currentScore,
      weekAverageScore: currentScore,
      scoreTrend: 'stable',
      dropPercentage: 0
    }
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date') || getEasternDateString()
    const includePredictions = searchParams.get('predictions') === 'true'
    
    console.log(`📊 Calculating diversity metrics for ${date}`)
    
    // Get scheduled posts for the target date
    const posts = await getScheduledPosts(date, date)
    console.log(`📋 Found ${posts.length} scheduled posts for analysis`)
    
    if (posts.length === 0) {
      return NextResponse.json({
        error: 'No scheduled posts found for the specified date',
        date,
        recommendation: 'Run schedule generation first'
      }, { status: 404 })
    }
    
    // Calculate all metrics
    const platformBalance = calculatePlatformBalance(posts)
    const temporalAnalysis = calculateTemporalAnalysis(posts)
    const contentTypes = calculateContentTypeMetrics(posts)
    const overallScore = calculateOverallScore(platformBalance, temporalAnalysis, contentTypes, posts.length)
    
    // Generate alerts and recommendations
    const alerts = generateAlerts(platformBalance, temporalAnalysis, contentTypes, posts.length)
    const recommendations = generateRecommendations(platformBalance, temporalAnalysis, alerts)
    
    // Get historical comparison
    const historicalComparison = await getHistoricalComparison(overallScore, date)
    
    // Check for score drop alert
    if (historicalComparison.dropPercentage > 30) {
      alerts.push({
        severity: historicalComparison.dropPercentage > 50 ? 'critical' : 'high',
        type: 'score_drop',
        message: `Diversity score dropped ${historicalComparison.dropPercentage.toFixed(1)}% from yesterday`,
        threshold: 30,
        actual: historicalComparison.dropPercentage
      })
    }
    
    const metrics: DiversityMetrics = {
      date,
      overallScore,
      platformBalance,
      temporalAnalysis,
      contentTypes,
      alerts,
      recommendations
    }
    
    const response = {
      ...metrics,
      historical: historicalComparison,
      summary: {
        status: alerts.some(a => a.severity === 'critical') ? 'critical' :
                alerts.some(a => a.severity === 'high') ? 'warning' :
                alerts.some(a => a.severity === 'medium') ? 'attention' : 'healthy',
        score: overallScore,
        trend: historicalComparison.scoreTrend,
        totalPosts: posts.length,
        alertCount: alerts.length
      }
    }
    
    console.log(`📊 Diversity analysis complete: ${overallScore}/100 (${response.summary.status})`)
    
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
    
  } catch (error) {
    console.error('Diversity metrics calculation failed:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Metrics calculation failed',
      date: getEasternDateString()
    }, { status: 500 })
  }
}