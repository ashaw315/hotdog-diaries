import { NextResponse } from 'next/server';
import { createSimpleClient } from '@/utils/supabase/server';

export async function GET() {
  const log = [];
  
  try {
    log.push('🔧 Manual Content Insertion Test');
    log.push('=================================');
    log.push('');
    
    // Connect to Supabase
    const supabase = createSimpleClient();
    
    // Check current content count
    const { count: beforeCount, error: countError } = await supabase
      .from('content_queue')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      throw new Error(`Failed to count existing content: ${countError.message}`);
    }
    
    log.push(`📊 Current content in database: ${beforeCount || 0}`);
    log.push('');
    
    // Create realistic test posts for each platform
    const testPosts = [
      {
        // YouTube video
        content_text: 'Chicago Style Hot Dog - Street Food Icons',
        content_image_url: 'https://i.ytimg.com/vi/8aFQKQlwbDc/maxresdefault.jpg',
        content_video_url: 'https://youtube.com/watch?v=8aFQKQlwbDc',
        content_type: 'video',
        source_platform: 'youtube',
        original_url: 'https://youtube.com/watch?v=8aFQKQlwbDc',
        original_author: 'Street Food Universe',
        content_hash: `youtube_test_${Date.now()}_1`,
        content_status: 'approved',
        confidence_score: 0.95,
        is_approved: true,
        is_rejected: false,
        is_posted: false,
        scraped_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        // Reddit post
        content_text: 'Made my first homemade chili cheese dog! The secret is in the caramelized onions.',
        content_image_url: 'https://preview.redd.it/the-perfect-chili-cheese-dog-v0-abcd1234.jpg?width=640&height=853&format=pjpg',
        content_video_url: null,
        content_type: 'image',
        source_platform: 'reddit',
        original_url: 'https://reddit.com/r/food/comments/test123',
        original_author: 'u/hotdoglover42',
        content_hash: `reddit_test_${Date.now()}_2`,
        content_status: 'approved',
        confidence_score: 0.88,
        is_approved: true,
        is_rejected: false,
        is_posted: false,
        scraped_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        // Giphy GIF
        content_text: 'Dancing Hotdog GIF',
        content_image_url: 'https://media.giphy.com/media/ToMjGpnDnZRxP5HCWN2/giphy.gif',
        content_video_url: 'https://media.giphy.com/media/ToMjGpnDnZRxP5HCWN2/giphy.mp4',
        content_type: 'video',
        source_platform: 'giphy',
        original_url: 'https://giphy.com/gifs/hotdog-ToMjGpnDnZRxP5HCWN2',
        original_author: 'Giphy',
        content_hash: `giphy_test_${Date.now()}_3`,
        content_status: 'approved',
        confidence_score: 0.92,
        is_approved: true,
        is_rejected: false,
        is_posted: false,
        scraped_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        // Imgur image
        content_text: 'Korean corn dogs are taking over the street food scene!',
        content_image_url: 'https://i.imgur.com/vKqWb2A.jpg',
        content_video_url: null,
        content_type: 'image',
        source_platform: 'imgur',
        original_url: 'https://imgur.com/gallery/vKqWb2A',
        original_author: 'ImgurUser123',
        content_hash: `imgur_test_${Date.now()}_4`,
        content_status: 'approved',
        confidence_score: 0.85,
        is_approved: true,
        is_rejected: false,
        is_posted: false,
        scraped_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        // Pixabay image
        content_text: 'Gourmet hotdog with truffle aioli and crispy onions',
        content_image_url: 'https://cdn.pixabay.com/photo/2021/09/26/06/42/hotdog-6656609_960_720.jpg',
        content_video_url: null,
        content_type: 'image',
        source_platform: 'pixabay',
        original_url: 'https://pixabay.com/photos/hotdog-6656609/',
        original_author: 'PixabayPhotographer',
        content_hash: `pixabay_test_${Date.now()}_5`,
        content_status: 'approved',
        confidence_score: 0.90,
        is_approved: true,
        is_rejected: false,
        is_posted: false,
        scraped_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        // Bonus: Bluesky post
        content_text: 'Just discovered the best hot dog cart in NYC! 53rd and 6th - you have to try the spicy mustard! 🌭 #NYCFood #StreetFood',
        content_image_url: 'https://images.unsplash.com/photo-1599599810694-b5b37304c041?w=800',
        content_video_url: null,
        content_type: 'image',
        source_platform: 'bluesky',
        original_url: 'https://bsky.app/profile/test.bsky.social/post/test123',
        original_author: '@foodie.bsky.social',
        content_hash: `bluesky_test_${Date.now()}_6`,
        content_status: 'approved',
        confidence_score: 0.87,
        is_approved: true,
        is_rejected: false,
        is_posted: false,
        scraped_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
    
    log.push(`📝 Attempting to insert ${testPosts.length} test posts...`);
    log.push('');
    
    // Track results
    const results = {
      successful: [],
      failed: []
    };
    
    // Insert each post individually to get detailed feedback
    for (const post of testPosts) {
      try {
        const { data, error } = await supabase
          .from('content_queue')
          .insert(post)
          .select()
          .single();
        
        if (error) {
          results.failed.push({
            platform: post.source_platform,
            title: post.content_text.substring(0, 50),
            error: error.message
          });
          log.push(`❌ Failed to insert ${post.source_platform} post: ${error.message}`);
        } else {
          results.successful.push({
            platform: post.source_platform,
            title: post.content_text.substring(0, 50),
            id: data.id
          });
          log.push(`✅ Successfully inserted ${post.source_platform} post with ID: ${data.id}`);
        }
      } catch (err) {
        results.failed.push({
          platform: post.source_platform,
          title: post.content_text.substring(0, 50),
          error: err.message
        });
        log.push(`❌ Error inserting ${post.source_platform} post: ${err.message}`);
      }
    }
    
    // Check final content count
    const { count: afterCount, error: finalCountError } = await supabase
      .from('content_queue')
      .select('*', { count: 'exact', head: true });
    
    log.push('');
    log.push('📊 Results Summary:');
    log.push(`  - Posts attempted: ${testPosts.length}`);
    log.push(`  - Successfully inserted: ${results.successful.length}`);
    log.push(`  - Failed to insert: ${results.failed.length}`);
    log.push(`  - Total content before: ${beforeCount || 0}`);
    log.push(`  - Total content after: ${afterCount || 0}`);
    log.push(`  - Net increase: ${(afterCount || 0) - (beforeCount || 0)}`);
    
    // Fetch and display the inserted content
    if (results.successful.length > 0) {
      log.push('');
      log.push('📋 Verifying inserted content...');
      
      const { data: insertedPosts, error: fetchError } = await supabase
        .from('content_queue')
        .select('id, content_text, source_platform, is_approved, created_at')
        .in('id', results.successful.map(r => r.id))
        .order('created_at', { ascending: false });
      
      if (insertedPosts && insertedPosts.length > 0) {
        log.push('');
        log.push('✅ Successfully inserted posts:');
        insertedPosts.forEach(post => {
          const approved = post.is_approved ? '✅' : '❌';
          log.push(`  ${approved} [${post.source_platform}] ${post.content_text.substring(0, 50)}...`);
        });
      }
    }
    
    // Final status
    const success = results.successful.length > 0;
    
    log.push('');
    if (success) {
      log.push('🎉 SUCCESS! Database pipeline is working!');
      log.push(`${results.successful.length} test posts were successfully inserted.`);
      log.push('These posts are approved and ready to be displayed.');
      log.push('');
      log.push('Next steps:');
      log.push('1. Check the main site to see if content appears');
      log.push('2. Fix the scanner services to find real content');
      log.push('3. Set up automated posting schedule');
    } else {
      log.push('❌ FAILURE: No posts could be inserted.');
      log.push('');
      log.push('Possible issues:');
      log.push('1. Table structure mismatch');
      log.push('2. Missing required columns');
      log.push('3. Row Level Security (RLS) blocking inserts');
      log.push('4. Permission issues with service role key');
      log.push('');
      log.push('Check Supabase dashboard for:');
      log.push('- Table schema for content_queue');
      log.push('- RLS policies (try disabling for testing)');
      log.push('- Service role key permissions');
    }
    
    return NextResponse.json({
      success,
      log,
      results: {
        attempted: testPosts.length,
        successful: results.successful,
        failed: results.failed,
        beforeCount: beforeCount || 0,
        afterCount: afterCount || 0
      }
    });
    
  } catch (error) {
    log.push('');
    log.push(`❌ Critical error: ${error.message}`);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      log
    }, { status: 500 });
  }
}