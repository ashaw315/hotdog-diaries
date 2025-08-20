import { NextRequest, NextResponse } from 'next/server'
import { createSimpleClient } from '@/utils/supabase/server'

export async function POST(request: NextRequest) {
  console.log('🔍 Starting diagnostic scan...')
  
  try {
    // Auth check
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

    // Test Giphy API
    const apiKey = process.env.GIPHY_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Giphy API key not found' }, { status: 500 })
    }

    console.log('📡 Fetching from Giphy API for diagnostic...')
    const searchUrl = 'https://api.giphy.com/v1/gifs/search'
    const params = new URLSearchParams({
      api_key: apiKey,
      q: 'hotdog',
      limit: '5',
      offset: '0',
      rating: 'g',
      lang: 'en'
    })

    const response = await fetch(`${searchUrl}?${params}`)
    if (!response.ok) {
      return NextResponse.json({
        error: `Giphy API error: ${response.status}`,
        details: await response.text()
      }, { status: 500 })
    }

    const giphyData = await response.json()
    console.log('✅ Giphy API returned:', giphyData.data?.length || 0, 'GIFs')

    // Connect to database
    const supabase = createSimpleClient()

    // Get existing content hashes
    const { data: existingContent, error: fetchError } = await supabase
      .from('content_queue')
      .select('content_hash, content_text, source_platform')
      .eq('source_platform', 'giphy')

    if (fetchError) {
      return NextResponse.json({
        error: 'Database fetch error',
        details: fetchError.message
      }, { status: 500 })
    }

    const existingHashes = new Set(existingContent.map(item => item.content_hash))
    console.log('📊 Found', existingHashes.size, 'existing Giphy hashes in database')

    // Analyze each GIF
    const analysis = []
    for (const gif of giphyData.data || []) {
      const hashInput = `giphy_${gif.id}_${gif.title}`
      const contentHash = require('crypto').createHash('md5').update(hashInput).digest('hex')
      
      const isDuplicate = existingHashes.has(contentHash)
      
      analysis.push({
        id: gif.id,
        title: gif.title || 'No title',
        url: gif.url,
        hash: contentHash,
        isDuplicate,
        status: isDuplicate ? 'DUPLICATE' : 'NEW'
      })
    }

    const newCount = analysis.filter(item => !item.isDuplicate).length
    const duplicateCount = analysis.filter(item => item.isDuplicate).length

    return NextResponse.json({
      success: true,
      diagnostic: {
        giphyApiReturned: giphyData.data?.length || 0,
        existingInDatabase: existingHashes.size,
        newContent: newCount,
        duplicates: duplicateCount,
        analysis: analysis,
        existingContent: existingContent.map(item => ({
          text: item.content_text,
          hash: item.content_hash,
          platform: item.source_platform
        }))
      }
    })

  } catch (error) {
    console.error('❌ Diagnostic error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}