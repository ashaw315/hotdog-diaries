#!/usr/bin/env npx tsx

import { db } from '@/lib/db'

async function initializeSqliteDatabase() {
  console.log('🔧 Initializing SQLite database...')
  
  try {
    await db.connect()
    console.log('✅ Database connection established')

    // Create content_queue table
    await db.query(`
      CREATE TABLE IF NOT EXISTS content_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content_text TEXT,
        content_image_url TEXT,
        content_video_url TEXT,
        content_type VARCHAR(50) DEFAULT 'image',
        source_platform VARCHAR(50) NOT NULL,
        original_url TEXT NOT NULL,
        original_author VARCHAR(255),
        original_score INTEGER DEFAULT 0,
        scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_approved BOOLEAN DEFAULT NULL,
        is_posted BOOLEAN DEFAULT FALSE,
        posted_at DATETIME,
        content_hash VARCHAR(64) UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        admin_notes TEXT,
        content_status VARCHAR(20) DEFAULT 'discovered',
        reviewed_at DATETIME,
        reviewed_by VARCHAR(255),
        rejection_reason TEXT,
        scheduled_for DATETIME,
        edit_history TEXT DEFAULT '[]'
      )
    `)
    console.log('✅ content_queue table created')

    // Create content_analysis table
    await db.query(`
      CREATE TABLE IF NOT EXISTS content_analysis (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content_queue_id INTEGER NOT NULL,
        is_spam BOOLEAN DEFAULT FALSE,
        is_inappropriate BOOLEAN DEFAULT FALSE,
        is_unrelated BOOLEAN DEFAULT FALSE,
        is_valid_hotdog BOOLEAN DEFAULT FALSE,
        confidence_score REAL DEFAULT 0.0,
        flagged_patterns TEXT,
        processing_notes TEXT,
        similarity_hash VARCHAR(64),
        duplicate_of INTEGER,
        filter_results TEXT,
        is_flagged BOOLEAN DEFAULT FALSE,
        flagged_reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (content_queue_id) REFERENCES content_queue(id) ON DELETE CASCADE,
        UNIQUE(content_queue_id)
      )
    `)
    console.log('✅ content_analysis table created')

    // Create system_logs table
    await db.query(`
      CREATE TABLE IF NOT EXISTS system_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        log_level VARCHAR(20) NOT NULL,
        message TEXT NOT NULL,
        component VARCHAR(100) NOT NULL,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✅ system_logs table created')

    // Create system_metrics table
    await db.query(`
      CREATE TABLE IF NOT EXISTS system_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        metric_name VARCHAR(100) NOT NULL,
        metric_value REAL NOT NULL,
        metric_type VARCHAR(50) NOT NULL,
        tags TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✅ system_metrics table created')

    // Create platform_scanning_logs table
    await db.query(`
      CREATE TABLE IF NOT EXISTS platform_scanning_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        platform VARCHAR(50) NOT NULL,
        scan_status VARCHAR(20) NOT NULL,
        content_found INTEGER DEFAULT 0,
        content_approved INTEGER DEFAULT 0,
        content_rejected INTEGER DEFAULT 0,
        scan_duration_ms INTEGER,
        error_message TEXT,
        scan_config TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✅ platform_scanning_logs table created')

    // Create indexes for performance
    await db.query(`CREATE INDEX IF NOT EXISTS idx_content_queue_platform ON content_queue(source_platform)`)
    await db.query(`CREATE INDEX IF NOT EXISTS idx_content_queue_approved ON content_queue(is_approved)`)
    await db.query(`CREATE INDEX IF NOT EXISTS idx_content_queue_posted ON content_queue(is_posted)`)
    await db.query(`CREATE INDEX IF NOT EXISTS idx_content_queue_status ON content_queue(content_status)`)
    await db.query(`CREATE INDEX IF NOT EXISTS idx_content_queue_created ON content_queue(created_at)`)
    await db.query(`CREATE INDEX IF NOT EXISTS idx_content_queue_hash ON content_queue(content_hash)`)
    
    await db.query(`CREATE INDEX IF NOT EXISTS idx_content_analysis_content_id ON content_analysis(content_queue_id)`)
    await db.query(`CREATE INDEX IF NOT EXISTS idx_content_analysis_valid_hotdog ON content_analysis(is_valid_hotdog)`)
    
    await db.query(`CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(log_level)`)
    await db.query(`CREATE INDEX IF NOT EXISTS idx_system_logs_component ON system_logs(component)`)
    await db.query(`CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs(created_at)`)
    
    await db.query(`CREATE INDEX IF NOT EXISTS idx_system_metrics_name ON system_metrics(metric_name)`)
    await db.query(`CREATE INDEX IF NOT EXISTS idx_system_metrics_created ON system_metrics(created_at)`)
    
    await db.query(`CREATE INDEX IF NOT EXISTS idx_platform_logs_platform ON platform_scanning_logs(platform)`)
    await db.query(`CREATE INDEX IF NOT EXISTS idx_platform_logs_status ON platform_scanning_logs(scan_status)`)
    await db.query(`CREATE INDEX IF NOT EXISTS idx_platform_logs_created ON platform_scanning_logs(created_at)`)
    
    console.log('✅ Database indexes created')

    // Test the database with a simple insert and query
    const testResult = await db.query(`
      INSERT INTO system_logs (log_level, message, component) 
      VALUES (?, ?, ?)
    `, ['info', 'SQLite database initialized successfully', 'init-script'])
    
    console.log('✅ Test insert successful')

    const logCount = await db.query('SELECT COUNT(*) as count FROM system_logs')
    console.log(`✅ Database test query successful - ${logCount.rows[0].count} log entries`)

    console.log('🎉 SQLite database initialization complete!')
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error)
    throw error
  } finally {
    await db.disconnect()
  }
}

// Run if called directly
if (require.main === module) {
  initializeSqliteDatabase().catch(console.error)
}

export { initializeSqliteDatabase }