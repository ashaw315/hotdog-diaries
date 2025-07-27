import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { FilteringService } from '@/lib/services/filtering'

export async function GET(request: NextRequest) {
  try {
    const filterPatterns = await query(`
      SELECT 
        id,
        pattern_type,
        pattern,
        description,
        is_regex,
        is_enabled,
        created_at,
        updated_at
      FROM filter_patterns
      ORDER BY pattern_type, created_at DESC
    `)

    const filteringStats = await query(`
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
        accuracy_rate
      FROM filtering_stats
      ORDER BY created_at DESC
      LIMIT 1
    `)

    return NextResponse.json({
      patterns: filterPatterns.rows,
      stats: filteringStats.rows[0] || {
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
    })
  } catch (error) {
    console.error('Error fetching filter data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch filter data' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { patterns } = await request.json()

    if (!patterns || !Array.isArray(patterns)) {
      return NextResponse.json(
        { error: 'Invalid patterns data' },
        { status: 400 }
      )
    }

    const client = await query('BEGIN')

    try {
      for (const pattern of patterns) {
        const { id, pattern_type, pattern: patternText, description, is_regex, is_enabled } = pattern

        if (id) {
          await query(`
            UPDATE filter_patterns 
            SET pattern_type = $1, pattern = $2, description = $3, is_regex = $4, is_enabled = $5, updated_at = NOW()
            WHERE id = $6
          `, [pattern_type, patternText, description, is_regex, is_enabled, id])
        } else {
          await query(`
            INSERT INTO filter_patterns (pattern_type, pattern, description, is_regex, is_enabled)
            VALUES ($1, $2, $3, $4, $5)
          `, [pattern_type, patternText, description, is_regex, is_enabled])
        }
      }

      await query('COMMIT')

      return NextResponse.json({ success: true })
    } catch (error) {
      await query('ROLLBACK')
      throw error
    }
  } catch (error) {
    console.error('Error updating filter patterns:', error)
    return NextResponse.json(
      { error: 'Failed to update filter patterns' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const patternId = searchParams.get('id')

    if (!patternId) {
      return NextResponse.json(
        { error: 'Pattern ID is required' },
        { status: 400 }
      )
    }

    await query('DELETE FROM filter_patterns WHERE id = $1', [patternId])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting filter pattern:', error)
    return NextResponse.json(
      { error: 'Failed to delete filter pattern' },
      { status: 500 }
    )
  }
}