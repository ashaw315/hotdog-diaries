import { NextResponse } from 'next/server';
import { Pool } from 'pg';
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

    // Create database connection
    const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    
    if (!connectionString) {
      return NextResponse.json({
        success: false,
        error: 'Database not configured'
      }, { status: 500 });
    }

    const pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
      } : false
    });

    try {
      // First, ensure the admin user exists
      const userCheck = await pool.query(
        'SELECT id, username, password_hash FROM admin_users WHERE username = $1',
        [username]
      );

      let user = userCheck.rows[0];

      // If admin user doesn't exist, create it
      if (!user && username === 'admin') {
        console.log('🔧 Admin user not found, creating...');
        
        // Create admin_users table if it doesn't exist
        await pool.query(`
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
        `);

        // Create the admin user
        const hashedPassword = await bcrypt.hash('StrongAdminPass123!', 10);
        const createResult = await pool.query(
          'INSERT INTO admin_users (username, password_hash, email, full_name) VALUES ($1, $2, $3, $4) RETURNING id, username, password_hash',
          ['admin', hashedPassword, 'admin@hotdogdiaries.com', 'Administrator']
        );
        
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
      await pool.query(
        'UPDATE admin_users SET last_login = NOW() WHERE id = $1',
        [user.id]
      );

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

    } finally {
      await pool.end();
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