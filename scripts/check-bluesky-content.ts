#!/usr/bin/env tsx

import { db } from '../lib/db'

async function checkBlueSkyContent() {
  try {
    console.log('🔍 Checking Bluesky Content in Database...\n')
    
    // First check if we can connect
    await db.connect()
    console.log('✅ Database connected successfully')
    
    // Check if content_queue table exists
    console.log('\n📋 Checking for content_queue table...')
    try {
      const tableCheck = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'content_queue'
        )
      `)
      
      if (!tableCheck.rows[0].exists) {
        console.log('❌ content_queue table does not exist')
        return
      }
      console.log('✅ content_queue table exists')
    } catch (err: any) {
      // For SQLite, try a different approach
      console.log('🔄 Using SQLite-compatible table check...')
      try {
        await db.query(`SELECT COUNT(*) FROM content_queue LIMIT 1`)
        console.log('✅ content_queue table exists')
      } catch (sqliteErr: any) {
        console.log(`❌ content_queue table not accessible: ${sqliteErr.message}`)
        return
      }
    }
    
    console.log('\n📱 Bluesky Content Analysis:')
    
    // Main analysis query
    const blueSkyAnalysis = await db.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN content_image_url IS NOT NULL AND content_image_url != '' THEN 1 ELSE 0 END) as with_images,
        SUM(CASE WHEN content_video_url IS NOT NULL AND content_video_url != '' THEN 1 ELSE 0 END) as with_videos,
        AVG(LENGTH(content_text)) as avg_text_length,
        MIN(LENGTH(content_text)) as min_text_length,
        MAX(LENGTH(content_text)) as max_text_length,
        SUM(CASE 
          WHEN (content_image_url IS NOT NULL AND content_image_url != '') 
           AND (content_video_url IS NOT NULL AND content_video_url != '') 
          THEN 1 ELSE 0 
        END) as with_both_media,
        SUM(CASE 
          WHEN (content_image_url IS NULL OR content_image_url = '') 
           AND (content_video_url IS NULL OR content_video_url = '') 
          THEN 1 ELSE 0 
        END) as text_only
      FROM content_queue
      WHERE source_platform = 'bluesky'
    `)
    
    if (blueSkyAnalysis.rows.length > 0) {
      const stats = blueSkyAnalysis.rows[0]
      const total = parseInt(stats.total)
      
      console.log(`  Total Bluesky posts: ${total}`)
      
      if (total > 0) {
        const withImages = parseInt(stats.with_images)
        const withVideos = parseInt(stats.with_videos)
        const withBothMedia = parseInt(stats.with_both_media)
        const textOnly = parseInt(stats.text_only)
        
        console.log(`  With images: ${withImages} (${((withImages / total) * 100).toFixed(1)}%)`)
        console.log(`  With videos: ${withVideos} (${((withVideos / total) * 100).toFixed(1)}%)`)
        console.log(`  With both media: ${withBothMedia}`)
        console.log(`  Text only: ${textOnly} (${((textOnly / total) * 100).toFixed(1)}%)`)
        console.log(`  Avg text length: ${stats.avg_text_length ? Math.round(stats.avg_text_length) : 0} chars`)
        console.log(`  Text length range: ${stats.min_text_length || 0} - ${stats.max_text_length || 0} chars`)
        
        // Sample some posts to see actual content
        console.log('\n  📝 Sample Bluesky posts:')
        const samples = await db.query(`
          SELECT 
            content_text,
            content_image_url IS NOT NULL AND content_image_url != '' as has_image,
            content_video_url IS NOT NULL AND content_video_url != '' as has_video,
            LENGTH(content_text) as text_length,
            content_image_url,
            content_video_url
          FROM content_queue 
          WHERE source_platform = 'bluesky' 
          ORDER BY created_at DESC 
          LIMIT 5
        `)
        
        for (let i = 0; i < samples.rows.length; i++) {
          const sample = samples.rows[i]
          const truncatedText = sample.content_text?.substring(0, 100) + (sample.content_text?.length > 100 ? '...' : '')
          console.log(`    ${i + 1}. [${sample.text_length} chars] ${sample.has_image ? '🖼️' : ''}${sample.has_video ? '🎥' : ''} "${truncatedText}"`)
          
          // Show media URLs if present
          if (sample.content_image_url) {
            console.log(`       Image: ${sample.content_image_url.substring(0, 80)}...`)
          }
          if (sample.content_video_url) {
            console.log(`       Video: ${sample.content_video_url.substring(0, 80)}...`)
          }
        }
        
        // Additional media analysis
        console.log('\n  🎬 Media Type Analysis:')
        const mediaAnalysis = await db.query(`
          SELECT 
            content_image_url,
            content_video_url
          FROM content_queue 
          WHERE source_platform = 'bluesky'
            AND (content_image_url IS NOT NULL OR content_video_url IS NOT NULL)
            AND (content_image_url != '' OR content_video_url != '')
          LIMIT 10
        `)
        
        const imageExtensions = new Set()
        const videoExtensions = new Set()
        const imageDomains = new Set()
        const videoDomains = new Set()
        
        for (const row of mediaAnalysis.rows) {
          if (row.content_image_url && row.content_image_url.trim() !== '') {
            try {
              const url = new URL(row.content_image_url)
              imageDomains.add(url.hostname)
              const ext = url.pathname.split('.').pop()?.toLowerCase()
              if (ext) imageExtensions.add(ext)
            } catch (e) {
              // Skip invalid URLs
            }
          }
          
          if (row.content_video_url && row.content_video_url.trim() !== '') {
            try {
              const url = new URL(row.content_video_url)
              videoDomains.add(url.hostname)
              const ext = url.pathname.split('.').pop()?.toLowerCase()
              if (ext) videoExtensions.add(ext)
            } catch (e) {
              // Skip invalid URLs
            }
          }
        }
        
        if (imageExtensions.size > 0) {
          console.log(`    Image formats found: ${Array.from(imageExtensions).join(', ')}`)
        }
        if (videoExtensions.size > 0) {
          console.log(`    Video formats found: ${Array.from(videoExtensions).join(', ')}`)
        }
        if (imageDomains.size > 0) {
          console.log(`    Image domains: ${Array.from(imageDomains).join(', ')}`)
        }
        if (videoDomains.size > 0) {
          console.log(`    Video domains: ${Array.from(videoDomains).join(', ')}`)
        }
        
      } else {
        console.log('  No Bluesky content found in database')
        
        // Check if there's any content at all
        const totalContent = await db.query('SELECT COUNT(*) as count FROM content_queue')
        console.log(`  Total content in database: ${totalContent.rows[0].count}`)
        
        // Show what platforms we do have
        const platforms = await db.query(`
          SELECT source_platform, COUNT(*) as count 
          FROM content_queue 
          GROUP BY source_platform 
          ORDER BY count DESC
        `)
        
        console.log('  Available platforms:')
        for (const platform of platforms.rows) {
          console.log(`    ${platform.source_platform}: ${platform.count}`)
        }
      }
    }
    
    console.log('\n✅ Bluesky content analysis complete')
    
  } catch (error: any) {
    console.error('❌ Analysis failed:', error.message)
    
    // Try to provide helpful debugging info
    if (error.message.includes('relation "content_queue" does not exist')) {
      console.log('\n🔧 The content_queue table does not exist. You may need to run database migrations first.')
    } else if (error.message.includes('Database connection unavailable')) {
      console.log('\n🔧 Database connection failed. Check your database configuration:')
      console.log('  - For development: Ensure SQLite is properly configured or PostgreSQL is running')
      console.log('  - For production: Check your environment variables')
    }
  } finally {
    await db.disconnect()
  }
}

// Run the analysis
checkBlueSkyContent().catch(console.error)