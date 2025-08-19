import { NextRequest, NextResponse } from 'next/server'
import { NextAuthUtils } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await NextAuthUtils.verifyRequestAuth(request)
    if (!authResult.isValid || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'all'
    const platform = searchParams.get('platform') || 'all'
    const dateRange = searchParams.get('dateRange') || 'all'
    const sort = searchParams.get('sort') || 'posted_at'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const offset = (page - 1) * limit
    const queryParams: string[] = []
    const whereConditions: string[] = []

    // Build WHERE conditions
    if (status !== 'all') {
      whereConditions.push(`status = $${queryParams.length + 1}`)
      queryParams.push(status)
    } else {
      whereConditions.push(`status IN ('posted', 'failed', 'draft')`)
    }

    if (platform !== 'all') {
      whereConditions.push(`platform = $${queryParams.length + 1}`)
      queryParams.push(platform)
    }

    // Date range filtering
    if (dateRange !== 'all') {
      const now = new Date()
      let dateCondition = ''
      
      switch (dateRange) {
        case 'today':
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          const tomorrow = new Date(today)
          tomorrow.setDate(tomorrow.getDate() + 1)
          dateCondition = `created_at >= $${queryParams.length + 1} AND created_at < $${queryParams.length + 2}`
          queryParams.push(today.toISOString(), tomorrow.toISOString())
          break
        case 'week':
          const weekStart = new Date(now)
          weekStart.setDate(now.getDate() - now.getDay())
          weekStart.setHours(0, 0, 0, 0)
          dateCondition = `created_at >= $${queryParams.length + 1}`
          queryParams.push(weekStart.toISOString())
          break
        case 'month':
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
          dateCondition = `created_at >= $${queryParams.length + 1}`
          queryParams.push(monthStart.toISOString())
          break
        case 'custom':
          if (startDate && endDate) {
            const start = new Date(startDate)
            const end = new Date(endDate)
            end.setHours(23, 59, 59, 999)
            dateCondition = `created_at >= $${queryParams.length + 1} AND created_at <= $${queryParams.length + 2}`
            queryParams.push(start.toISOString(), end.toISOString())
          }
          break
      }
      
      if (dateCondition) {
        whereConditions.push(dateCondition)
      }
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    // Build ORDER BY clause
    let orderClause = ''
    switch (sort) {
      case 'created_at':
        orderClause = 'ORDER BY created_at DESC'
        break
      case 'engagement_rate':
        orderClause = `ORDER BY 
          CASE 
            WHEN views > 0 THEN ((likes + shares + comments) * 100.0 / views)
            ELSE 0 
          END DESC NULLS LAST, 
          posted_at DESC`
        break
      default:
        orderClause = 'ORDER BY posted_at DESC NULLS LAST, created_at DESC'
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM content 
      ${whereClause}
    `
    const countResult = await db.query(countQuery, queryParams)
    const totalCount = parseInt(countResult.rows[0].total)

    // Get paginated content
    const contentQuery = `
      SELECT 
        id,
        title,
        content_text,
        platform,
        status,
        posted_at,
        created_at,
        media_url,
        tags,
        views,
        likes,
        shares,
        comments
      FROM content 
      ${whereClause}
      ${orderClause}
      LIMIT $${(queryParams.length + 1).toString()} OFFSET $${(queryParams.length + 2).toString()}
    `
    
    queryParams.push(limit.toString(), offset.toString())
    const contentResult = await db.query(contentQuery, queryParams)

    // Transform the data
    const content = contentResult.rows.map(row => ({
      ...row,
      tags: Array.isArray(row.tags) ? row.tags : [],
      created_at: new Date(row.created_at),
      posted_at: row.posted_at ? new Date(row.posted_at) : undefined,
      engagement_rate: row.views > 0 ? 
        (((row.likes || 0) + (row.shares || 0) + (row.comments || 0)) / row.views) * 100 : 0
    }))

    const totalPages = Math.ceil(totalCount / limit)

    return NextResponse.json({
      content,
      totalCount,
      totalPages,
      currentPage: page,
      limit
    })
  } catch (error) {
    console.error('Error fetching content history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch content history' },
      { status: 500 }
    )
  }
}