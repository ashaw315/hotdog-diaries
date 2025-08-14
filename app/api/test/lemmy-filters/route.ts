import { NextRequest, NextResponse } from 'next/server'
import { lemmyScanningService } from '@/lib/services/lemmy-scanning'

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing Lemmy filtering with fresh scan...')
    
    // Perform a small test scan with new filters
    const scanResult = await lemmyScanningService.performScan({
      maxPosts: 15 // Small test scan
    })
    
    // Get examples of current content in database
    const { db } = await import('@/lib/db')
    
    // Get recent Lemmy posts to see what made it through
    const recentPostsQuery = `
      SELECT 
        id,
        content_text,
        LENGTH(content_text) as text_length,
        is_approved,
        scraped_at,
        original_url
      FROM content_queue 
      WHERE source_platform = 'lemmy'
      ORDER BY scraped_at DESC 
      LIMIT 10
    `
    
    const recentPostsResult = await db.query(recentPostsQuery)
    const recentPosts = recentPostsResult.rows
    
    // Analyze the filtering results
    const analysis = {
      scan_results: scanResult,
      recent_posts: recentPosts.map(post => ({
        id: post.id,
        text_preview: post.content_text.substring(0, 100) + (post.content_text.length > 100 ? '...' : ''),
        text_length: post.text_length,
        is_approved: post.is_approved,
        scraped_at: post.scraped_at,
        passes_length_filter: post.text_length <= 150
      })),
      filtering_summary: {
        total_found: scanResult.totalFound,
        total_processed: scanResult.processed,
        total_approved: scanResult.approved,
        total_rejected: scanResult.rejected,
        rejection_rate: scanResult.totalFound > 0 ? 
          Math.round((scanResult.rejected / scanResult.totalFound) * 100) : 0,
        approval_rate: scanResult.processed > 0 ? 
          Math.round((scanResult.approved / scanResult.processed) * 100) : 0
      },
      content_quality_check: {
        posts_over_150_chars: recentPosts.filter(p => p.text_length > 150).length,
        posts_under_150_chars: recentPosts.filter(p => p.text_length <= 150).length,
        average_length: recentPosts.length > 0 ? 
          Math.round(recentPosts.reduce((sum, p) => sum + p.text_length, 0) / recentPosts.length) : 0,
        longest_post: recentPosts.length > 0 ? 
          Math.max(...recentPosts.map(p => p.text_length)) : 0,
        shortest_post: recentPosts.length > 0 ? 
          Math.min(...recentPosts.map(p => p.text_length)) : 0
      }
    }
    
    // Test the individual filter functions with sample data
    const filterTests = [
      // Test cases that should be REJECTED
      {
        title: "Breaking news: Congress votes on new legislation regarding food safety standards in restaurants across America today",
        body: "",
        should_pass: false,
        reason: "Political/news content"
      },
      {
        title: "FREE MONEY!!! Click here to win $1000 instantly! Limited time offer! Act now before it expires! Buy now and get rich quick!!!",
        body: "",
        should_pass: false,
        reason: "Spam patterns and excessive punctuation"
      },
      {
        title: "A very long rambling post about hotdogs that goes on and on and on with excessive details about every single aspect of hotdog preparation methods",
        body: "",
        should_pass: false,
        reason: "Title too long (>150 characters)"
      },
      {
        title: "Great hotdog!",
        body: "I went to this amazing hotdog stand yesterday and had the most incredible Chicago-style dog with all the fixings. The bun was perfectly toasted and steamed.",
        should_pass: false,
        reason: "Body too long (>150 characters)"
      },
      // Test cases that should PASS
      {
        title: "Amazing Chicago dog!",
        body: "Best hotdog I've ever had",
        should_pass: true,
        reason: "Short, food-focused content"
      },
      {
        title: "Homemade chili dogs",
        body: "Made these beauties for dinner tonight 🌭",
        should_pass: true,
        reason: "Short, relevant content"
      },
      {
        title: "Local hotdog vendor",
        body: "",
        should_pass: true,
        reason: "Short title, no body"
      }
    ]
    
    return NextResponse.json({
      success: true,
      message: 'Lemmy filter testing completed',
      analysis,
      filter_test_cases: filterTests,
      recommendation: scanResult.rejected > scanResult.approved ? 
        "Filters are working well - rejecting more low-quality content than approving" :
        "Consider strengthening filters if too much low-quality content is getting through"
    })

  } catch (error) {
    console.error('Lemmy filter test error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}