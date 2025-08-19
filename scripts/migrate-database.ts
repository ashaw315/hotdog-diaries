import { db } from '../lib/db';
import bcryptjs from 'bcryptjs';

async function migrateDatabaseTables() {
  console.log('🚀 Starting database migration...');
  
  try {
    // Connect to database
    await db.connect();
    
    // Detect database type
    const isPostgres = process.env.NODE_ENV === 'production' || !!process.env.POSTGRES_URL;
    console.log(`📦 Database type: ${isPostgres ? 'PostgreSQL' : 'SQLite'}`);
    
    // Define migrations based on database type
    const migrations = isPostgres ? getPostgresMigrations() : getSQLiteMigrations();
    
    // Run each migration
    for (const migration of migrations) {
      const tableName = migration.match(/(?:CREATE TABLE IF NOT EXISTS|CREATE INDEX IF NOT EXISTS idx_)[\s]+(\w+)/)?.[1] || 'operation';
      console.log(`  Running migration for: ${tableName}`);
      
      try {
        await db.query(migration);
        console.log(`  ✅ ${tableName} completed`);
      } catch (error: any) {
        if (error.message?.includes('already exists') || error.code === 'SQLITE_ERROR') {
          console.log(`  ⏭️  ${tableName} already exists, skipping`);
        } else {
          console.error(`  ❌ ${tableName} failed:`, error.message);
          throw error;
        }
      }
    }
    
    // Insert default admin user if not exists
    console.log('\n👤 Checking admin user...');
    const adminCheck = await db.query('SELECT id FROM admin_users WHERE username = ?', ['admin']);
    
    if (!adminCheck.rows || adminCheck.rows.length === 0) {
      const adminUsername = process.env.ADMIN_USERNAME || 'admin';
      const adminPassword = process.env.ADMIN_PASSWORD || 'StrongAdminPass123!';
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@hotdogdiaries.com';
      const adminFullName = process.env.ADMIN_FULL_NAME || 'Administrator';
      
      const hashedPassword = await bcryptjs.hash(adminPassword, 10);
      
      await db.query(
        `INSERT INTO admin_users (username, password_hash, email, full_name) 
         VALUES (?, ?, ?, ?)`,
        [adminUsername, hashedPassword, adminEmail, adminFullName]
      );
      console.log('  ✅ Default admin user created');
      console.log(`     Username: ${adminUsername}`);
      console.log(`     Email: ${adminEmail}`);
    } else {
      console.log('  ℹ️  Admin user already exists');
    }
    
    // Insert default platform configs if not exists
    console.log('\n⚙️  Setting up platform configurations...');
    const platforms = ['reddit', 'youtube', 'bluesky', 'unsplash', 'giphy', 'pixabay'];
    
    for (const platform of platforms) {
      const configCheck = await db.query(
        'SELECT id FROM platform_scan_configs WHERE platform = ?',
        [platform]
      );
      
      if (!configCheck.rows || configCheck.rows.length === 0) {
        await db.query(
          `INSERT INTO platform_scan_configs (platform, is_active, scan_frequency, config_data)
           VALUES (?, ?, ?, ?)`,
          [platform, true, 240, JSON.stringify({ maxResults: 10 })]
        );
        console.log(`  ✅ ${platform} config created`);
      }
    }
    
    // Initialize platform quotas
    console.log('\n📊 Setting up platform quotas...');
    for (const platform of platforms) {
      const quotaCheck = await db.query(
        'SELECT id FROM platform_quotas WHERE platform = ?',
        [platform]
      );
      
      if (!quotaCheck.rows || quotaCheck.rows.length === 0) {
        const limits: Record<string, number> = {
          reddit: 60,
          youtube: 100,
          bluesky: 50,
          unsplash: 50,
          giphy: 100,
          pixabay: 100
        };
        
        await db.query(
          `INSERT INTO platform_quotas (platform, daily_limit, used_today, reset_at)
           VALUES (?, ?, ?, ?)`,
          [platform, limits[platform] || 50, 0, new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()]
        );
        console.log(`  ✅ ${platform} quota initialized (limit: ${limits[platform] || 50})`);
      }
    }
    
    // Get row counts for each table
    const tables = ['admin_users', 'content_queue', 'posted_content', 'platform_scan_configs', 'system_logs', 'platform_quotas'];
    console.log('\n📈 Table statistics:');
    
    for (const table of tables) {
      try {
        const countResult = await db.query(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`  - ${table}: ${countResult.rows[0].count} rows`);
      } catch (error) {
        console.log(`  - ${table}: Table not found or empty`);
      }
    }
    
    console.log('\n✨ Database migration completed successfully!');
    console.log('🎉 Your database is ready for deployment!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await db.disconnect();
  }
}

function getPostgresMigrations(): string[] {
  return [
    // 1. Admin users table
    `CREATE TABLE IF NOT EXISTS admin_users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      email VARCHAR(255),
      full_name VARCHAR(255),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_login_at TIMESTAMP,
      login_count INTEGER DEFAULT 0
    )`,
    
    // 2. Content queue table
    `CREATE TABLE IF NOT EXISTS content_queue (
      id SERIAL PRIMARY KEY,
      content_text TEXT,
      content_image_url TEXT,
      content_video_url TEXT,
      content_type VARCHAR(50),
      source_platform VARCHAR(50),
      original_url TEXT,
      original_author VARCHAR(255),
      content_hash VARCHAR(255) UNIQUE,
      confidence_score DECIMAL(3,2),
      is_approved BOOLEAN DEFAULT false,
      is_posted BOOLEAN DEFAULT false,
      is_flagged BOOLEAN DEFAULT false,
      content_status VARCHAR(50) DEFAULT 'pending',
      quality_score INTEGER,
      admin_notes TEXT,
      rejection_reason TEXT,
      scraped_at TIMESTAMP,
      posted_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // 3. Posted content table
    `CREATE TABLE IF NOT EXISTS posted_content (
      id SERIAL PRIMARY KEY,
      content_queue_id INTEGER REFERENCES content_queue(id),
      post_order INTEGER,
      scheduled_time TIME,
      posted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      engagement_score INTEGER DEFAULT 0,
      view_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // 4. Platform scan configs
    `CREATE TABLE IF NOT EXISTS platform_scan_configs (
      id SERIAL PRIMARY KEY,
      platform VARCHAR(50) UNIQUE NOT NULL,
      is_active BOOLEAN DEFAULT true,
      scan_frequency INTEGER DEFAULT 240,
      last_scanned_at TIMESTAMP,
      config_data JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // 5. System logs
    `CREATE TABLE IF NOT EXISTS system_logs (
      id SERIAL PRIMARY KEY,
      level VARCHAR(20),
      category VARCHAR(50),
      action VARCHAR(100),
      details TEXT,
      metadata JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // 6. Platform quotas table
    `CREATE TABLE IF NOT EXISTS platform_quotas (
      id SERIAL PRIMARY KEY,
      platform VARCHAR(50) UNIQUE NOT NULL,
      daily_limit INTEGER DEFAULT 100,
      used_today INTEGER DEFAULT 0,
      reset_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Indexes
    `CREATE INDEX IF NOT EXISTS idx_content_queue_platform ON content_queue(source_platform)`,
    `CREATE INDEX IF NOT EXISTS idx_content_queue_approved ON content_queue(is_approved)`,
    `CREATE INDEX IF NOT EXISTS idx_content_queue_posted ON content_queue(is_posted)`,
    `CREATE INDEX IF NOT EXISTS idx_content_queue_status ON content_queue(content_status)`,
    `CREATE INDEX IF NOT EXISTS idx_content_queue_hash ON content_queue(content_hash)`
  ];
}

function getSQLiteMigrations(): string[] {
  return [
    // 1. Admin users table (already exists, but ensure structure)
    `CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      email TEXT,
      full_name TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login_at DATETIME,
      login_count INTEGER DEFAULT 0
    )`,
    
    // 2. Content queue table (already exists)
    `CREATE TABLE IF NOT EXISTS content_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content_text TEXT,
      content_image_url TEXT,
      content_video_url TEXT,
      content_type TEXT,
      source_platform TEXT,
      original_url TEXT,
      original_author TEXT,
      content_hash TEXT UNIQUE,
      confidence_score REAL,
      is_approved INTEGER DEFAULT 0,
      is_posted INTEGER DEFAULT 0,
      is_flagged INTEGER DEFAULT 0,
      content_status TEXT DEFAULT 'pending',
      quality_score INTEGER,
      admin_notes TEXT,
      rejection_reason TEXT,
      scraped_at DATETIME,
      posted_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // 3. Posted content table
    `CREATE TABLE IF NOT EXISTS posted_content (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content_queue_id INTEGER REFERENCES content_queue(id),
      post_order INTEGER,
      scheduled_time TEXT,
      posted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      engagement_score INTEGER DEFAULT 0,
      view_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // 4. Platform scan configs (new table)
    `CREATE TABLE IF NOT EXISTS platform_scan_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT UNIQUE NOT NULL,
      is_active INTEGER DEFAULT 1,
      scan_frequency INTEGER DEFAULT 240,
      last_scanned_at DATETIME,
      config_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // 5. System logs (new table)
    `CREATE TABLE IF NOT EXISTS system_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT,
      category TEXT,
      action TEXT,
      details TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // 6. Platform quotas table (new table)
    `CREATE TABLE IF NOT EXISTS platform_quotas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT UNIQUE NOT NULL,
      daily_limit INTEGER DEFAULT 100,
      used_today INTEGER DEFAULT 0,
      reset_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Indexes
    `CREATE INDEX IF NOT EXISTS idx_content_queue_platform ON content_queue(source_platform)`,
    `CREATE INDEX IF NOT EXISTS idx_content_queue_approved ON content_queue(is_approved)`,
    `CREATE INDEX IF NOT EXISTS idx_content_queue_posted ON content_queue(is_posted)`,
    `CREATE INDEX IF NOT EXISTS idx_content_queue_status ON content_queue(content_status)`,
    `CREATE INDEX IF NOT EXISTS idx_content_queue_hash ON content_queue(content_hash)`
  ];
}

// Run migration
migrateDatabaseTables().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});