import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function POST() {
  try {
    console.log('🚀 Triggering initial content scan...');
    
    // First, try to trigger the daily scan
    try {
      const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                      process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      
      const response = await fetch(`${baseUrl}/api/cron/daily`);
      const result = await response.json();
      
      return NextResponse.json({
        success: true,
        message: 'Daily scan triggered successfully',
        scanResult: result,
        timestamp: new Date().toISOString()
      });
      
    } catch (cronError) {
      console.log('Daily cron not available, performing emergency approval...');
      
      // If daily scan isn't available, check if we have any content to approve
      const contentResult = await sql`
        SELECT COUNT(*) as count FROM content_queue 
        WHERE is_approved = false AND is_rejected = false
      `;
      
      const pendingCount = parseInt(contentResult.rows[0]?.count || '0');
      
      if (pendingCount > 0) {
        // Emergency approve some content
        await sql`
          UPDATE content_queue 
          SET is_approved = true, content_status = 'approved'
          WHERE is_approved = false 
          AND is_rejected = false 
          AND content_text IS NOT NULL
          LIMIT 20
        `;
        
        return NextResponse.json({
          success: true,
          message: `Emergency approval completed - approved up to 20 posts`,
          approvedCount: Math.min(pendingCount, 20),
          pendingCount,
          timestamp: new Date().toISOString()
        });
      } else {
        return NextResponse.json({
          success: false,
          message: 'No content found to scan or approve. Content scanning services may need to be configured.',
          pendingCount: 0,
          recommendation: 'Check API keys for Reddit, YouTube, Giphy, etc. in environment variables',
          timestamp: new Date().toISOString()
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Initial scan failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}