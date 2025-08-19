import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET() {
  console.log('🔍 Running complete production diagnostic...\n');
  
  const diagnostic = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    deployment: {
      url: process.env.VERCEL_URL || process.env.NEXT_PUBLIC_APP_URL || 'unknown',
      region: process.env.VERCEL_REGION || 'unknown',
    },
    database: {
      connected: false,
      type: 'unknown',
      tables: [],
      error: null
    },
    content: {
      total: 0,
      approved: 0,
      posted: 0,
      readyToPost: 0,
      platforms: {}
    },
    apis: {
      reddit: { configured: false, working: false },
      youtube: { configured: false, working: false },
      giphy: { configured: false, working: false },
      pixabay: { configured: false, working: false },
      bluesky: { configured: false, working: false },
      imgur: { configured: false, working: false },
      lemmy: { configured: false, working: false },
      tumblr: { configured: false, working: false }
    },
    features: {
      adminLogin: { status: 'unknown', error: null },
      mainFeed: { status: 'unknown', error: null },
      scanning: { status: 'unknown', lastRun: null },
      posting: { status: 'unknown', lastPost: null },
      cronJob: { configured: false, lastRun: null }
    },
    criticalIssues: [],
    recommendations: []
  };

  // 1. CHECK DATABASE CONNECTION
  try {
    console.log('Checking database connection...');
    const testQuery = await sql`SELECT 1 as test`;
    diagnostic.database.connected = true;
    
    // Detect database type
    if (process.env.POSTGRES_URL || process.env.DATABASE_URL?.includes('postgres')) {
      diagnostic.database.type = 'PostgreSQL (Vercel)';
    } else {
      diagnostic.database.type = 'Unknown';
    }
    
    // Check tables
    try {
      const tables = ['admin_users', 'content_queue', 'posted_content', 'system_logs'];
      for (const table of tables) {
        try {
          const count = await sql.query(`SELECT COUNT(*) as count FROM ${table}`);
          diagnostic.database.tables.push({
            name: table,
            exists: true,
            rowCount: count.rows[0]?.count || 0
          });
        } catch (e) {
          diagnostic.database.tables.push({
            name: table,
            exists: false,
            error: e.message
          });
        }
      }
    } catch (e) {
      diagnostic.database.error = e.message;
    }
  } catch (error) {
    diagnostic.database.connected = false;
    diagnostic.database.error = error.message;
    diagnostic.criticalIssues.push('❌ Database not connected');
  }

  // 2. CHECK CONTENT STATUS
  if (diagnostic.database.connected) {
    try {
      console.log('Checking content status...');
      const contentStats = await sql`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN is_approved = true THEN 1 ELSE 0 END) as approved,
          SUM(CASE WHEN is_posted = true THEN 1 ELSE 0 END) as posted,
          SUM(CASE WHEN is_approved = true AND is_posted = false THEN 1 ELSE 0 END) as ready
        FROM content_queue
      `;
      
      const stats = contentStats.rows[0];
      diagnostic.content = {
        total: parseInt(stats?.total) || 0,
        approved: parseInt(stats?.approved) || 0,
        posted: parseInt(stats?.posted) || 0,
        readyToPost: parseInt(stats?.ready) || 0,
        platforms: {}
      };
      
      // Get platform breakdown
      const platforms = await sql`
        SELECT source_platform, COUNT(*) as count
        FROM content_queue
        GROUP BY source_platform
      `;
      
      platforms.rows?.forEach(p => {
        diagnostic.content.platforms[p.source_platform] = parseInt(p.count);
      });
      
      if (diagnostic.content.total === 0) {
        diagnostic.criticalIssues.push('❌ No content in database');
      }
      if (diagnostic.content.readyToPost === 0) {
        diagnostic.criticalIssues.push('❌ No content ready to post');
      }
    } catch (error) {
      console.error('Content check failed:', error);
      diagnostic.criticalIssues.push(`⚠️ Content check failed: ${error.message}`);
    }
  }

  // 3. CHECK API CONFIGURATIONS
  console.log('Checking API configurations...');
  
  // Reddit
  diagnostic.apis.reddit.configured = !!(
    process.env.REDDIT_CLIENT_ID && 
    process.env.REDDIT_CLIENT_SECRET
  );
  
  // YouTube
  diagnostic.apis.youtube.configured = !!process.env.YOUTUBE_API_KEY;
  
  // Giphy
  diagnostic.apis.giphy.configured = !!process.env.GIPHY_API_KEY;
  
  // Pixabay
  diagnostic.apis.pixabay.configured = !!process.env.PIXABAY_API_KEY;
  
  // Bluesky
  diagnostic.apis.bluesky.configured = !!(
    process.env.BLUESKY_HANDLE && 
    process.env.BLUESKY_PASSWORD
  );

  // 4. TEST CRITICAL FEATURES
  console.log('Testing critical features...');
  
  // Test admin login endpoint
  try {
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
    const loginTest = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'test', password: 'test' })
    });
    diagnostic.features.adminLogin.status = loginTest.status < 500 ? 'accessible' : 'broken';
    if (loginTest.status >= 500) {
      diagnostic.criticalIssues.push('❌ Admin login endpoint broken');
    }
  } catch (error) {
    diagnostic.features.adminLogin.status = 'broken';
    diagnostic.features.adminLogin.error = error.message;
    diagnostic.criticalIssues.push('❌ Admin login endpoint broken');
  }
  
  // Check scanning status
  try {
    if (diagnostic.database.connected) {
      const lastScan = await sql`
        SELECT * FROM system_logs 
        WHERE component = 'UNIFIED_SCAN_API_SUCCESS' 
        ORDER BY created_at DESC 
        LIMIT 1
      `;
      diagnostic.features.scanning.lastRun = lastScan.rows[0]?.created_at || 'never';
      diagnostic.features.scanning.status = lastScan.rows[0] ? 'working' : 'unknown';
    }
  } catch (error) {
    diagnostic.features.scanning.status = 'unknown';
  }
  
  // Check posting status
  try {
    if (diagnostic.database.connected) {
      const lastPost = await sql`
        SELECT * FROM posted_content 
        ORDER BY posted_at DESC 
        LIMIT 1
      `;
      diagnostic.features.posting.lastPost = lastPost.rows[0]?.posted_at || 'never';
      diagnostic.features.posting.status = lastPost.rows[0] ? 'working' : 'never_posted';
    }
  } catch (error) {
    diagnostic.features.posting.status = 'unknown';
  }

  // 5. GENERATE RECOMMENDATIONS
  console.log('Generating recommendations...');
  
  if (!diagnostic.database.connected) {
    diagnostic.recommendations.push('🚨 CRITICAL: Fix database connection first');
    diagnostic.recommendations.push('Run: vercel env pull to check DATABASE_URL');
  }
  
  if (diagnostic.database.connected && diagnostic.content.total === 0) {
    diagnostic.recommendations.push('📡 Run initial scan: POST /api/admin/social/scan-all');
  }
  
  if (diagnostic.content.total > 0 && diagnostic.content.approved === 0) {
    diagnostic.recommendations.push('✅ Approve content in admin panel');
  }
  
  const unconfiguredAPIs = Object.entries(diagnostic.apis)
    .filter(([_, status]) => !status.configured)
    .map(([name]) => name);
    
  if (unconfiguredAPIs.length > 0) {
    diagnostic.recommendations.push(`🔑 Add API keys for: ${unconfiguredAPIs.join(', ')}`);
  }

  // 6. DETERMINE OVERALL STATUS
  const overallStatus = {
    isWorking: diagnostic.database.connected && 
               diagnostic.criticalIssues.length === 0,
    readyForUsers: diagnostic.content.readyToPost > 0,
    percentComplete: 0
  };
  
  // Calculate completion percentage
  let points = 0;
  const maxPoints = 10;
  
  if (diagnostic.database.connected) points += 3;
  if (diagnostic.content.total > 0) points += 2;
  if (diagnostic.content.approved > 0) points += 1;
  if (diagnostic.content.readyToPost > 0) points += 1;
  if (diagnostic.features.adminLogin.status === 'accessible') points += 1;
  if (Object.values(diagnostic.apis).some(api => api.configured)) points += 2;
  
  overallStatus.percentComplete = Math.round((points / maxPoints) * 100);

  // Final summary
  return NextResponse.json({
    diagnostic,
    summary: {
      status: overallStatus.isWorking ? '✅ WORKING' : '❌ BROKEN',
      readyForUsers: overallStatus.readyForUsers,
      completeness: `${overallStatus.percentComplete}%`,
      criticalIssues: diagnostic.criticalIssues.length,
      nextSteps: diagnostic.recommendations.slice(0, 3)
    }
  }, {
    status: 200,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
}