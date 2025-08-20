import { NextResponse } from 'next/server';
import { redditScanningService } from '@/lib/services/reddit-scanning';
import { createSimpleClient } from '@/utils/supabase/server';

export async function GET() {
  const log = [];
  
  try {
    // Step 1: Test Supabase connection
    log.push('🔍 Testing Supabase connection...');
    const supabase = createSimpleClient();
    
    const { count, error: countError } = await supabase
      .from('content_queue')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      throw new Error(`Supabase connection failed: ${countError.message}`);
    }
    
    log.push(`✅ Supabase connected! Current posts in queue: ${count || 0}`);
    
    // Step 2: Test Reddit connection
    log.push('🔗 Testing Reddit connection...');
    const connectionTest = await redditScanningService.testConnection();
    
    if (!connectionTest.success) {
      throw new Error(`Reddit connection failed: ${connectionTest.message}`);
    }
    
    log.push('✅ Reddit connection successful!');
    
    // Step 3: Perform a small scan
    log.push('🤖 Starting Reddit scan for hotdog content...');
    
    const scanResult = await redditScanningService.performScan({ maxPosts: 5 });
    
    log.push(`📊 Scan completed:`);
    log.push(`  - Posts found: ${scanResult.postsFound}`);
    log.push(`  - Posts processed: ${scanResult.postsProcessed}`);
    log.push(`  - Posts approved: ${scanResult.postsApproved}`);
    log.push(`  - Posts rejected: ${scanResult.postsRejected}`);
    log.push(`  - Duplicates: ${scanResult.duplicatesFound}`);
    
    if (scanResult.errors.length > 0) {
      log.push(`⚠️ Errors encountered:`);
      scanResult.errors.forEach(err => log.push(`  - ${err}`));
    }
    
    // Step 4: Check if posts were saved to Supabase
    log.push('📋 Checking saved posts in Supabase...');
    
    const { data: savedPosts, error: fetchError } = await supabase
      .from('content_queue')
      .select('id, content_text, source_platform, created_at')
      .eq('source_platform', 'reddit')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (fetchError) {
      log.push(`❌ Error fetching saved posts: ${fetchError.message}`);
    } else {
      log.push(`✅ Found ${savedPosts?.length || 0} Reddit posts in database`);
      
      if (savedPosts && savedPosts.length > 0) {
        log.push('📝 Recent Reddit posts:');
        savedPosts.forEach(post => {
          const text = post.content_text?.substring(0, 50) || 'No text';
          log.push(`  - ${text}...`);
        });
      }
    }
    
    // Step 5: Summary
    const success = scanResult.postsProcessed > 0 || (savedPosts && savedPosts.length > 0);
    
    if (success) {
      log.push('');
      log.push('🎉 SUCCESS! Reddit scanner is working with Supabase!');
      log.push('Content pipeline is now finding and saving posts.');
    } else if (scanResult.postsFound === 0) {
      log.push('');
      log.push('⚠️ No posts found. This could mean:');
      log.push('  1. Reddit API returned no results for "hotdog" searches');
      log.push('  2. All found posts were filtered out');
      log.push('  3. Rate limiting is in effect');
    } else {
      log.push('');
      log.push('⚠️ Posts found but not saved. Check:');
      log.push('  1. Database table structure');
      log.push('  2. Content filtering logic');
      log.push('  3. Error logs above');
    }
    
    return NextResponse.json({
      success,
      log,
      scanResult: {
        postsFound: scanResult.postsFound,
        postsProcessed: scanResult.postsProcessed,
        postsApproved: scanResult.postsApproved
      },
      databasePosts: savedPosts?.length || 0
    });
    
  } catch (error) {
    log.push(`❌ Test failed: ${error.message}`);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      log
    }, { status: 500 });
  }
}