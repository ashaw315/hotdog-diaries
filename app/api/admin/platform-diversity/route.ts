import { NextRequest, NextResponse } from 'next/server'
import { analyzePlatformDiversity, getDiversityAnalytics } from '@/lib/utils/platform-diversity'

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const authHeader = request.headers.get('authorization')
    const isAuthenticated = authHeader === `Bearer ${process.env.AUTH_TOKEN}`
    
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('📊 Getting platform diversity analytics...')

    // Get comprehensive diversity analytics
    const analytics = await getDiversityAnalytics()

    return NextResponse.json({
      success: true,
      analytics,
      summary: {
        diversityScore: analytics.currentDiversity.diversityScore,
        totalPlatforms: Object.keys(analytics.platformHealth).length,
        activePlatforms: Object.values(analytics.platformHealth)
          .filter((p: any) => p.totalPosts > 0).length,
        problemPlatforms: Object.entries(analytics.platformHealth)
          .filter(([platform, stats]: [string, any]) => 
            stats.recommendedAction.includes('avoid'))
          .map(([platform]) => platform),
        recommendations: analytics.currentDiversity.recommendations
      },
      nextActions: {
        immediateAction: analytics.currentDiversity.diversityScore < 0.6 
          ? 'Improve platform diversity in next posts'
          : 'Platform diversity is healthy',
        suggestedPlatforms: analytics.upcomingRecommendations.suggestedPlatforms.slice(0, 3),
        avoidPlatforms: Object.entries(analytics.platformHealth)
          .filter(([platform, stats]: [string, any]) => 
            stats.recommendedAction.includes('avoid'))
          .map(([platform]) => platform)
      }
    })

  } catch (error) {
    console.error('❌ Error getting platform diversity analytics:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const authHeader = request.headers.get('authorization')
    const isAuthenticated = authHeader === `Bearer ${process.env.AUTH_TOKEN}`
    
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body

    if (action === 'analyze') {
      console.log('🔍 Running platform diversity analysis...')
      
      const analysis = await analyzePlatformDiversity()
      
      return NextResponse.json({
        success: true,
        action: 'analyze',
        analysis,
        issues: analysis.recommendations.length > 0 ? analysis.recommendations : null,
        status: analysis.diversityScore >= 0.8 
          ? 'excellent' 
          : analysis.diversityScore >= 0.6 
            ? 'good' 
            : analysis.diversityScore >= 0.4
              ? 'fair'
              : 'poor'
      })
    }

    return NextResponse.json({
      success: false,
      error: 'Unknown action. Supported actions: analyze'
    }, { status: 400 })

  } catch (error) {
    console.error('❌ Error in platform diversity POST:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}