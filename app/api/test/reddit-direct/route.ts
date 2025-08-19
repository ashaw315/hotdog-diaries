import { NextResponse } from 'next/server'
import { redditHttpService } from '@/lib/services/reddit-http'

export async function GET() {
  try {
    console.log('🧪 Testing Reddit HTTP service directly...')
    
    // Test direct Reddit API calls
    const tests = [
      { subreddit: 'food', query: 'hotdog', limit: 3 },
      { subreddit: 'food', query: 'hot dog', limit: 3 },
      { subreddit: 'FoodPorn', query: 'hotdog', limit: 2 }
    ]
    
    const results = []
    
    for (const test of tests) {
      try {
        console.log(`Testing ${test.subreddit} with query "${test.query}"...`)
        const posts = await redditHttpService.searchSubreddit(test.subreddit, test.query, test.limit)
        
        results.push({
          subreddit: test.subreddit,
          query: test.query,
          success: true,
          postsFound: posts.length,
          posts: posts.map(post => ({
            id: post.id,
            title: post.title.substring(0, 100) + (post.title.length > 100 ? '...' : ''),
            score: post.score,
            author: post.author,
            subreddit: post.subreddit,
            url: post.url
          }))
        })
        
        console.log(`✅ Found ${posts.length} posts in r/${test.subreddit}`)
      } catch (error) {
        results.push({
          subreddit: test.subreddit,
          query: test.query,
          success: false,
          error: error.message,
          postsFound: 0
        })
        console.log(`❌ Error in r/${test.subreddit}: ${error.message}`)
      }
    }
    
    // Test connection
    const connectionTest = await redditHttpService.testConnection()
    
    const summary = {
      totalTests: tests.length,
      successfulTests: results.filter(r => r.success).length,
      totalPostsFound: results.reduce((sum, r) => sum + r.postsFound, 0),
      connectionTest
    }
    
    return NextResponse.json({
      success: true,
      summary,
      results,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('❌ Reddit direct test failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}