import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    console.log('📋 Getting examples of Lemmy content filtering...')
    
    const { db } = await import('@/lib/db')
    
    // Get examples of posts that would be filtered out vs. kept
    const examplesQuery = `
      SELECT 
        id,
        content_text,
        LENGTH(content_text) as text_length,
        is_approved,
        scraped_at,
        original_url,
        original_author
      FROM content_queue 
      WHERE source_platform = 'lemmy'
      ORDER BY scraped_at DESC 
      LIMIT 20
    `
    
    const result = await db.query(examplesQuery)
    const posts = result.rows
    
    // Categorize posts
    const longPosts = posts.filter(p => p.text_length > 150)
    const shortPosts = posts.filter(p => p.text_length <= 150)
    
    // Check for political/news content in the text
    const checkPoliticalNews = (text: string): boolean => {
      const content = text.toLowerCase()
      const politicalKeywords = [
        'trump', 'biden', 'election', 'congress', 'senate', 'republican', 'democrat',
        'politics', 'political', 'government', 'legislation', 'vote', 'voting',
        'news:', 'breaking:', 'update:', 'report:', 'sources say', 'according to'
      ]
      return politicalKeywords.some(keyword => content.includes(keyword))
    }
    
    // Examples that would be FILTERED OUT
    const filteredOutExamples = longPosts.slice(0, 5).map(post => ({
      id: post.id,
      reason: post.text_length > 150 ? `Too long (${post.text_length} chars)` : 'Other filter',
      preview: post.content_text.substring(0, 100) + (post.content_text.length > 100 ? '...' : ''),
      is_political_news: checkPoliticalNews(post.content_text),
      original_length: post.text_length,
      scraped_at: post.scraped_at,
      was_approved: post.is_approved
    }))
    
    // Examples that would PASS filters  
    const passingExamples = shortPosts.slice(0, 5).map(post => ({
      id: post.id,
      reason: 'Passes length filter',
      full_text: post.content_text,
      length: post.text_length,
      is_political_news: checkPoliticalNews(post.content_text),
      scraped_at: post.scraped_at,
      was_approved: post.is_approved
    }))
    
    return NextResponse.json({
      success: true,
      message: 'Lemmy content filtering examples',
      summary: {
        total_posts_analyzed: posts.length,
        would_be_filtered_out: longPosts.length,
        would_pass_filter: shortPosts.length,
        filtering_effectiveness: Math.round((longPosts.length / posts.length) * 100) + '%'
      },
      examples_filtered_out: filteredOutExamples,
      examples_that_pass: passingExamples,
      filter_criteria: {
        max_title_length: 150,
        max_body_length: 150,
        blocks_political_keywords: true,
        blocks_spam_patterns: true,
        blocks_excessive_punctuation: true
      },
      quality_improvement: {
        before_filtering: {
          average_length: posts.length > 0 ? Math.round(posts.reduce((sum, p) => sum + p.text_length, 0) / posts.length) : 0,
          longest_post: posts.length > 0 ? Math.max(...posts.map(p => p.text_length)) : 0
        },
        after_filtering: {
          average_length: shortPosts.length > 0 ? Math.round(shortPosts.reduce((sum, p) => sum + p.text_length, 0) / shortPosts.length) : 0,
          longest_post: shortPosts.length > 0 ? Math.max(...shortPosts.map(p => p.text_length)) : 0
        }
      }
    })

  } catch (error) {
    console.error('Lemmy examples error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}