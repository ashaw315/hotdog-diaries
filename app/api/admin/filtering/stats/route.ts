import { NextRequest, NextResponse } from 'next/server'
import { createSimpleClient } from '@/utils/supabase/server'

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createSimpleClient()

    // Get current filtering statistics from content_queue
    const { data: contentStats, error: statsError } = await supabase
      .from('content_queue')
      .select('is_approved, is_posted, source_platform, content_type, confidence_score')

    if (statsError) {
      throw new Error(`Failed to get content stats: ${statsError.message}`)
    }

    const totalProcessed = contentStats?.length || 0
    const autoApproved = contentStats?.filter(c => c.is_approved).length || 0
    const autoRejected = contentStats?.filter(c => !c.is_approved).length || 0
    const posted = contentStats?.filter(c => c.is_posted).length || 0
    
    // Calculate platform breakdown
    const platformBreakdown = {}
    contentStats?.forEach(item => {
      const platform = item.source_platform
      if (!platformBreakdown[platform]) {
        platformBreakdown[platform] = { total: 0, approved: 0, posted: 0 }
      }
      platformBreakdown[platform].total++
      if (item.is_approved) platformBreakdown[platform].approved++
      if (item.is_posted) platformBreakdown[platform].posted++
    })

    // Calculate average confidence score
    const avgConfidence = contentStats?.length > 0 
      ? contentStats.reduce((sum, item) => sum + (item.confidence_score || 0.5), 0) / contentStats.length
      : 0.75

    // Create simplified daily trends (mock data for now)
    const dailyTrends = [
      { date: '2025-08-20', daily_processed: totalProcessed, daily_approved: autoApproved, daily_rejected: autoRejected, daily_accuracy: avgConfidence }
    ]

    const filteringStats = {
      current: {
        total_processed: totalProcessed,
        auto_approved: autoApproved,
        auto_rejected: autoRejected,
        posted: posted,
        flagged_for_review: 0,
        spam_detected: 0,
        inappropriate_detected: 0,
        unrelated_detected: 0,
        duplicates_detected: 0,
        false_positives: 0,
        false_negatives: 0,
        accuracy_rate: avgConfidence
      },
      daily: dailyTrends,
      platformBreakdown: platformBreakdown,
      patternEffectiveness: []
    }

    return NextResponse.json(filteringStats, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    console.error('Error fetching filtering statistics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch filtering statistics' },
      { status: 500 }
    )
  }
}