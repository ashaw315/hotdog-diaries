import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { mockAdminDataIfCI } from '../route-utils'

export async function GET(request: NextRequest) {
  // Return mock data for CI/test environments
  const mock = mockAdminDataIfCI('queue')
  if (mock) return NextResponse.json(mock)
  
  try {
    const flaggedContent = await query(`
      SELECT 
        c.id,
        c.content_text,
        c.content_image_url,
        c.content_video_url,
        c.content_type,
        c.source_platform,
        c.original_url,
        c.original_author,
        c.created_at,
        ca.is_spam,
        ca.is_inappropriate,
        ca.is_unrelated,
        ca.confidence_score,
        ca.flagged_patterns,
        ca.flagged_reason,
        ca.processing_notes,
        ca.flagged_at
      FROM content_queue c
      INNER JOIN content_analysis ca ON c.id = ca.content_id
      WHERE ca.is_spam = TRUE OR ca.is_inappropriate = TRUE OR ca.is_unrelated = TRUE
      ORDER BY ca.flagged_at DESC
      LIMIT 50
    `)

    const statsQuery = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE ca.is_spam = TRUE OR ca.is_inappropriate = TRUE OR ca.is_unrelated = TRUE) as total_flagged,
        COUNT(*) FILTER (WHERE ca.is_spam = TRUE OR ca.is_inappropriate = TRUE OR ca.is_unrelated = TRUE) as pending_review,
        COUNT(*) FILTER (WHERE c.is_approved = TRUE AND DATE(c.updated_at) = DATE(NOW())) as reviewed_today,
        AVG(EXTRACT(EPOCH FROM (c.updated_at - c.created_at))) FILTER (WHERE c.is_approved IS NOT NULL AND c.updated_at > NOW() - INTERVAL '7 days') as avg_review_time,
        COUNT(*) FILTER (WHERE c.is_approved = TRUE AND c.updated_at > NOW() - INTERVAL '7 days') / 
        GREATEST(COUNT(*) FILTER (WHERE c.is_approved IS NOT NULL AND c.updated_at > NOW() - INTERVAL '7 days'), 1)::float as approval_rate
      FROM content_queue c
      LEFT JOIN content_analysis ca ON c.id = ca.content_id
    `)

    const stats = statsQuery.rows[0] || {
      total_flagged: 0,
      pending_review: 0,
      reviewed_today: 0,
      avg_review_time: 0,
      approval_rate: 0
    }

    return NextResponse.json({
      flaggedContent: flaggedContent.rows,
      stats: {
        total_flagged: parseInt(stats.total_flagged) || 0,
        pending_review: parseInt(stats.pending_review) || 0,
        reviewed_today: parseInt(stats.reviewed_today) || 0,
        avg_review_time: parseFloat(stats.avg_review_time) || 0,
        approval_rate: parseFloat(stats.approval_rate) || 0
      }
    })
  } catch (error) {
    console.error('Error fetching review queue:', error)
    return NextResponse.json(
      { error: 'Failed to fetch review queue' },
      { status: 500 }
    )
  }
}