#!/usr/bin/env tsx

import { db } from '../lib/db'

console.log('🧪 Comprehensive YouTube API Test - Getting Real Content...\n')

async function main() {
  try {
    const YOUTUBE_API_KEY = 'AIzaSyBUeB1_I_qu3Tl2zu0JD5tdC6NuVXwiKxA'
    const searchTerms = [
      "hotdog eating contest", 
      "hotdog recipe", 
      "hotdog review", 
      "hotdog challenge", 
      "hotdog cooking"
    ]
    
    let totalNewVideos = 0
    
    for (const searchTerm of searchTerms) {
      console.log(`\n🔍 Searching for: "${searchTerm}"`)
      
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?` + 
        `part=snippet&q=${encodeURIComponent(searchTerm)}&type=video&` +
        `maxResults=10&key=${YOUTUBE_API_KEY}`
      
      const response = await fetch(searchUrl)
      const data = await response.json()
      
      if (!response.ok) {
        console.error('   ❌ API Error:', data.error?.message)
        continue
      }
      
      console.log(`   ✅ Found ${data.items?.length || 0} videos`)
      
      if (data.items && data.items.length > 0) {
        // Get video details
        const videoIds = data.items.map((item: any) => item.id.videoId).join(',')
        const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?` +
          `part=snippet,statistics,contentDetails&` +
          `id=${videoIds}&key=${YOUTUBE_API_KEY}`
        
        const detailsResponse = await fetch(detailsUrl)
        const detailsData = await detailsResponse.json()
        
        if (detailsResponse.ok && detailsData.items) {
          // Store videos in database
          for (let i = 0; i < data.items.length; i++) {
            const video = data.items[i]
            const details = detailsData.items[i]
            
            try {
              const crypto = require('crypto')
              const contentHash = crypto.createHash('sha256')
                .update(`${video.snippet.title}${video.id.videoId}`)
                .digest('hex')
              
              const insertResult = await db.query(`
                INSERT INTO content_queue (
                  content_text, content_type, content_image_url, content_video_url,
                  source_platform, original_url, original_author, scraped_at, 
                  created_at, content_hash, is_approved
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), $8, true)
                RETURNING id
              `, [
                video.snippet.title + '\n' + video.snippet.description,
                'video',
                video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.default?.url,
                `https://www.youtube.com/watch?v=${video.id.videoId}`,
                'youtube',
                `https://www.youtube.com/watch?v=${video.id.videoId}`,
                video.snippet.channelTitle,
                contentHash
              ])
              
              if (insertResult.rows.length > 0) {
                totalNewVideos++
                console.log(`     ✅ Stored: ${video.snippet.title.substring(0, 50)}... (ID: ${insertResult.rows[0].id})`)
              }
              
            } catch (dbError: any) {
              if (dbError.code === '23505') {
                console.log(`     ℹ️  Duplicate: ${video.snippet.title.substring(0, 50)}...`)
              } else {
                console.log(`     ❌ Error storing: ${dbError.message}`)
              }
            }
          }
        }
      }
    }
    
    console.log(`\n📊 Summary: ${totalNewVideos} new videos added to database`)
    
    // Final verification
    console.log('\n5. Final database verification...')
    const finalCount = await db.query(`
      SELECT COUNT(*) as total 
      FROM content_queue 
      WHERE source_platform = 'youtube' 
      AND content_video_url LIKE '%watch?v=%'
    `)
    
    console.log(`   ✅ Total real YouTube videos in database: ${finalCount.rows[0].total}`)
    
    // Show sample of recent videos
    const recentVideos = await db.query(`
      SELECT content_video_url, LEFT(content_text, 60) as preview
      FROM content_queue 
      WHERE source_platform = 'youtube'
      ORDER BY created_at DESC 
      LIMIT 5
    `)
    
    console.log('\n   Recent YouTube videos:')
    recentVideos.rows.forEach((row: any) => {
      console.log(`   - ${row.content_video_url}`)
      console.log(`     "${row.preview}..."`)
    })
    
    console.log('\n🎉 Comprehensive YouTube test completed successfully!')
    
  } catch (error) {
    console.error('\n❌ Test failed:', error)
  } finally {
    process.exit(0)
  }
}

main()