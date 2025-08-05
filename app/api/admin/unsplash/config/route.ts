import { NextRequest, NextResponse } from 'next/server'

// Default Unsplash configuration
const defaultConfig = {
  isEnabled: false,
  scanInterval: 60, // minutes
  maxPhotosPerScan: 20,
  searchTerms: ['hotdog', 'hot dog', 'frankfurter', 'sausage', 'food photography'],
  minDownloads: 100,
  minLikes: 10,
  publishedWithin: 30, // days
  orientation: 'all' as const,
  contentFilter: 'low' as const,
  lastScanTime: null
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // In a real implementation, this would load from database
    // For now, return default configuration
    return NextResponse.json({
      success: true,
      data: defaultConfig,
      message: 'Unsplash configuration retrieved successfully',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Unsplash config error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get configuration',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const updates = await request.json()
    
    // Validate the updates
    const validFields = [
      'isEnabled', 'scanInterval', 'maxPhotosPerScan', 'searchTerms', 
      'minDownloads', 'minLikes', 'publishedWithin', 'orientation', 'contentFilter'
    ]
    
    const filteredUpdates = Object.keys(updates)
      .filter(key => validFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = updates[key]
        return obj
      }, {} as any)

    // In a real implementation, this would save to database
    // For now, return the merged configuration
    const updatedConfig = { ...defaultConfig, ...filteredUpdates }
    
    return NextResponse.json({
      success: true,
      data: updatedConfig,
      message: 'Unsplash configuration updated successfully',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Unsplash config update error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update configuration',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}