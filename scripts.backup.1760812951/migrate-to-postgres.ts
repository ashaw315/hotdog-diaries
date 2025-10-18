import { db } from '../lib/db';
import bcryptjs from 'bcryptjs';

async function migrateToPostgres() {
  console.log('🚀 Starting PostgreSQL migration...');
  
  try {
    // Connect to database
    await db.connect();
    
    // Create tables in PostgreSQL
    const migrations = [
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
      
      // 2. Content queue table with proper status enum
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
      
      // 7. Create indexes for performance
      `CREATE INDEX IF NOT EXISTS idx_content_queue_platform ON content_queue(source_platform)`,
      `CREATE INDEX IF NOT EXISTS idx_content_queue_approved ON content_queue(is_approved)`,
      `CREATE INDEX IF NOT EXISTS idx_content_queue_posted ON content_queue(is_posted)`,
      `CREATE INDEX IF NOT EXISTS idx_content_queue_status ON content_queue(content_status)`,
      `CREATE INDEX IF NOT EXISTS idx_content_queue_hash ON content_queue(content_hash)`,
      `CREATE INDEX IF NOT EXISTS idx_posted_content_date ON posted_content(posted_at)`,
      `CREATE INDEX IF NOT EXISTS idx_posted_content_queue_id ON posted_content(content_queue_id)`,
      `CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs(created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_system_logs_category ON system_logs(category)`
    ];
    
    // Run each migration
    for (const migration of migrations) {
      const tableName = migration.match(/(?:CREATE TABLE IF NOT EXISTS|CREATE INDEX IF NOT EXISTS idx_)[\s]+(\w+)/)?.[1] || 'operation';
      console.log(`📦 Running migration for: ${tableName}`);
      
      try {
        await db.query(migration);
        console.log(`  ✅ ${tableName} completed`);
      } catch (error: any) {
        if (error.message?.includes('already exists')) {
          console.log(`  ⏭️  ${tableName} already exists, skipping`);
        } else {
          throw error;
        }
      }
    }
    
    // Insert default admin user if not exists
    console.log('\n👤 Checking admin user...');
    const adminCheck = await db.query('SELECT id FROM admin_users WHERE username = $1', ['admin']);
    
    if (!adminCheck.rows || adminCheck.rows.length === 0) {
      const adminUsername = process.env.ADMIN_USERNAME || 'admin';
      const adminPassword = process.env.ADMIN_PASSWORD || 'StrongAdminPass123!';
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@hotdogdiaries.com';
      const adminFullName = process.env.ADMIN_FULL_NAME || 'Administrator';
      
      const hashedPassword = await bcryptjs.hash(adminPassword, 10);
      
      await db.query(
        `INSERT INTO admin_users (username, password_hash, email, full_name) 
         VALUES ($1, $2, $3, $4)`,
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
        'SELECT id FROM platform_scan_configs WHERE platform = $1',
        [platform]
      );
      
      if (!configCheck.rows || configCheck.rows.length === 0) {
        await db.query(
          `INSERT INTO platform_scan_configs (platform, is_active, scan_frequency, config_data)
           VALUES ($1, $2, $3, $4)`,
          [platform, true, 240, JSON.stringify({ maxResults: 10 })]
        );
        console.log(`  ✅ ${platform} config created`);
      }
    }
    
    // Initialize platform quotas
    console.log('\n📊 Setting up platform quotas...');
    for (const platform of platforms) {
      const quotaCheck = await db.query(
        'SELECT id FROM platform_quotas WHERE platform = $1',
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
           VALUES ($1, $2, $3, $4)`,
          [platform, limits[platform] || 50, 0, new Date(Date.now() + 24 * 60 * 60 * 1000)]
        );
        console.log(`  ✅ ${platform} quota initialized (limit: ${limits[platform] || 50})`);
      }
    }
    
    // Run a test query to verify everything works
    console.log('\n🧪 Running verification queries...');
    const tableCount = await db.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `);
    
    console.log(`  ✅ ${tableCount.rows[0].count} tables created`);
    
    // Get row counts for each table
    const tables = ['admin_users', 'content_queue', 'posted_content', 'platform_scan_configs', 'system_logs', 'platform_quotas'];
    console.log('\n📈 Table statistics:');
    
    for (const table of tables) {
      try {
        const countResult = await db.query(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`  - ${table}: ${countResult.rows[0].count} rows`);
      } catch (error) {
        console.log(`  - ${table}: Unable to count`);
      }
    }
    
    console.log('\n✨ PostgreSQL migration completed successfully!');
    console.log('🎉 Your database is ready for production deployment on Vercel!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await db.disconnect();
  }
}

// Check if running in production environment
if (process.env.NODE_ENV === 'production' && !process.env.POSTGRES_URL) {
  console.error('❌ Error: POSTGRES_URL environment variable is required for production');
  console.error('   This script should be run after connecting Vercel Postgres storage');
  process.exit(1);
}

// Run migration
migrateToPostgres().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});