import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';

export async function POST() {
  const fixes = [];
  
  try {
    console.log('🔧 Running quick fixes...');
    
    // 1. Try to create missing tables
    console.log('Creating missing tables...');
    const tables = [
      {
        name: 'admin_users',
        sql: `CREATE TABLE IF NOT EXISTS admin_users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          email VARCHAR(255),
          full_name VARCHAR(255),
          is_active BOOLEAN DEFAULT true,
          last_login TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )`
      },
      {
        name: 'content_queue',
        sql: `CREATE TABLE IF NOT EXISTS content_queue (
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
          flagged_patterns JSONB,
          rejection_reason TEXT,
          is_approved BOOLEAN DEFAULT false,
          is_rejected BOOLEAN DEFAULT false,
          is_posted BOOLEAN DEFAULT false,
          posted_at TIMESTAMP,
          scraped_at TIMESTAMP DEFAULT NOW(),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )`
      },
      {
        name: 'posted_content',
        sql: `CREATE TABLE IF NOT EXISTS posted_content (
          id SERIAL PRIMARY KEY,
          content_queue_id INTEGER REFERENCES content_queue(id) ON DELETE CASCADE,
          platform VARCHAR(50) NOT NULL,
          external_id VARCHAR(255),
          posted_at TIMESTAMP DEFAULT NOW(),
          engagement_data JSONB,
          created_at TIMESTAMP DEFAULT NOW()
        )`
      },
      {
        name: 'system_logs',
        sql: `CREATE TABLE IF NOT EXISTS system_logs (
          id SERIAL PRIMARY KEY,
          log_level VARCHAR(20) NOT NULL CHECK (log_level IN ('debug', 'info', 'warning', 'error')),
          component VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          metadata JSONB,
          created_at TIMESTAMP DEFAULT NOW()
        )`
      }
    ];
    
    for (const table of tables) {
      try {
        await sql.query(table.sql);
        fixes.push(`✅ Table '${table.name}' created/verified`);
      } catch (e) {
        fixes.push(`⚠️ Table '${table.name}' error: ${e.message}`);
      }
    }
    
    // 2. Create admin user if missing
    console.log('Checking admin user...');
    try {
      const admin = await sql`SELECT id FROM admin_users WHERE username = 'admin'`;
      if (admin.rows.length === 0) {
        const hash = await bcrypt.hash('StrongAdminPass123!', 10);
        await sql`
          INSERT INTO admin_users (username, password_hash, email, full_name) 
          VALUES ('admin', ${hash}, 'admin@hotdogdiaries.com', 'Administrator')
        `;
        fixes.push('✅ Admin user created (username: admin, password: StrongAdminPass123!)');
      } else {
        fixes.push('✅ Admin user already exists');
      }
    } catch (e) {
      fixes.push(`⚠️ Admin user error: ${e.message}`);
    }
    
    // 3. Create indexes for better performance
    console.log('Creating database indexes...');
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_content_queue_platform ON content_queue(source_platform)',
      'CREATE INDEX IF NOT EXISTS idx_content_queue_approved ON content_queue(is_approved)',
      'CREATE INDEX IF NOT EXISTS idx_content_queue_posted ON content_queue(is_posted)',
      'CREATE INDEX IF NOT EXISTS idx_system_logs_component ON system_logs(component)',
      'CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at)'
    ];
    
    for (const indexSql of indexes) {
      try {
        await sql.query(indexSql);
        fixes.push('✅ Database index created');
      } catch (e) {
        fixes.push(`⚠️ Index error: ${e.message}`);
      }
    }
    
    // 4. Test API endpoints
    console.log('Testing critical endpoints...');
    try {
      const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
      
      // Test admin status endpoint
      const statusTest = await fetch(`${baseUrl}/api/admin/social/status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (statusTest.ok) {
        fixes.push('✅ Admin API endpoints accessible');
      } else {
        fixes.push(`⚠️ Admin API returned ${statusTest.status}`);
      }
    } catch (e) {
      fixes.push(`⚠️ API test error: ${e.message}`);
    }
    
    // 5. Add some sample content if database is empty
    try {
      const contentCount = await sql`SELECT COUNT(*) as count FROM content_queue`;
      if (parseInt(contentCount.rows[0].count) === 0) {
        await sql`
          INSERT INTO content_queue (
            content_text, 
            content_type, 
            source_platform, 
            original_url, 
            content_hash,
            is_approved,
            scraped_at
          ) VALUES (
            'Welcome to Hotdog Diaries! 🌭 Your daily dose of hotdog content is coming soon.',
            'text',
            'system',
            'https://hotdog-diaries.vercel.app',
            'welcome_message_' || extract(epoch from now()),
            true,
            NOW()
          )
        `;
        fixes.push('✅ Welcome message added to content queue');
      }
    } catch (e) {
      fixes.push(`⚠️ Sample content error: ${e.message}`);
    }
    
    return NextResponse.json({
      success: true,
      fixes,
      message: 'Quick fixes completed',
      nextSteps: [
        '1. Check /api/full-diagnostic for updated status',
        '2. Visit /admin to login (admin / StrongAdminPass123!)',
        '3. Trigger content scan: POST /api/admin/social/scan-all',
        '4. Check main site for content display'
      ]
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message,
      fixes,
      message: 'Some fixes may have failed'
    }, { status: 500 });
  }
}