import { NextRequest, NextResponse } from 'next/server'
import { createSimpleClient } from '@/utils/supabase/server'

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const authHeader = request.headers.get('authorization')
    const isAuthenticated = authHeader === `Bearer ${process.env.AUTH_TOKEN}`
    
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createSimpleClient()
    
    // 1. Check specific posted content IDs 204 and 252
    const { data: specificPosts, error: postsError } = await supabase
      .from('posted_content')
      .select(`
        id,
        content_queue_id,
        posted_at,
        content_queue (
          id,
          content_text,
          content_image_url,
          content_hash,
          source_platform,
          original_url,
          original_author
        )
      `)
      .in('content_queue_id', [204, 252])

    // 2. Find all content duplicates by text and image
    const { data: allContent, error: contentError } = await supabase
      .from('content_queue')
      .select('id, content_text, content_image_url, content_hash, source_platform, original_url, created_at')
      .order('created_at')

    if (contentError) {
      throw new Error(`Content query failed: ${contentError.message}`)
    }

    // Group content by text+image to find duplicates
    const contentGroups = new Map()
    const hashGroups = new Map()
    
    for (const content of allContent || []) {
      // Group by content text + image URL
      const textImageKey = `${content.content_text?.trim()}_${content.content_image_url || 'no-image'}`
      if (!contentGroups.has(textImageKey)) {
        contentGroups.set(textImageKey, [])
      }
      contentGroups.get(textImageKey).push(content)
      
      // Group by hash
      if (content.content_hash) {
        if (!hashGroups.has(content.content_hash)) {
          hashGroups.set(content.content_hash, [])
        }
        hashGroups.get(content.content_hash).push(content)
      }
    }

    // Find duplicates
    const contentDuplicates = Array.from(contentGroups.entries())
      .filter(([key, items]) => items.length > 1)
      .map(([key, items]) => ({
        key,
        count: items.length,
        ids: items.map(i => i.id),
        first_created: items[0].created_at,
        content_preview: items[0].content_text?.substring(0, 100),
        platform: items[0].source_platform
      }))

    const hashDuplicates = Array.from(hashGroups.entries())
      .filter(([hash, items]) => items.length > 1)
      .map(([hash, items]) => ({
        hash,
        count: items.length,
        ids: items.map(i => i.id)
      }))

    // 3. Get recent posted content for analysis
    const { data: recentPosts } = await supabase
      .from('posted_content')
      .select(`
        id, content_queue_id, posted_at,
        content_queue (content_text, content_image_url, source_platform)
      `)
      .order('posted_at', { ascending: false })
      .limit(10)

    return NextResponse.json({
      success: true,
      analysis: {
        specificPosts: specificPosts || [],
        contentDuplicates: contentDuplicates.slice(0, 20), // Top 20 duplicate groups
        hashDuplicates: hashDuplicates.slice(0, 20),
        recentPosts: recentPosts || [],
        stats: {
          totalContent: allContent?.length || 0,
          duplicateGroups: contentDuplicates.length,
          hashCollisions: hashDuplicates.length,
          worstDuplicate: contentDuplicates[0] || null
        }
      }
    })

  } catch (error) {
    console.error('❌ Error analyzing duplicates:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}