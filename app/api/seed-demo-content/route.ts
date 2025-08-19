import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function POST() {
  try {
    console.log('🌱 Seeding demo content...');
    
    // Check if content already exists
    const existingContent = await sql`SELECT COUNT(*) as count FROM content_queue`;
    const contentCount = parseInt(existingContent.rows[0]?.count || '0');
    
    if (contentCount > 0) {
      return NextResponse.json({
        success: true,
        message: `Database already has ${contentCount} content items`,
        contentCount,
        seeded: false
      });
    }
    
    // Demo content for hotdog diaries
    const demoContent = [
      {
        text: "🌭 The perfect hotdog: grilled to perfection with mustard and onions!",
        type: "text",
        platform: "demo",
        author: "hotdog_lover",
        url: "https://example.com/demo1"
      },
      {
        text: "Just discovered the best hotdog stand in NYC! Line was worth the wait 🔥",
        type: "text", 
        platform: "demo",
        author: "foodie_explorer",
        url: "https://example.com/demo2"
      },
      {
        text: "Making homemade hotdogs from scratch - the sausage casing snapped perfectly!",
        type: "text",
        platform: "demo", 
        author: "chef_mike",
        url: "https://example.com/demo3"
      },
      {
        text: "Hotdog eating contest champion shares secret technique 🏆",
        type: "text",
        platform: "demo",
        author: "competitive_eater",
        url: "https://example.com/demo4"
      },
      {
        text: "Chicago style vs New York style hotdogs - which team are you on?",
        type: "text",
        platform: "demo",
        author: "style_wars", 
        url: "https://example.com/demo5"
      }
    ];
    
    let insertedCount = 0;
    
    for (const content of demoContent) {
      await sql`
        INSERT INTO content_queue (
          content_text, 
          content_type, 
          source_platform, 
          original_author,
          original_url,
          content_hash,
          is_approved,
          content_status,
          scraped_at,
          confidence_score
        ) VALUES (
          ${content.text},
          ${content.type},
          ${content.platform}, 
          ${content.author},
          ${content.url},
          ${content.text.substring(0, 50) + '_demo_' + Date.now()},
          true,
          'approved', 
          NOW(),
          0.95
        )
      `;
      insertedCount++;
    }
    
    console.log(`✅ Seeded ${insertedCount} demo content items`);
    
    return NextResponse.json({
      success: true,
      message: `Successfully seeded ${insertedCount} demo content items`,
      contentCount: insertedCount,
      seeded: true,
      demoContent: demoContent.map(c => c.text)
    });
    
  } catch (error) {
    console.error('❌ Demo content seeding failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      seeded: false
    }, { status: 500 });
  }
}