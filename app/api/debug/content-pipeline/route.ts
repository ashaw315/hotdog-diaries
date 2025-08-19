import { NextResponse } from 'next/server';
import { redditHttpService } from '@/lib/services/reddit-http';
import { FilteringService } from '@/lib/services/filtering';
import { ContentProcessor } from '@/lib/services/content-processor';
import { DuplicateDetectionService } from '@/lib/services/duplicate-detection';
import { sql } from '@vercel/postgres';

export async function GET() {
  const debugLog = [];
  
  function log(stage: string, message: string, data?: any) {
    const entry = {
      timestamp: new Date().toISOString(),
      stage,
      message,
      data: data ? JSON.stringify(data, null, 2) : undefined
    };
    debugLog.push(entry);
    console.log(`[${stage}] ${message}`, data || '');
  }

  try {
    log('INIT', '🔍 Starting content pipeline debug trace');
    
    // STAGE 1: Test Reddit API directly
    log('STAGE_1', '📡 Testing Reddit API directly');
    
    let redditPosts = [];
    try {
      redditPosts = await redditHttpService.searchSubreddit('food', 'hotdog', 5);
      log('STAGE_1_SUCCESS', `✅ Reddit API returned ${redditPosts.length} posts`, {
        posts: redditPosts.map(p => ({
          id: p.id,
          title: p.title.substring(0, 100),
          score: p.score,
          author: p.author,
          url: p.url
        }))
      });
    } catch (error) {
      log('STAGE_1_ERROR', '❌ Reddit API failed', { error: error.message });
      return NextResponse.json({ error: 'Reddit API failed', debugLog });
    }

    if (redditPosts.length === 0) {
      log('STAGE_1_EMPTY', '⚠️ Reddit API returned 0 posts - this is the problem!');
      return NextResponse.json({ error: 'No posts from Reddit API', debugLog });
    }

    // STAGE 2: Test Content Processing
    log('STAGE_2', '🔧 Testing content processing pipeline');
    
    const testPost = redditPosts[0]; // Take first post
    log('STAGE_2_INPUT', `Processing test post: ${testPost.title}`, testPost);

    let processedPost;
    try {
      // Convert Reddit post to ProcessedRedditPost format (like in reddit-scanning.ts)
      processedPost = {
        id: testPost.id,
        title: testPost.title || '',
        selftext: testPost.selftext || '',
        subreddit: testPost.subreddit,
        author: testPost.author || '[deleted]',
        createdAt: new Date(testPost.created_utc * 1000),
        score: testPost.score || 0,
        upvoteRatio: testPost.upvote_ratio || 0,
        numComments: testPost.num_comments || 0,
        permalink: `https://reddit.com${testPost.permalink}`,
        url: testPost.url?.toString() || '',
        imageUrls: [],
        videoUrls: [],
        mediaUrls: [],
        isNSFW: testPost.over_18 || false,
        isSpoiler: false,
        isStickied: testPost.stickied || false,
        flair: undefined,
        isGallery: false,
        isCrosspost: false,
        crosspostOrigin: undefined
      };

      log('STAGE_2_CONVERTED', '✅ Converted to ProcessedRedditPost format', processedPost);
    } catch (error) {
      log('STAGE_2_CONVERT_ERROR', '❌ Failed to convert post format', { error: error.message });
      return NextResponse.json({ error: 'Post conversion failed', debugLog });
    }

    // STAGE 3: Test Content Filtering
    log('STAGE_3', '🧹 Testing content filtering');
    
    let filteringResult;
    try {
      const filteringService = new FilteringService();
      filteringResult = await filteringService.isValidContent(processedPost.title, processedPost.selftext);
      
      log('STAGE_3_RESULT', `Filtering result: ${filteringResult.isValid ? 'PASS' : 'REJECT'}`, {
        isValid: filteringResult.isValid,
        confidence: filteringResult.confidence,
        flags: filteringResult.flaggedPatterns,
        reason: filteringResult.rejectionReason
      });

      if (!filteringResult.isValid) {
        log('STAGE_3_FILTERED', '❌ Post was filtered out!', filteringResult);
      }
    } catch (error) {
      log('STAGE_3_ERROR', '❌ Filtering service failed', { error: error.message });
      filteringResult = { isValid: true, confidence: 1.0 }; // Assume valid if filtering fails
    }

    // STAGE 4: Test Duplicate Detection
    log('STAGE_4', '🔍 Testing duplicate detection');
    
    let isDuplicate = false;
    try {
      const duplicateService = new DuplicateDetectionService();
      const contentHash = duplicateService.generateContentHash(processedPost.title, processedPost.url);
      
      // Check if this hash exists in database
      const existingPost = await sql`
        SELECT id, content_hash FROM content_queue 
        WHERE content_hash = ${contentHash}
        LIMIT 1
      `;
      
      isDuplicate = existingPost.rows.length > 0;
      
      log('STAGE_4_RESULT', `Duplicate check: ${isDuplicate ? 'DUPLICATE' : 'UNIQUE'}`, {
        contentHash,
        existingPostId: existingPost.rows[0]?.id || null
      });

      if (isDuplicate) {
        log('STAGE_4_DUPLICATE', '❌ Post is a duplicate!', existingPost.rows[0]);
      }
    } catch (error) {
      log('STAGE_4_ERROR', '❌ Duplicate detection failed', { error: error.message });
      isDuplicate = false; // Assume not duplicate if check fails
    }

    // STAGE 5: Test Content Processing
    log('STAGE_5', '⚙️ Testing full content processing');
    
    let finalContentData;
    try {
      const contentProcessor = new ContentProcessor();
      
      // This is the actual processing that happens in the scanning service
      finalContentData = {
        content_text: processedPost.title + (processedPost.selftext ? '\n\n' + processedPost.selftext : ''),
        content_image_url: processedPost.imageUrls[0] || null,
        content_video_url: processedPost.videoUrls[0] || null,
        content_type: processedPost.imageUrls.length > 0 ? 'image' : 
                     processedPost.videoUrls.length > 0 ? 'video' : 'text',
        source_platform: 'reddit',
        original_url: processedPost.permalink,
        original_author: processedPost.author,
        content_hash: `reddit_${processedPost.id}_${Date.now()}`,
        confidence_score: filteringResult.confidence,
        flagged_patterns: filteringResult.flaggedPatterns ? JSON.stringify(filteringResult.flaggedPatterns) : null,
        rejection_reason: filteringResult.rejectionReason || null,
        is_approved: filteringResult.isValid && filteringResult.confidence > 0.7,
        is_rejected: !filteringResult.isValid,
        scraped_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      };

      log('STAGE_5_PROCESSED', '✅ Content processing complete', finalContentData);
    } catch (error) {
      log('STAGE_5_ERROR', '❌ Content processing failed', { error: error.message });
      return NextResponse.json({ error: 'Content processing failed', debugLog });
    }

    // STAGE 6: Test Database Insertion
    log('STAGE_6', '💾 Testing database insertion');
    
    let insertResult;
    try {
      // Test if we can insert this content
      insertResult = await sql`
        INSERT INTO content_queue (
          content_text, content_image_url, content_video_url, content_type,
          source_platform, original_url, original_author, content_hash,
          confidence_score, flagged_patterns, rejection_reason,
          is_approved, is_rejected, scraped_at, created_at, updated_at
        ) VALUES (
          ${finalContentData.content_text},
          ${finalContentData.content_image_url},
          ${finalContentData.content_video_url},
          ${finalContentData.content_type},
          ${finalContentData.source_platform},
          ${finalContentData.original_url},
          ${finalContentData.original_author},
          ${finalContentData.content_hash},
          ${finalContentData.confidence_score},
          ${finalContentData.flagged_patterns},
          ${finalContentData.rejection_reason},
          ${finalContentData.is_approved},
          ${finalContentData.is_rejected},
          ${finalContentData.scraped_at},
          ${finalContentData.created_at},
          ${finalContentData.updated_at}
        )
        RETURNING id, is_approved, is_rejected
      `;

      log('STAGE_6_SUCCESS', '✅ Database insertion successful!', {
        insertedId: insertResult.rows[0].id,
        isApproved: insertResult.rows[0].is_approved,
        isRejected: insertResult.rows[0].is_rejected
      });
    } catch (error) {
      log('STAGE_6_ERROR', '❌ Database insertion failed', { error: error.message });
      return NextResponse.json({ error: 'Database insertion failed', debugLog });
    }

    // STAGE 7: Verify Database Content
    log('STAGE_7', '🔍 Verifying database content');
    
    try {
      const contentCheck = await sql`
        SELECT COUNT(*) as total,
               SUM(CASE WHEN is_approved = true THEN 1 ELSE 0 END) as approved,
               SUM(CASE WHEN is_rejected = true THEN 1 ELSE 0 END) as rejected
        FROM content_queue 
        WHERE source_platform = 'reddit'
      `;

      log('STAGE_7_STATS', '📊 Database content stats', {
        total: parseInt(contentCheck.rows[0].total),
        approved: parseInt(contentCheck.rows[0].approved),
        rejected: parseInt(contentCheck.rows[0].rejected)
      });
    } catch (error) {
      log('STAGE_7_ERROR', '❌ Database verification failed', { error: error.message });
    }

    // FINAL ANALYSIS
    log('ANALYSIS', '🔬 Pipeline Analysis Complete');
    
    const analysis = {
      redditApiWorking: redditPosts.length > 0,
      contentFiltering: filteringResult.isValid,
      duplicateCheck: !isDuplicate,
      contentProcessing: !!finalContentData,
      databaseInsertion: !!insertResult,
      finalApprovalStatus: finalContentData?.is_approved || false,
      
      issuesFound: [],
      recommendations: []
    };

    if (redditPosts.length === 0) {
      analysis.issuesFound.push('Reddit API returning 0 posts');
      analysis.recommendations.push('Check Reddit HTTP service configuration');
    }

    if (!filteringResult.isValid) {
      analysis.issuesFound.push('Content being filtered out');
      analysis.recommendations.push('Review filtering criteria - may be too strict');
    }

    if (isDuplicate) {
      analysis.issuesFound.push('Content marked as duplicate');
      analysis.recommendations.push('Check duplicate detection logic');
    }

    if (!finalContentData?.is_approved) {
      analysis.issuesFound.push('Content not auto-approved');
      analysis.recommendations.push('Check approval criteria and confidence thresholds');
    }

    log('FINAL_RESULT', analysis.issuesFound.length === 0 ? 
      '✅ PIPELINE WORKING - content should appear!' : 
      '❌ ISSUES FOUND in pipeline', analysis);

    return NextResponse.json({
      success: true,
      analysis,
      debugLog,
      testPost: {
        originalTitle: testPost.title,
        processed: !!processedPost,
        filtered: filteringResult.isValid,
        inserted: !!insertResult,
        approved: finalContentData?.is_approved
      }
    });

  } catch (error) {
    log('FATAL_ERROR', '💥 Pipeline debug failed', { error: error.message, stack: error.stack });
    
    return NextResponse.json({
      success: false,
      error: error.message,
      debugLog
    }, { status: 500 });
  }
}