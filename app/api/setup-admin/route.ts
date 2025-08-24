import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import bcrypt from 'bcryptjs'

/**
 * One-time setup endpoint to create admin user in production
 * This should be called once after deployment to initialize the admin user
 * 
 * Security: Only works if no admin users exist yet
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Admin setup endpoint called')
    
    // Get credentials from environment variables
    const adminUsername = process.env.ADMIN_USERNAME || 'admin'
    const adminPassword = process.env.ADMIN_PASSWORD
    
    if (!adminPassword) {
      return NextResponse.json(
        { error: 'ADMIN_PASSWORD not configured' },
        { status: 500 }
      )
    }
    
    // Security check: Only allow if no admin users exist
    const existingAdmins = await sql`
      SELECT COUNT(*) as count FROM admin_users
    `
    
    const adminCount = parseInt(existingAdmins.rows[0]?.count || '0')
    
    if (adminCount > 0) {
      return NextResponse.json(
        { 
          message: 'Admin users already exist. This endpoint is disabled for security.',
          adminCount 
        },
        { status: 403 }
      )
    }
    
    // Create admin_users table if it doesn't exist
    console.log('📋 Creating admin_users table...')
    
    await sql`
      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(100),
        is_active BOOLEAN DEFAULT TRUE,
        last_login TIMESTAMP WITH TIME ZONE,
        login_count INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `
    
    // Create indexes
    await sql`
      CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username)
    `
    
    // Create admin user
    console.log('🆕 Creating admin user...')
    
    const passwordHash = await bcrypt.hash(adminPassword, 10)
    const adminEmail = `${adminUsername}@hotdogdiaries.com`
    
    const result = await sql`
      INSERT INTO admin_users (username, email, password_hash, full_name, is_active, login_count)
      VALUES (${adminUsername}, ${adminEmail}, ${passwordHash}, 'Administrator', true, 0)
      RETURNING id, username, email, created_at
    `
    
    if (result.rows.length === 0) {
      throw new Error('Failed to create admin user')
    }
    
    const newUser = result.rows[0]
    console.log('✅ Admin user created:', newUser.username)
    
    return NextResponse.json({
      success: true,
      message: 'Admin user created successfully',
      admin: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        created_at: newUser.created_at
      },
      credentials: {
        username: adminUsername,
        password: '***CONFIGURED***' // Don't expose the actual password
      }
    })
    
  } catch (error) {
    console.error('❌ Admin setup failed:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to create admin user',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}