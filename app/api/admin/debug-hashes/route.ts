import { NextRequest, NextResponse } from 'next/server'
import { createSimpleClient } from '@/utils/supabase/server'

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString())
      if (decoded.username !== 'admin' || decoded.id !== 1) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    } catch (e) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createSimpleClient()

    // Get all content hashes by platform
    const { data: allContent, error } = await supabase
      .from('content_queue')
      .select('content_hash, source_platform, content_text')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Group by platform
    const byPlatform = {}
    for (const item of allContent) {
      if (!byPlatform[item.source_platform]) {
        byPlatform[item.source_platform] = []
      }
      byPlatform[item.source_platform].push({
        hash: item.content_hash,
        text: item.content_text
      })
    }

    // Test Pixabay hash generation
    const testPixabayHashes = []
    const testImages = [
      { id: 1234, tags: 'hotdog, food, sausage' },
      { id: 5678, tags: 'hotdog, bakery, sweets, bread, meal, food, buns, sausage' }
    ]

    for (const img of testImages) {
      const hashInput = `pixabay_${img.id}_${img.tags}`
      const hash = require('crypto').createHash('md5').update(hashInput).digest('hex')
      testPixabayHashes.push({
        input: hashInput,
        hash: hash,
        existsInDb: allContent.some(item => item.content_hash === hash)
      })
    }

    return NextResponse.json({
      success: true,
      totalItems: allContent.length,
      byPlatform: Object.keys(byPlatform).reduce((acc, platform) => {
        acc[platform] = byPlatform[platform].length
        return acc
      }, {}),
      hashDetails: byPlatform,
      testPixabayHashes
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}