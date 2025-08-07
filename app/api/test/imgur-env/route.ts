import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.IMGUR_CLIENT_ID
    
    return NextResponse.json({
      success: true,
      data: {
        hasClientId: !!clientId,
        clientIdLength: clientId?.length || 0,
        clientIdMasked: clientId ? `${clientId.substring(0, 4)}***${clientId.substring(clientId.length - 3)}` : null,
        mode: clientId ? 'api' : 'mock',
        nodeEnv: process.env.NODE_ENV
      }
    })

  } catch (error) {
    console.error('Imgur env test error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    )
  }
}