import { NextRequest, NextResponse } from 'next/server'
import { socialMediaService } from '@/lib/services/social-media'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export async function GET(request: NextRequest) {
  try {
    // Get unified statistics and content distribution
    const unifiedStats = await socialMediaService.getUnifiedStats()

    const responseData = {
      ...unifiedStats,
      contentBalance: {
        isBalanced: this.checkContentBalance(unifiedStats.contentDistribution),
        recommendations: this.generateBalanceRecommendations(unifiedStats.contentDistribution, unifiedStats.platformBreakdown)
      },
      platformEfficiency: unifiedStats.platformBreakdown.map(platform => ({
        ...platform,
        efficiency: platform.postsFound > 0 ? (platform.postsApproved / platform.postsFound * 100) : 0,
        contentPerScan: platform.scans > 0 ? (platform.postsApproved / platform.scans) : 0
      }))
    }

    return NextResponse.json({
      success: true,
      data: responseData
    })

  } catch (error) {
    await logToDatabase(
      LogLevel.ERROR,
      'SOCIAL_MEDIA_DISTRIBUTION_API_ERROR',
      `Failed to get social media distribution via API: ${error.message}`,
      { error: error.message }
    )

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// Helper function to check if content distribution is balanced
function checkContentBalance(distribution: { posts: number; images: number; videos: number }): boolean {
  const target = { posts: 40, images: 35, videos: 25 } // Target distribution
  const tolerance = 10 // 10% tolerance

  return Math.abs(distribution.posts - target.posts) <= tolerance &&
         Math.abs(distribution.images - target.images) <= tolerance &&
         Math.abs(distribution.videos - target.videos) <= tolerance
}

// Helper function to generate balance recommendations
function generateBalanceRecommendations(
  distribution: { posts: number; images: number; videos: number },
  platformBreakdown: Array<{ platform: string; contentType: string; postsApproved: number }>
): string[] {
  const recommendations: string[] = []
  const target = { posts: 40, images: 35, videos: 25 }

  if (distribution.posts < target.posts - 10) {
    recommendations.push('Consider increasing Reddit scanning frequency to boost text post content')
  }
  if (distribution.images < target.images - 10) {
    recommendations.push('Consider increasing Instagram scanning frequency to boost image content')
  }
  if (distribution.videos < target.videos - 10) {
    recommendations.push('Consider increasing TikTok scanning frequency to boost video content')
  }

  if (distribution.posts > target.posts + 10) {
    recommendations.push('Text posts are over-represented. Consider balancing with more visual content')
  }
  if (distribution.images > target.images + 10) {
    recommendations.push('Image content is over-represented. Consider balancing with text and video content')
  }
  if (distribution.videos > target.videos + 10) {
    recommendations.push('Video content is over-represented. Consider balancing with text and image content')
  }

  return recommendations
}