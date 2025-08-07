import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY
    
    return NextResponse.json({
      success: true,
      data: {
        hasApiKey: !!apiKey,
        apiKeyLength: apiKey?.length || 0,
        apiKeyMasked: apiKey ? `${apiKey.substring(0, 4)}***${apiKey.substring(apiKey.length - 3)}` : null,
        mode: apiKey ? 'api' : 'mock',
        nodeEnv: process.env.NODE_ENV
      }
    })

  } catch (error) {
    console.error('YouTube env test error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    )
  }
}