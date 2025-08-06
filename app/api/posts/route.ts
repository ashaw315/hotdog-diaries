import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface Post {
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
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100) // Max 100 per request
    const featured = searchParams.get('featured') === 'true'
    const platform = searchParams.get('platform')
    const contentType = searchParams.get('type')
    
    const offset = (page - 1) * limit

    // Build WHERE clause
    let whereConditions = ['p.is_visible = true']
    const queryParams: any[] = []

    if (featured) {
      whereConditions.push('p.is_featured = true')
    }

    if (platform) {
      whereConditions.push(`p.source_platform = $${queryParams.length + 1}`)
      queryParams.push(platform)
    }

    if (contentType) {
      whereConditions.push(`p.content_type = $${queryParams.length + 1}`)
      queryParams.push(contentType)
    }

    const whereClause = whereConditions.join(' AND ')

    // Get posts with pagination
    const postsQuery = `
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
        p.is_featured
      FROM posts p
      WHERE ${whereClause}
      ORDER BY 
        p.is_featured DESC,
        p.posted_at DESC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `

    queryParams.push(limit, offset)
    const postsResult = await db.query<Post>(postsQuery, queryParams)

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM posts p
      WHERE ${whereClause}
    `
    const countResult = await db.query(countQuery, queryParams.slice(0, -2))
    const total = parseInt(countResult.rows[0].total)

    // Get platform statistics
    const statsQuery = `
      SELECT 
        source_platform,
        COUNT(*) as count,
        AVG(view_count) as avg_views
      FROM posts
      WHERE is_visible = true
      GROUP BY source_platform
      ORDER BY count DESC
    `
    const statsResult = await db.query(statsQuery)

    const response = {
      posts: postsResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + limit < total
      },
      platforms: statsResult.rows,
      filters: {
        featured,
        platform,
        contentType
      }
    }

    // Set cache headers for better performance
    const headers = {
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=600', // 5 min cache, 10 min stale
      'Content-Type': 'application/json'
    }

    return NextResponse.json(response, { headers })

  } catch (error) {
    console.error('Failed to fetch posts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch posts' },
      { status: 500 }
    )
  }
}

// Update view count when a post is viewed
export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const postId = searchParams.get('id')
    const action = searchParams.get('action') // 'view', 'like', 'share'

    if (!postId || !action) {
      return NextResponse.json(
        { error: 'Post ID and action are required' },
        { status: 400 }
      )
    }

    let updateColumn: string
    switch (action) {
      case 'view':
        updateColumn = 'view_count'
        break
      case 'like':
        updateColumn = 'like_count'
        break
      case 'share':
        updateColumn = 'share_count'
        break
      default:
        return NextResponse.json(
          { error: 'Invalid action. Must be view, like, or share' },
          { status: 400 }
        )
    }

    const updateQuery = `
      UPDATE posts 
      SET ${updateColumn} = ${updateColumn} + 1,
          updated_at = NOW()
      WHERE id = $1 AND is_visible = true
      RETURNING ${updateColumn}
    `

    const result = await db.query(updateQuery, [parseInt(postId)])
    
    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      action,
      newCount: result.rows[0][updateColumn]
    })

  } catch (error) {
    console.error('Failed to update post stats:', error)
    return NextResponse.json(
      { error: 'Failed to update post stats' },
      { status: 500 }
    )
  }
}