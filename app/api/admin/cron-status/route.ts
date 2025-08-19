import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { 
  validateRequestMethod,
  createSuccessResponse,
  handleApiError
} from '@/lib/api-middleware';

export async function GET() {
  try {
    validateRequestMethod({ method: 'GET' } as any, ['GET']);
    
    await db.connect();
    
    // Get last cron run from system logs
    const lastRunResult = await db.query(`
      SELECT * FROM system_logs 
      WHERE category = ? AND action = ?
      ORDER BY created_at DESC 
      LIMIT 1
    `, ['cron', 'daily_run']);
    
    let lastRun = null;
    if (lastRunResult.rows && lastRunResult.rows.length > 0) {
      const logEntry = lastRunResult.rows[0];
      try {
        lastRun = JSON.parse(logEntry.details);
      } catch (parseError) {
        console.error('Failed to parse log details:', parseError);
        lastRun = {
          timestamp: logEntry.created_at,
          success: false,
          message: 'Failed to parse log details'
        };
      }
    }
    
    // Get current queue status
    const queueResult = await db.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_approved = ? AND is_posted = ? THEN 1 ELSE 0 END) as ready_to_post,
        SUM(CASE WHEN is_approved = ? THEN 1 ELSE 0 END) as approved
      FROM content_queue
    `, [1, 0, 1]);
    
    const queueRow = queueResult.rows[0];
    const daysOfContent = Math.floor((queueRow?.ready_to_post || 0) / 6);
    
    const queueStatus = {
      total: queueRow?.total || 0,
      readyToPost: queueRow?.ready_to_post || 0,
      approved: queueRow?.approved || 0,
      daysOfContent
    };
    
    // Calculate next run time (10:00 AM UTC next day)
    const nextRun = getNextRunTime();
    
    return createSuccessResponse({
      lastRun,
      queueStatus,
      nextRun,
      cronEnabled: !!process.env.CRON_SECRET
    });
    
  } catch (error) {
    return handleApiError(error);
  } finally {
    await db.disconnect();
  }
}

function getNextRunTime(): string {
  const now = new Date();
  const next = new Date();
  
  // Set to 10:00 AM UTC
  next.setUTCHours(10, 0, 0, 0);
  
  // If it's already past 10 AM UTC today, schedule for tomorrow
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  
  return next.toISOString();
}