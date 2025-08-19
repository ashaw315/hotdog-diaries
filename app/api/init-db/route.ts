import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

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

    return NextResponse.json({
      success: true,
      message: 'Database initialized successfully',
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