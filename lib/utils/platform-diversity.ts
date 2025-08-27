import { createSimpleClient } from '@/utils/supabase/server'
import { db } from '@/lib/db'

export interface ContentCandidate {
  id: number
  content_text?: string
  content_image_url?: string | null
  content_video_url?: string | null
  content_type: string
  source_platform: string
  original_url: string
  original_author?: string
  confidence_score: number
  created_at: string
}

export interface PlatformDiversityOptions {
  maxPosts?: number
  mealTime?: string
  avoidRecentPlatforms?: boolean
  enforceContentTypeMix?: boolean
  platformPriority?: string[]
}

// Platform priority: Higher priority platforms preferred when quality is similar
const DEFAULT_PLATFORM_PRIORITY = [
  'youtube',    // Video content - highest engagement
  'reddit',     // Community content - good engagement  
  'giphy',      // GIFs - high visual appeal
  'bluesky',    // Social content - good diversity
  'imgur',      // Image content - reliable
  'lemmy',      // Alt social - niche content
  'tumblr',     // Creative content - good variety
  'pixabay'     // Stock images - lowest priority due to generic nature
]

// Content type balancing: Prefer variety across video/gif/image/text
const CONTENT_TYPE_WEIGHTS = {
  'video': 1.3,    // Boost video content
  'gif': 1.2,      // Boost GIF content  
  'image': 1.0,    // Standard weight
  'text': 1.1      // Slight boost for text variety
}

/**
 * Analyze recent posting patterns for platform diversity insights
 */
export async function analyzePlatformDiversity(): Promise<{
  recentPlatforms: string[]
  platformCounts: Record<string, number>
  contentTypeCounts: Record<string, number>
  diversityScore: number
  recommendations: string[]
}> {
  // Use SQLite database for development, fallback to Supabase for production
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  let posts: Array<{ id: number; posted_at: string; source_platform: string; content_type: string }>
  
  if (isDevelopment) {
    await db.connect()
    
    // Get last 10 posts using direct SQLite query
    const recentPostsResult = await db.query(`
      SELECT 
        pc.id,
        pc.posted_at,
        cq.source_platform,
        cq.content_type
      FROM posted_content pc
      JOIN content_queue cq ON pc.content_queue_id = cq.id
      ORDER BY pc.posted_at DESC
      LIMIT 10
    `)
    
    posts = recentPostsResult.rows || []
  } else {
    const supabase = createSimpleClient()
    
    // Get last 10 posts for pattern analysis using Supabase
    const { data: recentPosts, error } = await supabase
      .from('posted_content')
      .select(`
        id, posted_at,
        content_queue!inner (
          source_platform,
          content_type
        )
      `)
      .order('posted_at', { ascending: false })
      .limit(10)

    if (error) {
      throw new Error(`Failed to analyze platform diversity: ${error.message}`)
    }

    posts = (recentPosts || []).map(p => ({
      id: p.id,
      posted_at: p.posted_at,
      source_platform: p.content_queue.source_platform,
      content_type: p.content_queue.content_type
    }))
  }
  
  // Extract recent platforms (last 5 posts)
  const recentPlatforms = posts.slice(0, 5).map(p => p.source_platform)
  
  // Count platform distribution
  const platformCounts: Record<string, number> = {}
  const contentTypeCounts: Record<string, number> = {}
  
  posts.forEach(post => {
    const platform = post.source_platform
    const contentType = post.content_type
    
    platformCounts[platform] = (platformCounts[platform] || 0) + 1
    contentTypeCounts[contentType] = (contentTypeCounts[contentType] || 0) + 1
  })
  
  // Calculate diversity score (0-1, higher is more diverse)
  const uniquePlatforms = Object.keys(platformCounts).length
  const totalPosts = posts.length
  const maxPossibleDiversity = Math.min(totalPosts, DEFAULT_PLATFORM_PRIORITY.length)
  const diversityScore = totalPosts > 0 ? uniquePlatforms / maxPossibleDiversity : 0
  
  // Generate recommendations
  const recommendations: string[] = []
  
  if (diversityScore < 0.6) {
    recommendations.push('Low platform diversity detected')
  }
  
  const dominantPlatform = Object.entries(platformCounts).reduce((a, b) => 
    platformCounts[a[0]] > platformCounts[b[0]] ? a : b
  )?.[0]
  
  if (dominantPlatform && platformCounts[dominantPlatform] > totalPosts * 0.4) {
    recommendations.push(`${dominantPlatform} is dominating recent posts`)
  }
  
  // Check for same platform appearing too frequently in recent posts
  const recentPlatformRuns = []
  let currentRun = 1
  for (let i = 1; i < recentPlatforms.length; i++) {
    if (recentPlatforms[i] === recentPlatforms[i-1]) {
      currentRun++
    } else {
      if (currentRun >= 2) {
        recentPlatformRuns.push({ platform: recentPlatforms[i-1], length: currentRun })
      }
      currentRun = 1
    }
  }
  if (currentRun >= 2) {
    recentPlatformRuns.push({ platform: recentPlatforms[recentPlatforms.length-1], length: currentRun })
  }
  
  if (recentPlatformRuns.length > 0) {
    recentPlatformRuns.forEach(run => {
      recommendations.push(`${run.platform} appeared ${run.length} times in a row recently`)
    })
  }
  
  return {
    recentPlatforms,
    platformCounts,
    contentTypeCounts,
    diversityScore,
    recommendations
  }
}

/**
 * Select content with platform diversity optimization
 */
export async function selectDiverseContent(options: PlatformDiversityOptions = {}): Promise<ContentCandidate[]> {
  const isDevelopment = process.env.NODE_ENV === 'development'
  const { 
    maxPosts = 1, 
    mealTime,
    avoidRecentPlatforms = true,
    enforceContentTypeMix = true,
    platformPriority = DEFAULT_PLATFORM_PRIORITY
  } = options

  console.log('🎯 Selecting diverse content with options:', options)

  // 1. Analyze current diversity state
  const diversityAnalysis = await analyzePlatformDiversity()
  console.log('📊 Diversity analysis:', {
    diversityScore: diversityAnalysis.diversityScore,
    recentPlatforms: diversityAnalysis.recentPlatforms,
    recommendations: diversityAnalysis.recommendations
  })

  // 2. Get all available approved content
  let candidates: ContentCandidate[]
  
  if (isDevelopment) {
    await db.connect()
    
    const candidatesResult = await db.query(`
      SELECT 
        id, content_text, content_image_url, content_video_url,
        content_type, source_platform, original_url, original_author,
        confidence_score, created_at
      FROM content_queue
      WHERE is_approved = true AND is_posted = false
      ORDER BY confidence_score DESC
      LIMIT 100
    `)
    
    candidates = candidatesResult.rows || []
  } else {
    const supabase = createSimpleClient()
    
    const { data: supabaseCandidates, error } = await supabase
      .from('content_queue')
      .select(`
        id, content_text, content_image_url, content_video_url,
        content_type, source_platform, original_url, original_author,
        confidence_score, created_at
      `)
      .eq('is_approved', true)
      .eq('is_posted', false)
      .order('confidence_score', { ascending: false })
      .limit(100)

    if (error) {
      throw new Error(`Failed to get content candidates: ${error.message}`)
    }
    
    candidates = supabaseCandidates || []
  }

  if (!candidates || candidates.length === 0) {
    throw new Error('No approved content available for posting')
  }

  console.log(`📋 Found ${candidates.length} content candidates`)

  // 3. Apply diversity scoring to each candidate
  const scoredCandidates = candidates.map(candidate => {
    let diversityScore = 1.0
    
    // Platform diversity scoring
    const platformIndex = platformPriority.indexOf(candidate.source_platform.toLowerCase())
    const platformPriorityScore = platformIndex !== -1 
      ? (platformPriority.length - platformIndex) / platformPriority.length 
      : 0.5

    // Penalize platforms that appeared recently
    if (avoidRecentPlatforms) {
      const recentAppearances = diversityAnalysis.recentPlatforms.filter(p => 
        p === candidate.source_platform
      ).length
      
      if (recentAppearances >= 2) {
        diversityScore *= 0.3 // Heavy penalty for platforms appearing 2+ times in last 5 posts
      } else if (recentAppearances >= 1) {
        diversityScore *= 0.7 // Moderate penalty for platforms appearing once recently
      }
    }
    
    // Content type balancing
    const contentTypeWeight = CONTENT_TYPE_WEIGHTS[candidate.content_type as keyof typeof CONTENT_TYPE_WEIGHTS] || 1.0
    
    // Boost underrepresented content types
    const currentTypeCount = diversityAnalysis.contentTypeCounts[candidate.content_type] || 0
    const typeBalanceBoost = currentTypeCount === 0 ? 1.3 : (currentTypeCount === 1 ? 1.1 : 1.0)
    
    // Calculate final score
    const finalScore = (
      candidate.confidence_score * 0.4 +           // Original quality score (40%)
      platformPriorityScore * 100 * 0.3 +         // Platform priority (30%) 
      diversityScore * 100 * 0.2 +                // Recent diversity penalty (20%)
      contentTypeWeight * typeBalanceBoost * 10    // Content type balancing (10%)
    )

    return {
      ...candidate,
      diversityScore: finalScore,
      platformPriorityScore,
      recentPenalty: 1 - diversityScore,
      contentTypeWeight: contentTypeWeight * typeBalanceBoost
    }
  })

  // 4. Sort by diversity score and apply additional constraints
  scoredCandidates.sort((a, b) => b.diversityScore - a.diversityScore)
  
  // 5. Select final content avoiding same platform twice
  const selectedContent: ContentCandidate[] = []
  const usedPlatforms = new Set<string>()
  const usedContentTypes = new Set<string>()
  
  for (const candidate of scoredCandidates) {
    // For multiple posts, avoid same platform twice
    if (maxPosts > 1 && usedPlatforms.has(candidate.source_platform)) {
      console.log(`⏭️  Skipping ${candidate.source_platform} - already selected for this batch`)
      continue
    }
    
    selectedContent.push(candidate)
    usedPlatforms.add(candidate.source_platform)
    usedContentTypes.add(candidate.content_type)
    
    console.log(`✅ Selected: ${candidate.source_platform} (${candidate.content_type}) - Score: ${candidate.diversityScore.toFixed(2)}`)
    
    if (selectedContent.length >= maxPosts) {
      break
    }
  }

  if (selectedContent.length === 0) {
    throw new Error('No diverse content could be selected with current constraints')
  }

  console.log(`🎯 Selected ${selectedContent.length} diverse content items`)
  console.log('Platform mix:', [...usedPlatforms].join(', '))
  console.log('Content type mix:', [...usedContentTypes].join(', '))

  return selectedContent
}

/**
 * Get platform rotation schedule for meal times
 */
export function getPlatformRotationForMeal(mealTime: string): {
  preferredPlatforms: string[]
  avoidPlatforms: string[]
  contentTypeFocus: string[]
} {
  const rotationSchedule = {
    'breakfast': {
      preferredPlatforms: ['reddit', 'tumblr', 'bluesky'],  // Social content for morning
      avoidPlatforms: ['pixabay'],                          // Avoid generic stock 
      contentTypeFocus: ['text', 'gif']                     // Light content
    },
    'lunch': {
      preferredPlatforms: ['youtube', 'giphy', 'imgur'],    // Visual content for midday
      avoidPlatforms: ['pixabay'],
      contentTypeFocus: ['video', 'gif', 'image']
    },
    'snack': {
      preferredPlatforms: ['giphy', 'tumblr', 'imgur'],     // Quick visual content  
      avoidPlatforms: ['pixabay'],
      contentTypeFocus: ['gif', 'image']
    },
    'dinner': {
      preferredPlatforms: ['youtube', 'reddit', 'lemmy'],   // Substantial content for evening
      avoidPlatforms: ['pixabay'], 
      contentTypeFocus: ['video', 'text']
    },
    'evening': {
      preferredPlatforms: ['tumblr', 'bluesky', 'imgur'],   // Creative content for evening
      avoidPlatforms: ['pixabay'],
      contentTypeFocus: ['image', 'text']
    },
    'late_night': {
      preferredPlatforms: ['reddit', 'lemmy', 'tumblr'],    // Community content for night owls
      avoidPlatforms: ['pixabay'],
      contentTypeFocus: ['text', 'gif']
    }
  }

  return rotationSchedule[mealTime as keyof typeof rotationSchedule] || {
    preferredPlatforms: DEFAULT_PLATFORM_PRIORITY.slice(0, 4),
    avoidPlatforms: ['pixabay'],
    contentTypeFocus: ['image', 'text']
  }
}

/**
 * API endpoint to get diversity analytics
 */
export async function getDiversityAnalytics(): Promise<{
  currentDiversity: any
  platformHealth: Record<string, {
    totalPosts: number
    recentPosts: number  
    lastPosted?: string
    contentTypes: Record<string, number>
    recommendedAction: string
  }>
  upcomingRecommendations: {
    nextMealTime: string
    suggestedPlatforms: string[]
    suggestedContentTypes: string[]
  }
}> {
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  // Get current diversity analysis
  const currentDiversity = await analyzePlatformDiversity()
  
  // Get all-time platform statistics
  let allPlatformStats: Array<{ id: number; posted_at: string; source_platform: string; content_type: string }>
  
  if (isDevelopment) {
    await db.connect()
    
    const allStatsResult = await db.query(`
      SELECT 
        pc.id,
        pc.posted_at,
        cq.source_platform,
        cq.content_type
      FROM posted_content pc
      JOIN content_queue cq ON pc.content_queue_id = cq.id
      ORDER BY pc.posted_at DESC
    `)
    
    allPlatformStats = allStatsResult.rows || []
  } else {
    const supabase = createSimpleClient()
    
    const { data: supabaseStats } = await supabase
      .from('posted_content')
      .select(`
        id, posted_at,
        content_queue!inner (
          source_platform,
          content_type
        )
      `)
      .order('posted_at', { ascending: false })
    
    allPlatformStats = (supabaseStats || []).map(p => ({
      id: p.id,
      posted_at: p.posted_at,
      source_platform: p.content_queue.source_platform,
      content_type: p.content_queue.content_type
    }))
  }

  // Calculate platform health metrics
  const platformHealth: Record<string, any> = {}
  const now = new Date()
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  
  // Initialize all known platforms
  DEFAULT_PLATFORM_PRIORITY.forEach(platform => {
    platformHealth[platform] = {
      totalPosts: 0,
      recentPosts: 0,
      lastPosted: null,
      contentTypes: {},
      recommendedAction: 'ready'
    }
  })
  
  // Process all posts
  allPlatformStats?.forEach(post => {
    const platform = post.source_platform
    const contentType = post.content_type
    const postedAt = new Date(post.posted_at)
    
    if (!platformHealth[platform]) {
      platformHealth[platform] = {
        totalPosts: 0,
        recentPosts: 0,
        lastPosted: null,
        contentTypes: {},
        recommendedAction: 'ready'
      }
    }
    
    platformHealth[platform].totalPosts++
    platformHealth[platform].contentTypes[contentType] = 
      (platformHealth[platform].contentTypes[contentType] || 0) + 1
    
    if (postedAt > oneDayAgo) {
      platformHealth[platform].recentPosts++
    }
    
    if (!platformHealth[platform].lastPosted || postedAt > new Date(platformHealth[platform].lastPosted)) {
      platformHealth[platform].lastPosted = post.posted_at
    }
  })
  
  // Set recommended actions
  Object.keys(platformHealth).forEach(platform => {
    const stats = platformHealth[platform]
    const recentAppearances = currentDiversity.recentPlatforms.filter(p => p === platform).length
    
    if (recentAppearances >= 2) {
      stats.recommendedAction = 'avoid - appeared too recently'
    } else if (recentAppearances === 1) {
      stats.recommendedAction = 'caution - appeared recently'  
    } else if (stats.totalPosts === 0) {
      stats.recommendedAction = 'priority - never posted'
    } else if (stats.recentPosts === 0) {
      stats.recommendedAction = 'good - ready for posting'
    } else {
      stats.recommendedAction = 'ready'
    }
  })
  
  // Generate upcoming recommendations
  const nextHour = new Date().getUTCHours() + 1
  const mealTimes = [
    { hour: 7, name: 'breakfast' },
    { hour: 12, name: 'lunch' }, 
    { hour: 15, name: 'snack' },
    { hour: 18, name: 'dinner' },
    { hour: 20, name: 'evening' },
    { hour: 22, name: 'late_night' }
  ]
  
  const nextMeal = mealTimes.find(meal => meal.hour >= nextHour) || mealTimes[0]
  const mealRotation = getPlatformRotationForMeal(nextMeal.name)
  
  return {
    currentDiversity,
    platformHealth,
    upcomingRecommendations: {
      nextMealTime: nextMeal.name,
      suggestedPlatforms: mealRotation.preferredPlatforms,
      suggestedContentTypes: mealRotation.contentTypeFocus
    }
  }
}