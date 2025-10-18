#!/usr/bin/env ts-node

import { db } from '../lib/db'

async function inspectDatabase() {
  try {
    console.log('🔍 Inspecting Database Structure...\n')
    
    // Get all tables
    const tables = await db.query(`
      SELECT tablename 
      FROM pg_catalog.pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename
    `)
    
    console.log('📋 Available Tables:')
    for (const table of tables.rows) {
      console.log(`  - ${table.tablename}`)
    }
    
    console.log('\n📊 Content Queue Info:')
    try {
      const contentCount = await db.query('SELECT COUNT(*) FROM content_queue')
      console.log(`  Content rows: ${contentCount.rows[0].count}`)
      
      const platforms = await db.query(`
        SELECT source_platform, COUNT(*) as count 
        FROM content_queue 
        GROUP BY source_platform 
        ORDER BY source_platform
      `)
      
      console.log('  By platform:')
      for (const platform of platforms.rows) {
        console.log(`    ${platform.source_platform}: ${platform.count}`)
      }
    } catch (err) {
      console.log('  ⚠️  Could not query content_queue')
    }
    
    console.log('\n📱 Bluesky Content Analysis:')
    try {
      const blueSkyAnalysis = await db.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN content_image_url IS NOT NULL THEN 1 ELSE 0 END) as with_images,
          SUM(CASE WHEN content_video_url IS NOT NULL THEN 1 ELSE 0 END) as with_videos,
          AVG(LENGTH(content_text)) as avg_text_length,
          MIN(LENGTH(content_text)) as min_text_length,
          MAX(LENGTH(content_text)) as max_text_length,
          SUM(CASE WHEN content_image_url IS NOT NULL AND content_video_url IS NOT NULL THEN 1 ELSE 0 END) as with_both_media,
          SUM(CASE WHEN content_image_url IS NULL AND content_video_url IS NULL THEN 1 ELSE 0 END) as text_only
        FROM content_queue
        WHERE source_platform = 'bluesky'
      `)
      
      if (blueSkyAnalysis.rows.length > 0) {
        const stats = blueSkyAnalysis.rows[0]
        console.log(`  Total Bluesky posts: ${stats.total}`)
        console.log(`  With images: ${stats.with_images} (${stats.total > 0 ? ((stats.with_images / stats.total) * 100).toFixed(1) : 0}%)`)
        console.log(`  With videos: ${stats.with_videos} (${stats.total > 0 ? ((stats.with_videos / stats.total) * 100).toFixed(1) : 0}%)`)
        console.log(`  With both media: ${stats.with_both_media}`)
        console.log(`  Text only: ${stats.text_only} (${stats.total > 0 ? ((stats.text_only / stats.total) * 100).toFixed(1) : 0}%)`)
        console.log(`  Avg text length: ${stats.avg_text_length ? Math.round(stats.avg_text_length) : 0} chars`)
        console.log(`  Text length range: ${stats.min_text_length || 0} - ${stats.max_text_length || 0} chars`)
        
        // Sample some posts to see actual content
        console.log('\n  📝 Sample Bluesky posts:')
        const samples = await db.query(`
          SELECT 
            content_text,
            content_image_url IS NOT NULL as has_image,
            content_video_url IS NOT NULL as has_video,
            LENGTH(content_text) as text_length
          FROM content_queue 
          WHERE source_platform = 'bluesky' 
          ORDER BY created_at DESC 
          LIMIT 5
        `)
        
        for (let i = 0; i < samples.rows.length; i++) {
          const sample = samples.rows[i]
          const truncatedText = sample.content_text?.substring(0, 100) + (sample.content_text?.length > 100 ? '...' : '')
          console.log(`    ${i + 1}. [${sample.text_length} chars] ${sample.has_image ? '🖼️' : ''}${sample.has_video ? '🎥' : ''} "${truncatedText}"`)
        }
      } else {
        console.log('  No Bluesky content found')
      }
    } catch (err: any) {
      console.log(`  ⚠️  Could not analyze Bluesky content: ${err.message}`)
    }

    console.log('\n🔧 Config Tables:')
    const configTables = [
      'scan_config',
      'reddit_scan_config', 
      'youtube_scan_config',
      'imgur_scan_config',
      'lemmy_scan_config',
      'tumblr_scan_config',
      'pixabay_scan_config',
      'bluesky_scan_config',
      'giphy_scan_config'
    ]
    
    for (const table of configTables) {
      try {
        const exists = await db.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = '${table}'
          )
        `)
        
        if (exists.rows[0].exists) {
          const count = await db.query(`SELECT COUNT(*) FROM ${table}`)
          console.log(`  ✅ ${table} (${count.rows[0].count} rows)`)
          
          // Show columns for config tables
          const columns = await db.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = '${table}'
            ORDER BY column_name
          `)
          console.log(`      Columns: ${columns.rows.map(c => c.column_name).join(', ')}`)
        } else {
          console.log(`  ❌ ${table} (does not exist)`)
        }
      } catch (err: any) {
        console.log(`  ⚠️  ${table} (error: ${err.message})`)
      }
    }
    
  } catch (error) {
    console.error('❌ Database inspection failed:', error)
  }
}

// Run if executed directly
if (require.main === module) {
  inspectDatabase().catch(console.error)
}

export { inspectDatabase }