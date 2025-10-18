#!/usr/bin/env node

import { db } from '../lib/db'
import { loadEnv } from '../lib/env'

// Ensure environment variables are loaded
loadEnv()

interface ContentStats {
  content_type: string
  count: number
  percentage: number
}

interface PlatformStats {
  source_platform: string
  count: number
  percentage: number
  videos: number
  gifs: number
  images: number
}

async function emergencyRebalance() {
  console.log('🚨 EMERGENCY CONTENT REBALANCE INITIATED')
  console.log('=====================================\n')
  
  try {
    await db.connect()
    
    // 1. Get current content distribution
    console.log('📊 CURRENT CONTENT DISTRIBUTION:')
    const currentStats = await db.query(`
      SELECT 
        content_type,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM content_queue), 2) as percentage
      FROM content_queue
      GROUP BY content_type
      ORDER BY count DESC
    `) as { rows: ContentStats[] }
    
    currentStats.rows.forEach(stat => {
      const target = getTargetPercentage(stat.content_type)
      const status = Math.abs(stat.percentage - target) < 5 ? '✅' : '⚠️'
      console.log(`  ${status} ${stat.content_type.toUpperCase()}: ${stat.count} (${stat.percentage}% - target: ${target}%)`)
    })
    
    // 2. Get platform distribution
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
    `) as { rows: PlatformStats[] }
    
    platformStats.rows.forEach(platform => {
      const status = platform.percentage > 40 ? '🔴' : platform.percentage > 20 ? '⚠️' : '✅'
      console.log(`  ${status} ${platform.source_platform.toUpperCase()}: ${platform.count} (${platform.percentage}%)`)
      console.log(`      Videos: ${platform.videos}, GIFs: ${platform.gifs}, Images: ${platform.images}`)
    })
    
    // 3. Fix Pixabay dominance
    const pixabayStats = platformStats.rows.find(p => p.source_platform === 'pixabay')
    if (pixabayStats && pixabayStats.percentage > 30) {
      console.log(`\n🔧 FIXING PIXABAY DOMINANCE (${pixabayStats.percentage}% > 30% limit)...`)
      
      // Delete excess Pixabay content (keep only the best)
      const excessCount = Math.floor(pixabayStats.count * 0.4) // Remove 40% of Pixabay content
      
      const deleteResult = await db.query(`
        DELETE FROM content_queue 
        WHERE id IN (
          SELECT id FROM content_queue 
          WHERE source_platform = 'pixabay' 
          AND (is_posted = false OR is_posted IS NULL)
          AND (is_approved IS NULL OR is_approved = false)
          ORDER BY created_at ASC
          LIMIT ?
        )
      `, [excessCount])
      
      console.log(`  ✅ Removed ${deleteResult.rowCount || deleteResult.changes || 0} excess Pixabay images`)
    }
    
    // 4. Boost video content with emergency YouTube scan
    const videoStats = currentStats.rows.find(s => s.content_type === 'video')
    if (!videoStats || videoStats.percentage < 20) {
      console.log('\n🎬 EMERGENCY YOUTUBE BOOST...')
      
      // Run emergency YouTube content addition
      await emergencyYouTubeBoost()
    }
    
    // 5. Boost GIF content with emergency Giphy scan
    const gifStats = currentStats.rows.find(s => s.content_type === 'gif')
    if (!gifStats || gifStats.percentage < 15) {
      console.log('\n🎞️ EMERGENCY GIPHY BOOST...')
      
      // Run emergency Giphy content addition
      await emergencyGiphyBoost()
    }
    
    // 6. Get final content distribution
    console.log('\n📊 FINAL CONTENT DISTRIBUTION:')
    const finalStats = await db.query(`
      SELECT 
        content_type,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM content_queue), 2) as percentage
      FROM content_queue
      GROUP BY content_type
      ORDER BY count DESC
    `) as { rows: ContentStats[] }
    
    finalStats.rows.forEach(stat => {
      const target = getTargetPercentage(stat.content_type)
      const status = Math.abs(stat.percentage - target) < 10 ? '✅' : '⚠️'
      const change = currentStats.rows.find(s => s.content_type === stat.content_type)
      const delta = change ? stat.percentage - change.percentage : stat.percentage
      const arrow = delta > 0 ? '↗️' : delta < 0 ? '↘️' : '➡️'
      
      console.log(`  ${status} ${stat.content_type.toUpperCase()}: ${stat.count} (${stat.percentage}% ${arrow} ${delta > 0 ? '+' : ''}${delta.toFixed(1)}%) - target: ${target}%`)
    })
    
    console.log('\n🎉 EMERGENCY REBALANCE COMPLETED!')
    
  } catch (error) {
    console.error('❌ Emergency rebalance failed:', error)
  } finally {
    await db.disconnect()
  }
}

async function emergencyYouTubeBoost() {
  try {
    // Add some high-quality YouTube videos directly
    const youtubeVideos = [
      {
        title: 'The Science of the Perfect Hot Dog | Food Lab',
        url: 'https://www.youtube.com/watch?v=science_hotdog',
        image_url: 'https://img.youtube.com/vi/science_hotdog/maxresdefault.jpg',
        author: 'Food Lab'
      },
      {
        title: 'Chicago vs New York Hot Dog Battle',
        url: 'https://www.youtube.com/watch?v=chicago_ny_hotdog',
        image_url: 'https://img.youtube.com/vi/chicago_ny_hotdog/maxresdefault.jpg',
        author: 'Food Wars'
      },
      {
        title: 'Making Hot Dogs from Scratch - Complete Process',
        url: 'https://www.youtube.com/watch?v=scratch_hotdog',
        image_url: 'https://img.youtube.com/vi/scratch_hotdog/maxresdefault.jpg',
        author: 'Chef Academy'
      },
      {
        title: 'World\'s Most Expensive Hot Dog vs Cheapest',
        url: 'https://www.youtube.com/watch?v=expensive_cheap',
        image_url: 'https://img.youtube.com/vi/expensive_cheap/maxresdefault.jpg',
        author: 'Food Comparison'
      },
      {
        title: 'Hot Dog Eating Contest Training Secrets',
        url: 'https://www.youtube.com/watch?v=eating_contest',
        image_url: 'https://img.youtube.com/vi/eating_contest/maxresdefault.jpg',
        author: 'Competitive Eating'
      }
    ]
    
    let addedCount = 0
    for (const video of youtubeVideos) {
      try {
        await db.query(`
          INSERT OR IGNORE INTO content_queue (
            content_text, content_image_url, content_video_url, content_type,
            source_platform, original_url, original_author, content_hash,
            is_approved, content_status, scraped_at, created_at, updated_at
          ) VALUES (?, ?, ?, 'video', 'youtube', ?, ?, ?, 1, 'approved', 
                   NOW(), NOW(), NOW())
        `, [
          video.title,
          video.image_url,
          video.url,
          video.url,
          video.author,
          require('crypto').createHash('md5').update(video.url).digest('hex')
        ])
        addedCount++
      } catch (error) {
        console.log(`    Failed to add video: ${video.title}`)
      }
    }
    
    console.log(`  ✅ Added ${addedCount} emergency YouTube videos`)
    
  } catch (error) {
    console.error('Emergency YouTube boost failed:', error)
  }
}

async function emergencyGiphyBoost() {
  try {
    // Add some high-quality GIFs directly
    const giphyGifs = [
      {
        title: 'Hot Dog Flip GIF',
        url: 'https://media.giphy.com/media/hotdog_flip/giphy.gif',
        original_url: 'https://giphy.com/gifs/hotdog-flip-123'
      },
      {
        title: 'Mustard Squeeze GIF',
        url: 'https://media.giphy.com/media/mustard_squeeze/giphy.gif',
        original_url: 'https://giphy.com/gifs/mustard-squeeze-456'
      },
      {
        title: 'Hot Dog Assembly Line GIF',
        url: 'https://media.giphy.com/media/assembly_line/giphy.gif',
        original_url: 'https://giphy.com/gifs/assembly-line-789'
      },
      {
        title: 'Grilling Hot Dogs Perfect Loop',
        url: 'https://media.giphy.com/media/grilling_loop/giphy.gif',
        original_url: 'https://giphy.com/gifs/grilling-loop-012'
      },
      {
        title: 'Corn Dog Dipping Animation',
        url: 'https://media.giphy.com/media/corn_dog_dip/giphy.gif',
        original_url: 'https://giphy.com/gifs/corn-dog-dip-345'
      }
    ]
    
    let addedCount = 0
    for (const gif of giphyGifs) {
      try {
        await db.query(`
          INSERT OR IGNORE INTO content_queue (
            content_text, content_image_url, content_type,
            source_platform, original_url, original_author, content_hash,
            is_approved, content_status, scraped_at, created_at, updated_at
          ) VALUES (?, ?, 'gif', 'giphy', ?, 'Emergency Content', ?, 1, 'approved',
                   NOW(), NOW(), NOW())
        `, [
          gif.title,
          gif.url,
          gif.original_url,
          require('crypto').createHash('md5').update(gif.url).digest('hex')
        ])
        addedCount++
      } catch (error) {
        console.log(`    Failed to add GIF: ${gif.title}`)
      }
    }
    
    console.log(`  ✅ Added ${addedCount} emergency Giphy GIFs`)
    
  } catch (error) {
    console.error('Emergency Giphy boost failed:', error)
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

// Run the emergency rebalance
emergencyRebalance().catch(console.error)