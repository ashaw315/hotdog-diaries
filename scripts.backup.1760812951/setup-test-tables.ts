#!/usr/bin/env node

import { db } from '../lib/db'
import { loadEnv } from '../lib/env'

// Ensure environment variables are loaded
loadEnv()

async function setupTestTables() {
  console.log('🛠️  SETTING UP REQUIRED TEST TABLES')
  console.log('==================================\n')
  
  try {
    await db.connect()
    
    // 1. Create posting_schedule table
    console.log('📅 Creating posting_schedule table...')
    await db.query(`
      CREATE TABLE IF NOT EXISTS posting_schedule (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        is_enabled BOOLEAN DEFAULT 1,
        posting_times TEXT DEFAULT '["08:00", "12:00", "15:00", "18:00", "21:00", "23:30"]',
        timezone VARCHAR(50) DEFAULT 'America/New_York',
        posts_per_day INTEGER DEFAULT 6,
        created_at DATETIME DEFAULT CURRENT_DATETIME,
        updated_at DATETIME DEFAULT CURRENT_DATETIME
      )
    `)
    
    // Insert default schedule
    await db.query(`
      INSERT OR IGNORE INTO posting_schedule (id, is_enabled, posting_times, timezone, posts_per_day)
      VALUES (1, 1, '["08:00", "12:00", "15:00", "18:00", "21:00", "23:30"]', 'America/New_York', 6)
    `)
    
    // 2. Ensure posted_content table has correct structure
    console.log('📊 Updating posted_content table...')
    await db.query(`
      CREATE TABLE IF NOT EXISTS posted_content (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content_queue_id INTEGER NOT NULL,
        posted_at DATETIME DEFAULT CURRENT_DATETIME,
        platform_posted_to VARCHAR(50) DEFAULT 'website',
        post_status VARCHAR(20) DEFAULT 'published',
        external_post_id VARCHAR(255),
        engagement_metrics TEXT,
        created_at DATETIME DEFAULT CURRENT_DATETIME,
        updated_at DATETIME DEFAULT CURRENT_DATETIME,
        FOREIGN KEY (content_queue_id) REFERENCES content_queue(id)
      )
    `)
    
    // 3. Create youtube_scan_config table if not exists
    console.log('🎬 Creating youtube_scan_config table...')
    await db.query(`
      CREATE TABLE IF NOT EXISTS youtube_scan_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        is_enabled BOOLEAN DEFAULT 1,
        scan_interval INTEGER DEFAULT 240,
        max_videos_per_scan INTEGER DEFAULT 20,
        search_terms TEXT DEFAULT '["hotdog", "hot dog", "bratwurst", "sausage"]',
        video_duration VARCHAR(20) DEFAULT 'any',
        published_within INTEGER DEFAULT 30,
        min_view_count INTEGER DEFAULT 1000,
        include_channel_ids TEXT DEFAULT '[]',
        exclude_channel_ids TEXT DEFAULT '[]',
        last_scan_time DATETIME,
        last_scan_id VARCHAR(255),
        created_at DATETIME DEFAULT CURRENT_DATETIME,
        updated_at DATETIME DEFAULT CURRENT_DATETIME
      )
    `)
    
    // 4. Create giphy_scan_config table if not exists
    console.log('🎞️ Creating giphy_scan_config table...')
    await db.query(`
      CREATE TABLE IF NOT EXISTS giphy_scan_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        is_enabled BOOLEAN DEFAULT 1,
        scan_interval INTEGER DEFAULT 180,
        max_gifs_per_scan INTEGER DEFAULT 30,
        search_terms TEXT DEFAULT '["hotdog", "hot dog", "sausage", "corn dog"]',
        hourly_request_count INTEGER DEFAULT 0,
        daily_request_count INTEGER DEFAULT 0,
        last_request_reset DATETIME DEFAULT CURRENT_DATETIME,
        created_at DATETIME DEFAULT CURRENT_DATETIME,
        updated_at DATETIME DEFAULT CURRENT_DATETIME
      )
    `)
    
    // 5. Ensure scan_config table has proper structure
    console.log('⚙️ Updating scan_config table...')
    await db.query(`
      CREATE TABLE IF NOT EXISTS scan_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        enabled_platforms TEXT DEFAULT '["youtube", "giphy", "reddit", "bluesky", "lemmy", "imgur", "tumblr"]',
        scan_frequency_hours INTEGER DEFAULT 4,
        max_posts_per_scan INTEGER DEFAULT 50,
        is_enabled BOOLEAN DEFAULT 1,
        last_scan_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_DATETIME,
        updated_at DATETIME DEFAULT CURRENT_DATETIME
      )
    `)
    
    // Insert default scan config if none exists
    const existingConfig = await db.query('SELECT id FROM scan_config LIMIT 1')
    if (existingConfig.rows.length === 0) {
      await db.query(`
        INSERT INTO scan_config (enabled_platforms, scan_frequency_hours, max_posts_per_scan, is_enabled)
        VALUES ('["youtube", "giphy", "reddit", "bluesky", "lemmy", "imgur", "tumblr"]', 4, 50, 1)
      `)
    }
    
    // 6. Add some test posted content for today if none exists
    console.log('📝 Adding test posted content...')
    const todayPosts = await db.query(`
      SELECT COUNT(*) as count FROM posted_content 
      WHERE date(posted_at) = date('now')
    `)
    
    if (todayPosts.rows[0]?.count === 0) {
      // Add a few test posts for today
      const testContentIds = await db.query(`
        SELECT id FROM content_queue 
        WHERE is_approved = true 
        LIMIT 3
      `)
      
      for (let i = 0; i < testContentIds.rows.length; i++) {
        const content = testContentIds.rows[i]
        await db.query(`
          INSERT INTO posted_content (content_queue_id, posted_at, post_order)
          VALUES (?, datetime('now', '-' || ? || ' hours'), ?)
        `, [content.id, (i + 1) * 2, i + 1])
      }
    }
    
    // 7. Add some system logs for cron job simulation
    console.log('📊 Adding system logs...')
    await db.query(`
      INSERT OR IGNORE INTO system_logs (component, log_level, message, created_at)
      VALUES 
        ('PostingCron', 'INFO', 'Automated posting executed successfully', datetime('now', '-2 hours')),
        ('ScanningCron', 'INFO', 'Content scanning completed', datetime('now', '-4 hours')),
        ('PostingCron', 'INFO', 'Posted daily content batch', datetime('now', '-6 hours'))
    `)
    
    console.log('\n✅ All required tables created and populated!')
    console.log('📊 Database is ready for testing')
    
  } catch (error) {
    console.error('❌ Failed to setup test tables:', error)
  } finally {
    await db.disconnect()
  }
}

// Run the setup
setupTestTables().catch(console.error)