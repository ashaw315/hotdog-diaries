import { NextRequest, NextResponse } from 'next/server'
import { youtubeScanningService } from '@/lib/services/youtube-scanning'

export async function GET(request: NextRequest) {
  try {
    const config = await youtubeScanningService.getScanConfig()
    
    return NextResponse.json({
      success: true,
      data: {
        isEnabled: config.isEnabled,
        scanInterval: config.scanInterval,
        maxVideosPerScan: config.maxVideosPerScan,
        searchTerms: config.searchTerms,
        publishedAfter: config.publishedAfter,
        videoDuration: config.videoDuration,
        videoDefinition: config.videoDefinition,
        safeSearch: config.safeSearch,
        channelIds: config.channelIds,
        lastScanTime: config.lastScanTime?.toISOString()
      }
    })

  } catch (error) {
    console.error('YouTube config get error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get YouTube configuration',
        details: error.message
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const updates = await request.json()
    
    // Validate the updates
    const validatedUpdates: any = {}
    
    if (typeof updates.isEnabled === 'boolean') {
      validatedUpdates.isEnabled = updates.isEnabled
    }
    
    if (typeof updates.scanInterval === 'number' && updates.scanInterval >= 60) {
      validatedUpdates.scanInterval = updates.scanInterval
    }
    
    if (typeof updates.maxVideosPerScan === 'number' && updates.maxVideosPerScan >= 1 && updates.maxVideosPerScan <= 50) {
      validatedUpdates.maxVideosPerScan = updates.maxVideosPerScan
    }
    
    if (Array.isArray(updates.searchTerms)) {
      validatedUpdates.searchTerms = updates.searchTerms.filter(term => typeof term === 'string' && term.length > 0)
    }
    
    if (updates.publishedAfter && !isNaN(Date.parse(updates.publishedAfter))) {
      validatedUpdates.publishedAfter = new Date(updates.publishedAfter)
    }
    
    if (['any', 'short', 'medium', 'long'].includes(updates.videoDuration)) {
      validatedUpdates.videoDuration = updates.videoDuration
    }
    
    if (['any', 'high', 'standard'].includes(updates.videoDefinition)) {
      validatedUpdates.videoDefinition = updates.videoDefinition
    }
    
    if (['none', 'moderate', 'strict'].includes(updates.safeSearch)) {
      validatedUpdates.safeSearch = updates.safeSearch
    }
    
    if (Array.isArray(updates.channelIds)) {
      validatedUpdates.channelIds = updates.channelIds.filter(id => typeof id === 'string' && id.length > 0)
    }

    await youtubeScanningService.updateScanConfig(validatedUpdates)
    
    const updatedConfig = await youtubeScanningService.getScanConfig()
    
    return NextResponse.json({
      success: true,
      data: {
        isEnabled: updatedConfig.isEnabled,
        scanInterval: updatedConfig.scanInterval,
        maxVideosPerScan: updatedConfig.maxVideosPerScan,
        searchTerms: updatedConfig.searchTerms,
        publishedAfter: updatedConfig.publishedAfter,
        videoDuration: updatedConfig.videoDuration,
        videoDefinition: updatedConfig.videoDefinition,
        safeSearch: updatedConfig.safeSearch,
        channelIds: updatedConfig.channelIds,
        lastScanTime: updatedConfig.lastScanTime?.toISOString()
      }
    })

  } catch (error) {
    console.error('YouTube config update error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update YouTube configuration',
        details: error.message
      },
      { status: 500 }
    )
  }
}