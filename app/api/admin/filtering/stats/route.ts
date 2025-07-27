import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const currentStats = await query(`
      SELECT 
        total_processed,
        auto_approved,
        auto_rejected,
        flagged_for_review,
        spam_detected,
        inappropriate_detected,
        unrelated_detected,
        duplicates_detected,
        false_positives,
        false_negatives,
        accuracy_rate,
        created_at
      FROM filtering_stats
      ORDER BY created_at DESC
      LIMIT 1
    `)

    const dailyStats = await query(`
      SELECT 
        DATE(created_at) as date,
        SUM(total_processed) as daily_processed,
        SUM(auto_approved) as daily_approved,
        SUM(auto_rejected) as daily_rejected,
        SUM(flagged_for_review) as daily_flagged,
        AVG(accuracy_rate) as daily_accuracy
      FROM filtering_stats
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `)

    const patternEffectiveness = await query(`
      SELECT 
        fp.pattern_type,
        fp.pattern,
        fp.description,
        COUNT(ca.id) as matches,
        AVG(ca.confidence_score) as avg_confidence
      FROM filter_patterns fp
      LEFT JOIN content_analysis ca ON ca.flagged_patterns @> ARRAY[fp.pattern]
      WHERE fp.is_enabled = true
      GROUP BY fp.id, fp.pattern_type, fp.pattern, fp.description
      ORDER BY matches DESC
      LIMIT 20
    `)

    const current = currentStats.rows[0] || {
      total_processed: 0,
      auto_approved: 0,
      auto_rejected: 0,
      flagged_for_review: 0,
      spam_detected: 0,
      inappropriate_detected: 0,
      unrelated_detected: 0,
      duplicates_detected: 0,
      false_positives: 0,
      false_negatives: 0,
      accuracy_rate: 0
    }

    return NextResponse.json({
      current,
      daily: dailyStats.rows,
      patternEffectiveness: patternEffectiveness.rows
    })
  } catch (error) {
    console.error('Error fetching filtering statistics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch filtering statistics' },
      { status: 500 }
    )
  }
}