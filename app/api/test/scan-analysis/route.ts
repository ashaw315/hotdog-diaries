import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Content volume per scan session per platform (last 7 days)
    const scanSessions = await db.query(`
      WITH scan_sessions AS (
        SELECT 
          source_platform,
          DATE_TRUNC('hour', scraped_at) as scan_hour,
          COUNT(*) as items_in_scan,
          COUNT(*) FILTER (WHERE is_approved = true) as approved_items,
          MIN(scraped_at) as scan_start,
          MAX(scraped_at) as scan_end,
          EXTRACT(EPOCH FROM (MAX(scraped_at) - MIN(scraped_at))) as scan_duration_seconds
        FROM content_queue
        WHERE scraped_at > NOW() - INTERVAL '7 days'
        GROUP BY source_platform, DATE_TRUNC('hour', scraped_at)
      )
      SELECT 
        source_platform,
        COUNT(DISTINCT scan_hour) as total_scans,
        ROUND(AVG(items_in_scan), 1) as avg_items_per_scan,
        MAX(items_in_scan) as max_items_per_scan,
        MIN(items_in_scan) as min_items_per_scan,
        ROUND(AVG(approved_items), 1) as avg_approved_per_scan,
        ROUND(AVG(scan_duration_seconds), 1) as avg_scan_duration_sec
      FROM scan_sessions
      GROUP BY source_platform
      ORDER BY avg_items_per_scan DESC;
    `)

    // Show actual scan sessions with timestamps (last 24 hours)
    const recentScans = await db.query(`
      SELECT 
        DATE_TRUNC('hour', scraped_at) as scan_time,
        source_platform,
        COUNT(*) as items_scraped,
        COUNT(*) FILTER (WHERE is_approved = true) as items_approved,
        ROUND(100.0 * COUNT(*) FILTER (WHERE is_approved = true) / COUNT(*), 1) as approval_rate
      FROM content_queue
      WHERE scraped_at > NOW() - INTERVAL '24 hours'
      GROUP BY DATE_TRUNC('hour', scraped_at), source_platform
      ORDER BY scan_time DESC, items_scraped DESC;
    `)

    // Scan frequency analysis - when do scans actually happen?
    const scanTiming = await db.query(`
      WITH scan_times AS (
        SELECT 
          DATE_TRUNC('hour', scraped_at) as scan_hour,
          COUNT(DISTINCT source_platform) as platforms_scanned,
          COUNT(*) as total_items
        FROM content_queue
        WHERE scraped_at > NOW() - INTERVAL '3 days'
        GROUP BY DATE_TRUNC('hour', scraped_at)
      )
      SELECT 
        TO_CHAR(scan_hour, 'Day') as day_of_week,
        EXTRACT(HOUR FROM scan_hour) as hour_of_day,
        platforms_scanned,
        total_items,
        scan_hour
      FROM scan_times
      ORDER BY scan_hour DESC
      LIMIT 30;
    `)

    // Time between scans
    const scanGaps = await db.query(`
      WITH scan_sessions AS (
        SELECT DISTINCT DATE_TRUNC('hour', scraped_at) as scan_time
        FROM content_queue
        WHERE scraped_at > NOW() - INTERVAL '7 days'
        ORDER BY scan_time
      ),
      scan_gaps AS (
        SELECT 
          scan_time,
          LAG(scan_time) OVER (ORDER BY scan_time) as previous_scan,
          EXTRACT(EPOCH FROM (scan_time - LAG(scan_time) OVER (ORDER BY scan_time))) / 3600 as hours_between_scans
        FROM scan_sessions
      )
      SELECT 
        ROUND(AVG(hours_between_scans), 1) as avg_hours_between_scans,
        MIN(hours_between_scans) as min_gap_hours,
        MAX(hours_between_scans) as max_gap_hours,
        COUNT(*) as total_scan_intervals
      FROM scan_gaps
      WHERE hours_between_scans IS NOT NULL;
    `)

    // Content buffer status over time
    const bufferHealth = await db.query(`
      WITH daily_buffer AS (
        SELECT 
          DATE(scraped_at) as date,
          COUNT(*) FILTER (WHERE is_approved = true AND is_posted = false) as buffer_size,
          COUNT(*) FILTER (WHERE is_approved = true AND is_posted = true) as posted_count,
          COUNT(*) as new_content_today
        FROM content_queue
        WHERE scraped_at > NOW() - INTERVAL '14 days'
        GROUP BY DATE(scraped_at)
      )
      SELECT 
        date,
        buffer_size,
        posted_count,
        new_content_today,
        ROUND(buffer_size / 6.0, 1) as days_of_buffer,
        CASE 
          WHEN buffer_size < 6 THEN 'Critical'
          WHEN buffer_size < 12 THEN 'Low'
          WHEN buffer_size < 24 THEN 'Good'
          ELSE 'Excellent'
        END as buffer_health
      FROM daily_buffer
      ORDER BY date DESC;
    `)

    // Current buffer by platform
    const platformBuffer = await db.query(`
      SELECT 
        source_platform,
        COUNT(*) as ready_to_post,
        MIN(scraped_at) as oldest_content,
        MAX(scraped_at) as newest_content,
        ROUND(EXTRACT(EPOCH FROM (NOW() - MIN(scraped_at))) / 86400, 1) as oldest_content_days
      FROM content_queue
      WHERE is_approved = true 
      AND is_posted = false
      GROUP BY source_platform
      ORDER BY ready_to_post DESC;
    `)

    return NextResponse.json({
      success: true,
      analysis: {
        scanVolume: scanSessions.rows,
        recentScans: recentScans.rows,
        scanTiming: scanTiming.rows,
        scanGaps: scanGaps.rows[0],
        bufferHealth: bufferHealth.rows,
        platformBuffer: platformBuffer.rows
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Scan analysis error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}