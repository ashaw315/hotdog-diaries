import { NextResponse } from 'next/server';
import { createSimpleClient } from '@/utils/supabase/server';

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
    const supabase = createSimpleClient();
    
    // Test connection with a simple query
    const { data, error } = await supabase.from('content_queue').select('count', { count: 'exact', head: true });
    if (error) throw error;
    
    diagnostic.database.connected = true;
    diagnostic.database.type = 'Supabase PostgreSQL';
    
    // Check tables
    try {
      const tables = ['admin_users', 'content_queue', 'posted_content', 'system_logs'];
      for (const table of tables) {
        try {
          const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
          if (error) throw error;
          
          diagnostic.database.tables.push({
            name: table,
            exists: true,
            rowCount: count || 0
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
      const supabase = createSimpleClient();
      
      // Get content stats
      const { data: allContent, error: allError } = await supabase.from('content_queue').select('is_approved, is_posted');
      if (allError) throw allError;
      
      const total = allContent?.length || 0;
      const approved = allContent?.filter(c => c.is_approved).length || 0;
      const posted = allContent?.filter(c => c.is_posted).length || 0;
      const ready = allContent?.filter(c => c.is_approved && !c.is_posted).length || 0;
      
      diagnostic.content = {
        total,
        approved,
        posted,
        readyToPost: ready,
        platforms: {}
      };
      
      // Get platform breakdown
      const { data: platformData, error: platformError } = await supabase
        .from('content_queue')
        .select('source_platform')
        .then(result => {
          if (result.error) throw result.error;
          const platforms: Record<string, number> = {};
          result.data?.forEach(p => {
            platforms[p.source_platform] = (platforms[p.source_platform] || 0) + 1;
          });
          return { data: platforms, error: null };
        });
      
      if (platformError) throw platformError;
      diagnostic.content.platforms = platformData || {};
      
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
      const supabase = createSimpleClient();
      const { data: lastScan, error } = await supabase
        .from('system_logs')
        .select('*')
        .eq('component', 'UNIFIED_SCAN_API_SUCCESS')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (!error && lastScan) {
        diagnostic.features.scanning.lastRun = lastScan.created_at;
        diagnostic.features.scanning.status = 'working';
      } else {
        diagnostic.features.scanning.lastRun = 'never';
        diagnostic.features.scanning.status = 'unknown';
      }
    }
  } catch (error) {
    diagnostic.features.scanning.status = 'unknown';
  }
  
  // Check posting status
  try {
    if (diagnostic.database.connected) {
      const supabase = createSimpleClient();
      const { data: lastPost, error } = await supabase
        .from('posted_content')
        .select('*')
        .order('posted_at', { ascending: false })
        .limit(1)
        .single();
      
      if (!error && lastPost) {
        diagnostic.features.posting.lastPost = lastPost.posted_at;
        diagnostic.features.posting.status = 'working';
      } else {
        diagnostic.features.posting.lastPost = 'never';
        diagnostic.features.posting.status = 'never_posted';
      }
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