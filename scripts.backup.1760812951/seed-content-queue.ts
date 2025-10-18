#!/usr/bin/env tsx

/**
 * Development Seed Script: Populate Content Queue
 * Creates mock approved content from multiple platforms for testing the scheduler
 */

import { db } from '../lib/db'
import { ContentStatus, SourcePlatform, ContentType } from '../types'

const mockContent = [
  {
    content_text: "Chicago-style hotdog with all the classic toppings",
    content_type: ContentType.IMAGE,
    source_platform: SourcePlatform.REDDIT,
    original_url: "https://reddit.com/r/hotdogs/1",
    original_author: "ChicagoFoodie",
    content_image_url: "https://i.imgur.com/hotdog1.jpg",
    confidence_score: 0.9
  },
  {
    content_text: "Epic hotdog eating contest compilation",
    content_type: ContentType.VIDEO,
    source_platform: SourcePlatform.YOUTUBE,
    original_url: "https://youtube.com/watch?v=hotdog123",
    original_author: "CompetitiveEating",
    content_video_url: "https://youtube.com/watch?v=hotdog123",
    confidence_score: 0.8
  },
  {
    content_text: "Gourmet hotdog with truffle toppings",
    content_type: ContentType.IMAGE,
    source_platform: SourcePlatform.PIXABAY,
    original_url: "https://pixabay.com/hotdog-gourmet",
    original_author: "GourmetChef",
    content_image_url: "https://cdn.pixabay.com/hotdog-gourmet.jpg",
    confidence_score: 0.85
  },
  {
    content_text: "Funny hotdog dancing GIF",
    content_type: ContentType.GIF,
    source_platform: SourcePlatform.GIPHY,
    original_url: "https://giphy.com/gifs/hotdog-dance",
    original_author: "GiphyCreator",
    content_image_url: "https://media.giphy.com/hotdog-dance.gif",
    confidence_score: 0.75
  },
  {
    content_text: "Street vendor hotdog cart setup",
    content_type: ContentType.IMAGE,
    source_platform: SourcePlatform.BLUESKY,
    original_url: "https://bsky.app/profile/vendor/post/123",
    original_author: "StreetVendor",
    content_image_url: "https://example.com/vendor-cart.jpg",
    confidence_score: 0.7
  },
  {
    content_text: "Homemade hotdog buns recipe",
    content_type: ContentType.TEXT,
    source_platform: SourcePlatform.TUMBLR,
    original_url: "https://tumblr.com/hotdog-recipe",
    original_author: "HomeBaker",
    confidence_score: 0.8
  },
  {
    content_text: "Hotdog festival highlights from summer",
    content_type: ContentType.MIXED,
    source_platform: SourcePlatform.LEMMY,
    original_url: "https://lemmy.world/post/hotdog-festival",
    original_author: "FestivalGoer",
    content_image_url: "https://example.com/festival.jpg",
    confidence_score: 0.88
  },
  {
    content_text: "Amazing hotdog topping combinations",
    content_type: ContentType.IMAGE,
    source_platform: SourcePlatform.REDDIT,
    original_url: "https://reddit.com/r/food/hotdog2",
    original_author: "FoodExplorer",
    content_image_url: "https://i.imgur.com/toppings.jpg",
    confidence_score: 0.82
  },
  {
    content_text: "Hotdog grilling techniques masterclass",
    content_type: ContentType.VIDEO,
    source_platform: SourcePlatform.YOUTUBE,
    original_url: "https://youtube.com/watch?v=grill456",
    original_author: "GrillMaster",
    content_video_url: "https://youtube.com/watch?v=grill456",
    confidence_score: 0.91
  },
  {
    content_text: "Vintage hotdog advertisement collection",
    content_type: ContentType.IMAGE,
    source_platform: SourcePlatform.PIXABAY,
    original_url: "https://pixabay.com/vintage-hotdog-ads",
    original_author: "VintageCollector",
    content_image_url: "https://cdn.pixabay.com/vintage-ads.jpg",
    confidence_score: 0.76
  },
  {
    content_text: "Hotdog eating world record attempt",
    content_type: ContentType.GIF,
    source_platform: SourcePlatform.GIPHY,
    original_url: "https://giphy.com/gifs/world-record",
    original_author: "RecordBreaker",
    content_image_url: "https://media.giphy.com/world-record.gif",
    confidence_score: 0.89
  },
  {
    content_text: "International hotdog variations around the world",
    content_type: ContentType.TEXT,
    source_platform: SourcePlatform.BLUESKY,
    original_url: "https://bsky.app/profile/foodie/post/456",
    original_author: "WorldFoodie",
    confidence_score: 0.84
  },
  {
    content_text: "Hotdog cart business startup guide",
    content_type: ContentType.MIXED,
    source_platform: SourcePlatform.TUMBLR,
    original_url: "https://tumblr.com/business-guide",
    original_author: "Entrepreneur",
    content_image_url: "https://example.com/business.jpg",
    confidence_score: 0.73
  },
  {
    content_text: "Best hotdog joints in NYC",
    content_type: ContentType.IMAGE,
    source_platform: SourcePlatform.LEMMY,
    original_url: "https://lemmy.world/post/nyc-hotdogs",
    original_author: "NYCExplorer",
    content_image_url: "https://example.com/nyc-joints.jpg",
    confidence_score: 0.87
  },
  {
    content_text: "Hotdog science: Perfect cooking temperature",
    content_type: ContentType.TEXT,
    source_platform: SourcePlatform.REDDIT,
    original_url: "https://reddit.com/r/science/hotdog",
    original_author: "FoodScientist",
    confidence_score: 0.94
  }
]

async function generateContentHash(content: any): Promise<string> {
  const crypto = require('crypto')
  return crypto
    .createHash('sha256')
    .update(`${content.content_text}-${content.source_platform}`)
    .digest('hex')
}

async function main() {
  try {
    console.log('🌱 Starting content queue seeding...')
    
    // Connect to database
    await db.connect()
    
    // Check if we already have approved content
    const existingCount = await db.query(`
      SELECT COUNT(*) as count 
      FROM content_queue 
      WHERE is_approved = TRUE AND status = 'approved'
    `)
    
    const currentCount = existingCount.rows[0]?.count || 0
    console.log(`📊 Current approved content count: ${currentCount}`)
    
    if (currentCount >= 10) {
      console.log('✅ Sufficient approved content already exists. Skipping seed.')
      return
    }
    
    console.log('➕ Seeding approved content for scheduler testing...')
    
    let insertedCount = 0
    
    for (const content of mockContent) {
      try {
        const contentHash = await generateContentHash(content)
        
        // Check if content already exists
        const existing = await db.query(
          'SELECT id FROM content_queue WHERE content_hash = $1',
          [contentHash]
        )
        
        if (existing.rows.length > 0) {
          console.log(`⏭️  Skipping duplicate: ${content.content_text.substring(0, 30)}...`)
          continue
        }
        
        // Insert new content as approved and ready for scheduling
        await db.query(`
          INSERT INTO content_queue (
            content_text, content_type, source_platform, original_url,
            original_author, content_image_url, content_video_url,
            content_hash, confidence_score, scraped_at, is_approved,
            is_posted, status, priority, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, datetime('now'), 
                    TRUE, FALSE, 'approved', 0, datetime('now'), datetime('now'))
        `, [
          content.content_text,
          content.content_type,
          content.source_platform,
          content.original_url,
          content.original_author,
          content.content_image_url || null,
          content.content_video_url || null,
          contentHash,
          content.confidence_score
        ])
        
        insertedCount++
        console.log(`✅ Added: ${content.content_text.substring(0, 40)}... (${content.source_platform})`)
        
      } catch (error) {
        console.error(`❌ Failed to insert content: ${error.message}`)
      }
    }
    
    // Verify the seeding results
    const finalCount = await db.query(`
      SELECT COUNT(*) as count 
      FROM content_queue 
      WHERE is_approved = TRUE AND status = 'approved'
    `)
    
    const platformDistribution = await db.query(`
      SELECT 
        source_platform,
        COUNT(*) as count
      FROM content_queue 
      WHERE is_approved = TRUE AND status = 'approved'
      GROUP BY source_platform
      ORDER BY count DESC
    `)
    
    console.log(`\n📊 Seeding Results:`)
    console.log(`✅ Inserted ${insertedCount} new content items`)
    console.log(`📈 Total approved content: ${finalCount.rows[0]?.count || 0}`)
    
    console.log(`\n🎯 Platform Distribution:`)
    console.table(platformDistribution.rows)
    
    console.log('🎉 Content queue seeding completed successfully!')
    
  } catch (error) {
    console.error('❌ Seeding failed:', error)
    process.exit(1)
  } finally {
    await db.disconnect()
  }
}

// Run seeding if called directly
if (require.main === module) {
  main()
}

export { main as seedContentQueue }