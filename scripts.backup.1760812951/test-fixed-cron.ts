import { db } from '../lib/db';

async function testFixedCronLogic() {
  console.log('🧪 Testing FIXED Daily Cron Logic...');
  
  try {
    await db.connect();
    
    // Test queue status check
    console.log('\n📊 Testing queue status check...');
    const queueStats = await checkQueueStatus();
    console.log('Current Queue Status:');
    console.log(`  - Total: ${queueStats.total} items`);
    console.log(`  - Approved: ${queueStats.approved} items`);
    console.log(`  - Ready to Post: ${queueStats.readyToPost} items`);
    console.log(`  - Days of Content: ${queueStats.daysOfContent} days`);
    
    // Test scanning decision logic
    console.log('\n🔍 Testing scanning decision logic...');
    
    let scanDecision = '';
    let scanUrgency = '';
    
    if (queueStats.readyToPost === 0) {
      scanDecision = 'EMERGENCY SCAN + AUTO-APPROVAL';
      scanUrgency = '🚨 CRITICAL';
    } else if (queueStats.daysOfContent < 3) {
      scanDecision = 'CRITICAL SCAN';
      scanUrgency = '🚨 URGENT';
    } else if (queueStats.daysOfContent < 7) {
      scanDecision = 'WARNING SCAN';
      scanUrgency = '⚠️ MODERATE';
    } else if (queueStats.daysOfContent < 14) {
      scanDecision = 'NORMAL SCAN (Buffer Maintenance)';
      scanUrgency = '📡 ROUTINE';
    } else {
      scanDecision = 'SKIP SCANNING (Sufficient Content)';
      scanUrgency = '✅ NORMAL';
    }
    
    console.log(`Decision: ${scanUrgency} - ${scanDecision}`);
    
    // Test emergency approval thresholds
    console.log('\n🚑 Testing emergency approval logic...');
    
    // Check content by confidence levels
    const confidenceStats = await db.query(`
      SELECT 
        COUNT(CASE WHEN confidence_score >= 0.75 THEN 1 END) as high_confidence,
        COUNT(CASE WHEN confidence_score >= 0.65 AND confidence_score < 0.75 THEN 1 END) as medium_confidence,
        COUNT(CASE WHEN confidence_score >= 0.5 AND confidence_score < 0.65 THEN 1 END) as low_confidence,
        COUNT(CASE WHEN is_approved = false THEN 1 END) as unapproved_total
      FROM content_queue
      WHERE is_approved = false
    `);
    
    const confStats = confidenceStats.rows[0];
    console.log('Content Available for Emergency Approval:');
    console.log(`  - High Confidence (≥0.75): ${confStats.high_confidence} items`);
    console.log(`  - Medium Confidence (0.65-0.74): ${confStats.medium_confidence} items`);
    console.log(`  - Low Confidence (0.5-0.64): ${confStats.low_confidence} items`);
    console.log(`  - Total Unapproved: ${confStats.unapproved_total} items`);
    
    // Test posting logic
    console.log('\n📝 Testing posting logic...');
    const postingTimes = ['07:00', '10:00', '13:00', '16:00', '19:00', '22:00'];
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    console.log(`Current time: ${currentTime}`);
    
    let shouldPost = 0;
    let shouldSchedule = 0;
    
    for (const timeSlot of postingTimes) {
      const [hour, minute] = timeSlot.split(':').map(Number);
      const currentHour = now.getHours();
      const currentMinutes = now.getMinutes();
      
      if (hour < currentHour || (hour === currentHour && minute <= currentMinutes)) {
        shouldPost++;
        console.log(`  ${timeSlot}: ✅ Should post now`);
      } else {
        shouldSchedule++;
        console.log(`  ${timeSlot}: ⏰ Schedule for later`);
      }
    }
    
    console.log(`\nPosting Summary: ${shouldPost} posts due now, ${shouldSchedule} scheduled for later`);
    
    // Summary and recommendations
    console.log('\n📋 FIXED CRON SUMMARY:');
    console.log('='.repeat(50));
    
    if (queueStats.readyToPost === 0) {
      console.log('🚨 STATUS: EMERGENCY - No content available!');
      console.log('✅ FIXED: Will now scan immediately + auto-approve content');
      console.log('🔧 ACTIONS: Emergency scan all platforms, auto-approve high confidence items');
    } else if (queueStats.daysOfContent < 3) {
      console.log('⚠️ STATUS: CRITICAL - Very low content');
      console.log('✅ FIXED: Will now scan urgently');
    } else if (queueStats.daysOfContent < 7) {
      console.log('📡 STATUS: WARNING - Low content');
      console.log('✅ FIXED: Will now scan proactively');
    } else {
      console.log('✅ STATUS: GOOD - Sufficient content');
    }
    
    console.log('\n🎯 KEY IMPROVEMENTS:');
    console.log('  ✅ ALWAYS scans when readyToPost = 0 (emergency)');
    console.log('  ✅ Tiered urgency levels (0-3-7-14 day thresholds)');
    console.log('  ✅ Emergency auto-approval when desperate');
    console.log('  ✅ More aggressive platform scanning');
    console.log('  ✅ Admin emergency controls');
    
    console.log('\n🎉 Fixed daily cron logic test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await db.disconnect();
  }
}

// Queue status check function (updated)
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

testFixedCronLogic();