import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Starting database debug...')
    
    // Check environment variables
    const envDebug = {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL,
      VERCEL_ENV: process.env.VERCEL_ENV,
      hasPostgresUrl: !!process.env.POSTGRES_URL,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasSupabaseServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    }
    
    console.log('🔍 Environment debug:', envDebug)
    
    // Try to connect to database
    await db.connect()
    console.log('✅ Database connection successful')
    
    // Try a simple query
    const result = await db.query('SELECT 1 as test')
    console.log('✅ Query successful:', result.rows)
    
    await db.disconnect()
    
    return NextResponse.json({
      success: true,
      message: 'Database debug successful',
      environment: envDebug,
      testResult: result.rows
    })
    
  } catch (error) {
    console.error('❌ Database debug failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        VERCEL: process.env.VERCEL,
        VERCEL_ENV: process.env.VERCEL_ENV,
        hasPostgresUrl: !!process.env.POSTGRES_URL,
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        hasSupabaseUrl: !!process.env.SUPABASE_URL,
        hasSupabaseServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY
      }
    }, { status: 500 })
  }
}