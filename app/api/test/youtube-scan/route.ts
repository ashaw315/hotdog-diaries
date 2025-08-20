import { NextResponse } from 'next/server';
import { YouTubeScanningService } from '@/lib/services/youtube-scanning';
import { createSimpleClient } from '@/utils/supabase/server';

export async function GET() {
  const log = [];
  
  try {
    // Step 1: Check YouTube API key
    log.push('🔍 Checking YouTube API configuration...');
    const hasApiKey = !!process.env.YOUTUBE_API_KEY;
    log.push(hasApiKey ? 
      `✅ YouTube API key configured (${process.env.YOUTUBE_API_KEY?.substring(0, 10)}...)` : 
      '❌ YouTube API key not found');
    
    // Step 2: Test Supabase connection
    log.push('');
    log.push('🔍 Testing Supabase connection...');
    const supabase = createSimpleClient();
    
    const { count: beforeCount, error: countError } = await supabase
      .from('content_queue')
      .select('*', { count: 'exact', head: true })
      .eq('source_platform', 'youtube');
    
    if (countError) {
      throw new Error(`Supabase connection failed: ${countError.message}`);
    }
    
    log.push(`✅ Supabase connected! YouTube posts before scan: ${beforeCount || 0}`);
    
    // Step 3: Perform YouTube scan
    log.push('');
    log.push('🎬 Starting YouTube scan for hotdog content...');
    
    const scanService = new YouTubeScanningService();
    const scanResult = await scanService.performScan({ maxPosts: 5 });
    
    log.push('');
    log.push('📊 Scan Results:');
    log.push(`  - Total found: ${scanResult.totalFound}`);
    log.push(`  - Processed: ${scanResult.processed}`);
    log.push(`  - Approved: ${scanResult.approved}`);
    log.push(`  - Rejected: ${scanResult.rejected}`);
    log.push(`  - Duplicates: ${scanResult.duplicates}`);
    
    if (scanResult.errors.length > 0) {
      log.push('');
      log.push('📋 Debug messages:');
      scanResult.errors.forEach(err => {
        if (err.startsWith('DEBUG:')) {
          log.push(`  ${err}`);
        }
      });
      
      log.push('');
      log.push('⚠️ Errors:');
      scanResult.errors.forEach(err => {
        if (!err.startsWith('DEBUG:')) {
          log.push(`  - ${err}`);
        }
      });
    }
    
    // Step 4: Check saved videos in Supabase
    log.push('');
    log.push('📋 Checking saved videos in Supabase...');
    
    const { data: savedVideos, error: fetchError } = await supabase
      .from('content_queue')
      .select('id, content_text, content_video_url, is_approved, created_at')
      .eq('source_platform', 'youtube')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (fetchError) {
      log.push(`❌ Error fetching saved videos: ${fetchError.message}`);
    } else {
      const { count: afterCount } = await supabase
        .from('content_queue')
        .select('*', { count: 'exact', head: true })
        .eq('source_platform', 'youtube');
      
      log.push(`✅ YouTube posts after scan: ${afterCount || 0} (added ${(afterCount || 0) - (beforeCount || 0)})`);
      
      if (savedVideos && savedVideos.length > 0) {
        log.push('');
        log.push('🎥 Recent YouTube videos saved:');
        savedVideos.forEach(video => {
          const title = video.content_text?.substring(0, 60) || 'No title';
          const approved = video.is_approved ? '✅' : '❌';
          log.push(`  ${approved} ${title}...`);
        });
      }
    }
    
    // Step 5: Summary
    const success = scanResult.approved > 0 || (savedVideos && savedVideos.length > 0);
    
    log.push('');
    if (success) {
      log.push('🎉 SUCCESS! YouTube scanner is working with Supabase!');
      log.push(`Found and saved ${scanResult.approved} videos about hotdogs.`);
    } else if (!hasApiKey) {
      log.push('⚠️ YouTube API key not configured.');
      log.push('The scanner will use mock data for testing.');
      if (scanResult.approved > 0) {
        log.push('Mock data was successfully saved to database!');
      }
    } else if (scanResult.totalFound === 0) {
      log.push('⚠️ No videos found. Possible issues:');
      log.push('  1. YouTube API quota exceeded');
      log.push('  2. No hotdog videos match search criteria');
      log.push('  3. API key may be invalid');
    } else {
      log.push('⚠️ Videos found but not saved. Check:');
      log.push('  1. Supabase table structure');
      log.push('  2. Content filtering logic');
      log.push('  3. Error messages above');
    }
    
    return NextResponse.json({
      success,
      log,
      scanResult: {
        totalFound: scanResult.totalFound,
        processed: scanResult.processed,
        approved: scanResult.approved,
        duplicates: scanResult.duplicates
      },
      databaseVideos: savedVideos?.length || 0,
      apiKeyConfigured: hasApiKey
    });
    
  } catch (error) {
    log.push('');
    log.push(`❌ Test failed: ${error.message}`);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      log
    }, { status: 500 });
  }
}