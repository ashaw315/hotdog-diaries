import { NextRequest, NextResponse } from 'next/server'
import { flickrScanningService } from '@/lib/services/flickr-scanning'

export async function GET(request: NextRequest) {
  try {
    const config = await flickrScanningService.getScanConfig()
    
    return NextResponse.json({
      success: true,
      data: {
        isEnabled: config.isEnabled,
        scanInterval: config.scanInterval,
        maxPhotosPerScan: config.maxPhotosPerScan,
        searchTerms: config.searchTerms,
        license: config.license,
        publishedWithin: config.publishedWithin,
        minViews: config.minViews,
        contentType: config.contentType,
        safeSearch: config.safeSearch,
        lastScanTime: config.lastScanTime?.toISOString()
      }
    })

  } catch (error) {
    console.error('Flickr config get error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get Flickr configuration',
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
    
    if (typeof updates.maxPhotosPerScan === 'number' && updates.maxPhotosPerScan >= 1 && updates.maxPhotosPerScan <= 50) {
      validatedUpdates.maxPhotosPerScan = updates.maxPhotosPerScan
    }
    
    if (Array.isArray(updates.searchTerms)) {
      validatedUpdates.searchTerms = updates.searchTerms.filter(term => typeof term === 'string' && term.length > 0)
    }
    
    if (typeof updates.license === 'string') {
      validatedUpdates.license = updates.license
    }
    
    if (typeof updates.publishedWithin === 'number' && updates.publishedWithin >= 1 && updates.publishedWithin <= 365) {
      validatedUpdates.publishedWithin = updates.publishedWithin
    }
    
    if (typeof updates.minViews === 'number' && updates.minViews >= 0) {
      validatedUpdates.minViews = updates.minViews
    }
    
    if (['photos', 'screenshots', 'other'].includes(updates.contentType)) {
      validatedUpdates.contentType = updates.contentType
    }
    
    if (['safe', 'moderate', 'restricted'].includes(updates.safeSearch)) {
      validatedUpdates.safeSearch = updates.safeSearch
    }

    await flickrScanningService.updateScanConfig(validatedUpdates)
    
    const updatedConfig = await flickrScanningService.getScanConfig()
    
    return NextResponse.json({
      success: true,
      data: {
        isEnabled: updatedConfig.isEnabled,
        scanInterval: updatedConfig.scanInterval,
        maxPhotosPerScan: updatedConfig.maxPhotosPerScan,
        searchTerms: updatedConfig.searchTerms,
        license: updatedConfig.license,
        publishedWithin: updatedConfig.publishedWithin,
        minViews: updatedConfig.minViews,
        contentType: updatedConfig.contentType,
        safeSearch: updatedConfig.safeSearch,
        lastScanTime: updatedConfig.lastScanTime?.toISOString()
      }
    })

  } catch (error) {
    console.error('Flickr config update error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update Flickr configuration',
        details: error.message
      },
      { status: 500 }
    )
  }
}