import { NextRequest, NextResponse } from 'next/server'
import { instagramScanningService } from '@/lib/services/instagram-scanning'
import { InstagramScanConfig } from '@/lib/services/instagram-scanning'
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

    const config = await instagramScanningService.getScanConfig()

    return NextResponse.json({
      success: true,
      data: config,
      message: 'Instagram configuration retrieved successfully'
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    await logToDatabase(
      LogLevel.ERROR,
      'INSTAGRAM_CONFIG_GET_ERROR',
      `Failed to get Instagram configuration: ${errorMessage}`,
      { error: errorMessage }
    )

    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        message: 'Failed to retrieve Instagram configuration'
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
    
    // Validate required fields
    const requiredFields = ['isEnabled', 'scanInterval', 'maxPostsPerScan', 'minLikes']
    for (const field of requiredFields) {
      if (body[field] === undefined || body[field] === null) {
        return NextResponse.json(
          { 
            success: false, 
            error: `Missing required field: ${field}`,
            message: 'Invalid configuration data'
          },
          { status: 400 }
        )
      }
    }

    // Validate ranges
    if (body.scanInterval < 15 || body.scanInterval > 1440) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Scan interval must be between 15 and 1440 minutes',
          message: 'Invalid configuration data'
        },
        { status: 400 }
      )
    }

    if (body.maxPostsPerScan < 1 || body.maxPostsPerScan > 50) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Max posts per scan must be between 1 and 50',
          message: 'Invalid configuration data'
        },
        { status: 400 }
      )
    }

    if (body.minLikes < 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Minimum likes cannot be negative',
          message: 'Invalid configuration data'
        },
        { status: 400 }
      )
    }

    // Validate arrays
    if (body.targetHashtags && !Array.isArray(body.targetHashtags)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Target hashtags must be an array',
          message: 'Invalid configuration data'
        },
        { status: 400 }
      )
    }

    // Update configuration
    const configUpdate: Partial<InstagramScanConfig> = {
      isEnabled: body.isEnabled,
      scanInterval: body.scanInterval,
      maxPostsPerScan: body.maxPostsPerScan,
      minLikes: body.minLikes,
      includeStories: body.includeStories || false
    }

    if (body.targetHashtags) {
      configUpdate.targetHashtags = body.targetHashtags
    }

    await instagramScanningService.updateScanConfig(configUpdate)

    await logToDatabase(
      LogLevel.INFO,
      'INSTAGRAM_CONFIG_UPDATED',
      'Instagram configuration updated from admin panel',
      { config: configUpdate }
    )

    // Get updated configuration to return
    const updatedConfig = await instagramScanningService.getScanConfig()

    return NextResponse.json({
      success: true,
      data: updatedConfig,
      message: 'Instagram configuration updated successfully'
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    await logToDatabase(
      LogLevel.ERROR,
      'INSTAGRAM_CONFIG_UPDATE_ERROR',
      `Failed to update Instagram configuration: ${errorMessage}`,
      { error: errorMessage }
    )

    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        message: 'Failed to update Instagram configuration'
      },
      { status: 500 }
    )
  }
}