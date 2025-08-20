import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  console.log('🧪 Testing YouTube API configuration...')
  
  try {
    // Auth check - same as other admin endpoints
    let userId: string | null = null
    let username: string | null = null

    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      try {
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString())
        if (decoded.username === 'admin' && decoded.id === 1) {
          userId = '1'
          username = 'admin'
        }
      } catch (e) {
        // Fall through to normal auth
      }
    }

    if (!userId) {
      userId = request.headers.get('x-user-id')
      username = request.headers.get('x-username')
    }

    if (!userId || !username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const apiKey = process.env.YOUTUBE_API_KEY
    
    // Comprehensive API key diagnostics
    const diagnostics = {
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        hasYouTubeKey: !!apiKey,
        keyLength: apiKey ? apiKey.length : 0,
        keyPrefix: apiKey ? apiKey.substring(0, 10) + '...' : 'N/A'
      },
      configuration: {
        expectedKeyFormat: 'AIza... (39 characters)',
        currentKeyValid: apiKey ? apiKey.startsWith('AIza') && apiKey.length === 39 : false,
        documentation: 'https://developers.google.com/youtube/v3/getting-started'
      }
    }

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'YouTube API key not configured',
        diagnostics,
        instructions: {
          step1: 'Go to Google Cloud Console (console.cloud.google.com)',
          step2: 'Create a new project or select existing project',
          step3: 'Enable YouTube Data API v3',
          step4: 'Create API key in "Credentials" section',
          step5: 'Add YOUTUBE_API_KEY to environment variables',
          step6: 'Restart the application'
        }
      })
    }

    // Test API key with minimal request
    console.log('🧪 Testing API key with YouTube search...')
    const testUrl = 'https://www.googleapis.com/youtube/v3/search'
    const testParams = new URLSearchParams({
      key: apiKey,
      q: 'test',
      part: 'snippet',
      type: 'video',
      maxResults: '1'
    })

    const testResponse = await fetch(`${testUrl}?${testParams}`)
    const responseText = await testResponse.text()
    
    let responseData
    try {
      responseData = JSON.parse(responseText)
    } catch (e) {
      responseData = { raw: responseText }
    }

    if (testResponse.ok) {
      // Success - API key is working
      return NextResponse.json({
        success: true,
        message: 'YouTube API key is working correctly!',
        diagnostics,
        testResult: {
          status: testResponse.status,
          videosFound: responseData.items?.length || 0,
          quotaUsed: '100 units (search operation)',
          nextSteps: 'API key is configured correctly. YouTube scanning should work.'
        }
      })
    } else {
      // Error - provide detailed diagnosis
      const errorDetails = responseData.error || responseData
      
      let diagnosis = 'Unknown error'
      let solution = 'Check API key configuration'
      
      if (testResponse.status === 403) {
        if (errorDetails.message?.includes('unregistered callers')) {
          diagnosis = 'API key is missing, invalid, or not properly formatted'
          solution = 'Generate a new YouTube Data API v3 key from Google Cloud Console'
        } else if (errorDetails.message?.includes('quota')) {
          diagnosis = 'YouTube API quota has been exceeded'
          solution = 'Wait for quota reset (daily) or request quota increase'
        } else if (errorDetails.message?.includes('disabled')) {
          diagnosis = 'YouTube Data API v3 is not enabled for this project'
          solution = 'Enable YouTube Data API v3 in Google Cloud Console'
        } else if (errorDetails.message?.includes('restricted')) {
          diagnosis = 'API key has restrictions that block this request'
          solution = 'Check API key restrictions in Google Cloud Console'
        }
      } else if (testResponse.status === 400) {
        diagnosis = 'Invalid API request parameters'
        solution = 'Check API key format (should be 39 characters starting with "AIza")'
      }

      return NextResponse.json({
        success: false,
        error: `YouTube API test failed: ${testResponse.status}`,
        diagnostics,
        errorAnalysis: {
          status: testResponse.status,
          message: errorDetails.message || 'Unknown error',
          diagnosis,
          solution,
          fullErrorResponse: responseData
        }
      })
    }

  } catch (error) {
    console.error('❌ Critical error in YouTube API test:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      diagnostics: {
        environment: {
          NODE_ENV: process.env.NODE_ENV,
          hasYouTubeKey: !!process.env.YOUTUBE_API_KEY
        }
      }
    }, { status: 500 })
  }
}