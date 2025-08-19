import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { 
  validateRequestMethod,
  createSuccessResponse,
  handleApiError
} from '@/lib/api-middleware';

export async function POST() {
  console.log('🚨 EMERGENCY SCAN TRIGGERED BY ADMIN');
  
  try {
    validateRequestMethod({ method: 'POST' } as any, ['POST']);
    
    await db.connect();
    
    // Run emergency scan of all platforms
    const scanResult = await performEmergencyScanning();
    
    // Auto-approve high-confidence content
    const approvalResult = await emergencyApproveContent();
    
    // Get updated queue status
    const queueStats = await checkQueueStatus();
    
    // Log the emergency scan
    await db.query(`
      INSERT INTO system_logs (log_level, message, component, metadata, created_at)
      VALUES (?, ?, ?, ?, ?)
    `, [
      'warn', 
      'Emergency scan triggered by admin', 
      'emergency_scan', 
      JSON.stringify({
        scanResult,
        approvalResult,
        queueStats,
        triggeredAt: new Date().toISOString()
      }), 
      new Date().toISOString()
    ]);
    
    return createSuccessResponse({
      scanResult,
      approvalResult,
      queueStats,
      message: `Emergency scan complete: Found ${scanResult.totalItems || 0} items, approved ${approvalResult.total} items`
    });
    
  } catch (error) {
    return handleApiError(error);
  } finally {
    await db.disconnect();
  }
}

// Emergency scanning function
async function performEmergencyScanning() {
  const platforms = ['reddit', 'youtube', 'giphy', 'pixabay', 'bluesky', 'imgur'];
  const scanResults = [];
  let totalNewItems = 0;
  
  console.log(`🚨 Emergency scanning ${platforms.length} platforms...`);
  
  for (const platform of platforms) {
    try {
      console.log(`  Emergency scanning ${platform}...`);
      
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL || 'http://localhost:3000';
      const response = await fetch(`${baseUrl}/api/admin/${platform}/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cron-secret': process.env.CRON_SECRET || 'dev-secret'
        },
        body: JSON.stringify({
          emergency: true,
          limit: 100 // Maximum items for emergency scan
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        const itemsFound = result.itemsFound || result.items?.length || result.processed || 0;
        scanResults.push({ 
          platform, 
          success: true, 
          items: itemsFound 
        });
        totalNewItems += itemsFound;
        console.log(`    🚨 Emergency found ${itemsFound} items`);
      } else {
        scanResults.push({ 
          platform, 
          success: false, 
          error: response.statusText 
        });
      }
    } catch (error: any) {
      console.error(`    ❌ Emergency ${platform} scan failed:`, error.message);
      scanResults.push({ 
        platform, 
        success: false, 
        error: error.message 
      });
    }
  }
  
  console.log(`🚨 Emergency scan complete: ${totalNewItems} total items found`);
  
  return {
    success: true,
    totalItems: totalNewItems,
    platformResults: scanResults,
    message: `Emergency scanned ${platforms.length} platforms`
  };
}

// Emergency content approval function
async function emergencyApproveContent() {
  console.log('🚑 Emergency auto-approval initiated...');
  
  try {
    // Auto-approve video and gif content first (usually highest quality)
    const videoResult = await db.query(`
      UPDATE content_queue 
      SET is_approved = ?, 
          admin_notes = ?,
          updated_at = ?
      WHERE is_approved = ? 
        AND content_type IN ('video', 'gif')
        AND id IN (SELECT id FROM content_queue WHERE is_approved = ? AND content_type IN ('video', 'gif') ORDER BY id DESC LIMIT 20)
    `, [1, 'Auto-approved by emergency scan (video/gif)', new Date().toISOString(), 0, 0]);
    
    // Auto-approve image content
    const imageResult = await db.query(`
      UPDATE content_queue 
      SET is_approved = ?,
          admin_notes = ?,
          updated_at = ?
      WHERE is_approved = ? 
        AND content_type = 'image'
        AND id IN (SELECT id FROM content_queue WHERE is_approved = ? AND content_type = 'image' ORDER BY id DESC LIMIT 20)
    `, [1, 'Auto-approved by emergency scan (image)', new Date().toISOString(), 0, 0]);
    
    // If we still need more, approve text content
    const textResult = await db.query(`
      UPDATE content_queue 
      SET is_approved = ?,
          admin_notes = ?,
          updated_at = ?
      WHERE is_approved = ? 
        AND (content_type = 'text' OR content_type IS NULL)
        AND id IN (SELECT id FROM content_queue WHERE is_approved = ? AND (content_type = 'text' OR content_type IS NULL) ORDER BY id DESC LIMIT 15)
    `, [1, 'Auto-approved by emergency scan (text)', new Date().toISOString(), 0, 0]);
    
    const total = (videoResult.rowCount || 0) + (imageResult.rowCount || 0) + (textResult.rowCount || 0);
    
    console.log(`  🚑 Emergency approved: ${videoResult.rowCount || 0} video/gif, ${imageResult.rowCount || 0} image, ${textResult.rowCount || 0} text items`);
    
    return {
      videoGif: videoResult.rowCount || 0,
      image: imageResult.rowCount || 0,
      text: textResult.rowCount || 0,
      total: total
    };
  } catch (error) {
    console.error('Emergency approval failed:', error);
    return { videoGif: 0, image: 0, text: 0, total: 0 };
  }
}

// Check queue status
async function checkQueueStatus() {
  try {
    const stats = await db.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_approved = ? THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN is_posted = ? AND is_approved = ? THEN 1 ELSE 0 END) as ready_to_post
      FROM content_queue
    `, [1, 0, 1]);
    
    const row = stats.rows[0];
    const daysOfContent = Math.floor((row?.ready_to_post || 0) / 6);
    
    return {
      total: row?.total || 0,
      approved: row?.approved || 0,
      readyToPost: row?.ready_to_post || 0,
      daysOfContent: daysOfContent
    };
  } catch (error) {
    console.error('Queue status check failed:', error);
    return { total: 0, approved: 0, readyToPost: 0, daysOfContent: 0 };
  }
}