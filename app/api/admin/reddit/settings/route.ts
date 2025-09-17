import { NextRequest, NextResponse } from 'next/server'
import { redditScanningService } from '@/lib/services/reddit-scanning'
import { RedditScanConfig } from '@/lib/services/reddit-scanning'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export async function GET(request: NextRequest) {
  try {
    // TODO: Add authentication check here
    // const auth = await verifyAdminAuth(request)
    // if (!auth.success) {
    //   return NextResponse.json(
    //     { success: false, error: 'Unauthorized' },
    //     { status: 401 }
    //   )
    // }

    const config = await redditScanningService.getScanConfig()

    return NextResponse.json({
      success: true,
      data: config,
      message: 'Reddit configuration retrieved successfully'
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    await logToDatabase(
      LogLevel.ERROR,
      'REDDIT_CONFIG_GET_ERROR',
      `Failed to get Reddit configuration: ${errorMessage}`,
      { error: errorMessage }
    )

    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        message: 'Failed to retrieve Reddit configuration'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // TODO: Add authentication check here
    // const auth = await verifyAdminAuth(request)
    // if (!auth.success) {
    //   return NextResponse.json(
    //     { success: false, error: 'Unauthorized' },
    //     { status: 401 }
    //   )
    // }

    const body = await request.json()
    
    // Validate that at least one field is provided for partial updates
    const hasValidFields = ['isEnabled', 'scanInterval', 'maxPostsPerScan', 'minScore', 'sortBy', 'timeRange', 'includeNSFW', 'targetSubreddits', 'searchTerms'].some(field => body[field] !== undefined)
    
    if (!hasValidFields) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'At least one configuration field must be provided',
          message: 'Invalid configuration data'
        },
        { status: 400 }
      )
    }

    // Validate ranges for provided fields only
    if (body.scanInterval !== undefined && (body.scanInterval < 5 || body.scanInterval > 1440)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Scan interval must be between 5 and 1440 minutes',
          message: 'Invalid configuration data'
        },
        { status: 400 }
      )
    }

    if (body.maxPostsPerScan !== undefined && (body.maxPostsPerScan < 1 || body.maxPostsPerScan > 100)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Max posts per scan must be between 1 and 100',
          message: 'Invalid configuration data'
        },
        { status: 400 }
      )
    }

    if (body.minScore !== undefined && body.minScore < 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Minimum score cannot be negative',
          message: 'Invalid configuration data'
        },
        { status: 400 }
      )
    }

    // Validate arrays
    if (body.targetSubreddits && !Array.isArray(body.targetSubreddits)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Target subreddits must be an array',
          message: 'Invalid configuration data'
        },
        { status: 400 }
      )
    }

    if (body.searchTerms && !Array.isArray(body.searchTerms)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Search terms must be an array',
          message: 'Invalid configuration data'
        },
        { status: 400 }
      )
    }

    // Update configuration (only include provided fields)
    const configUpdate: Partial<RedditScanConfig> = {}
    
    if (body.isEnabled !== undefined) configUpdate.isEnabled = body.isEnabled
    if (body.scanInterval !== undefined) configUpdate.scanInterval = body.scanInterval
    if (body.maxPostsPerScan !== undefined) configUpdate.maxPostsPerScan = body.maxPostsPerScan
    if (body.minScore !== undefined) configUpdate.minScore = body.minScore
    if (body.sortBy !== undefined) configUpdate.sortBy = body.sortBy
    if (body.timeRange !== undefined) configUpdate.timeRange = body.timeRange
    if (body.includeNSFW !== undefined) configUpdate.includeNSFW = body.includeNSFW

    if (body.targetSubreddits) {
      configUpdate.targetSubreddits = body.targetSubreddits
    }

    if (body.searchTerms) {
      configUpdate.searchTerms = body.searchTerms
    }

    await redditScanningService.updateScanConfig(configUpdate)

    await logToDatabase(
      LogLevel.INFO,
      'REDDIT_CONFIG_UPDATED',
      'Reddit configuration updated from admin panel',
      { config: configUpdate }
    )

    // Get updated configuration to return
    const updatedConfig = await redditScanningService.getScanConfig()

    return NextResponse.json({
      success: true,
      data: updatedConfig,
      message: 'Reddit configuration updated successfully'
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    await logToDatabase(
      LogLevel.ERROR,
      'REDDIT_CONFIG_UPDATE_ERROR',
      `Failed to update Reddit configuration: ${errorMessage}`,
      { error: errorMessage }
    )

    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        message: 'Failed to update Reddit configuration'
      },
      { status: 500 }
    )
  }
}