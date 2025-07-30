import { NextRequest, NextResponse } from 'next/server'
import { tiktokScanningService } from '@/lib/services/tiktok-scanning'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const config = await tiktokScanningService.getScanConfig()

    return NextResponse.json({
      success: true,
      data: config
    })

  } catch (error) {
    await logToDatabase(
      LogLevel.ERROR,
      'TIKTOK_GET_SETTINGS_API_ERROR',
      `Failed to get TikTok settings via API: ${error.message}`,
      { error: error.message }
    )

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate settings
    const validSettings = [
      'isEnabled', 'scanInterval', 'maxVideosPerScan', 'targetKeywords',
      'targetHashtags', 'minViews', 'maxDuration', 'sortBy'
    ]

    const filteredSettings = Object.keys(body)
      .filter(key => validSettings.includes(key))
      .reduce((obj, key) => {
        obj[key] = body[key]
        return obj
      }, {})

    // Validate specific fields
    if (filteredSettings.scanInterval !== undefined) {
      if (typeof filteredSettings.scanInterval !== 'number' || filteredSettings.scanInterval < 30) {
        return NextResponse.json(
          { success: false, error: 'scanInterval must be a number >= 30 minutes (TikTok rate limits)' },
          { status: 400 }
        )
      }
    }

    if (filteredSettings.maxVideosPerScan !== undefined) {
      if (typeof filteredSettings.maxVideosPerScan !== 'number' || filteredSettings.maxVideosPerScan < 1 || filteredSettings.maxVideosPerScan > 100) {
        return NextResponse.json(
          { success: false, error: 'maxVideosPerScan must be a number between 1 and 100' },
          { status: 400 }
        )
      }
    }

    if (filteredSettings.minViews !== undefined) {
      if (typeof filteredSettings.minViews !== 'number' || filteredSettings.minViews < 0) {
        return NextResponse.json(
          { success: false, error: 'minViews must be a non-negative number' },
          { status: 400 }
        )
      }
    }

    if (filteredSettings.maxDuration !== undefined) {
      if (typeof filteredSettings.maxDuration !== 'number' || filteredSettings.maxDuration < 1) {
        return NextResponse.json(
          { success: false, error: 'maxDuration must be a positive number (seconds)' },
          { status: 400 }
        )
      }
    }

    if (filteredSettings.targetKeywords !== undefined) {
      if (!Array.isArray(filteredSettings.targetKeywords)) {
        return NextResponse.json(
          { success: false, error: 'targetKeywords must be an array' },
          { status: 400 }
        )
      }
    }

    if (filteredSettings.targetHashtags !== undefined) {
      if (!Array.isArray(filteredSettings.targetHashtags)) {
        return NextResponse.json(
          { success: false, error: 'targetHashtags must be an array' },
          { status: 400 }
        )
      }
    }

    if (filteredSettings.sortBy !== undefined) {
      const validSortOptions = ['relevance', 'create_time', 'view_count']
      if (!validSortOptions.includes(filteredSettings.sortBy)) {
        return NextResponse.json(
          { success: false, error: `sortBy must be one of: ${validSortOptions.join(', ')}` },
          { status: 400 }
        )
      }
    }

    // Update settings
    await tiktokScanningService.updateScanConfig(filteredSettings)

    await logToDatabase(
      LogLevel.INFO,
      'TIKTOK_SETTINGS_UPDATED_API',
      'TikTok settings updated via API',
      { updatedFields: Object.keys(filteredSettings) }
    )

    return NextResponse.json({
      success: true,
      message: 'TikTok settings updated successfully'
    })

  } catch (error) {
    await logToDatabase(
      LogLevel.ERROR,
      'TIKTOK_UPDATE_SETTINGS_API_ERROR',
      `Failed to update TikTok settings via API: ${error.message}`,
      { error: error.message }
    )

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}