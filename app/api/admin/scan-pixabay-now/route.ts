import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  console.log('📸 Starting Pixabay scan with enhanced diagnostics...')
  
  try {
    // Auth check - same as other admin endpoints
    let userId: string | null = null
    let username: string | null = null

    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      try {
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString())
        if (decoded.username === 'admin' && decoded.id === 1) {
          userId = '1'
          username = 'admin'
        }
      } catch (e) {
        // Fall through to normal auth
      }
    }

    if (!userId) {
      userId = request.headers.get('x-user-id')
      username = request.headers.get('x-username')
    }

    if (!userId || !username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('✅ Authentication successful for Pixabay scan')

    // Enhanced API key diagnostics
    const apiKey = process.env.PIXABAY_API_KEY
    console.log('🔑 Pixabay API Key Status:', {
      exists: !!apiKey,
      length: apiKey ? apiKey.length : 0,
      firstChars: apiKey ? apiKey.substring(0, 8) + '...' : 'N/A'
    })

    if (!apiKey) {
      console.error('❌ PIXABAY_API_KEY not found in environment')
      return NextResponse.json({
        success: false,
        error: 'Pixabay API key not configured. Please set PIXABAY_API_KEY environment variable.',
        details: {
          message: 'Missing API key',
          solution: 'Get a Pixabay API key from https://pixabay.com/api/docs/',
          documentation: 'https://pixabay.com/api/docs/'
        },
        images_added: 0
      }, { status: 500 })
    }

    // Test API key first with a minimal request
    console.log('🧪 Testing Pixabay API key validity...')
    const testUrl = 'https://pixabay.com/api/'
    const testParams = new URLSearchParams({
      key: apiKey,
      q: 'test',
      image_type: 'photo',
      per_page: '3'
    })

    const testResponse = await fetch(`${testUrl}?${testParams}`)
    console.log('🧪 Test response status:', testResponse.status)

    if (!testResponse.ok) {
      const errorText = await testResponse.text()
      console.error('❌ Pixabay API key test failed:', errorText)
      
      let errorDetails
      try {
        const errorJson = JSON.parse(errorText)
        errorDetails = errorJson.error || errorJson
      } catch (e) {
        errorDetails = { message: errorText }
      }

      // Provide specific error guidance
      let solution = 'Check your API key configuration'
      if (testResponse.status === 403) {
        solution = 'API key is invalid or has insufficient permissions'
      } else if (testResponse.status === 429) {
        solution = 'Pixabay API rate limit exceeded. Wait and retry.'
      } else if (testResponse.status === 400) {
        solution = 'Invalid API request parameters. Check API key format.'
      }

      return NextResponse.json({
        success: false,
        error: `Pixabay API authentication failed: ${testResponse.status}`,
        details: {
          status: testResponse.status,
          message: errorDetails.message || 'Unknown error',
          solution,
          errorType: testResponse.status === 403 ? 'authentication_error' : 'api_error'
        },
        images_added: 0
      }, { status: 500 })
    }

    console.log('✅ Pixabay API key test successful!')

    // Search for hotdog images
    const searchUrl = 'https://pixabay.com/api/'
    const params = new URLSearchParams({
      key: apiKey,
      q: 'hotdog',
      image_type: 'photo',
      per_page: '3', // Get 3 high-quality images (valid range: 3-200)
      safesearch: 'true',
      order: 'popular', // Get popular/high-quality images
      min_width: '640', // Ensure decent resolution
      category: 'food'
    })

    console.log('🔍 Fetching hotdog images from Pixabay API...')
    const response = await fetch(`${searchUrl}?${params}`)
    
    if (!response.ok) {
      console.error('❌ Pixabay API search error:', response.status, response.statusText)
      const errorText = await response.text()
      console.error('❌ Pixabay API error body:', errorText)
      
      // Parse error for better user feedback
      let errorDetails
      try {
        const errorJson = JSON.parse(errorText)
        errorDetails = errorJson.error || errorJson
      } catch (e) {
        errorDetails = { message: errorText }
      }

      return NextResponse.json({
        success: false,
        error: `Pixabay API search failed: ${response.status} ${response.statusText}`,
        details: {
          status: response.status,
          message: errorDetails.message || 'Unknown error',
          query: 'hotdog'
        },
        images_added: 0
      }, { status: 500 })
    }

    const pixabayData = await response.json()
    console.log('✅ Pixabay API response received, images found:', pixabayData.hits?.length || 0)

    if (!pixabayData.hits || pixabayData.hits.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hotdog images found for query "hotdog"',
        images_added: 0
      })
    }

    // Connect to database (SQLite for dev, PostgreSQL for production)
    await db.connect()
    let addedCount = 0
    const errors = []

    // Process each image with quality filtering
    for (const hit of pixabayData.hits) {
      try {
        // Quality filter: only include images with decent engagement
        if (hit.likes < 10 || hit.views < 100) {
          console.log(`⚠️ Skipping low-quality image: ${hit.tags} (${hit.likes} likes, ${hit.views} views)`)
          continue
        }

        // Generate content hash for duplicate detection
        const hashInput = `pixabay_${hit.id}_${hit.tags}`
        const contentHash = require('crypto').createHash('md5').update(hashInput).digest('hex')

        console.log(`📝 Attempting to save image: "${hit.tags}" by ${hit.user}`)

        // Use standard database query that works with both SQLite and PostgreSQL
        const result = await db.query(
          `INSERT INTO content_queue (
            content_text, content_image_url, content_video_url, content_type,
            source_platform, original_url, original_author, content_hash,
            content_status, confidence_score, is_approved, is_rejected, is_posted,
            scraped_at, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) 
          RETURNING id`,
          [
            hit.tags || 'Hotdog Photo',
            hit.webformatURL, // Medium-quality image for display
            null, // No video URL for images
            'image',
            'pixabay',
            hit.pageURL, // Link to Pixabay page
            hit.user || 'Pixabay User',
            contentHash,
            'discovered',
            0.90, // High confidence for curated stock photos
            true, // Auto-approve Pixabay content
            false,
            false,
            new Date().toISOString(),
            new Date().toISOString(),
            new Date().toISOString()
          ]
        )

        if (result.rows.length > 0) {
          console.log(`✅ Successfully saved image with ID: ${result.rows[0].id}`)
          addedCount++
        } else {
          errors.push(`Failed to save "${hit.tags}": No ID returned`)
        }

      } catch (imageError) {
        console.error(`❌ Error processing image "${hit.tags}":`, imageError)
        if (imageError.message?.includes('duplicate') || imageError.message?.includes('UNIQUE constraint')) {
          console.log(`⚠️ Duplicate image skipped: "${hit.tags}"`)
        } else {
          errors.push(`Error processing "${hit.tags}": ${imageError.message}`)
        }
      }
    }

    console.log(`📊 Pixabay scan complete: ${addedCount} images added, ${errors.length} errors`)

    return NextResponse.json({
      success: true,
      message: `Successfully added ${addedCount} hotdog images from Pixabay`,
      images_added: addedCount,
      total_found: pixabayData.hits.length,
      total_after_quality_filter: addedCount + errors.length,
      errors: errors.length > 0 ? errors : undefined,
      note: addedCount === 0 && errors.length === 0 ? 'All images were duplicates or low quality' : undefined
    })

  } catch (error) {
    console.error('❌ Critical error in Pixabay scan:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      images_added: 0
    }, { status: 500 })
  }
}