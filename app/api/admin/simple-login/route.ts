import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    
    if (!username || !password) {
      return NextResponse.json({
        success: false,
        error: 'Username and password required'
      }, { status: 400 });
    }

    // TEMPORARY: Bypass database for testing
    if (username === 'admin' && password === 'admin123') {
      const token = Buffer.from(JSON.stringify({
        id: 1,
        username: 'admin',
        exp: Date.now() + (24 * 60 * 60 * 1000)
      })).toString('base64');

      return NextResponse.json({
        success: true,
        user: { id: 1, username: 'admin' },
        accessToken: token,
        message: 'Test login successful (no database)'
      });
    }

    try {
      // First, ensure the admin user exists
      const userCheck = await sql`
        SELECT id, username, password_hash FROM admin_users WHERE username = ${username}
      `;

      let user = userCheck.rows[0];

      // If admin user doesn't exist, create it
      if (!user && username === 'admin') {
        console.log('🔧 Admin user not found, creating...');
        
        // Create admin_users table if it doesn't exist
        await sql`
          CREATE TABLE IF NOT EXISTS admin_users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            email VARCHAR(255),
            full_name VARCHAR(255),
            is_active BOOLEAN DEFAULT true,
            last_login TIMESTAMP,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `;

        // Create the admin user  
        const hashedPassword = await bcrypt.hash('admin123', 10);
        const createResult = await sql`
          INSERT INTO admin_users (username, password_hash, email, full_name) 
          VALUES (${username}, ${hashedPassword}, ${'admin@hotdogdiaries.com'}, ${'Administrator'}) 
          RETURNING id, username, password_hash
        `;
        
        user = createResult.rows[0];
        console.log('✅ Admin user created');
      }

      if (!user) {
        return NextResponse.json({
          success: false,
          error: 'Invalid username or password'
        }, { status: 401 });
      }

      // Check password
      const passwordValid = await bcrypt.compare(password, user.password_hash);
      
      if (!passwordValid) {
        return NextResponse.json({
          success: false,
          error: 'Invalid username or password'
        }, { status: 401 });
      }

      // Update last login
      await sql`
        UPDATE admin_users SET last_login = NOW() WHERE id = ${user.id}
      `;

      // Simple token (in production, use proper JWT)
      const token = Buffer.from(JSON.stringify({
        id: user.id,
        username: user.username,
        exp: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
      })).toString('base64');

      return NextResponse.json({
        success: true,
        user: {
          id: user.id,
          username: user.username
        },
        accessToken: token,
        message: 'Login successful'
      });

    } catch (dbError) {
      console.error('❌ Database error:', dbError);
      throw dbError;
    }

  } catch (error) {
    console.error('❌ Login error:', error);
    return NextResponse.json({
      success: false,
      error: 'Authentication failed',
      details: error.message
    }, { status: 500 });
  }
}