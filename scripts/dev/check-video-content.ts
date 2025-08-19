#!/usr/bin/env tsx

import { db } from '../lib/db'

async function main() {
  try {
    console.log('🎥 Checking video content in database...\n')
    
    // Check total video content
    const totalVideos = await db.query(`
      SELECT COUNT(*) as total 
      FROM content_queue 
      WHERE content_video_url IS NOT NULL
    `)
    
    console.log(`Total videos in database: ${totalVideos.rows[0].total}`)
    
    // Check by platform
    const byPlatform = await db.query(`
      SELECT 
        source_platform, 
        COUNT(*) as count,
        COUNT(CASE WHEN content_video_url LIKE '%youtube%' THEN 1 END) as youtube_urls,
        COUNT(CASE WHEN content_video_url LIKE '%imgur%' THEN 1 END) as imgur_urls
      FROM content_queue 
      WHERE content_video_url IS NOT NULL
      GROUP BY source_platform
      ORDER BY count DESC
    `)
    
    console.log('\nBy platform:')
    byPlatform.rows.forEach(row => {
      console.log(`  ${row.source_platform}: ${row.count} videos`)
      if (row.youtube_urls > 0) console.log(`    - YouTube URLs: ${row.youtube_urls}`)
      if (row.imgur_urls > 0) console.log(`    - Imgur URLs: ${row.imgur_urls}`)
    })
    
    // Show recent video samples
    const recentVideos = await db.query(`
      SELECT 
        id,
        source_platform, 
        content_video_url, 
        LEFT(content_text, 50) as preview,
        created_at
      FROM content_queue 
      WHERE content_video_url IS NOT NULL
      ORDER BY created_at DESC 
      LIMIT 5
    `)
    
    console.log('\nRecent video samples:')
    recentVideos.rows.forEach(row => {
      console.log(`  ${row.id}: [${row.source_platform}] ${row.content_video_url}`)
      console.log(`     "${row.preview}..."`)
    })
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    process.exit(0)
  }
}

main()