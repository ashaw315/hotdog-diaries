import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const offset = parseInt(searchParams.get('offset') || '0')
    
    console.log(`🎯 Loading 2 items per platform for display testing... (offset: ${offset})`)
    
    // Query to get exactly 2 approved items from each platform in specific order
    // Using offset to get different content on refresh
    const result = await db.query(`
      WITH RankedContent AS (
        SELECT *,
               ROW_NUMBER() OVER (PARTITION BY source_platform ORDER BY scraped_at DESC) as rn
        FROM content_queue
        WHERE is_approved = true
      )
      SELECT * FROM RankedContent
      WHERE rn > $1 AND rn <= $1 + 2
      ORDER BY 
        CASE source_platform
          WHEN 'reddit' THEN 1
          WHEN 'youtube' THEN 2
          WHEN 'giphy' THEN 3
          WHEN 'pixabay' THEN 4
          WHEN 'bluesky' THEN 5
          WHEN 'imgur' THEN 6
          WHEN 'tumblr' THEN 7
          WHEN 'lemmy' THEN 8
          ELSE 9
        END,
        rn ASC
    `, [offset])
    
    const items = result.rows
    console.log(`Found ${items.length} items for display test`)
    
    // Group by platform for easy counting
    const platformCounts = items.reduce((acc, item) => {
      acc[item.source_platform] = (acc[item.source_platform] || 0) + 1
      return acc
    }, {})
    
    console.log('Platform distribution:', platformCounts)
    
    // Enhance each item with display metadata
    const enhancedItems = items.map(item => ({
      ...item,
      displayMetadata: {
        hasVideo: !!item.content_video_url,
        hasImage: !!item.content_image_url,
        hasText: !!item.content_text,
        contentLength: item.content_text ? item.content_text.length : 0,
        isGif: item.content_type === 'gif' || (item.content_image_url && item.content_image_url.includes('.gif')),
        estimatedLoadTime: calculateEstimatedLoadTime(item),
        renderingComplexity: calculateRenderingComplexity(item)
      }
    }))
    
    return NextResponse.json({
      success: true,
      message: `Loaded ${items.length} items for platform display testing`,
      totalItems: items.length,
      platformCounts,
      platforms: Object.keys(platformCounts),
      items: enhancedItems,
      testMetadata: {
        expectedPlatforms: ['reddit', 'youtube', 'giphy', 'pixabay', 'bluesky', 'imgur', 'tumblr', 'lemmy'],
        expectedItemsPerPlatform: 2,
        expectedTotalItems: 16,
        actualTotalItems: items.length,
        missingPlatforms: ['reddit', 'youtube', 'giphy', 'pixabay', 'bluesky', 'imgur', 'tumblr', 'lemmy']
          .filter(platform => !platformCounts[platform])
      }
    })

  } catch (error) {
    console.error('Platform display test error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

function calculateEstimatedLoadTime(item: any): string {
  let baseTime = 100 // Base load time in ms
  
  if (item.content_video_url) {
    baseTime += 1000 // Videos take longer
  }
  if (item.content_image_url) {
    baseTime += 300 // Images take some time
  }
  if (item.content_type === 'gif') {
    baseTime += 500 // GIFs can be large
  }
  if (item.content_text && item.content_text.length > 500) {
    baseTime += 50 // Long text adds minimal time
  }
  
  return `~${baseTime}ms`
}

function calculateRenderingComplexity(item: any): 'simple' | 'medium' | 'complex' {
  let complexity = 0
  
  if (item.content_video_url) complexity += 3
  if (item.content_image_url) complexity += 2
  if (item.content_type === 'gif') complexity += 2
  if (item.content_text && item.content_text.length > 200) complexity += 1
  
  if (complexity <= 2) return 'simple'
  if (complexity <= 4) return 'medium'
  return 'complex'
}