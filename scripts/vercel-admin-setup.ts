#!/usr/bin/env tsx

/**
 * Script to create admin user in Vercel production database
 * This script is designed to run on Vercel with production environment variables
 */

import { sql } from '@vercel/postgres'
import bcrypt from 'bcryptjs'

async function createAdminUserOnVercel() {
  try {
    console.log('🔧 Creating admin user in Vercel production database...')
    
    // Get credentials from Vercel environment variables
    const adminUsername = process.env.ADMIN_USERNAME || 'admin'
    const adminPassword = process.env.ADMIN_PASSWORD
    const adminEmail = `${adminUsername}@hotdogdiaries.com`
    
    if (!adminPassword) {
      throw new Error('ADMIN_PASSWORD environment variable is required')
    }
    
    console.log(`👤 Using username: ${adminUsername}`)
    
    // First, ensure the admin_users table exists
    console.log('📋 Creating admin_users table if not exists...')
    
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
      );
    `
    
    // Create indexes
    await sql`
      CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);
    `
    await sql`
      CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
    `
    
    console.log('✅ admin_users table ready')
    
    // Check if admin user already exists
    const existingUsers = await sql`
      SELECT id, username, email, is_active 
      FROM admin_users 
      WHERE username = ${adminUsername}
    `
    
    if (existingUsers.rows.length > 0) {
      const existingUser = existingUsers.rows[0]
      console.log('✅ Admin user already exists:', {
        id: existingUser.id,
        username: existingUser.username,
        email: existingUser.email,
        isActive: existingUser.is_active
      })
      
      // Update the password
      console.log('🔄 Updating admin password...')
      const passwordHash = await bcrypt.hash(adminPassword, 10)
      
      await sql`
        UPDATE admin_users 
        SET password_hash = ${passwordHash}, updated_at = NOW() 
        WHERE username = ${adminUsername}
      `
      
      console.log('✅ Admin password updated')
    } else {
      // Create new admin user
      console.log('🆕 Creating new admin user...')
      
      const passwordHash = await bcrypt.hash(adminPassword, 10)
      
      const result = await sql`
        INSERT INTO admin_users (username, email, password_hash, full_name, is_active, login_count)
        VALUES (${adminUsername}, ${adminEmail}, ${passwordHash}, 'Administrator', true, 0)
        RETURNING id, username, email
      `
      
      if (result.rows.length === 0) {
        throw new Error('Failed to create admin user')
      }
      
      const newUser = result.rows[0]
      console.log('✅ Admin user created successfully:', {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email
      })
    }
    
    console.log('')
    console.log('🎉 Vercel admin setup completed successfully!')
    console.log('')
    console.log('📋 Admin Login Credentials:')
    console.log(`Username: ${adminUsername}`)
    console.log(`Password: ${adminPassword}`)
    console.log(`Email: ${adminEmail}`)
    console.log('')
    console.log('🌐 You can now login at your production admin URL')
    
  } catch (error) {
    console.error('❌ Failed to set up Vercel admin:', error)
    if (error instanceof Error) {
      console.error('Error details:', error.message)
    }
    throw error
  }
}

// Export for Vercel Functions
export default async function handler() {
  await createAdminUserOnVercel()
  return { success: true }
}

// Run directly if called
// ES module check for direct execution
const isMainModule = process.argv[1] && process.argv[1].includes('vercel-admin-setup')
if (isMainModule) {
  createAdminUserOnVercel().catch((error) => {
    console.error('Script failed:', error)
    process.exit(1)
  })
}