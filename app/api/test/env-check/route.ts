import { NextResponse } from 'next/server'
import { existsSync } from 'fs'

export async function GET() {
  // Check what environment variables are available
  const envCheck = {
    youtube: {
      exists: !!process.env.YOUTUBE_API_KEY,
      length: process.env.YOUTUBE_API_KEY?.length || 0,
      isNotMock: process.env.YOUTUBE_API_KEY !== 'mock',
      preview: process.env.YOUTUBE_API_KEY?.substring(0, 5) + '...'
    },
    giphy: {
      exists: !!process.env.GIPHY_API_KEY,
      length: process.env.GIPHY_API_KEY?.length || 0,
      isNotMock: process.env.GIPHY_API_KEY !== 'mock',
      preview: process.env.GIPHY_API_KEY?.substring(0, 5) + '...'
    },
    nodeEnv: process.env.NODE_ENV,
    envFileCheck: {
      dotenvLocal: existsSync('.env.local'),
      dotenv: existsSync('.env')
    }
  }
  
  return NextResponse.json({
    message: 'Environment check',
    checks: envCheck,
    recommendation: (!envCheck.youtube.exists || !envCheck.giphy.exists) 
      ? 'API keys not loading - check .env.local and restart dev server'
      : 'API keys detected - services should use real data',
    timestamp: new Date().toISOString()
  })
}