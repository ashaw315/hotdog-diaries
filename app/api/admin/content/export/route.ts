import { NextRequest, NextResponse } from 'next/server'
import { NextAuthUtils } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const authResult = await NextAuthUtils.verifyRequestAuth(request)
    if (!authResult.isValid || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'all'
    const platform = searchParams.get('platform') || 'all'
    const dateRange = searchParams.get('dateRange') || 'all'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const queryParams: string[] = []
    const whereConditions: string[] = []

    // Build WHERE conditions (same logic as history route)
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

    // Export query - get all matching records
    const exportQuery = `
      SELECT 
        id,
        title,
        content_text,
        platform,
        status,
        posted_at,
        created_at,
        updated_at,
        media_url,
        tags,
        views,
        likes,
        shares,
        comments,
        CASE 
          WHEN views > 0 THEN ((likes + shares + comments) * 100.0 / views)
          ELSE 0 
        END as engagement_rate
      FROM content 
      ${whereClause}
      ORDER BY created_at DESC
    `
    
    const result = await db.query(exportQuery, queryParams)
    
    // Convert to CSV format
    const csvHeaders = [
      'ID',
      'Title',
      'Content',
      'Platform',
      'Status',
      'Posted At',
      'Created At',
      'Updated At',
      'Media URL',
      'Tags',
      'Views',
      'Likes',
      'Shares',
      'Comments',
      'Engagement Rate (%)'
    ]

    const csvRows = result.rows.map(row => {
      const tags = Array.isArray(row.tags) ? row.tags.join(';') : ''
      const postedAt = row.posted_at ? new Date(row.posted_at).toISOString() : ''
      const createdAt = new Date(row.created_at).toISOString()
      const updatedAt = row.updated_at ? new Date(row.updated_at).toISOString() : ''
      const engagementRate = row.engagement_rate ? parseFloat(row.engagement_rate).toFixed(2) : '0.00'
      
      return [
        row.id,
        `"${(row.title || '').replace(/"/g, '""')}"`,
        `"${(row.content_text || '').replace(/"/g, '""')}"`,
        row.platform,
        row.status,
        postedAt,
        createdAt,
        updatedAt,
        row.media_url || '',
        `"${tags}"`,
        row.views || 0,
        row.likes || 0,
        row.shares || 0,
        row.comments || 0,
        engagementRate
      ]
    })

    // Create CSV content
    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.join(','))
    ].join('\n')

    // Return CSV file
    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `hotdog-diaries-content-${timestamp}.csv`

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': csvContent.length.toString()
      }
    })
  } catch (error) {
    console.error('Error exporting content:', error)
    return NextResponse.json(
      { error: 'Failed to export content' },
      { status: 500 }
    )
  }
}