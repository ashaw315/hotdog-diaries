import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { db } from '@/lib/db';

// This runs once per day at 10 AM UTC
export async function GET(request: NextRequest) {
  console.log('🌅 Starting daily operations at', new Date().toISOString());
  
  // Security: Verify this is from Vercel Cron
  const authHeader = (await headers()).get('authorization');
  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = {
    timestamp: new Date().toISOString(),
    scanning: { success: false, message: '' },
    posting: { success: false, message: '' },
    queueStatus: { total: 0, approved: 0, daysOfContent: 0 }
  };

  try {
    await db.connect();

    // 1. CHECK QUEUE STATUS FIRST
    console.log('📊 Checking queue status...');
    let queueStats = await checkQueueStatus();
    results.queueStatus = queueStats;
    
    // 2. SCAN FOR NEW CONTENT - CRITICAL LOGIC
    // Always scan if we're low on content
    // Only skip if we have MORE than 14 days
    
    if (queueStats.readyToPost === 0) {
      // EMERGENCY: No content at all!
      console.log('🚨 EMERGENCY: No content available! Scanning all platforms immediately...');
      results.scanning = await performDailyScanning();
      
      // After emergency scan, try to auto-approve some content
      const approvalResult = await emergencyApproveContent();
      console.log('🚑 Emergency approval completed:', approvalResult);
      
      // Re-check queue status
      queueStats = await checkQueueStatus();
      results.queueStatus = queueStats;
      
    } else if (queueStats.daysOfContent < 14) {
      // AUTOMATED MAINTENANCE: Auto-approve and scan to maintain 14-day buffer
      console.log('🤖 AUTOMATED: Maintaining', queueStats.daysOfContent, 'days buffer. Auto-approving and scanning...');
      
      // First auto-approve existing content to reach 14-day buffer
      const autoApprovalResult = await progressiveAutoApproval();
      console.log('🔄 Auto-approval completed:', autoApprovalResult);
      
      // Then scan for new content
      results.scanning = await performDailyScanning();
      
      // Re-check queue status after auto-approval and scanning
      const updatedStats = await checkQueueStatus();
      console.log('📊 Updated queue after automation:', updatedStats);
      results.queueStatus = updatedStats;
      
    } else if (queueStats.daysOfContent < 21) {
      // PREVENTIVE: Still scan to build bigger buffer
      console.log('🔄 PREVENTIVE: Scanning to build larger buffer (', queueStats.daysOfContent, 'days available)');
      results.scanning = await performDailyScanning();
      
    } else {
      // SKIP: We have plenty of content
      console.log('✅ Queue sufficient (', queueStats.daysOfContent, 'days). Skipping scan to save API calls.');
      results.scanning = {
        success: true,
        message: `Skipped - ${queueStats.daysOfContent} days of content available`
      };
    }
    
    // 3. POST TODAY'S CONTENT
    console.log('📝 Posting scheduled content...');
    results.posting = await performDailyPosting();
    
    // 4. LOG THE DAILY RUN
    await logDailyRun(results);
    
    console.log('✅ Daily operations completed successfully');
    return NextResponse.json({
      success: true,
      ...results
    });
    
  } catch (error: any) {
    console.error('❌ Daily cron error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      ...results
    }, { status: 500 });
  } finally {
    await db.disconnect();
  }
}

// Check how much content we have
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

// Scan all platforms for new content
async function performDailyScanning() {
  // All 8 platforms for comprehensive scanning
  const platforms = ['reddit', 'youtube', 'giphy', 'pixabay', 'bluesky', 'imgur', 'lemmy', 'tumblr'];
  const scanResults = [];
  let totalNewItems = 0;
  
  console.log(`📡 Starting aggressive scan of ${platforms.length} platforms...`);
  
  for (const platform of platforms) {
    try {
      console.log(`  Scanning ${platform}...`);
      
      // Call the platform-specific scan endpoint with emergency params
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL || 'http://localhost:3000';
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);
      
      const response = await fetch(`${baseUrl}/api/admin/${platform}/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cron-secret': process.env.CRON_SECRET || 'dev-secret'
        },
        body: JSON.stringify({
          emergency: true, // Flag for more aggressive scanning
          limit: 50 // Get more items when queue is low
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const result = await response.json();
        const itemsFound = result.itemsFound || result.items?.length || result.processed || 0;
        scanResults.push({ 
          platform, 
          success: true, 
          items: itemsFound 
        });
        totalNewItems += itemsFound;
        console.log(`    ✅ Found ${itemsFound} items`);
      } else {
        scanResults.push({ 
          platform, 
          success: false, 
          error: response.statusText 
        });
        console.log(`    ❌ Failed: ${response.statusText}`);
      }
    } catch (error: any) {
      console.error(`    ❌ ${platform} scan error:`, error.message);
      scanResults.push({ 
        platform, 
        success: false, 
        error: error.message 
      });
    }
  }
  
  console.log(`📊 Aggressive scan complete: ${totalNewItems} total items found`);
  
  return {
    success: true,
    message: `Scanned ${platforms.length} platforms, found ${totalNewItems} items`,
    details: scanResults,
    totalItems: totalNewItems
  };
}

// Post content for today
async function performDailyPosting() {
  // First check if we have ANY content to post
  const availableContent = await db.query(`
    SELECT COUNT(*) as count 
    FROM content_queue 
    WHERE is_approved = ? AND is_posted = ?
  `, [1, 0]);
  
  if (!availableContent.rows || availableContent.rows[0].count === 0) {
    console.log('  ⚠️ No approved content available to post!');
    console.log('  🔄 Triggering emergency scan and approval...');
    
    // Emergency scan when we have nothing to post
    await performDailyScanning();
    const approvalResult = await emergencyApproveContent();
    console.log('  🚑 Emergency approval result:', approvalResult);
    
    // Try again after emergency scan
    const retryContent = await db.query(`
      SELECT COUNT(*) as count 
      FROM content_queue 
      WHERE is_approved = ? AND is_posted = ?
    `, [1, 0]);
    
    if (!retryContent.rows || retryContent.rows[0].count === 0) {
      return {
        success: false,
        message: 'No content available even after emergency scan',
        details: { 
          published: 0, 
          scheduled: 0,
          emergencyScan: true,
          criticalError: true
        }
      };
    }
    
    console.log('  ✅ Emergency scan successful, now have content to post');
  }
  
  // Continue with normal posting logic...
  const postingTimes = ['07:00', '10:00', '13:00', '16:00', '19:00', '22:00'];
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinutes = now.getMinutes();
  
  let postsPublished = 0;
  let postsScheduled = 0;
  
  for (const scheduleTime of postingTimes) {
    const [scheduledHour, scheduledMinute] = scheduleTime.split(':').map(Number);
    
    // Check if this posting time has passed today
    if (scheduledHour < currentHour || (scheduledHour === currentHour && scheduledMinute <= currentMinutes)) {
      // Time has passed, check if we already posted
      const alreadyPosted = await checkIfAlreadyPosted(scheduleTime);
      
      if (!alreadyPosted) {
        // Post now!
        const posted = await publishContent(scheduleTime);
        if (posted) {
          postsPublished++;
          console.log(`  ✅ Published content for ${scheduleTime}`);
        }
      }
    } else {
      // Schedule for later today (this would need a separate mechanism to actually post)
      await scheduleForLater(scheduleTime);
      postsScheduled++;
      console.log(`  ⏰ Scheduled for ${scheduleTime}`);
    }
  }
  
  return {
    success: true,
    message: `Published ${postsPublished} posts, scheduled ${postsScheduled} for later`,
    details: {
      published: postsPublished,
      scheduled: postsScheduled,
      currentTime: `${currentHour.toString().padStart(2, '0')}:${currentMinutes.toString().padStart(2, '0')}`
    }
  };
}

// Check if we already posted at this time today
async function checkIfAlreadyPosted(timeSlot: string): Promise<boolean> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const result = await db.query(`
      SELECT COUNT(*) as count
      FROM posted_content
      WHERE DATE(posted_at) = ?
      AND TIME(posted_at) BETWEEN TIME(?) AND TIME(?, '+30 minutes')
    `, [today, timeSlot, timeSlot]);
    
    return (result.rows[0]?.count || 0) > 0;
  } catch (error) {
    console.error('Check already posted failed:', error);
    return false;
  }
}

// Publish content immediately
async function publishContent(timeSlot: string): Promise<boolean> {
  try {
    // Get BEST unposted approved content (fixed ordering)
    const result = await db.query(`
      SELECT * FROM content_queue
      WHERE is_approved = ? AND is_posted = ?
      ORDER BY confidence_score DESC, created_at ASC
      LIMIT 1
    `, [1, 0]);
    
    if (!result.rows || result.rows.length === 0) {
      console.log('  ⚠️ No approved content available to post');
      return false;
    }
    
    const content = result.rows[0];
    
    // CRITICAL FIX: Check if already posted (duplicate prevention)
    const existingPost = await db.query(`
      SELECT id FROM posted_content WHERE content_queue_id = ?
    `, [content.id]);
    
    if (existingPost.rows && existingPost.rows.length > 0) {
      console.log(`  🚫 Content ${content.id} already posted! Skipping and marking as posted.`);
      // Mark as posted in content_queue to prevent future selection
      await db.query(`
        UPDATE content_queue 
        SET is_posted = ?, posted_at = ? 
        WHERE id = ?
      `, [1, new Date().toISOString(), content.id]);
      return false;
    }
    
    const now = new Date().toISOString();
    
    // Mark as posted in content_queue FIRST
    await db.query(`
      UPDATE content_queue 
      SET is_posted = ?, posted_at = ? 
      WHERE id = ?
    `, [1, now, content.id]);
    
    // Record in posted_content table
    await db.query(`
      INSERT INTO posted_content (content_queue_id, scheduled_time, posted_at, post_order)
      VALUES (?, ?, ?, ?)
    `, [content.id, timeSlot, now, Math.floor(Date.now() / 1000)]);
    
    console.log(`  ✅ Posted content ${content.id}: ${content.content_text?.substring(0, 50)}...`);
    return true;
  } catch (error) {
    console.error('Publishing failed:', error);
    return false;
  }
}

// Schedule content for later (store in database)
async function scheduleForLater(timeSlot: string): Promise<void> {
  try {
    // This stores the schedule in the database
    // Note: Vercel Hobby only allows 1 cron, so scheduled posts would need
    // to be handled by the next daily run or manual intervention
    
    await db.query(`
      INSERT OR IGNORE INTO system_logs (level, category, action, details, created_at)
      VALUES (?, ?, ?, ?, ?)
    `, ['info', 'schedule', 'content_scheduled', JSON.stringify({ timeSlot, date: new Date().toISOString().split('T')[0] }), new Date().toISOString()]);
  } catch (error) {
    console.error('Scheduling failed:', error);
  }
}

// Progressive auto-approval based on content age and quality
async function progressiveAutoApproval() {
  console.log('🤖 Progressive auto-approval initiated...');
  
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const threeDaysAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000);
  
  let totalApproved = 0;
  const results = { immediate: 0, aged24h: 0, aged48h: 0, aged72h: 0, balanced: 0 };
  
  try {
    // 1. Immediately approve high-quality content (confidence >= 0.8)
    const immediateResult = await db.query(`
      UPDATE content_queue 
      SET is_approved = ?, 
          admin_notes = ?,
          updated_at = ?
      WHERE is_approved = ? 
        AND is_posted = ?
        AND confidence_score >= ?
    `, [1, 'Auto-approved - high quality (≥0.8)', now.toISOString(), 0, 0, 0.8]);
    
    results.immediate = immediateResult.rowCount || 0;
    totalApproved += results.immediate;
    console.log(`  ✅ Approved ${results.immediate} high-quality items immediately`);
    
    // 2. Approve medium-quality content after 24 hours (confidence >= 0.6)
    const aged24Result = await db.query(`
      UPDATE content_queue 
      SET is_approved = ?, 
          admin_notes = ?,
          updated_at = ?
      WHERE is_approved = ? 
        AND is_posted = ?
        AND confidence_score >= ?
        AND created_at <= ?
    `, [1, 'Auto-approved - aged 24h + medium quality (≥0.6)', now.toISOString(), 0, 0, 0.6, oneDayAgo.toISOString()]);
    
    results.aged24h = aged24Result.rowCount || 0;
    totalApproved += results.aged24h;
    console.log(`  ✅ Approved ${results.aged24h} medium-quality items aged 24+ hours`);
    
    // 3. Approve decent content after 48 hours (confidence >= 0.5)
    const aged48Result = await db.query(`
      UPDATE content_queue 
      SET is_approved = ?, 
          admin_notes = ?,
          updated_at = ?
      WHERE is_approved = ? 
        AND is_posted = ?
        AND confidence_score >= ?
        AND created_at <= ?
    `, [1, 'Auto-approved - aged 48h + decent quality (≥0.5)', now.toISOString(), 0, 0, 0.5, twoDaysAgo.toISOString()]);
    
    results.aged48h = aged48Result.rowCount || 0;
    totalApproved += results.aged48h;
    console.log(`  ✅ Approved ${results.aged48h} decent items aged 48+ hours`);
    
    // 4. Approve any non-spam content after 72 hours (confidence >= 0.4)
    const aged72Result = await db.query(`
      UPDATE content_queue 
      SET is_approved = ?, 
          admin_notes = ?,
          updated_at = ?
      WHERE is_approved = ? 
        AND is_posted = ?
        AND confidence_score >= ?
        AND created_at <= ?
    `, [1, 'Auto-approved - aged 72h + non-spam (≥0.4)', now.toISOString(), 0, 0, 0.4, threeDaysAgo.toISOString()]);
    
    results.aged72h = aged72Result.rowCount || 0;
    totalApproved += results.aged72h;
    console.log(`  ✅ Approved ${results.aged72h} non-spam items aged 72+ hours`);
    
    // 5. Platform-balanced approval to ensure no single platform dominates
    const platformBalanceResult = await balancedPlatformApproval();
    results.balanced = platformBalanceResult;
    totalApproved += results.balanced;
    console.log(`  ✅ Approved ${results.balanced} items for platform balance`);
    
    console.log(`🎉 Progressive approval complete: ${totalApproved} total items approved`);
    
    return {
      ...results,
      total: totalApproved
    };
    
  } catch (error) {
    console.error('Progressive approval failed:', error);
    return { immediate: 0, aged24h: 0, aged48h: 0, aged72h: 0, balanced: 0, total: 0 };
  }
}

// Balanced platform approval to maintain diversity
async function balancedPlatformApproval() {
  console.log('⚖️ Running balanced platform approval...');
  
  const platforms = ['youtube', 'reddit', 'giphy', 'imgur', 'bluesky', 'pixabay', 'lemmy', 'tumblr'];
  let totalApproved = 0;
  
  for (const platform of platforms) {
    try {
      // Approve up to 15 items per platform with reasonable confidence
      const result = await db.query(`
        UPDATE content_queue 
        SET is_approved = ?, 
            admin_notes = ?,
            updated_at = ?
        WHERE is_approved = ? 
          AND is_posted = ?
          AND source_platform = ?
          AND confidence_score >= ?
          AND id IN (
            SELECT id FROM content_queue 
            WHERE is_approved = ? 
              AND is_posted = ?
              AND source_platform = ? 
              AND confidence_score >= ?
            ORDER BY confidence_score DESC 
            LIMIT 15
          )
      `, [1, `Auto-approved for platform balance (${platform})`, new Date().toISOString(), 0, 0, platform, 0.5, 0, 0, platform, 0.5]);
      
      const approved = result.rowCount || 0;
      totalApproved += approved;
      console.log(`    ✅ ${platform}: approved ${approved} items`);
    } catch (error) {
      console.error(`    ❌ ${platform}: approval failed`, error);
    }
  }
  
  return totalApproved;
}

// Emergency approve content when queue is empty (fallback)
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
        AND id IN (SELECT id FROM content_queue WHERE is_approved = ? AND content_type IN ('video', 'gif') ORDER BY id DESC LIMIT 15)
    `, [1, 'Auto-approved by emergency scan (video/gif)', new Date().toISOString(), 0, 0]);
    
    console.log(`  ✅ Emergency approved ${videoResult.rowCount || 0} video/gif items`);
    
    // Auto-approve image content
    const imageResult = await db.query(`
      UPDATE content_queue 
      SET is_approved = ?,
          admin_notes = ?,
          updated_at = ?
      WHERE is_approved = ? 
        AND content_type = 'image'
        AND id IN (SELECT id FROM content_queue WHERE is_approved = ? AND content_type = 'image' ORDER BY id DESC LIMIT 15)
    `, [1, 'Auto-approved by emergency scan (image)', new Date().toISOString(), 0, 0]);
    
    console.log(`  ✅ Emergency approved ${imageResult.rowCount || 0} image items`);
    
    // If we still need more, approve text content
    const textResult = await db.query(`
      UPDATE content_queue 
      SET is_approved = ?,
          admin_notes = ?,
          updated_at = ?
      WHERE is_approved = ? 
        AND (content_type = 'text' OR content_type IS NULL)
        AND id IN (SELECT id FROM content_queue WHERE is_approved = ? AND (content_type = 'text' OR content_type IS NULL) ORDER BY id DESC LIMIT 10)
    `, [1, 'Auto-approved by emergency scan (text)', new Date().toISOString(), 0, 0]);
    
    console.log(`  ✅ Emergency approved ${textResult.rowCount || 0} text items`);
    
    const total = (videoResult.rowCount || 0) + (imageResult.rowCount || 0) + (textResult.rowCount || 0);
    
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

// Log the daily run for monitoring
async function logDailyRun(results: any): Promise<void> {
  try {
    await db.query(`
      INSERT INTO system_logs (level, category, action, details, created_at)
      VALUES (?, ?, ?, ?, ?)
    `, ['info', 'cron', 'daily_run', JSON.stringify(results), new Date().toISOString()]);
  } catch (error) {
    console.error('Logging failed:', error);
  }
}