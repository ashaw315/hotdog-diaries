import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { db } = await import('@/lib/db')
    
    // Get recent Lemmy posts from the database
    const recentQuery = `
      SELECT 
        id,
        content_text,
        LENGTH(content_text) as text_length,
        is_approved,
        content_type,
        original_url,
        original_author,
        scraped_at
      FROM content_queue 
      WHERE source_platform = 'lemmy'
      ORDER BY scraped_at DESC 
      LIMIT 10
    `
    
    const result = await db.query(recentQuery)
    const recentPosts = result.rows
    
    // Analyze the content
    const analysis = {
      total_recent_posts: recentPosts.length,
      approved_posts: recentPosts.filter(p => p.is_approved).length,
      rejected_posts: recentPosts.filter(p => !p.is_approved).length,
      approval_rate: recentPosts.length > 0 ? 
        Math.round((recentPosts.filter(p => p.is_approved).length / recentPosts.length) * 100) : 0,
      
      // Show examples of what got approved vs rejected
      approved_examples: recentPosts
        .filter(p => p.is_approved)
        .slice(0, 3)
        .map(p => ({
          text_preview: p.content_text?.substring(0, 100) + (p.content_text?.length > 100 ? '...' : ''),
          length: p.text_length,
          type: p.content_type,
          author: p.original_author
        })),
        
      rejected_examples: recentPosts
        .filter(p => !p.is_approved)
        .slice(0, 3)
        .map(p => ({
          text_preview: p.content_text?.substring(0, 100) + (p.content_text?.length > 100 ? '...' : ''),
          length: p.text_length,
          type: p.content_type,
          author: p.original_author,
          // reasoning: 'Check content processor logs'
        })),
      
      // Look for hotdog community content specifically
      hotdog_community_posts: recentPosts.filter(p => 
        p.original_author?.includes('hot_dog') || 
        p.content_text?.toLowerCase().includes('hot dog') ||
        p.content_text?.toLowerCase().includes('hotdog')
      ).length,
      
      content_length_analysis: {
        avg_length: recentPosts.length > 0 ? 
          Math.round(recentPosts.reduce((sum, p) => sum + (p.text_length || 0), 0) / recentPosts.length) : 0,
        max_length: recentPosts.length > 0 ? Math.max(...recentPosts.map(p => p.text_length || 0)) : 0,
        min_length: recentPosts.length > 0 ? Math.min(...recentPosts.map(p => p.text_length || 0)) : 0
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Recent Lemmy content analysis',
      analysis,
      raw_posts: recentPosts.map(p => ({
        id: p.id,
        text_preview: p.content_text?.substring(0, 80) + '...',
        length: p.text_length,
        approved: p.is_approved,
        type: p.content_type,
        scraped: p.scraped_at,
        author: p.original_author
      }))
    })

  } catch (error) {
    console.error('Recent content analysis error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}