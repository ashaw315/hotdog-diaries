import { NextRequest, NextResponse } from 'next/server'
import { YouTubeService } from '@/lib/services/youtube'

export async function GET(request: NextRequest) {
  try {
    const service = new YouTubeService()
    
    // Debug environment variable loading
    const hasApiKey = !!process.env.YOUTUBE_API_KEY
    const apiKeyLength = process.env.YOUTUBE_API_KEY?.length || 0
    
    console.log('🐛 YouTube Debug Info:')
    console.log('- Has API Key:', hasApiKey)
    console.log('- API Key Length:', apiKeyLength)
    console.log('- API Key (first 10 chars):', process.env.YOUTUBE_API_KEY?.substring(0, 10) + '...')
    
    // Test API status
    const apiStatus = await service.getApiStatus()
    
    console.log('- API Status:', apiStatus)
    
    // Test a direct search
    let searchTest = null
    try {
      searchTest = await service.searchVideos({
        q: 'cooking',
        maxResults: 2,
        type: 'video'
      })
      console.log('- Search test results:', searchTest.length)
    } catch (searchError) {
      console.log('- Search test error:', searchError)
      searchTest = { error: searchError.message }
    }
    
    return NextResponse.json({
      success: true,
      debug: {
        hasApiKey,
        apiKeyLength,
        apiKeyPrefix: process.env.YOUTUBE_API_KEY?.substring(0, 10) + '...',
        apiStatus,
        searchTest: Array.isArray(searchTest) ? 
          { count: searchTest.length, firstTitle: searchTest[0]?.title } : 
          searchTest
      }
    })

  } catch (error) {
    console.error('YouTube debug error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        debug: {
          hasApiKey: !!process.env.YOUTUBE_API_KEY,
          apiKeyLength: process.env.YOUTUBE_API_KEY?.length || 0
        }
      },
      { status: 500 }
    )
  }
}