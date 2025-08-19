import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { 
  validateRequestMethod,
  createSuccessResponse,
  handleApiError
} from '@/lib/api-middleware';

export async function POST() {
  try {
    validateRequestMethod({ method: 'POST' } as any, ['POST']);
    
    await db.connect();
    
    // Get the next approved content to post
    const contentResult = await db.query(`
      SELECT * FROM content_queue
      WHERE is_approved = ? AND is_posted = ?
      ORDER BY confidence_score DESC, created_at ASC
      LIMIT 1
    `, [1, 0]);
    
    if (!contentResult.rows || contentResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No approved content available to post'
      }, { status: 404 });
    }
    
    const content = contentResult.rows[0];
    
    // Get current time for scheduling
    const now = new Date();
    const timeSlot = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    // Mark content as posted
    await db.query(`
      UPDATE content_queue 
      SET is_posted = ?, posted_at = ? 
      WHERE id = ?
    `, [1, now.toISOString(), content.id]);
    
    // Record in posted_content table
    await db.query(`
      INSERT INTO posted_content (content_queue_id, scheduled_time, posted_at)
      VALUES (?, ?, ?)
    `, [content.id, timeSlot, now.toISOString()]);
    
    // Log the manual post
    await db.query(`
      INSERT INTO system_logs (level, category, action, details, created_at)
      VALUES (?, ?, ?, ?, ?)
    `, [
      'info', 
      'posting', 
      'manual_post', 
      JSON.stringify({
        contentId: content.id,
        contentText: content.content_text?.substring(0, 100),
        platform: content.source_platform,
        timeSlot,
        triggeredAt: now.toISOString()
      }), 
      now.toISOString()
    ]);
    
    return createSuccessResponse({
      contentId: content.id,
      contentText: content.content_text?.substring(0, 100) + (content.content_text && content.content_text.length > 100 ? '...' : ''),
      platform: content.source_platform,
      timeSlot,
      postedAt: now.toISOString()
    }, 'Content posted successfully');
    
  } catch (error) {
    return handleApiError(error, { method: 'POST' } as any, '/api/admin/post/trigger');
  } finally {
    await db.disconnect();
  }
}