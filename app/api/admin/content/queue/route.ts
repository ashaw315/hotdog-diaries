import { NextRequest, NextResponse } from 'next/server'
import { NextAuthUtils } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const authResult = await NextAuthUtils.verifyRequestAuth(request)
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sort = searchParams.get('sort') || 'created_at'
    const filter = searchParams.get('filter') || 'all'

    // Build the WHERE clause based on filter
    let whereClause = ''
    const queryParams: string[] = []

    if (filter === 'pending') {
      whereClause = "WHERE status = 'pending'"
    } else if (filter === 'scheduled') {
      whereClause = "WHERE status = 'scheduled'"
    } else {
      whereClause = "WHERE status IN ('pending', 'scheduled', 'processing')"
    }

    // Build the ORDER BY clause
    let orderClause = ''
    switch (sort) {
      case 'priority':
        orderClause = `ORDER BY 
          CASE priority 
            WHEN 'high' THEN 1 
            WHEN 'medium' THEN 2 
            WHEN 'low' THEN 3 
            ELSE 4 
          END ASC, 
          created_at DESC`
        break
      case 'scheduled_for':
        orderClause = 'ORDER BY scheduled_for ASC NULLS LAST, created_at DESC'
        break
      default:
        orderClause = 'ORDER BY created_at DESC'
    }

    const query = `
      SELECT 
        id,
        title,
        content_text,
        platform,
        scheduled_for,
        priority,
        status,
        created_at,
        media_url,
        tags
      FROM content 
      ${whereClause}
      ${orderClause}
      LIMIT 50
    `

    const result = await db.query(query, queryParams)

    // Transform the data
    const queuedContent = result.rows.map(row => ({
      ...row,
      tags: Array.isArray(row.tags) ? row.tags : [],
      created_at: new Date(row.created_at),
      scheduled_for: row.scheduled_for ? new Date(row.scheduled_for) : undefined
    }))

    return NextResponse.json(queuedContent)
  } catch (error) {
    console.error('Error fetching queued content:', error)
    return NextResponse.json(
      { error: 'Failed to fetch queued content' },
      { status: 500 }
    )
  }
}