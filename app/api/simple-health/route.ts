import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const envInfo = {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL,
      VERCEL_ENV: process.env.VERCEL_ENV,
      POSTGRES_URL_EXISTS: !!process.env.POSTGRES_URL,
      DATABASE_URL_EXISTS: !!process.env.DATABASE_URL,
      POSTGRES_HOST: process.env.POSTGRES_HOST,
      POSTGRES_DATABASE: process.env.POSTGRES_DATABASE,
      timestamp: new Date().toISOString()
    };

    return NextResponse.json({
      status: 'basic_healthy',
      message: 'Server is running',
      environment: envInfo
    });
  } catch (error) {
    console.error('Simple health check failed:', error);
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}