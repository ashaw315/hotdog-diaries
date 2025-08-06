import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface PostDetails {
  id: number
  title: string
  content: string | null
  image_url: string | null
  video_url: string | null
  content_type: string
  source_platform: string
  original_url: string
  original_author: string | null
  posted_at: string
  slug: string | null
  view_count: number
  like_count: number
  share_count: number
  is_featured: boolean
  meta_description: string | null
}

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params

    if (!slug) {
      return NextResponse.json(
        { error: 'Slug is required' },
        { status: 400 }
      )
    }

    // Get post by slug
    const postQuery = `
      SELECT 
        p.id,
        p.title,
        p.content,
        p.image_url,
        p.video_url,
        p.content_type,
        p.source_platform,
        p.original_url,
        p.original_author,
        p.posted_at,
        p.slug,
        p.view_count,
        p.like_count,
        p.share_count,
        p.is_featured,
        p.meta_description
      FROM posts p
      WHERE p.slug = $1 AND p.is_visible = true
    `

    const postResult = await db.query<PostDetails>(postQuery, [slug])

    if (postResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      )
    }

    const post = postResult.rows[0]

    // Get related posts from the same platform
    const relatedQuery = `
      SELECT 
        p.id,
        p.title,
        p.slug,
        p.image_url,
        p.content_type,
        p.source_platform,
        p.posted_at,
        p.view_count,
        p.like_count
      FROM posts p
      WHERE p.source_platform = $1 
        AND p.id != $2 
        AND p.is_visible = true
      ORDER BY p.posted_at DESC
      LIMIT 5
    `

    const relatedResult = await db.query(relatedQuery, [post.source_platform, post.id])

    // Automatically increment view count
    await db.query(
      'UPDATE posts SET view_count = view_count + 1 WHERE id = $1',
      [post.id]
    )

    const response = {
      post: {
        ...post,
        view_count: post.view_count + 1 // Return updated count
      },
      related: relatedResult.rows,
      navigation: {
        platform: post.source_platform,
        contentType: post.content_type
      }
    }

    // Set cache headers
    const headers = {
      'Cache-Control': 'public, max-age=600, stale-while-revalidate=1200', // 10 min cache, 20 min stale
      'Content-Type': 'application/json'
    }

    return NextResponse.json(response, { headers })

  } catch (error) {
    console.error('Failed to fetch post:', error)
    return NextResponse.json(
      { error: 'Failed to fetch post' },
      { status: 500 }
    )
  }
}