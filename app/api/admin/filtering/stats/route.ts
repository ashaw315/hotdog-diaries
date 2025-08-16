import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {

    // Get current filtering statistics using SQLite syntax
    const currentStatsQuery = `
      SELECT 
        COUNT(cq.id) as total_processed,
        SUM(CASE WHEN cq.is_approved = 1 THEN 1 ELSE 0 END) as auto_approved,
        SUM(CASE WHEN cq.is_approved = 0 AND cq.content_status != 'rejected' THEN 1 ELSE 0 END) as auto_rejected,
        SUM(CASE WHEN ca.is_flagged = 1 THEN 1 ELSE 0 END) as flagged_for_review,
        SUM(CASE WHEN ca.is_spam = 1 THEN 1 ELSE 0 END) as spam_detected,
        SUM(CASE WHEN ca.is_inappropriate = 1 THEN 1 ELSE 0 END) as inappropriate_detected,
        SUM(CASE WHEN ca.is_unrelated = 1 THEN 1 ELSE 0 END) as unrelated_detected,
        SUM(CASE WHEN ca.duplicate_of IS NOT NULL THEN 1 ELSE 0 END) as duplicates_detected,
        AVG(ca.confidence_score) as avg_confidence
      FROM content_queue cq
      LEFT JOIN content_analysis ca ON cq.id = ca.content_queue_id
    `

    const currentStatsResult = await db.query(currentStatsQuery)
    const currentStats = currentStatsResult.rows[0] || {}

    // Calculate derived metrics
    const totalProcessed = parseInt(currentStats.total_processed) || 0
    const autoApproved = parseInt(currentStats.auto_approved) || 0
    const autoRejected = parseInt(currentStats.auto_rejected) || 0
    const flaggedForReview = parseInt(currentStats.flagged_for_review) || 0
    const avgConfidence = parseFloat(currentStats.avg_confidence) || 0

    // Calculate accuracy rate (assuming high confidence scores indicate accurate filtering)
    const accuracyRate = avgConfidence > 0 ? avgConfidence : 0.85

    // Estimate false positives/negatives (simplified calculation)
    const falsePositives = Math.max(0, Math.round(autoRejected * (1 - accuracyRate)))
    const falseNegatives = Math.max(0, Math.round(autoApproved * (1 - accuracyRate)))

    // Get daily trends for the last 7 days using SQLite syntax
    const dailyTrendsQuery = `
      SELECT 
        date(cq.created_at) as date,
        COUNT(cq.id) as daily_processed,
        SUM(CASE WHEN cq.is_approved = 1 THEN 1 ELSE 0 END) as daily_approved,
        SUM(CASE WHEN cq.is_approved = 0 AND cq.content_status = 'rejected' THEN 1 ELSE 0 END) as daily_rejected,
        SUM(CASE WHEN ca.is_flagged = 1 THEN 1 ELSE 0 END) as daily_flagged,
        AVG(ca.confidence_score) as daily_accuracy
      FROM content_queue cq
      LEFT JOIN content_analysis ca ON cq.id = ca.content_queue_id
      WHERE cq.created_at >= datetime('now', '-7 days')
      GROUP BY date(cq.created_at)
      ORDER BY date DESC
      LIMIT 7
    `

    const dailyTrendsResult = await db.query(dailyTrendsQuery)
    const dailyTrends = dailyTrendsResult.rows.map((row: any) => ({
      date: row.date,
      daily_processed: parseInt(row.daily_processed) || 0,
      daily_approved: parseInt(row.daily_approved) || 0,
      daily_rejected: parseInt(row.daily_rejected) || 0,
      daily_flagged: parseInt(row.daily_flagged) || 0,
      daily_accuracy: parseFloat(row.daily_accuracy) || 0.85
    }))

    // Get pattern effectiveness from flagged_patterns
    const patternEffectivenessQuery = `
      SELECT 
        flagged_patterns,
        confidence_score,
        is_spam,
        is_inappropriate,
        is_unrelated
      FROM content_analysis
      WHERE flagged_patterns IS NOT NULL 
      AND flagged_patterns != '[]'
      AND flagged_patterns != ''
      LIMIT 100
    `

    const patternResult = await db.query(patternEffectivenessQuery)
    
    // Process pattern effectiveness (simplified - extract common patterns)
    const patternMap = new Map()
    
    patternResult.rows.forEach((row: any) => {
      try {
        const patterns = JSON.parse(row.flagged_patterns)
        const confidence = parseFloat(row.confidence_score) || 0
        const isSpam = row.is_spam === 1
        const isInappropriate = row.is_inappropriate === 1
        const isUnrelated = row.is_unrelated === 1
        
        if (Array.isArray(patterns)) {
          patterns.forEach((pattern: string) => {
            if (!patternMap.has(pattern)) {
              patternMap.set(pattern, {
                pattern: pattern,
                matches: 0,
                totalConfidence: 0,
                type: isSpam ? 'spam' : isInappropriate ? 'inappropriate' : isUnrelated ? 'unrelated' : 'required'
              })
            }
            const entry = patternMap.get(pattern)
            entry.matches++
            entry.totalConfidence += confidence
          })
        }
      } catch (error) {
        // Skip invalid JSON
      }
    })

    // Convert to array and calculate averages
    const patternEffectiveness = Array.from(patternMap.values())
      .map(entry => ({
        pattern_type: entry.type,
        pattern: entry.pattern,
        description: `Pattern for ${entry.type} detection`,
        matches: entry.matches,
        avg_confidence: entry.matches > 0 ? entry.totalConfidence / entry.matches : 0
      }))
      .sort((a, b) => b.matches - a.matches)
      .slice(0, 10)

    const filteringStats = {
      current: {
        total_processed: totalProcessed,
        auto_approved: autoApproved,
        auto_rejected: autoRejected,
        flagged_for_review: flaggedForReview,
        spam_detected: parseInt(currentStats.spam_detected) || 0,
        inappropriate_detected: parseInt(currentStats.inappropriate_detected) || 0,
        unrelated_detected: parseInt(currentStats.unrelated_detected) || 0,
        duplicates_detected: parseInt(currentStats.duplicates_detected) || 0,
        false_positives: falsePositives,
        false_negatives: falseNegatives,
        accuracy_rate: accuracyRate
      },
      daily: dailyTrends,
      patternEffectiveness: patternEffectiveness
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