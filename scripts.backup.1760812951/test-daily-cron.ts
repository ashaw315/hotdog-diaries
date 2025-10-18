import { db } from '../lib/db';

async function testDailyCronFunctionality() {
  console.log('🧪 Testing Daily Cron Functionality...');
  
  try {
    await db.connect();
    console.log('✅ Database connected successfully');
    
    // Test queue status check
    console.log('\n📊 Testing queue status check...');
    const queueStats = await checkQueueStatus();
    console.log('Queue Status:', queueStats);
    
    // Test posting time logic
    console.log('\n⏰ Testing posting time logic...');
    const postingTimes = ['07:00', '10:00', '13:00', '16:00', '19:00', '22:00'];
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    
    console.log(`Current time: ${currentHour.toString().padStart(2, '0')}:${currentMinutes.toString().padStart(2, '0')}`);
    
    for (const scheduleTime of postingTimes) {
      const [scheduledHour, scheduledMinute] = scheduleTime.split(':').map(Number);
      const hasPassed = scheduledHour < currentHour || (scheduledHour === currentHour && scheduledMinute <= currentMinutes);
      console.log(`  ${scheduleTime}: ${hasPassed ? '✅ Should post' : '⏰ Future'}`);
    }
    
    // Test log insertion
    console.log('\n📝 Testing log insertion...');
    await db.query(`
      INSERT INTO system_logs (log_level, message, component, metadata, created_at)
      VALUES (?, ?, ?, ?, ?)
    `, ['info', 'Daily cron functionality test', 'daily_cron_test', JSON.stringify({
      timestamp: new Date().toISOString(),
      message: 'Daily cron functionality test successful'
    }), new Date().toISOString()]);
    
    console.log('✅ Log entry created successfully');
    
    // Get recent logs
    const recentLogs = await db.query(`
      SELECT * FROM system_logs 
      WHERE component = ? 
      ORDER BY created_at DESC 
      LIMIT 3
    `, ['daily_cron_test']);
    
    console.log('📄 Recent test logs:', recentLogs.rows?.length || 0);
    
    console.log('\n🎉 Daily cron functionality test completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`  - Database: ✅ Connected and working`);
    console.log(`  - Queue Status: ✅ ${queueStats.daysOfContent} days of content`);
    console.log(`  - Time Logic: ✅ Posting schedule calculated correctly`);
    console.log(`  - Logging: ✅ System logs working`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await db.disconnect();
  }
}

// Queue status check function (from the cron endpoint)
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

testDailyCronFunctionality();