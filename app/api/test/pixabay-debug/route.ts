import { NextRequest, NextResponse } from 'next/server'
import { pixabayScanningService } from '@/lib/services/pixabay-scanning'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 PIXABAY DEBUG: Testing actual search results...')
    
    // Get the API key
    const apiKey = process.env.PIXABAY_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'API key not configured',
        env_check: {
          has_key: !!apiKey,
          key_length: apiKey?.length || 0
        }
      })
    }

    // Make a direct API call to see what we get
    const url = new URL('https://pixabay.com/api/')
    url.searchParams.set('key', apiKey)
    url.searchParams.set('q', 'hotdog')
    url.searchParams.set('image_type', 'photo')
    url.searchParams.set('per_page', '3')
    url.searchParams.set('safesearch', 'true')
    url.searchParams.set('order', 'popular')

    console.log('🌐 Fetching from Pixabay API:', url.toString().replace(apiKey, 'REDACTED'))

    const response = await fetch(url.toString())
    const data = await response.json()

    console.log('📊 Pixabay API response:', {
      status: response.status,
      total: data.total,
      totalHits: data.totalHits,
      hits: data.hits?.length || 0
    })

    // Process the results to see what content would be generated
    const processedResults = data.hits?.slice(0, 3).map((hit, index) => {
      const description = `${hit.tags.split(', ').slice(0, 3).join(', ')} - Photo by ${hit.user}`
      const contentText = `${description} ${hit.tags}`
      
      console.log(`📝 Image ${index + 1} content:`, {
        id: hit.id,
        tags: hit.tags,
        description,
        contentText: contentText.substring(0, 100) + '...',
        hasHotdog: contentText.toLowerCase().includes('hotdog') || contentText.toLowerCase().includes('hot dog'),
        photoUrl: hit.webformatURL
      })
      
      return {
        id: hit.id,
        tags: hit.tags,
        description,
        contentText,
        hasHotdogKeyword: contentText.toLowerCase().includes('hotdog') || contentText.toLowerCase().includes('hot dog'),
        photoUrl: hit.webformatURL,
        pageUrl: hit.pageURL,
        user: hit.user
      }
    }) || []

    return NextResponse.json({
      success: response.ok,
      api_status: response.status,
      data: {
        total: data.total,
        totalHits: data.totalHits,
        processed_samples: processedResults
      },
      analysis: {
        samples_with_hotdog_keywords: processedResults.filter(r => r.hasHotdogKeyword).length,
        total_samples: processedResults.length
      }
    })

  } catch (error) {
    console.error('Pixabay debug error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: error.stack
      },
      { status: 500 }
    )
  }
}