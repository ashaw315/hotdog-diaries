#!/usr/bin/env tsx

import { AdminService } from '../lib/services/admin'
import { db } from '../lib/db'

/**
 * Script to create admin user in production database
 * Works with both Supabase and other PostgreSQL databases
 */
async function createProductionAdmin() {
  try {
    console.log('🔧 Setting up admin user in production database...')
    console.log(`Environment: ${process.env.NODE_ENV}`)
    console.log(`Database mode: ${process.env.POSTGRES_URL ? 'Postgres/Supabase' : 'Local'}`)
    
    // Connect to the database
    await db.connect()
    console.log('✅ Connected to database')
    
    // Get admin credentials from environment
    const adminUsername = process.env.ADMIN_USERNAME || 'admin'
    const adminPassword = process.env.ADMIN_PASSWORD || 'StrongAdminPass123!'
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@hotdogdiaries.com'
    
    console.log(`👤 Using username: ${adminUsername}`)
    
    // First, ensure the admin_users table exists with correct schema
    console.log('📋 Ensuring admin_users table exists...')
    
    try {
      await db.query(`
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
      `)
      
      // Ensure indexes exist
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);
        CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
        CREATE INDEX IF NOT EXISTS idx_admin_users_last_login ON admin_users(last_login);
      `)
      
      console.log('✅ admin_users table ready')
    } catch (tableError) {
      console.log('⚠️  Table creation warning (may already exist):', tableError)
    }
    
    // Check if admin user already exists
    try {
      const existingAdmin = await AdminService.getAdminByUsername(adminUsername)
      if (existingAdmin) {
        console.log('✅ Admin user already exists:', {
          id: existingAdmin.id,
          username: existingAdmin.username,
          email: existingAdmin.email,
          isActive: existingAdmin.is_active
        })
        
        // Update the password to ensure it's current
        console.log('🔄 Updating admin password...')
        await db.query(
          `UPDATE admin_users SET password_hash = $1, updated_at = NOW() WHERE username = $2`,
          [await require('bcryptjs').hash(adminPassword, 10), adminUsername]
        )
        console.log('✅ Admin password updated')
        
        console.log('')
        console.log('🎉 Admin setup completed!')
        console.log('📋 Login Credentials:')
        console.log(`Username: ${adminUsername}`)
        console.log(`Password: ${adminPassword}`)
        console.log(`Email: ${existingAdmin.email}`)
        
        return
      }
    } catch (error) {
      console.log('👤 No existing admin found, creating new one...')
    }
    
    // Create new admin user
    console.log('🆕 Creating new admin user...')
    
    const adminUser = await AdminService.createAdminUser({
      username: adminUsername,
      password: adminPassword,
      email: adminEmail,
      full_name: 'Administrator',
      is_active: true
    })
    
    console.log('✅ Admin user created successfully:', {
      id: adminUser.id,
      username: adminUser.username,
      email: adminUser.email
    })
    
    console.log('')
    console.log('🎉 Production admin setup completed successfully!')
    console.log('')
    console.log('📋 Admin Login Credentials:')
    console.log(`Username: ${adminUsername}`)
    console.log(`Password: ${adminPassword}`)
    console.log(`Email: ${adminEmail}`)
    console.log('')
    console.log('🌐 You can now login at your production admin URL')
    
  } catch (error) {
    console.error('❌ Failed to set up production admin:', error)
    if (error instanceof Error) {
      console.error('Error details:', error.message)
      console.error('Stack trace:', error.stack)
    }
    process.exit(1)
  } finally {
    try {
      await db.disconnect()
    } catch (disconnectError) {
      console.error('⚠️  Warning: Failed to disconnect from database:', disconnectError)
    }
  }
}

// Run the setup if this script is executed directly
if (require.main === module) {
  createProductionAdmin()
}

export default createProductionAdmin