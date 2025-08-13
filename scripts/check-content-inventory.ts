#!/usr/bin/env npx tsx

import { db } from '@/lib/db'

async function checkContent() {
  await db.connect()
  
  console.log('=== CONTENT INVENTORY BY PLATFORM ===\n')
  
  // Get sample content from each platform
  const platforms = ['youtube', 'pixabay', 'imgur', 'reddit', 'lemmy', 'tumblr', 'bluesky', 'giphy']
  
  for (const platform of platforms) {
    console.log(`\n--- ${platform.toUpperCase()} ---`)
    
    const samples = await db.query(`
      SELECT 
        id,
        content_text,
        content_type,
        content_image_url,
        content_video_url,
        is_approved,
        is_posted
      FROM content_queue 
      WHERE source_platform = ?
      ORDER BY id DESC
      LIMIT 3
    `, [platform])
    
    if (samples.rows.length === 0) {
      console.log('No content found')
      continue
    }
    
    samples.rows.forEach((row, i) => {
      console.log(`\n${i + 1}. ID ${row.id}: ${row.content_text?.substring(0, 50) || 'No text'}...`)
      console.log(`   Type: ${row.content_type}`)
      console.log(`   Image URL: ${row.content_image_url ? 'Yes' : 'No'}`)
      console.log(`   Video URL: ${row.content_video_url ? 'Yes' : 'No'}`)
      console.log(`   Approved: ${row.is_approved}, Posted: ${row.is_posted}`)
    })
  }
  
  // Get overall stats
  console.log('\n\n=== OVERALL STATISTICS ===')
  const stats = await db.query(`
    SELECT 
      source_platform,
      content_type,
      COUNT(*) as count
    FROM content_queue
    GROUP BY source_platform, content_type
    ORDER BY source_platform, content_type
  `)
  
  console.log('\nContent by Platform and Type:')
  let currentPlatform = ''
  stats.rows.forEach(row => {
    if (row.source_platform !== currentPlatform) {
      currentPlatform = row.source_platform
      console.log(`\n${currentPlatform}:`)
    }
    console.log(`  ${row.content_type}: ${row.count}`)
  })
  
  await db.disconnect()
}

checkContent().catch(console.error)