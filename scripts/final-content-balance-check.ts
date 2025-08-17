#!/usr/bin/env node

import { db } from '../lib/db'
import { loadEnv } from '../lib/env'

// Ensure environment variables are loaded
loadEnv()

async function finalContentBalanceCheck() {
  console.log('📊 FINAL CONTENT BALANCE CHECK')
  console.log('=============================\n')
  
  try {
    await db.connect()
    
    // 1. Current distribution
    console.log('📈 CURRENT CONTENT DISTRIBUTION:')
    const currentStats = await db.query(`
      SELECT 
        content_type,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM content_queue), 2) as percentage
      FROM content_queue
      GROUP BY content_type
      ORDER BY count DESC
    `)
    
    let totalContent = 0
    currentStats.rows.forEach((stat: any) => {
      const target = getTargetPercentage(stat.content_type)
      const status = getStatusEmoji(stat.percentage, target)
      const gap = (stat.percentage - target).toFixed(1)
      console.log(`  ${status} ${stat.content_type.toUpperCase()}: ${stat.count} (${stat.percentage}%) - target: ${target}% (${gap > 0 ? '+' : ''}${gap}%)`)
      totalContent += stat.count
    })
    
    // 2. Platform distribution
    console.log('\n🏢 PLATFORM DISTRIBUTION:')
    const platformStats = await db.query(`
      SELECT 
        source_platform,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM content_queue), 2) as percentage,
        SUM(CASE WHEN content_type = 'video' THEN 1 ELSE 0 END) as videos,
        SUM(CASE WHEN content_type = 'gif' THEN 1 ELSE 0 END) as gifs,
        SUM(CASE WHEN content_type = 'image' THEN 1 ELSE 0 END) as images
      FROM content_queue
      GROUP BY source_platform
      ORDER BY count DESC
    `)
    
    platformStats.rows.forEach((platform: any) => {
      const status = platform.percentage > 40 ? '🔴' : platform.percentage > 20 ? '⚠️' : '✅'
      console.log(`  ${status} ${platform.source_platform.toUpperCase()}: ${platform.count} (${platform.percentage}%)`)
      console.log(`      Videos: ${platform.videos}, GIFs: ${platform.gifs}, Images: ${platform.images}`)
    })
    
    // 3. Approved content analysis
    console.log('\n✅ APPROVED CONTENT BREAKDOWN:')
    const approvedStats = await db.query(`
      SELECT 
        content_type,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM content_queue WHERE is_approved = 1), 2) as percentage
      FROM content_queue
      WHERE is_approved = 1
      GROUP BY content_type
      ORDER BY count DESC
    `)
    
    if (approvedStats.rows.length > 0) {
      approvedStats.rows.forEach((stat: any) => {
        console.log(`  📝 ${stat.content_type.toUpperCase()}: ${stat.count} approved (${stat.percentage}% of approved content)`)
      })
    } else {
      console.log('  ⚠️  No approved content found')
    }
    
    // 4. Balance assessment
    console.log('\n🎯 BALANCE ASSESSMENT:')
    const videoStat = currentStats.rows.find((s: any) => s.content_type === 'video')
    const gifStat = currentStats.rows.find((s: any) => s.content_type === 'gif')
    const imageStat = currentStats.rows.find((s: any) => s.content_type === 'image')
    
    const videoProgress = videoStat ? (videoStat.percentage / 30 * 100).toFixed(1) : '0'
    const gifProgress = gifStat ? (gifStat.percentage / 25 * 100).toFixed(1) : '0'
    const imageBalance = imageStat ? imageStat.percentage <= 45 ? 'GOOD' : 'HIGH' : 'UNKNOWN'
    
    console.log(`  🎬 Video Progress: ${videoProgress}% to target (${videoStat?.percentage || 0}% / 30%)`)
    console.log(`  🎞️ GIF Progress: ${gifProgress}% to target (${gifStat?.percentage || 0}% / 25%)`)
    console.log(`  🖼️ Image Balance: ${imageBalance} (${imageStat?.percentage || 0}% vs 40% target)`)
    
    // 5. Next steps recommendations
    console.log('\n📋 NEXT STEPS RECOMMENDATIONS:')
    
    if ((videoStat?.percentage || 0) < 25) {
      console.log('  🎬 PRIORITY: Need more video content')
      console.log('    - Run more YouTube scans')
      console.log('    - Add Reddit video content')
      console.log('    - Consider Lemmy video posts')
    }
    
    if ((gifStat?.percentage || 0) < 20) {
      console.log('  🎞️ PRIORITY: Need more GIF content')
      console.log('    - Fix Giphy API authentication')
      console.log('    - Scan Reddit GIF subreddits')
      console.log('    - Add Imgur GIF content')
    }
    
    if ((imageStat?.percentage || 0) > 45) {
      console.log('  🖼️ PRIORITY: Still too many images')
      console.log('    - Continue Pixabay removal')
      console.log('    - Limit image platform scanning')
      console.log('    - Focus on video/GIF sources only')
    }
    
    console.log(`\n📊 TOTAL CONTENT: ${totalContent} items`)
    console.log('🎉 BALANCE CHECK COMPLETED!')
    
  } catch (error) {
    console.error('❌ Balance check failed:', error)
  } finally {
    await db.disconnect()
  }
}

function getTargetPercentage(contentType: string): number {
  const targets = {
    video: 30,
    gif: 25,
    image: 40,
    text: 5
  }
  return targets[contentType as keyof typeof targets] || 0
}

function getStatusEmoji(current: number, target: number): string {
  const diff = Math.abs(current - target)
  if (diff <= 5) return '✅'
  if (diff <= 15) return '⚠️'
  return '🔴'
}

// Run the balance check
finalContentBalanceCheck().catch(console.error)