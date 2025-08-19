import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';

export async function GET() {
  try {
    console.log('🔧 Initializing database tables...');
    
    // Log environment info for debugging
    console.log('Environment:', {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL,
      POSTGRES_URL_EXISTS: !!process.env.POSTGRES_URL,
      DATABASE_URL_EXISTS: !!process.env.DATABASE_URL
    });

    // Test connection first
    const testResult = await sql`SELECT 1 as test`;
    console.log('✅ Database connected:', testResult.rows[0]);

    // Create system_logs table
    await sql`
      CREATE TABLE IF NOT EXISTS system_logs (
        id SERIAL PRIMARY KEY,
        log_level VARCHAR(20) NOT NULL CHECK (log_level IN ('debug', 'info', 'warning', 'error')),
        component VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Create system_alerts table
    await sql`
      CREATE TABLE IF NOT EXISTS system_alerts (
        id SERIAL PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        metadata JSONB,
        channels TEXT[],
        created_at TIMESTAMP DEFAULT NOW(),
        acknowledged BOOLEAN DEFAULT FALSE,
        acknowledged_at TIMESTAMP,
        acknowledged_by VARCHAR(255)
      )
    `;

    // Create admin_users table
    await sql`
      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        full_name VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Create content_queue table
    await sql`
      CREATE TABLE IF NOT EXISTS content_queue (
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
      )
    `;

    // Create content_analysis table
    await sql`
      CREATE TABLE IF NOT EXISTS content_analysis (
        id SERIAL PRIMARY KEY,
        content_queue_id INTEGER REFERENCES content_queue(id) ON DELETE CASCADE,
        confidence_score DECIMAL(3,2) NOT NULL,
        flagged_patterns JSONB,
        analysis_metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Create posted_content table
    await sql`
      CREATE TABLE IF NOT EXISTS posted_content (
        id SERIAL PRIMARY KEY,
        content_queue_id INTEGER REFERENCES content_queue(id) ON DELETE CASCADE,
        platform VARCHAR(50) NOT NULL,
        external_id VARCHAR(255),
        posted_at TIMESTAMP DEFAULT NOW(),
        engagement_data JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    console.log('✅ Database tables created successfully');

    // Check if admin user exists
    const adminCheck = await sql`
      SELECT id, username FROM admin_users WHERE username = 'admin'
    `;

    let adminCreated = false;
    if (adminCheck.rows.length === 0) {
      // Create default admin user
      const hashedPassword = await bcrypt.hash('StrongAdminPass123!', 10);
      await sql`
        INSERT INTO admin_users (username, password_hash, email, full_name, is_active) 
        VALUES ('admin', ${hashedPassword}, 'admin@hotdogdiaries.com', 'Administrator', true)
      `;
      console.log('✅ Admin user created');
      adminCreated = true;
    } else {
      console.log('✅ Admin user already exists');
    }

    // Create indexes for better performance
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_content_queue_platform ON content_queue(source_platform)`,
      `CREATE INDEX IF NOT EXISTS idx_content_queue_approved ON content_queue(is_approved)`,
      `CREATE INDEX IF NOT EXISTS idx_content_queue_posted ON content_queue(is_posted)`,
      `CREATE INDEX IF NOT EXISTS idx_content_queue_status ON content_queue(content_status)`
    ];

    for (const indexSql of indexes) {
      await sql.query(indexSql);
    }
    console.log('✅ Database indexes created');

    // Get current database stats
    const statsResult = await sql`
      SELECT 
        (SELECT COUNT(*) FROM content_queue) as total_content,
        (SELECT COUNT(*) FROM admin_users) as admin_count,
        (SELECT COUNT(*) FROM content_queue WHERE is_approved = true) as approved_content,
        (SELECT COUNT(*) FROM content_queue WHERE is_posted = true) as posted_content
    `;
    const stats = statsResult.rows[0];

    return NextResponse.json({
      success: true,
      message: 'Database initialized successfully',
      adminCreated,
      adminCredentials: adminCreated ? {
        username: 'admin',
        password: 'StrongAdminPass123!',
        note: 'Please change this password after first login'
      } : null,
      stats: {
        totalContent: parseInt(stats.total_content) || 0,
        adminUsers: parseInt(stats.admin_count) || 0,
        approvedContent: parseInt(stats.approved_content) || 0,
        postedContent: parseInt(stats.posted_content) || 0
      },
      tablesCreated: [
        'system_logs',
        'system_alerts', 
        'admin_users',
        'content_queue',
        'content_analysis',
        'posted_content'
      ],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Database initialization error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Also support POST for backwards compatibility
export async function POST() {
  return GET();
}