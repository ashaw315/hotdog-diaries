#!/usr/bin/env node

import { db } from '../lib/db'
import { loadEnv } from '../lib/env'

// Ensure environment variables are loaded
loadEnv()

async function updatePlatformQuotas() {
  console.log('🎯 UPDATING PLATFORM QUOTAS PERMANENTLY')
  console.log('=====================================\n')
  
  try {
    await db.connect()
    
    // 1. Set Pixabay scan limit to 0 until video/gif targets are reached
    console.log('🚫 Setting Pixabay quota to 0 (temporary halt)')
    // Just update to exclude pixabay in the next step
    
    // 2. Update scanning service to prioritize video/GIF platforms
    console.log('📊 Updating platform priorities in content scanning...')
    const newConfig = {
      enabled_platforms: ['youtube', 'giphy', 'reddit', 'bluesky', 'lemmy', 'imgur', 'tumblr'],
      max_posts_per_scan: 100, // Increased from 50
      scan_frequency_hours: 2,  // Reduced from 4 (more frequent)
      is_enabled: true
    }
    
    await db.query(`
      UPDATE scan_config 
      SET enabled_platforms = ?, 
          max_posts_per_scan = ?, 
          scan_frequency_hours = ?,
          updated_at = datetime('now')
      WHERE id = (SELECT id FROM scan_config ORDER BY created_at DESC LIMIT 1)
    `, [
      JSON.stringify(newConfig.enabled_platforms),
      newConfig.max_posts_per_scan,
      newConfig.scan_frequency_hours
    ])
    
    // 3. Set auto-approval rules in content processor settings
    console.log('⚡ Configuring auto-approval for video/GIF content...')
    
    // Create or update content processing configuration
    await db.query(`
      INSERT OR REPLACE INTO processing_config (
        content_type, 
        auto_approval_threshold, 
        auto_rejection_threshold,
        manual_review_required,
        created_at,
        updated_at
      ) VALUES 
        ('video', 0.5, 0.2, 0, datetime('now'), datetime('now')),
        ('gif', 0.4, 0.2, 0, datetime('now'), datetime('now')),
        ('image', 0.7, 0.3, 1, datetime('now'), datetime('now')),
        ('text', 0.6, 0.3, 1, datetime('now'), datetime('now'))
    `)
    
    // 4. Update YouTube scan configuration for aggressive scanning
    console.log('🎬 Updating YouTube scan configuration...')
    await db.query(`
      INSERT OR REPLACE INTO youtube_scan_config (
        is_enabled,
        scan_interval,
        max_videos_per_scan,
        search_terms,
        video_duration,
        published_within,
        min_view_count,
        created_at,
        updated_at
      ) VALUES (
        1,
        120,
        50,
        ?,
        'any',
        90,
        500,
        datetime('now'),
        datetime('now')
      )
    `, [JSON.stringify([
      'hotdog', 'hot dog', 'hot dogs', 'hotdogs',
      'frankfurter', 'wiener', 'bratwurst', 'sausage',
      'ballpark food', 'stadium hot dog', 'corn dog',
      'chili dog', 'chicago hot dog', 'new york hot dog',
      'hot dog recipe', 'hot dog cooking', 'hot dog grill',
      'hot dog eating contest', 'nathans hot dog'
    ])])
    
    // 5. Create Giphy scan configuration
    console.log('🎞️ Creating Giphy scan configuration...')
    await db.query(`
      INSERT OR REPLACE INTO giphy_scan_config (
        is_enabled,
        scan_interval,
        max_gifs_per_scan,
        search_terms,
        hourly_request_count,
        daily_request_count,
        last_request_reset,
        created_at,
        updated_at
      ) VALUES (
        1,
        180,
        40,
        ?,
        0,
        0,
        datetime('now'),
        datetime('now'),
        datetime('now')
      )
    `, [JSON.stringify([
      'hotdog', 'hot dog', 'hot dogs', 'hotdogs',
      'frankfurter', 'wiener', 'bratwurst', 'sausage',
      'corn dog', 'chili dog', 'grilling sausage',
      'mustard squeeze', 'ketchup', 'relish',
      'hot dog flip', 'grilling hotdog', 'cooking sausage'
    ])])
    
    // 6. Show current content distribution
    console.log('\n📊 UPDATED CONTENT DISTRIBUTION:')
    const stats = await db.query(`
      SELECT 
        content_type,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM content_queue), 2) as percentage
      FROM content_queue
      GROUP BY content_type
      ORDER BY count DESC
    `)
    
    stats.rows.forEach((stat: any) => {
      const target = getTargetPercentage(stat.content_type)
      const status = Math.abs(stat.percentage - target) < 15 ? '✅' : '⚠️'
      console.log(`  ${status} ${stat.content_type.toUpperCase()}: ${stat.count} (${stat.percentage}%) - target: ${target}%`)
    })
    
    console.log('\n🎯 PLATFORM QUOTA UPDATES COMPLETED!')
    console.log('\nNew Configuration:')
    console.log('- Pixabay: DISABLED (until video/GIF targets reached)')
    console.log('- YouTube: 50 videos per scan, every 2 hours')
    console.log('- Giphy: 40 GIFs per scan, every 3 hours')
    console.log('- Videos: Auto-approve at 50% confidence')
    console.log('- GIFs: Auto-approve at 40% confidence')
    console.log('- Images: Require manual review (70% confidence)')
    
  } catch (error) {
    console.error('❌ Platform quota update failed:', error)
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

// Run the platform quota update
updatePlatformQuotas().catch(console.error)