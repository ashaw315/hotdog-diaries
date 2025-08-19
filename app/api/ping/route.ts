import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Hotdog Diaries API is alive',
    timestamp: new Date().toISOString(),
    deployment: 'working'
  });
}