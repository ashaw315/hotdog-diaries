#!/usr/bin/env tsx

import { db } from '../lib/db'

console.log('🧪 Testing YouTube Scanner Direct API Call...\n')

async function main() {
  try {
    const YOUTUBE_API_KEY = 'AIzaSyBUeB1_I_qu3Tl2zu0JD5tdC6NuVXwiKxA'
    
    console.log('1. Testing direct YouTube API search...')
    
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?` + 
      `part=snippet&q=${encodeURIComponent('hotdog recipe')}&type=video&` +
      `maxResults=10&key=${YOUTUBE_API_KEY}`
    
    console.log('   Search URL:', searchUrl.replace(YOUTUBE_API_KEY, 'KEY_HIDDEN'))
    
    const response = await fetch(searchUrl)
    const data = await response.json()
    
    if (!response.ok) {
      console.error('   ❌ API Error:', data)
      return
    }
    
    console.log(`   ✅ Found ${data.items?.length || 0} videos`)
    
    if (data.items && data.items.length > 0) {
      // Get detailed video information
      const videoIds = data.items.map((item: any) => item.id.videoId).join(',')
      const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?` +
        `part=snippet,statistics,contentDetails&` +
        `id=${videoIds}&key=${YOUTUBE_API_KEY}`
      
      console.log('\n2. Getting video details...')
      const detailsResponse = await fetch(detailsUrl)
      const detailsData = await detailsResponse.json()
      
      if (detailsResponse.ok && detailsData.items) {
        console.log(`   ✅ Got details for ${detailsData.items.length} videos`)
        
        // Show sample of what we'd store
        const sampleVideo = data.items[0]
        const sampleDetails = detailsData.items[0]
        
        console.log('\n3. Sample video to be stored:')
        console.log('   Title:', sampleVideo.snippet.title)
        console.log('   Video ID:', sampleVideo.id.videoId)
        console.log('   Channel:', sampleVideo.snippet.channelTitle)
        console.log('   URL:', `https://www.youtube.com/watch?v=${sampleVideo.id.videoId}`)
        console.log('   Views:', sampleDetails?.statistics?.viewCount || 'N/A')
        console.log('   Duration:', sampleDetails?.contentDetails?.duration || 'N/A')
        
        // Test storing one video in database
        console.log('\n4. Testing database storage...')
        
        const crypto = require('crypto')
        const contentHash = crypto.createHash('sha256')
          .update(`${sampleVideo.snippet.title}${sampleVideo.id.videoId}`)
          .digest('hex')
        
        const insertResult = await db.query(`
          INSERT INTO content_queue (
            content_text, content_type, content_image_url, content_video_url,
            source_platform, original_url, original_author, scraped_at, created_at, content_hash
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), $8)
          RETURNING id
        `, [
          sampleVideo.snippet.title + '\n' + sampleVideo.snippet.description,
          'video',
          sampleVideo.snippet.thumbnails?.high?.url || sampleVideo.snippet.thumbnails?.default?.url,
          `https://www.youtube.com/watch?v=${sampleVideo.id.videoId}`,
          'youtube',
          `https://www.youtube.com/watch?v=${sampleVideo.id.videoId}`,
          sampleVideo.snippet.channelTitle,
          contentHash
        ])
        
        if (insertResult.rows.length > 0) {
          console.log('   ✅ Successfully stored video with ID:', insertResult.rows[0].id)
        } else {
          console.log('   ℹ️  Video already exists (duplicate)')
        }
      }
    }
    
    console.log('\n🎉 Direct API test completed successfully!')
    
  } catch (error) {
    console.error('\n❌ Test failed:', error)
  } finally {
    process.exit(0)
  }
}

main()