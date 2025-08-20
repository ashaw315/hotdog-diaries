import { NextRequest, NextResponse } from 'next/server'
import { createSimpleClient } from '@/utils/supabase/server'

export async function POST(request: NextRequest) {
  console.log('🎬 Starting Giphy scan...')
  
  try {
    // Auth check - same as /api/admin/me
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

    console.log('✅ Authentication successful for Giphy scan')

    // Check Giphy API key
    const apiKey = process.env.GIPHY_API_KEY
    if (!apiKey) {
      console.error('❌ GIPHY_API_KEY not found in environment')
      return NextResponse.json({
        success: false,
        error: 'Giphy API key not configured',
        gifs_added: 0
      }, { status: 500 })
    }

    console.log('✅ Giphy API key found')

    // Search for hotdog GIFs with variety to avoid duplicates
    const searchTerms = ['hotdog', 'hot dog', 'chicago hotdog', 'hotdog recipe', 'frankfurter']
    const randomTerm = searchTerms[Math.floor(Math.random() * searchTerms.length)]
    const randomOffset = Math.floor(Math.random() * 50) // Random offset up to 50
    
    const searchUrl = 'https://api.giphy.com/v1/gifs/search'
    const params = new URLSearchParams({
      api_key: apiKey,
      q: randomTerm,
      limit: '10',
      offset: randomOffset.toString(),
      rating: 'g',
      lang: 'en',
      random: Date.now().toString() // Avoid caching
    })
    
    console.log(`🎯 Searching Giphy with term: "${randomTerm}", offset: ${randomOffset}`)

    console.log('🔍 Fetching GIFs from Giphy API...')
    const response = await fetch(`${searchUrl}?${params}`)
    
    if (!response.ok) {
      console.error('❌ Giphy API error:', response.status, response.statusText)
      return NextResponse.json({
        success: false,
        error: `Giphy API error: ${response.status} ${response.statusText}`,
        gifs_added: 0
      }, { status: 500 })
    }

    const giphyData = await response.json()
    console.log('✅ Giphy API response received, GIFs found:', giphyData.data?.length || 0)

    if (!giphyData.data || giphyData.data.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hotdog GIFs found',
        gifs_added: 0
      })
    }

    // Connect to Supabase
    const supabase = createSimpleClient()
    let addedCount = 0
    let duplicateCount = 0
    let processedCount = 0
    const errors = []

    // Process each GIF
    for (const gif of giphyData.data) {
      try {
        processedCount++
        
        // Generate content hash for duplicate detection
        const hashInput = `giphy_${gif.id}_${gif.title}`
        const contentHash = require('crypto').createHash('md5').update(hashInput).digest('hex')
        
        console.log(`📝 Processing GIF ${processedCount}/${giphyData.data.length}: "${gif.title}" (ID: ${gif.id})`)

        const gifData = {
          content_text: gif.title || 'Hotdog GIF',
          content_image_url: gif.images.downsized_medium?.url || gif.images.original?.url,
          content_video_url: gif.images.original?.mp4 || null,
          content_type: 'image',
          source_platform: 'giphy',
          original_url: gif.url,
          original_author: gif.username || 'Giphy User',
          content_hash: contentHash,
          content_status: 'discovered',
          confidence_score: 0.85,
          is_approved: true, // Auto-approve Giphy content
          is_rejected: false,
          is_posted: false,
          scraped_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }

        console.log(`📝 Attempting to save GIF: "${gif.title}" (${gif.id})`)

        const { data, error } = await supabase
          .from('content_queue')
          .insert(gifData)
          .select('id')
          .single()

        if (error) {
          if (error.message?.includes('duplicate') || error.code === '23505') {
            console.log(`⚠️ Duplicate GIF skipped: "${gif.title}" (hash: ${contentHash.substring(0, 8)}...)`)
            duplicateCount++
          } else {
            console.error(`❌ Error saving GIF "${gif.title}":`, error)
            errors.push(`Failed to save "${gif.title}": ${error.message}`)
          }
        } else {
          console.log(`✅ Successfully saved GIF with ID: ${data.id}`)
          addedCount++
        }

      } catch (gifError) {
        console.error(`❌ Error processing GIF "${gif.title}":`, gifError)
        errors.push(`Error processing "${gif.title}": ${gifError.message}`)
      }
    }

    console.log(`📊 Giphy scan complete: ${addedCount} GIFs added, ${duplicateCount} duplicates, ${errors.length} errors`)

    // Return failure if no content was added
    if (addedCount === 0) {
      return NextResponse.json({
        success: false,
        error: "No new content added - all items were duplicates or failed processing",
        details: {
          searchTerm: randomTerm,
          searchOffset: randomOffset,
          apiReturned: giphyData.data.length,
          processed: processedCount,
          added: addedCount,
          duplicates: duplicateCount,
          errors: errors
        }
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: `Successfully added ${addedCount} hotdog GIFs from Giphy`,
      gifs_added: addedCount,
      stats: {
        searchTerm: randomTerm,
        searchOffset: randomOffset,
        apiReturned: giphyData.data.length,
        processed: processedCount,
        added: addedCount,
        duplicates: duplicateCount,
        errors: errors
      }
    })

  } catch (error) {
    console.error('❌ Critical error in Giphy scan:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      gifs_added: 0
    }, { status: 500 })
  }
}