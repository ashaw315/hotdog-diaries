import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.TUMBLR_API_KEY
    const apiSecret = process.env.TUMBLR_API_SECRET
    
    return NextResponse.json({
      success: true,
      data: {
        hasApiKey: !!apiKey,
        hasApiSecret: !!apiSecret,
        apiKeyLength: apiKey?.length || 0,
        apiSecretLength: apiSecret?.length || 0,
        apiKeyMasked: apiKey ? `${apiKey.substring(0, 4)}***${apiKey.substring(apiKey.length - 3)}` : null,
        mode: (apiKey && apiSecret) ? 'api' : 'mock',
        nodeEnv: process.env.NODE_ENV
      }
    })

  } catch (error) {
    console.error('Tumblr env test error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    )
  }
}