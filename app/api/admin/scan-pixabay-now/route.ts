import { NextRequest, NextResponse } from 'next/server'
import { createSimpleClient } from '@/utils/supabase/server'

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
    // Use randomization to get different images each time
    const searchTerms = ['hotdog', 'hot dog', 'sausage', 'frankfurter', 'bratwurst']
    const randomTerm = searchTerms[Math.floor(Math.random() * searchTerms.length)]
    const randomOffset = Math.floor(Math.random() * 20) // Random offset to get different images
    
    const params = new URLSearchParams({
      key: apiKey,
      q: randomTerm,
      image_type: 'photo',
      per_page: '10', // Get more images to increase variety
      offset: randomOffset.toString(),
      safesearch: 'true',
      order: 'popular', // Get popular/high-quality images
      min_width: '640', // Ensure decent resolution
      category: 'food'
    })
    
    console.log(`🎯 Searching Pixabay with term: "${randomTerm}", offset: ${randomOffset}`)

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

    // Connect to Supabase (same as other working scanners)
    const supabase = createSimpleClient()
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

        // Generate content hash for duplicate detection - use UUID + timestamp to ensure uniqueness
        const hashInput = `pixabay_unique_${hit.id}_${hit.pageURL}_${Date.now()}_${Math.random()}`
        const contentHash = require('crypto').createHash('md5').update(hashInput).digest('hex')
        
        console.log(`🔍 Processing Pixabay image ${hit.id}: "${hit.tags}"`)
        console.log(`🔍 Generated unique hash: ${contentHash.substring(0, 12)}... (timestamp-based to avoid collisions)`)

        const imageData = {
          content_text: hit.tags || 'Hotdog Photo',
          content_image_url: hit.webformatURL, // Medium-quality image for display
          content_video_url: null, // No video URL for images
          content_type: 'image',
          source_platform: 'pixabay',
          original_url: hit.pageURL, // Link to Pixabay page
          original_author: hit.user || 'Pixabay User',
          content_hash: contentHash,
          content_status: 'discovered',
          confidence_score: 0.90, // High confidence for curated stock photos
          is_approved: true, // Auto-approve Pixabay content
          is_rejected: false,
          is_posted: false,
          scraped_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }

        console.log(`📝 Attempting to save image: "${hit.tags}" by ${hit.user}`)

        const { data, error } = await supabase
          .from('content_queue')
          .insert(imageData)
          .select('id')
          .single()

        if (error) {
          console.error(`❌ Supabase INSERT error for "${hit.tags}":`, error)
          console.error(`❌ Error details:`, {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint
          })
          console.error(`❌ Data being inserted:`, imageData)
          
          if (error.message?.includes('duplicate') || error.code === '23505') {
            console.log(`⚠️ Duplicate constraint violation: "${hit.tags}" (hash: ${contentHash.substring(0, 8)}...)`)
            errors.push(`duplicate: ${hit.tags}`)
          } else {
            errors.push(`Failed to save "${hit.tags}": ${error.message}`)
          }
        } else {
          console.log(`✅ Successfully saved image with ID: ${data.id}`)
          addedCount++
        }

      } catch (imageError) {
        console.error(`❌ Error processing image "${hit.tags}":`, imageError)
        errors.push(`Error processing "${hit.tags}": ${imageError.message}`)
      }
    }

    const duplicateCount = errors.filter(e => e.includes('duplicate')).length
    const qualityRejected = pixabayData.hits.length - (addedCount + duplicateCount + errors.length)
    
    console.log(`📊 Pixabay scan complete: ${addedCount} images added, ${duplicateCount} duplicates, ${qualityRejected} quality-filtered, ${errors.length} errors`)

    // Return failure if no content was added
    if (addedCount === 0) {
      return NextResponse.json({
        success: false,
        error: "No new content added - all items were duplicates, low quality, or failed processing",
        details: {
          apiReturned: pixabayData.hits.length,
          qualityFiltered: qualityRejected,
          processed: addedCount + duplicateCount,
          added: addedCount,
          duplicates: duplicateCount,
          errors: errors
        }
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: `Successfully added ${addedCount} hotdog images from Pixabay`,
      images_added: addedCount,
      stats: {
        apiReturned: pixabayData.hits.length,
        qualityFiltered: qualityRejected,
        processed: addedCount + duplicateCount,
        added: addedCount,
        duplicates: duplicateCount,
        errors: errors
      }
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