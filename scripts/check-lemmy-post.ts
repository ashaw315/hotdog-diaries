#!/usr/bin/env node
process.env.NODE_ENV = 'development'
import { db } from '../lib/db'

async function checkLemmyPost() {
  try {
    await db.connect()
    
    console.log('🔍 Searching for epoxy hot dog Lemmy post...\n')
    
    // Check for the specific post
    const results = await db.query(`
      SELECT 
        id, 
        content_text, 
        content_image_url, 
        content_video_url, 
        source_platform, 
        original_url, 
        original_author,
        content_type,
        scraped_at
      FROM content_queue 
      WHERE (
        content_text ILIKE '%epoxy%' OR 
        content_text ILIKE '%remorseful%' OR 
        original_author ILIKE '%owenfromcanada%'
      ) 
      AND source_platform = 'lemmy' 
      ORDER BY scraped_at DESC 
      LIMIT 5;
    `)
    
    if (results.rows.length === 0) {
      console.log('❌ No matching Lemmy posts found in database')
      
      // Check for any Lemmy posts
      const anyLemmy = await db.query(`
        SELECT COUNT(*) as count, MAX(scraped_at) as latest
        FROM content_queue 
        WHERE source_platform = 'lemmy'
      `)
      
      console.log(`📊 Total Lemmy posts in DB: ${anyLemmy.rows[0]?.count || 0}`)
      console.log(`📅 Latest Lemmy post: ${anyLemmy.rows[0]?.latest || 'None'}`)
      
    } else {
      console.log(`✅ Found ${results.rows.length} matching posts:\n`)
      
      results.rows.forEach((post, index) => {
        console.log(`--- Post ${index + 1} ---`)
        console.log(`ID: ${post.id}`)
        console.log(`Text: ${post.content_text?.substring(0, 100)}...`)
        console.log(`Image URL: ${post.content_image_url || 'None'}`)
        console.log(`Video URL: ${post.content_video_url || 'None'}`)
        console.log(`Content Type: ${post.content_type}`)
        console.log(`Original URL: ${post.original_url}`)
        console.log(`Author: ${post.original_author || 'None'}`)
        console.log(`Scraped: ${post.scraped_at}`)
        console.log('')
      })
    }
    
  } catch (error) {
    console.error('❌ Database error:', error)
  } finally {
    await db.disconnect()
  }
}

checkLemmyPost().catch(console.error)