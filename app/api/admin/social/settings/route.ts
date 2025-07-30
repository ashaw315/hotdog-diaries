import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db-query-builder'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export async function GET(request: NextRequest) {
  try {
    // Get current coordination settings
    const config = await query('social_media_coordination_config')
      .select('*')
      .first()

    const defaultConfig = {
      enableCoordination: true,
      scanInterval: 60,
      platformPriority: ['reddit', 'instagram', 'tiktok'],
      contentBalancing: {
        enabled: true,
        redditWeight: 40,
        instagramWeight: 35,
        tiktokWeight: 25,
        targetDistribution: {
          posts: 40,
          images: 35,
          videos: 25
        }
      },
      rateLimitCoordination: true,
      errorThreshold: 5,
      intelligentScheduling: {
        enabled: true,
        peakContentTimes: {
          reddit: ['09', '12', '15', '18', '21'],
          instagram: ['08', '11', '14', '17', '19'],
          tiktok: ['16', '18', '20', '21', '22']
        },
        adaptiveIntervals: true
      }
    }

    const responseData = config ? {
      enableCoordination: config.enable_coordination,
      scanInterval: config.scan_interval,
      platformPriority: config.platform_priority || defaultConfig.platformPriority,
      contentBalancing: {
        enabled: config.content_balancing_enabled,         redditWeight: config.reddit_weight || 40,
        instagramWeight: config.instagram_weight || 35,
        tiktokWeight: config.tiktok_weight || 25,
        targetDistribution: config.target_distribution || defaultConfig.contentBalancing.targetDistribution
      },
      rateLimitCoordination: config.rate_limit_coordination,
      errorThreshold: config.error_threshold,
      intelligentScheduling: config.intelligent_scheduling || defaultConfig.intelligentScheduling
    } : defaultConfig

    return NextResponse.json({
      success: true,
      data: responseData
    })

  } catch (error) {
    await logToDatabase(
      LogLevel.ERROR,
      'SOCIAL_MEDIA_GET_SETTINGS_API_ERROR',
      `Failed to get social media settings via API: ${error.message}`,
      { error: error.message }
    )

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate settings
    const validSettings = [
      'enableCoordination', 'scanInterval', 'platformPriority', 'contentBalancing',
      'rateLimitCoordination', 'errorThreshold', 'intelligentScheduling'
    ]

    const filteredSettings = Object.keys(body)
      .filter(key => validSettings.includes(key))
      .reduce((obj, key) => {
        obj[key] = body[key]
        return obj
      }, {})

    // Validate specific fields
    if (filteredSettings.scanInterval !== undefined) {
      if (typeof filteredSettings.scanInterval !== 'number' || filteredSettings.scanInterval < 15) {
        return NextResponse.json(
          { success: false, error: 'scanInterval must be a number >= 15 minutes' },
          { status: 400 }
        )
      }
    }

    if (filteredSettings.platformPriority !== undefined) {
      if (!Array.isArray(filteredSettings.platformPriority)) {
        return NextResponse.json(
          { success: false, error: 'platformPriority must be an array' },
          { status: 400 }
        )
      }
      
      const validPlatforms = ['reddit', 'instagram', 'tiktok']
      const invalidPlatforms = filteredSettings.platformPriority.filter(p => !validPlatforms.includes(p))
      if (invalidPlatforms.length > 0) {
        return NextResponse.json(
          { success: false, error: `Invalid platforms in priority: ${invalidPlatforms.join(', ')}` },
          { status: 400 }
        )
      }
    }

    if (filteredSettings.contentBalancing !== undefined) {
      if (typeof filteredSettings.contentBalancing !== 'object') {
        return NextResponse.json(
          { success: false, error: 'contentBalancing must be an object' },
          { status: 400 }
        )
      }

      const weights = filteredSettings.contentBalancing
      if (weights.redditWeight !== undefined || weights.instagramWeight !== undefined || weights.tiktokWeight !== undefined) {
        const total = (weights.redditWeight || 0) + (weights.instagramWeight || 0) + (weights.tiktokWeight || 0)
        if (Math.abs(total - 100) > 1) { // Allow 1% tolerance for rounding
          return NextResponse.json(
            { success: false, error: 'Platform weights must sum to 100' },
            { status: 400 }
          )
        }
      }
    }

    if (filteredSettings.errorThreshold !== undefined) {
      if (typeof filteredSettings.errorThreshold !== 'number' || filteredSettings.errorThreshold < 1) {
        return NextResponse.json(
          { success: false, error: 'errorThreshold must be a positive number' },
          { status: 400 }
        )
      }
    }

    // Transform settings for database
    const dbSettings = {
      enable_coordination: filteredSettings.enableCoordination,
      scan_interval: filteredSettings.scanInterval,
      platform_priority: filteredSettings.platformPriority,
      content_balancing_enabled: filteredSettings.contentBalancing?.enabled,
      reddit_weight: filteredSettings.contentBalancing?.redditWeight,
      instagram_weight: filteredSettings.contentBalancing?.instagramWeight,
      tiktok_weight: filteredSettings.contentBalancing?.tiktokWeight,
      target_distribution: filteredSettings.contentBalancing?.targetDistribution,
      rate_limit_coordination: filteredSettings.rateLimitCoordination,
      error_threshold: filteredSettings.errorThreshold,
      intelligent_scheduling: filteredSettings.intelligentScheduling,
      updated_at: new Date()
    }

    // Remove undefined values
    Object.keys(dbSettings).forEach(key => {
      if (dbSettings[key] === undefined) {
        delete dbSettings[key]
      }
    })

    // Update or insert settings
    await query('social_media_coordination_config')
      .upsert(dbSettings)

    await logToDatabase(
      LogLevel.INFO,
      'SOCIAL_MEDIA_SETTINGS_UPDATED_API',
      'Social media coordination settings updated via API',
      { updatedFields: Object.keys(filteredSettings) }
    )

    return NextResponse.json({
      success: true,
      message: 'Social media settings updated successfully'
    })

  } catch (error) {
    await logToDatabase(
      LogLevel.ERROR,
      'SOCIAL_MEDIA_UPDATE_SETTINGS_API_ERROR',
      `Failed to update social media settings via API: ${error.message}`,
      { error: error.message }
    )

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}