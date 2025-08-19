import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';

export async function GET() {
  const steps = [];
  
  try {
    console.log('🚀 Starting production setup...');
    
    // Step 1: Initialize database directly (no HTTP call)
    console.log('Step 1: Initializing database...');
    try {
      // Test connection
      const testResult = await sql`SELECT 1 as test`;
      console.log('✅ Database connected');

      // Create all tables
      await sql`CREATE TABLE IF NOT EXISTS system_logs (
        id SERIAL PRIMARY KEY,
        log_level VARCHAR(20) NOT NULL CHECK (log_level IN ('debug', 'info', 'warning', 'error')),
        component VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )`;

      await sql`CREATE TABLE IF NOT EXISTS system_alerts (
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
      )`;

      await sql`CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        full_name VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`;

      await sql`CREATE TABLE IF NOT EXISTS content_queue (
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
        content_status VARCHAR(50) DEFAULT 'pending',
        posted_at TIMESTAMP,
        scraped_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`;

      await sql`CREATE TABLE IF NOT EXISTS content_analysis (
        id SERIAL PRIMARY KEY,
        content_queue_id INTEGER REFERENCES content_queue(id) ON DELETE CASCADE,
        confidence_score DECIMAL(3,2) NOT NULL,
        flagged_patterns JSONB,
        analysis_metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )`;

      await sql`CREATE TABLE IF NOT EXISTS posted_content (
        id SERIAL PRIMARY KEY,
        content_queue_id INTEGER REFERENCES content_queue(id) ON DELETE CASCADE,
        platform VARCHAR(50) NOT NULL,
        external_id VARCHAR(255),
        posted_at TIMESTAMP DEFAULT NOW(),
        engagement_data JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )`;

      console.log('✅ Tables created');

      // Check if admin exists and create if not
      const adminCheck = await sql`SELECT id FROM admin_users WHERE username = 'admin'`;
      let adminCreated = false;

      if (adminCheck.rows.length === 0) {
        const hashedPassword = await bcrypt.hash('StrongAdminPass123!', 10);
        await sql`INSERT INTO admin_users (username, password_hash, email, full_name) 
                  VALUES ('admin', ${hashedPassword}, 'admin@hotdogdiaries.com', 'Administrator')`;
        adminCreated = true;
        console.log('✅ Admin user created');
      }

      // Get stats
      const statsResult = await sql`SELECT 
        (SELECT COUNT(*) FROM content_queue) as total_content,
        (SELECT COUNT(*) FROM admin_users) as admin_count
      `;
      const stats = statsResult.rows[0];

      steps.push({
        step: 'Database Initialization',
        success: true,
        message: 'Database tables and admin user initialized',
        adminCreated,
        stats: {
          totalContent: parseInt(stats.total_content) || 0,
          adminUsers: parseInt(stats.admin_count) || 0
        }
      });

    } catch (dbError) {
      steps.push({
        step: 'Database Initialization',
        success: false,
        error: dbError.message,
        message: 'Database setup failed'
      });
      console.error('Database error:', dbError);
    }

    // Step 2: Content check and seeding
    console.log('Step 2: Checking and seeding content...');
    try {
      const contentCheck = await sql`SELECT COUNT(*) as count FROM content_queue`;
      let contentCount = parseInt(contentCheck.rows[0]?.count || '0');
      
      if (contentCount === 0) {
        // Seed with demo content
        const demoContent = [
          "🌭 The perfect hotdog: grilled to perfection with mustard and onions!",
          "Just discovered the best hotdog stand in NYC! Line was worth the wait 🔥", 
          "Making homemade hotdogs from scratch - the sausage casing snapped perfectly!",
          "Hotdog eating contest champion shares secret technique 🏆",
          "Chicago style vs New York style hotdogs - which team are you on?"
        ];
        
        for (let i = 0; i < demoContent.length; i++) {
          await sql`INSERT INTO content_queue (
            content_text, content_type, source_platform, original_author,
            original_url, content_hash, is_approved, content_status,
            scraped_at, confidence_score
          ) VALUES (
            ${demoContent[i]}, 'text', 'demo', 'hotdog_lover',
            ${'https://example.com/demo' + (i+1)}, 
            ${'demo_' + Date.now() + '_' + i},
            true, 'approved', NOW(), 0.95
          )`;
        }
        contentCount = demoContent.length;
        
        steps.push({
          step: 'Content Seeding',
          success: true,
          message: `Seeded ${contentCount} demo content items`,
          contentCount,
          seeded: true
        });
      } else {
        steps.push({
          step: 'Content Check',
          success: true,
          message: `Found ${contentCount} existing content items`,
          contentCount,
          seeded: false
        });
      }
    } catch (contentError) {
      steps.push({
        step: 'Content Check',
        success: false,
        error: contentError.message
      });
    }

    // Step 3: Environment check
    console.log('Step 3: Environment check...');
    const envCheck = {
      nodeEnv: process.env.NODE_ENV,
      hasPostgres: !!process.env.POSTGRES_URL,
      hasVercel: !!process.env.VERCEL
    };
    
    steps.push({
      step: 'Environment Check',
      success: true,
      message: 'Environment verified',
      environment: envCheck
    });
    
    const allStepsSuccessful = steps.every(step => step.success);
    
    return NextResponse.json({
      success: allStepsSuccessful,
      message: allStepsSuccessful ? '🎉 Production setup completed!' : '⚠️ Setup completed with some warnings',
      steps,
      nextSteps: [
        '1. Visit /admin to access the admin login',
        '2. Username: admin',
        '3. Password: StrongAdminPass123!',
        '4. Content scanning may need to be configured manually',
        '5. Check environment variables for API keys (Reddit, YouTube, etc.)'
      ],
      adminCredentials: {
        loginUrl: '/admin',
        username: 'admin',
        password: 'StrongAdminPass123!',
        note: 'Please change this password after first login'
      },
      recommendations: [
        'Database is now initialized and ready',
        'Admin user created - login should work',
        'To populate content, configure API keys in environment variables',
        'Or manually trigger /api/cron/daily once API keys are set'
      ],
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      steps,
      partialSetup: steps.length > 0,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}