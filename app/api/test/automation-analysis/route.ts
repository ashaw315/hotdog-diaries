import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Analyze current content availability for 6x daily posting
    const contentAnalysis = await db.query(`
      WITH daily_stats AS (
        SELECT 
          DATE(scraped_at) as scan_date,
          COUNT(*) FILTER (WHERE is_approved = true) as approved_count,
          COUNT(*) FILTER (WHERE is_approved = true AND is_posted = false) as available_count,
          COUNT(*) as total_scanned,
          source_platform
        FROM content_queue
        WHERE scraped_at > NOW() - INTERVAL '7 days'
        GROUP BY DATE(scraped_at), source_platform
      )
      SELECT 
        AVG(approved_count) as avg_daily_approved,
        AVG(available_count) as avg_daily_available,
        AVG(total_scanned) as avg_daily_scanned,
        source_platform,
        COUNT(*) as scan_days
      FROM daily_stats
      GROUP BY source_platform
      ORDER BY avg_daily_approved DESC;
    `)

    // Check current queue status
    const queueStatus = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE is_approved = true AND is_posted = false) as ready_to_post,
        COUNT(*) FILTER (WHERE is_approved = true AND is_posted = true) as already_posted,
        COUNT(*) FILTER (WHERE is_approved = false) as rejected_content,
        COUNT(*) FILTER (WHERE scraped_at > NOW() - INTERVAL '24 hours') as last_24h_scanned,
        COUNT(*) FILTER (WHERE scraped_at > NOW() - INTERVAL '24 hours' AND is_approved = true) as last_24h_approved
      FROM content_queue;
    `)

    // Check current posting frequency
    const postingPattern = await db.query(`
      SELECT 
        DATE_TRUNC('hour', posted_at) as hour,
        COUNT(*) as posts_made,
        STRING_AGG(DISTINCT source_platform::text, ', ') as platforms_posted
      FROM content_queue 
      WHERE is_posted = true 
      AND posted_at > NOW() - INTERVAL '7 days'
      GROUP BY DATE_TRUNC('hour', posted_at)
      ORDER BY hour DESC
      LIMIT 20;
    `)

    // Check scanning frequency
    const scanningPattern = await db.query(`
      SELECT 
        DATE_TRUNC('hour', scraped_at) as scan_hour,
        COUNT(*) as items_scanned,
        COUNT(DISTINCT source_platform) as platforms_scanned,
        STRING_AGG(DISTINCT source_platform::text, ', ') as platforms
      FROM content_queue
      WHERE scraped_at > NOW() - INTERVAL '7 days'
      GROUP BY DATE_TRUNC('hour', scraped_at)
      ORDER BY scan_hour DESC
      LIMIT 20;
    `)

    // Check if scan_config table exists and get config
    let scanConfig = null
    try {
      const configResult = await db.query(`
        SELECT * FROM scan_config ORDER BY created_at DESC LIMIT 1;
      `)
      scanConfig = configResult.rows[0] || null
    } catch (error) {
      // scan_config table might not exist
    }

    // Calculate sustainability metrics
    const totalApproved = queueStatus.rows[0]?.ready_to_post || 0
    const dailyApproved = contentAnalysis.rows.reduce((sum, row) => sum + parseFloat(row.avg_daily_approved), 0)
    const daysOfContent = totalApproved > 0 ? Math.floor(totalApproved / 6) : 0
    const sustainabilityStatus = dailyApproved >= 6 ? 'Sustainable ✅' : `Need more content ⚠️ (${6 - dailyApproved} short/day)`

    return NextResponse.json({
      success: true,
      analysis: {
        // Content availability for 6x daily posting
        contentSustainability: {
          currentQueue: parseInt(queueStatus.rows[0]?.ready_to_post || '0'),
          dailyApprovalRate: Math.round(dailyApproved * 10) / 10,
          daysOfContentAvailable: daysOfContent,
          requirementMet: dailyApproved >= 6,
          status: sustainabilityStatus,
          recommendedScanFrequency: dailyApproved < 6 ? 'Every 2-3 hours' : 'Every 4-6 hours'
        },

        // Platform performance
        platformBreakdown: contentAnalysis.rows.map(row => ({
          platform: row.source_platform,
          avgDailyApproved: parseFloat(row.avg_daily_approved),
          avgDailyAvailable: parseFloat(row.avg_daily_available),
          avgDailyScanned: parseFloat(row.avg_daily_scanned),
          scanDays: parseInt(row.scan_days),
          contributionPercentage: Math.round((parseFloat(row.avg_daily_approved) / dailyApproved) * 100)
        })),

        // Current automation status
        automationStatus: {
          scanConfig: scanConfig ? {
            enabled: scanConfig.is_enabled,
            platforms: scanConfig.enabled_platforms,
            frequency: scanConfig.scan_frequency_hours + ' hours',
            maxPerScan: scanConfig.max_posts_per_scan,
            lastScan: scanConfig.last_scan_at
          } : 'No scan configuration found',
          cronEndpoints: [
            '/api/cron/scan-content (scanning automation)',
            '/api/cron/post-content (posting automation)', 
            '/api/cron/automated-post (meal-time posting)'
          ]
        },

        // Current activity patterns
        recentActivity: {
          scanning: scanningPattern.rows.slice(0, 5),
          posting: postingPattern.rows.slice(0, 5),
          last24Hours: {
            scanned: parseInt(queueStatus.rows[0]?.last_24h_scanned || '0'),
            approved: parseInt(queueStatus.rows[0]?.last_24h_approved || '0'),
            approvalRate: queueStatus.rows[0] ? 
              Math.round((parseInt(queueStatus.rows[0].last_24h_approved) / parseInt(queueStatus.rows[0].last_24h_scanned)) * 100) : 0
          }
        },

        // 6x daily posting requirements
        requirements: {
          targetPostsPerDay: 6,
          postingInterval: '4 hours',
          requiredDailyApprovals: 8, // 6 + 2 buffer
          currentShortfall: Math.max(0, 8 - dailyApproved),
          mealTimes: [
            '07:00 - Breakfast',
            '12:00 - Lunch', 
            '15:00 - Afternoon snack',
            '18:00 - Dinner',
            '20:00 - Evening snack',
            '22:00 - Late night'
          ]
        }
      }
    })

  } catch (error) {
    console.error('Automation analysis error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}