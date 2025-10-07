#!/usr/bin/env tsx

/**
 * CI Database Seeder
 * Seeds test data for E2E tests in CI environment
 */

import { db } from '@/lib/db'
import { AdminService } from '@/lib/services/admin'
import { generateContentHash } from '@/lib/utils/content-deduplication'

async function seedDatabase() {
  console.log('🌱 Starting CI database seeding...')
  
  try {
    await db.connect()
    console.log('✅ Connected to database')

    // 1. Create admin user
    console.log('👤 Creating admin user...')
    try {
      const adminUser = await AdminService.createAdminUser({
        username: 'admin',
        password: 'StrongAdminPass123!',
        email: 'admin@hotdogdiaries.com',
        full_name: 'CI Admin User'
      })
      console.log('✅ Admin user created:', adminUser.username)
    } catch (error) {
      if (error.message?.includes('already exists') || error.message?.includes('unique constraint')) {
        console.log('ℹ️ Admin user already exists, skipping...')
      } else {
        throw error
      }
    }

    // 2. Seed test content
    console.log('📝 Seeding test content...')
    
    const testContent = [
      {
        content_text: 'Chicago-style hotdog with all the fixings',
        content_type: 'image',
        source_platform: 'reddit',
        original_url: 'https://reddit.com/r/hotdogs/test1',
        original_author: 'TestUser1',
        content_image_url: 'https://i.imgur.com/test-hotdog1.jpg',
        content_video_url: null,
        scraped_at: new Date(),
        is_approved: true,
        is_posted: false,
        confidence_score: 0.85
      },
      {
        content_text: 'Epic hotdog eating contest compilation',
        content_type: 'video',
        source_platform: 'youtube',
        original_url: 'https://youtube.com/watch?v=test123',
        original_author: 'TestChannel',
        content_image_url: null,
        content_video_url: 'https://youtube.com/watch?v=test123',
        scraped_at: new Date(),
        is_approved: true,
        is_posted: false,
        confidence_score: 0.92
      },
      {
        content_text: 'Funny hotdog dancing GIF',
        content_type: 'gif',
        source_platform: 'giphy',
        original_url: 'https://giphy.com/gifs/test-hotdog',
        original_author: 'GiphyUser',
        content_image_url: 'https://media.giphy.com/media/test-hotdog/giphy.gif',
        content_video_url: null,
        scraped_at: new Date(),
        is_approved: true,
        is_posted: false,
        confidence_score: 0.78
      },
      {
        content_text: 'Beautiful hotdog photography',
        content_type: 'image',
        source_platform: 'pixabay',
        original_url: 'https://pixabay.com/photos/test-hotdog-456789',
        original_author: 'PixabayUser',
        content_image_url: 'https://cdn.pixabay.com/photo/test-hotdog.jpg',
        content_video_url: null,
        scraped_at: new Date(),
        is_approved: true,
        is_posted: false,
        confidence_score: 0.81
      },
      {
        content_text: 'Hotdog meme from Bluesky',
        content_type: 'text',
        source_platform: 'bluesky',
        original_url: 'https://bsky.app/profile/test/post/test123',
        original_author: 'BlueskyUser',
        content_image_url: null,
        content_video_url: null,
        scraped_at: new Date(),
        is_approved: true,
        is_posted: false,
        confidence_score: 0.65
      },
      {
        content_text: 'Gourmet hotdog from upscale restaurant',
        content_type: 'image',
        source_platform: 'imgur',
        original_url: 'https://imgur.com/test-gourmet',
        original_author: 'ImgurUser',
        content_image_url: 'https://i.imgur.com/test-gourmet.jpg',
        content_video_url: null,
        scraped_at: new Date(),
        is_approved: false, // Some unapproved content for testing
        is_posted: false,
        confidence_score: 0.73
      },
      {
        content_text: 'Street vendor hotdog review',
        content_type: 'video',
        source_platform: 'tumblr',
        original_url: 'https://tumblr.com/test-review',
        original_author: 'TumblrUser',
        content_image_url: null,
        content_video_url: 'https://vtt.tumblr.com/test-review.mp4',
        scraped_at: new Date(),
        is_approved: true,
        is_posted: false,
        confidence_score: 0.79
      },
      {
        content_text: 'Homemade hotdog recipe discussion',
        content_type: 'text',
        source_platform: 'lemmy',
        original_url: 'https://lemmy.world/post/test-recipe',
        original_author: 'LemmyUser',
        content_image_url: null,
        content_video_url: null,
        scraped_at: new Date(),
        is_approved: true,
        is_posted: false,
        confidence_score: 0.68
      }
    ]

    // Add content_hash to each item
    const contentWithHashes = testContent.map(content => ({
      ...content,
      content_hash: generateContentHash(content),
      created_at: new Date(),
      updated_at: new Date()
    }))

    // Insert test content (handle duplicates gracefully)
    for (const content of contentWithHashes) {
      try {
        // Insert into content_queue (without confidence_score)
        const insertQuery = `
          INSERT INTO content_queue (
            content_text, content_type, source_platform, original_url, original_author,
            content_image_url, content_video_url, content_hash, scraped_at,
            is_approved, is_posted, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (content_hash) DO NOTHING
        `
        
        const result = await db.query(insertQuery, [
          content.content_text, content.content_type, content.source_platform,
          content.original_url, content.original_author, content.content_image_url,
          content.content_video_url, content.content_hash, content.scraped_at,
          content.is_approved, content.is_posted, content.created_at, content.updated_at
        ])
        
        // Get the inserted content ID
        const contentIdResult = await db.query(
          'SELECT id FROM content_queue WHERE content_hash = $1', 
          [content.content_hash]
        )
        
        if (contentIdResult.rows.length > 0) {
          const contentId = contentIdResult.rows[0].id
          
          // Insert into content_analysis table with confidence_score
          await db.query(`
            INSERT INTO content_analysis (
              content_queue_id, is_valid_hotdog, confidence_score, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (content_queue_id) DO NOTHING
          `, [contentId, true, content.confidence_score, content.created_at, content.updated_at])
        }
        
        console.log(`✅ Seeded content: ${content.content_text.substring(0, 30)}...`)
      } catch (error) {
        console.log(`ℹ️ Content already exists: ${content.content_text.substring(0, 30)}...`)
      }
    }

    // 3. Seed some posted content for dashboard
    console.log('📋 Seeding posted content...')
    
    // Get some approved content to mark as posted
    const approvedContent = await db.query(`
      SELECT id FROM content_queue 
      WHERE is_approved = true AND is_posted = false 
      LIMIT 3
    `)

    if (approvedContent.rows.length > 0) {
      for (let i = 0; i < Math.min(3, approvedContent.rows.length); i++) {
        const contentId = approvedContent.rows[i].id
        const postedAt = new Date(Date.now() - (i + 1) * 2 * 60 * 60 * 1000) // Posted 2, 4, 6 hours ago
        
        try {
          // Check if posted_content table exists and create entry
          await db.query(`
            INSERT INTO posted_content (content_queue_id, posted_at, post_order)
            VALUES ($1, $2, $3)
          `, [contentId, postedAt, 1000 + i])
          
          // Mark as posted in content_queue
          await db.query(`
            UPDATE content_queue 
            SET is_posted = true, updated_at = $1 
            WHERE id = $2
          `, [new Date(), contentId])
          
          console.log(`✅ Marked content ${contentId} as posted`)
        } catch (error) {
          console.log(`ℹ️ Posted content entry might already exist for ${contentId}`)
        }
      }
    }

    // 4. Check final state
    const stats = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN is_approved = true THEN 1 END) as approved,
        COUNT(CASE WHEN is_posted = true THEN 1 END) as posted
      FROM content_queue
    `)

    console.log('\n📊 Database seeding completed!')
    console.log(`Total content: ${stats.rows[0].total}`)
    console.log(`Approved content: ${stats.rows[0].approved}`)
    console.log(`Posted content: ${stats.rows[0].posted}`)
    console.log('✅ CI database ready for E2E tests')

  } catch (error) {
    console.error('❌ Database seeding failed:', error)
    throw error
  } finally {
    await db.disconnect()
  }
}

// Run seeder if called directly
if (require.main === module) {
  seedDatabase().catch((error) => {
    console.error('❌ Seeding process failed:', error)
    process.exit(1)
  })
}

export { seedDatabase }