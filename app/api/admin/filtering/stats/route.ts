import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Mock data for now - replace with real database queries once filtering tables are properly configured
    const mockFilteringStats = {
      current: {
        total_processed: 1247,
        auto_approved: 892,
        auto_rejected: 198,
        flagged_for_review: 157,
        spam_detected: 89,
        inappropriate_detected: 45,
        unrelated_detected: 64,
        duplicates_detected: 78,
        false_positives: 12,
        false_negatives: 8,
        accuracy_rate: 0.91
      },
      daily: [
        {
          date: new Date().toISOString().split('T')[0],
          daily_processed: 247,
          daily_approved: 189,
          daily_rejected: 38,
          daily_flagged: 20,
          daily_accuracy: 0.92
        },
        {
          date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          daily_processed: 198,
          daily_approved: 156,
          daily_rejected: 24,
          daily_flagged: 18,
          daily_accuracy: 0.89
        },
        {
          date: new Date(Date.now() - 24 * 60 * 60 * 1000 * 2).toISOString().split('T')[0],
          daily_processed: 234,
          daily_approved: 201,
          daily_rejected: 19,
          daily_flagged: 14,
          daily_accuracy: 0.94
        },
        {
          date: new Date(Date.now() - 24 * 60 * 60 * 1000 * 3).toISOString().split('T')[0],
          daily_processed: 189,
          daily_approved: 167,
          daily_rejected: 12,
          daily_flagged: 10,
          daily_accuracy: 0.93
        },
        {
          date: new Date(Date.now() - 24 * 60 * 60 * 1000 * 4).toISOString().split('T')[0],
          daily_processed: 156,
          daily_approved: 134,
          daily_rejected: 15,
          daily_flagged: 7,
          daily_accuracy: 0.90
        },
        {
          date: new Date(Date.now() - 24 * 60 * 60 * 1000 * 5).toISOString().split('T')[0],
          daily_processed: 223,
          daily_approved: 195,
          daily_rejected: 18,
          daily_flagged: 10,
          daily_accuracy: 0.91
        }
      ],
      patternEffectiveness: [
        {
          pattern_type: 'spam',
          pattern: '/\\b(buy now|click here|limited time)\\b/i',
          description: 'Common spam trigger phrases',
          matches: 456,
          avg_confidence: 0.87
        },
        {
          pattern_type: 'inappropriate',
          pattern: '/\\b(violent|explicit|nsfw)\\b/i',
          description: 'Inappropriate content detection',
          matches: 234,
          avg_confidence: 0.92
        },
        {
          pattern_type: 'unrelated',
          pattern: '/\\b(politics|religion|finance)\\b/i',
          description: 'Off-topic content filtering',
          matches: 189,
          avg_confidence: 0.78
        },
        {
          pattern_type: 'required',
          pattern: '/\\b(hotdog|hot dog|sausage|frankfurter)\\b/i',
          description: 'Required hotdog-related content',
          matches: 1847,
          avg_confidence: 0.95
        },
        {
          pattern_type: 'spam',
          pattern: '/\\b(free|urgent|act now)\\b/i',
          description: 'Urgent action spam patterns',
          matches: 167,
          avg_confidence: 0.83
        },
        {
          pattern_type: 'inappropriate',
          pattern: '/\\b(hate|discrimination|harassment)\\b/i',
          description: 'Hate speech detection',
          matches: 89,
          avg_confidence: 0.94
        },
        {
          pattern_type: 'unrelated',
          pattern: '/\\b(cryptocurrency|investment|loan)\\b/i',
          description: 'Financial content filtering',
          matches: 134,
          avg_confidence: 0.81
        },
        {
          pattern_type: 'spam',
          pattern: '/\\b(miracle cure|guaranteed|instant)\\b/i',
          description: 'Medical/miracle claim detection',
          matches: 112,
          avg_confidence: 0.89
        }
      ]
    }

    return NextResponse.json(mockFilteringStats, {
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