import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  console.log('🔍 Starting Comprehensive Platform Audit...\n')
  
  try {
    await db.connect()
    
    // 1. Check which platforms have API keys
    const apiKeyStatus = {
      youtube: {
        hasKey: !!process.env.YOUTUBE_API_KEY,
        keyLength: process.env.YOUTUBE_API_KEY?.length || 0,
        isMock: process.env.YOUTUBE_API_KEY === 'mock',
        status: 'checking...'
      },
      giphy: {
        hasKey: !!process.env.GIPHY_API_KEY,
        keyLength: process.env.GIPHY_API_KEY?.length || 0,
        isMock: process.env.GIPHY_API_KEY === 'mock',
        status: 'checking...'
      },
      reddit: {
        hasKey: !!process.env.REDDIT_CLIENT_ID,
        hasSecret: !!process.env.REDDIT_CLIENT_SECRET,
        keyLength: process.env.REDDIT_CLIENT_ID?.length || 0,
        status: 'checking...'
      },
      pixabay: {
        hasKey: !!process.env.PIXABAY_API_KEY,
        keyLength: process.env.PIXABAY_API_KEY?.length || 0,
        isMock: process.env.PIXABAY_API_KEY === 'mock',
        status: 'checking...'
      },
      imgur: {
        hasKey: !!process.env.IMGUR_CLIENT_ID,
        keyLength: process.env.IMGUR_CLIENT_ID?.length || 0,
        status: 'checking...'
      },
      tumblr: {
        hasKey: !!process.env.TUMBLR_CONSUMER_KEY,
        keyLength: process.env.TUMBLR_CONSUMER_KEY?.length || 0,
        status: 'checking...'
      },
      bluesky: {
        hasKey: !!process.env.BLUESKY_IDENTIFIER,
        hasPassword: !!process.env.BLUESKY_PASSWORD,
        status: 'checking...'
      },
      lemmy: {
        hasInstanceUrl: !!process.env.LEMMY_INSTANCE_URL,
        status: 'checking...'
      }
    }
    
    // 2. Get current database content distribution
    const contentDistribution = await db.query(`
      SELECT 
        source_platform,
        content_type,
        COUNT(*) as count,
        ROUND(AVG(CASE WHEN confidence_score IS NOT NULL THEN confidence_score ELSE 0 END), 3) as avg_confidence,
        SUM(CASE WHEN is_approved = 1 THEN 1 ELSE 0 END) as approved_count,
        SUM(CASE WHEN is_posted = 1 THEN 1 ELSE 0 END) as posted_count,
        MAX(created_at) as latest_content
      FROM content_queue
      GROUP BY source_platform, content_type
      ORDER BY source_platform, count DESC
    `)
    
    // 3. Get platform percentages
    const platformTotals = await db.query(`
      SELECT 
        source_platform,
        COUNT(*) as total_items,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM content_queue), 2) as percentage,
        SUM(CASE WHEN content_type = 'video' THEN 1 ELSE 0 END) as videos,
        SUM(CASE WHEN content_type = 'gif' THEN 1 ELSE 0 END) as gifs,
        SUM(CASE WHEN content_type = 'image' THEN 1 ELSE 0 END) as images,
        SUM(CASE WHEN content_type = 'text' THEN 1 ELSE 0 END) as texts,
        SUM(CASE WHEN is_approved = 1 THEN 1 ELSE 0 END) as approved_total,
        MAX(created_at) as latest_activity
      FROM content_queue
      GROUP BY source_platform
      ORDER BY total_items DESC
    `)
    
    // 4. Test each platform's API
    
    // Test YouTube
    try {
      if (apiKeyStatus.youtube.hasKey && !apiKeyStatus.youtube.isMock) {
        const testUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=test&type=video&maxResults=1&key=${process.env.YOUTUBE_API_KEY}`
        const response = await fetch(testUrl)
        apiKeyStatus.youtube.status = response.ok ? '✅ Real API Working' : `❌ API Error ${response.status}`
      } else {
        apiKeyStatus.youtube.status = '📦 Using Mock Data'
      }
    } catch (e) {
      apiKeyStatus.youtube.status = '❌ Service Error'
    }
    
    // Test Giphy
    try {
      if (apiKeyStatus.giphy.hasKey && !apiKeyStatus.giphy.isMock) {
        const testUrl = `https://api.giphy.com/v1/gifs/search?api_key=${process.env.GIPHY_API_KEY}&q=test&limit=1`
        const response = await fetch(testUrl)
        apiKeyStatus.giphy.status = response.ok ? '✅ Real API Working' : `❌ API Error ${response.status}`
      } else {
        apiKeyStatus.giphy.status = '📦 Using Mock Data'
      }
    } catch (e) {
      apiKeyStatus.giphy.status = '❌ Service Error'
    }
    
    // Test Reddit
    try {
      if (apiKeyStatus.reddit.hasKey && apiKeyStatus.reddit.hasSecret) {
        // Reddit requires OAuth but we can test basic endpoint access
        const response = await fetch('https://www.reddit.com/r/test.json?limit=1')
        apiKeyStatus.reddit.status = response.ok ? '✅ Basic Access Working' : `❌ API Error ${response.status}`
      } else {
        apiKeyStatus.reddit.status = '📦 Missing Credentials'
      }
    } catch (e) {
      apiKeyStatus.reddit.status = '❌ Service Error'
    }
    
    // Test Pixabay
    try {
      if (apiKeyStatus.pixabay.hasKey && !apiKeyStatus.pixabay.isMock) {
        const testUrl = `https://pixabay.com/api/?key=${process.env.PIXABAY_API_KEY}&q=test&per_page=3`
        const response = await fetch(testUrl)
        apiKeyStatus.pixabay.status = response.ok ? '✅ Real API Working' : `❌ API Error ${response.status}`
      } else {
        apiKeyStatus.pixabay.status = '📦 Using Mock Data'
      }
    } catch (e) {
      apiKeyStatus.pixabay.status = '❌ Service Error'
    }
    
    // Test Imgur
    try {
      if (apiKeyStatus.imgur.hasKey) {
        const response = await fetch('https://api.imgur.com/3/gallery/hot/viral/0.json', {
          headers: { 'Authorization': `Client-ID ${process.env.IMGUR_CLIENT_ID}` }
        })
        apiKeyStatus.imgur.status = response.ok ? '✅ Real API Working' : `❌ API Error ${response.status}`
      } else {
        apiKeyStatus.imgur.status = '📦 Missing Client ID'
      }
    } catch (e) {
      apiKeyStatus.imgur.status = '❌ Service Error'
    }
    
    // Test Tumblr
    try {
      if (apiKeyStatus.tumblr.hasKey) {
        const response = await fetch(`https://api.tumblr.com/v2/blog/tumblr.tumblr.com/info?api_key=${process.env.TUMBLR_CONSUMER_KEY}`)
        apiKeyStatus.tumblr.status = response.ok ? '✅ Real API Working' : `❌ API Error ${response.status}`
      } else {
        apiKeyStatus.tumblr.status = '📦 Missing Consumer Key'
      }
    } catch (e) {
      apiKeyStatus.tumblr.status = '❌ Service Error'
    }
    
    // Test Bluesky
    try {
      if (apiKeyStatus.bluesky.hasKey && apiKeyStatus.bluesky.hasPassword) {
        apiKeyStatus.bluesky.status = '✅ Credentials Available'
      } else {
        apiKeyStatus.bluesky.status = '📦 Missing Credentials'
      }
    } catch (e) {
      apiKeyStatus.bluesky.status = '❌ Service Error'
    }
    
    // Test Lemmy
    try {
      if (apiKeyStatus.lemmy.hasInstanceUrl) {
        const response = await fetch(`${process.env.LEMMY_INSTANCE_URL}/api/v3/site`)
        apiKeyStatus.lemmy.status = response.ok ? '✅ Instance Accessible' : `❌ Instance Error ${response.status}`
      } else {
        apiKeyStatus.lemmy.status = '📦 No Instance URL'
      }
    } catch (e) {
      apiKeyStatus.lemmy.status = '❌ Service Error'
    }
    
    // 5. Analyze content type problems
    const contentTypeAnalysis = await db.query(`
      SELECT 
        content_type,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM content_queue), 2) as percentage,
        GROUP_CONCAT(DISTINCT source_platform) as platforms_providing,
        SUM(CASE WHEN is_approved = 1 THEN 1 ELSE 0 END) as approved_count,
        ROUND(SUM(CASE WHEN is_approved = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as approval_rate
      FROM content_queue
      GROUP BY content_type
      ORDER BY count DESC
    `)
    
    // 6. Find out why we have no videos/few GIFs
    const videoGifAnalysis = await db.query(`
      SELECT 
        source_platform,
        SUM(CASE WHEN content_type = 'video' THEN 1 ELSE 0 END) as video_count,
        SUM(CASE WHEN content_type = 'gif' THEN 1 ELSE 0 END) as gif_count,
        SUM(CASE WHEN content_type = 'image' THEN 1 ELSE 0 END) as image_count,
        SUM(CASE WHEN content_type = 'text' THEN 1 ELSE 0 END) as text_count,
        COUNT(*) as total_from_platform,
        MAX(created_at) as last_content_date
      FROM content_queue
      GROUP BY source_platform
      ORDER BY total_from_platform DESC
    `)
    
    // 7. Get recent scanning activity
    const recentActivity = await db.query(`
      SELECT 
        source_platform,
        COUNT(*) as items_today,
        MIN(created_at) as first_today,
        MAX(created_at) as last_today
      FROM content_queue
      WHERE created_at > datetime('now', '-1 day')
      GROUP BY source_platform
      ORDER BY items_today DESC
    `)
    
    // 8. Get total counts
    const totalStats = await db.query(`
      SELECT 
        COUNT(*) as total_content,
        SUM(CASE WHEN is_approved = 1 THEN 1 ELSE 0 END) as approved_content,
        SUM(CASE WHEN is_posted = 1 THEN 1 ELSE 0 END) as posted_content,
        SUM(CASE WHEN content_type = 'video' THEN 1 ELSE 0 END) as total_videos,
        SUM(CASE WHEN content_type = 'gif' THEN 1 ELSE 0 END) as total_gifs,
        SUM(CASE WHEN content_type = 'image' THEN 1 ELSE 0 END) as total_images,
        SUM(CASE WHEN content_type = 'text' THEN 1 ELSE 0 END) as total_texts
      FROM content_queue
    `)
    
    // 9. Generate comprehensive report
    const report = {
      summary: totalStats.rows[0],
      apiStatus: apiKeyStatus,
      platformDistribution: platformTotals.rows,
      contentTypes: contentTypeAnalysis.rows,
      videoGifSources: videoGifAnalysis.rows,
      recentActivity: recentActivity.rows,
      detailedBreakdown: contentDistribution.rows,
      criticalIssues: [],
      recommendations: []
    }
    
    // 10. Identify critical issues
    const videoPercentage = contentTypeAnalysis.rows.find(c => c.content_type === 'video')?.percentage || 0
    const gifPercentage = contentTypeAnalysis.rows.find(c => c.content_type === 'gif')?.percentage || 0
    
    if (videoPercentage < 10) {
      report.criticalIssues.push(`🔴 Videos at ${videoPercentage}% (target: 30%)`)
      report.recommendations.push('Fix YouTube service or enable Reddit/Imgur video scanning')
    }
    
    if (gifPercentage < 15) {
      report.criticalIssues.push(`🔴 GIFs at ${gifPercentage}% (target: 25%)`)
      report.recommendations.push('Fix Giphy service or enable Imgur/Reddit GIF scanning')
    }
    
    // Check if video/GIF platforms are working
    if (apiKeyStatus.youtube.status.includes('Mock') || apiKeyStatus.youtube.status.includes('Error')) {
      report.criticalIssues.push('🔴 YouTube not working - no real videos being added')
    }
    if (apiKeyStatus.giphy.status.includes('Mock') || apiKeyStatus.giphy.status.includes('Error')) {
      report.criticalIssues.push('🔴 Giphy not working - no real GIFs being added')
    }
    
    // Check for platforms with no recent activity
    const activePlatforms = recentActivity.rows.map(r => r.source_platform)
    const allKnownPlatforms = ['youtube', 'giphy', 'reddit', 'pixabay', 'imgur', 'tumblr', 'bluesky', 'lemmy']
    const inactivePlatforms = allKnownPlatforms.filter(p => !activePlatforms.includes(p))
    
    if (inactivePlatforms.length > 0) {
      report.criticalIssues.push(`⚠️ Inactive platforms (24h): ${inactivePlatforms.join(', ')}`)
    }
    
    // Add specific recommendations
    if (videoPercentage === 0) {
      report.recommendations.push('URGENT: No videos found - YouTube service likely broken')
    }
    if (gifPercentage < 5) {
      report.recommendations.push('URGENT: Very few GIFs - Giphy service likely broken')  
    }
    
    console.log('📊 PLATFORM AUDIT COMPLETE')
    console.log('API Status Summary:')
    Object.entries(apiKeyStatus).forEach(([platform, status]) => {
      console.log(`  ${platform}: ${status.status}`)
    })
    console.log('Critical Issues:', report.criticalIssues)
    
    return NextResponse.json(report, { status: 200 })
    
  } catch (error) {
    console.error('❌ Platform audit failed:', error)
    return NextResponse.json({
      error: 'Platform audit failed',
      message: error.message
    }, { status: 500 })
  } finally {
    await db.disconnect()
  }
}