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

    // Search for hotdog GIFs
    const searchUrl = 'https://api.giphy.com/v1/gifs/search'
    const params = new URLSearchParams({
      api_key: apiKey,
      q: 'hotdog',
      limit: '10',
      offset: '0',
      rating: 'g',
      lang: 'en'
    })

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
    const errors = []

    // Process each GIF
    for (const gif of giphyData.data) {
      try {
        // Generate content hash for duplicate detection
        const hashInput = `giphy_${gif.id}_${gif.title}`
        const contentHash = require('crypto').createHash('md5').update(hashInput).digest('hex')

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
          if (error.message?.includes('duplicate')) {
            console.log(`⚠️ Duplicate GIF skipped: "${gif.title}"`)
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

    console.log(`📊 Giphy scan complete: ${addedCount} GIFs added, ${errors.length} errors`)

    return NextResponse.json({
      success: true,
      message: `Successfully added ${addedCount} hotdog GIFs from Giphy`,
      gifs_added: addedCount,
      total_found: giphyData.data.length,
      errors: errors.length > 0 ? errors : undefined
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