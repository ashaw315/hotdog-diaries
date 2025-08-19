import { NextResponse } from 'next/server';

export async function GET() {
  console.log('🔍 Checking ALL 8 platforms status...\n');
  
  // All 8 platforms
  const platforms = [
    'reddit',
    'youtube', 
    'giphy',
    'pixabay',
    'bluesky',
    'imgur',
    'lemmy',
    'tumblr'
  ];
  
  const results = {
    timestamp: new Date().toISOString(),
    totalPlatforms: 8,
    summary: {
      working: 0,
      configured: 0,
      failed: 0
    },
    platforms: {},
    apiKeys: {},
    scanResults: {}
  };

  // 1. CHECK API KEY CONFIGURATION
  console.log('📝 Checking API configurations...');
  
  results.apiKeys = {
    reddit: {
      configured: !!(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET),
      hasClientId: !!process.env.REDDIT_CLIENT_ID,
      hasSecret: !!process.env.REDDIT_CLIENT_SECRET
    },
    youtube: {
      configured: !!process.env.YOUTUBE_API_KEY,
      keyLength: process.env.YOUTUBE_API_KEY?.length || 0
    },
    giphy: {
      configured: !!process.env.GIPHY_API_KEY,
      keyLength: process.env.GIPHY_API_KEY?.length || 0
    },
    pixabay: {
      configured: !!process.env.PIXABAY_API_KEY,
      keyLength: process.env.PIXABAY_API_KEY?.length || 0
    },
    bluesky: {
      configured: !!(process.env.BLUESKY_HANDLE && process.env.BLUESKY_PASSWORD),
      hasHandle: !!process.env.BLUESKY_HANDLE,
      hasPassword: !!process.env.BLUESKY_PASSWORD
    },
    imgur: {
      configured: !!process.env.IMGUR_CLIENT_ID,
      hasClientId: !!process.env.IMGUR_CLIENT_ID
    },
    lemmy: {
      configured: true, // Lemmy doesn't require API keys
      note: 'No API key required'
    },
    tumblr: {
      configured: !!(process.env.TUMBLR_CONSUMER_KEY && process.env.TUMBLR_CONSUMER_SECRET),
      hasKey: !!process.env.TUMBLR_CONSUMER_KEY,
      hasSecret: !!process.env.TUMBLR_CONSUMER_SECRET
    }
  };

  // Count configured platforms
  results.summary.configured = Object.values(results.apiKeys).filter(p => p.configured).length;

  // 2. TEST EACH PLATFORM'S STATUS ENDPOINT
  console.log('🔍 Testing platform status endpoints...\n');
  
  for (const platform of platforms) {
    console.log(`Testing ${platform}...`);
    
    try {
      // Test the status endpoint first
      const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
      const statusUrl = `${baseUrl}/api/admin/${platform}/status`;
      
      const response = await fetch(statusUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        results.platforms[platform] = {
          status: '✅ WORKING',
          success: true,
          authentication: data.authentication || 'unknown',
          health: data.health || 'unknown',
          contentFound: data.contentFound || 0,
          message: data.message || 'Status check successful'
        };
        results.summary.working++;
      } else if (response.status === 404) {
        results.platforms[platform] = {
          status: '⚠️ NOT IMPLEMENTED',
          success: false,
          error: 'Status endpoint not found',
          details: 'Platform may not be implemented yet'
        };
        results.summary.failed++;
      } else {
        const errorText = await response.text();
        results.platforms[platform] = {
          status: '❌ FAILED',
          success: false,
          error: `HTTP ${response.status}`,
          details: errorText.substring(0, 200)
        };
        results.summary.failed++;
      }
    } catch (error) {
      results.platforms[platform] = {
        status: '❌ ERROR',
        success: false,
        error: error.message
      };
      results.summary.failed++;
    }
    
    // Also test if scanning endpoint exists
    try {
      const scanUrl = `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/admin/${platform}/scan`;
      const scanResponse = await fetch(scanUrl, { method: 'HEAD' });
      
      if (scanResponse.status !== 404) {
        results.platforms[platform].scanEndpoint = '✅ Scan endpoint exists';
      } else {
        results.platforms[platform].scanEndpoint = '❌ No scan endpoint';
      }
    } catch (e) {
      results.platforms[platform].scanEndpoint = '❌ Scan test failed';
    }
  }

  // 3. CHECK ACTUAL CONTENT FROM PLATFORMS
  console.log('\n📊 Checking content in database...');
  
  try {
    // Try to connect to database and get content stats
    const { sql } = await import('@vercel/postgres');
    
    const contentByPlatform = await sql`
      SELECT 
        source_platform,
        COUNT(*) as total,
        SUM(CASE WHEN is_approved = true THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN is_posted = true THEN 1 ELSE 0 END) as posted
      FROM content_queue
      GROUP BY source_platform
    `;
    
    results.scanResults.contentInDatabase = {};
    contentByPlatform.rows?.forEach(row => {
      results.scanResults.contentInDatabase[row.source_platform] = {
        total: parseInt(row.total),
        approved: parseInt(row.approved),
        posted: parseInt(row.posted)
      };
    });
    
    results.scanResults.totalContent = contentByPlatform.rows?.reduce((sum, row) => sum + parseInt(row.total), 0) || 0;
    
  } catch (error) {
    results.scanResults.error = error.message;
    results.scanResults.databaseConnected = false;
  }

  // 4. GENERATE SUMMARY REPORT
  const report = {
    '🎯 PLATFORM STATUS': `${results.summary.working}/8 platforms working`,
    '🔑 API KEYS': `${results.summary.configured}/8 platforms configured`,
    '📊 CONTENT': results.scanResults.totalContent || 0,
    
    '✅ WORKING PLATFORMS': Object.entries(results.platforms)
      .filter(([_, data]) => data.success)
      .map(([name]) => name),
    
    '❌ FAILED PLATFORMS': Object.entries(results.platforms)
      .filter(([_, data]) => !data.success)
      .map(([name, data]) => `${name} (${data.error})`),
    
    '🔑 MISSING API KEYS': Object.entries(results.apiKeys)
      .filter(([_, data]) => !data.configured)
      .map(([name]) => name),
    
    '📋 RECOMMENDATIONS': []
  };

  // Add recommendations
  if (results.summary.configured < 8) {
    report['📋 RECOMMENDATIONS'].push(`Add API keys for: ${report['🔑 MISSING API KEYS'].join(', ')}`);
  }
  
  if (results.summary.working < results.summary.configured) {
    report['📋 RECOMMENDATIONS'].push('Some configured platforms are failing - check error logs');
  }
  
  if (results.scanResults.totalContent === 0) {
    report['📋 RECOMMENDATIONS'].push('No content in database - run initial scan');
  }

  const notImplemented = Object.entries(results.platforms)
    .filter(([_, data]) => data.status === '⚠️ NOT IMPLEMENTED')
    .map(([name]) => name);
    
  if (notImplemented.length > 0) {
    report['📋 RECOMMENDATIONS'].push(`Implement missing platforms: ${notImplemented.join(', ')}`);
  }

  // 5. DETAILED PLATFORM BREAKDOWN
  console.log('\n' + '='.repeat(50));
  console.log('📊 COMPLETE PLATFORM ASSESSMENT');
  console.log('='.repeat(50));
  
  platforms.forEach(platform => {
    const status = results.platforms[platform];
    const apiKey = results.apiKeys[platform];
    const content = results.scanResults.contentInDatabase?.[platform];
    
    console.log(`\n${platform.toUpperCase()}:`);
    console.log(`  Status: ${status?.status || 'Unknown'}`);
    console.log(`  API Key: ${apiKey?.configured ? '✅ Configured' : '❌ Missing'}`);
    console.log(`  Content: ${content?.total || 0} items`);
    console.log(`  Scan Endpoint: ${status?.scanEndpoint || 'Unknown'}`);
    if (status?.error) {
      console.log(`  Error: ${status.error}`);
    }
  });
  
  console.log('\n' + '='.repeat(50));
  console.log(`FINAL: ${results.summary.working}/8 platforms operational`);
  console.log('='.repeat(50) + '\n');

  return NextResponse.json({
    success: true,
    results,
    report
  }, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
}