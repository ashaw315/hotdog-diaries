import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.PIXABAY_API_KEY;
  
  return NextResponse.json({
    success: true,
    platform: 'pixabay',
    status: 'active',
    authentication: apiKey ? 'connected' : 'disconnected',
    health: 'healthy',
    lastScan: null,
    contentFound: 0,
    errorRate: 0,
    stats: {
      imagesFound: 0,
      totalQueries: 0
    }
  });
}