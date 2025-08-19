import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Basic system information that doesn't require database access
    const systemInfo = {
      status: 'online',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      platform: 'vercel',
      version: '1.0.0'
    };

    return NextResponse.json({
      success: true,
      message: 'Hotdog Diaries is online',
      data: systemInfo
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}