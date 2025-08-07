import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  console.log('=== ENVIRONMENT VARIABLES DEBUG ===')
  
  // Try to instantiate RedditService to trigger constructor debug logs
  try {
    console.log('🧪 Testing Reddit service instantiation...')
    const { RedditService } = await import('@/lib/services/reddit')
    const redditService = new RedditService()
    console.log('✅ Reddit service instantiated successfully')
  } catch (error) {
    console.log('❌ Reddit service instantiation failed:', error.message)
  }
  console.log('NODE_ENV:', process.env.NODE_ENV)
  console.log('PWD:', process.env.PWD)
  
  // Log Reddit environment variables
  console.log('REDDIT_CLIENT_ID raw:', process.env.REDDIT_CLIENT_ID)
  console.log('REDDIT_CLIENT_SECRET raw:', process.env.REDDIT_CLIENT_SECRET)
  console.log('REDDIT_USERNAME raw:', process.env.REDDIT_USERNAME)
  console.log('REDDIT_PASSWORD raw:', process.env.REDDIT_PASSWORD)
  console.log('REDDIT_USER_AGENT raw:', process.env.REDDIT_USER_AGENT)
  
  // Check all env vars that start with REDDIT
  const allEnvVars = Object.keys(process.env).filter(key => key.startsWith('REDDIT'))
  console.log('All REDDIT_* env vars found:', allEnvVars)
  
  // Check if .env file is being loaded
  console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL)
  console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET)
  
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    reddit: {
      CLIENT_ID: process.env.REDDIT_CLIENT_ID ? 
        `SET (${process.env.REDDIT_CLIENT_ID.substring(0, 4)}...)` : 'NOT SET',
      CLIENT_SECRET: process.env.REDDIT_CLIENT_SECRET ? 
        `SET (${process.env.REDDIT_CLIENT_SECRET.substring(0, 4)}...)` : 'NOT SET', 
      USERNAME: process.env.REDDIT_USERNAME ? 
        `SET (${process.env.REDDIT_USERNAME})` : 'NOT SET',
      PASSWORD: process.env.REDDIT_PASSWORD ? 'SET (redacted)' : 'NOT SET',
      USER_AGENT: process.env.REDDIT_USER_AGENT || 'NOT SET'
    },
    otherEnvVars: {
      DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
      JWT_SECRET: process.env.JWT_SECRET ? 'SET' : 'NOT SET',
      ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'NOT SET'
    },
    allRedditVars: allEnvVars,
    totalEnvVars: Object.keys(process.env).length
  })
}