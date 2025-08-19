import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    
    if (!username || !password) {
      return NextResponse.json({
        success: false,
        error: 'Username and password required'
      }, { status: 400 });
    }

    // Hardcoded test credentials - no database required
    if (username === 'admin' && password === 'admin123') {
      // Simple token (in production, use proper JWT)
      const token = Buffer.from(JSON.stringify({
        id: 1,
        username: 'admin',
        exp: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
      })).toString('base64');

      return NextResponse.json({
        success: true,
        user: {
          id: 1,
          username: 'admin'
        },
        accessToken: token,
        message: 'Test login successful - no database required'
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid credentials - use admin/admin123'
      }, { status: 401 });
    }

  } catch (error) {
    console.error('❌ Test login error:', error);
    return NextResponse.json({
      success: false,
      error: 'Login failed',
      details: error.message
    }, { status: 500 });
  }
}