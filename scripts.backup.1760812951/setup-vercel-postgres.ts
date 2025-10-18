#!/usr/bin/env tsx
/**
 * Vercel PostgreSQL Setup Script
 * Handles database initialization for production deployment
 */

import { sql } from '@vercel/postgres'
import fs from 'fs'
import path from 'path'

// Ensure this script only runs in production/preview environments
if (process.env.NODE_ENV === 'development') {
  console.log('⚠️ This script is for production deployment only')
  process.exit(0)
}

async function setupVercelPostgres() {
  console.log('🚀 Setting up Vercel PostgreSQL database...')
  
  // Check if required environment variables are present
  const requiredEnvVars = [
    'POSTGRES_URL',
    'POSTGRES_HOST', 
    'POSTGRES_USER',
    'POSTGRES_DATABASE'
  ]
  
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.error(`❌ Missing required environment variable: ${envVar}`)
      process.exit(1)
    }
  }
  
  console.log('✅ Environment variables verified')
  
  try {
    // Test connection
    console.log('🔌 Testing database connection...')
    const testResult = await sql`SELECT NOW() as current_time`
    console.log('✅ Database connection successful:', testResult.rows[0].current_time)
    
    // Check if tables already exist
    console.log('🔍 Checking existing database schema...')
    const tableCheck = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `
    
    if (tableCheck.rows.length > 0) {
      console.log('✅ Database already initialized with tables:', 
        tableCheck.rows.map(r => r.table_name).join(', '))
      return
    }
    
    // Run migrations
    console.log('📊 Running database migrations...')
    await runMigrations()
    
    // Create admin user
    console.log('👤 Setting up admin user...')
    await setupAdminUser()
    
    console.log('🎉 Vercel PostgreSQL setup completed successfully!')
    
  } catch (error) {
    console.error('❌ Database setup failed:', error)
    throw error
  }
}

async function runMigrations() {
  const migrationsDir = path.join(process.cwd(), 'lib/migrations')
  const migrationFiles = [
    '001_initial_schema.sql',
    '002_reddit_integration.sql',
    '004_logging_schema_fixes.sql',
    '005_mastodon_integration.sql',
    '006_scan_config.sql',
    '007_content_status_workflow.sql',
    'add_posting_system_tables.sql'
  ]
  
  for (const file of migrationFiles) {
    const filePath = path.join(migrationsDir, file)
    
    if (!fs.existsSync(filePath)) {
      console.log(`⏭️ Skipping missing migration: ${file}`)
      continue
    }
    
    console.log(`📄 Running migration: ${file}`)
    
    try {
      const migrationSQL = fs.readFileSync(filePath, 'utf8')
      
      // Split SQL file by statements (simple approach)
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s && !s.startsWith('--'))
      
      for (const statement of statements) {
        if (statement.trim()) {
          await sql.query(statement)
        }
      }
      
      console.log(`✅ Migration completed: ${file}`)
      
    } catch (error: any) {
      // Some errors are expected (like tables already existing)
      if (error.message?.includes('already exists')) {
        console.log(`⚠️ Migration skipped (already applied): ${file}`)
      } else {
        console.error(`❌ Migration failed: ${file}`, error.message)
        throw error
      }
    }
  }
}

async function setupAdminUser() {
  const bcrypt = require('bcryptjs')
  
  const adminData = {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'StrongAdminPass123!',
    email: process.env.ADMIN_EMAIL || 'admin@hotdogdiaries.com',
    full_name: process.env.ADMIN_FULL_NAME || 'Administrator'
  }
  
  // Check if admin user already exists
  const existingAdmin = await sql`
    SELECT id, username FROM admin_users WHERE username = ${adminData.username}
  `
  
  if (existingAdmin.rows.length > 0) {
    console.log('✅ Admin user already exists:', existingAdmin.rows[0].username)
    return
  }
  
  // Hash password
  const hashedPassword = await bcrypt.hash(adminData.password, 10)
  
  // Create admin user
  await sql`
    INSERT INTO admin_users (username, password_hash, email, full_name, is_active, created_at, updated_at)
    VALUES (${adminData.username}, ${hashedPassword}, ${adminData.email}, ${adminData.full_name}, true, NOW(), NOW())
  `
  
  console.log('✅ Admin user created:', adminData.username)
}

// Auto-run if called directly
if (require.main === module) {
  setupVercelPostgres()
    .then(() => {
      console.log('✅ Setup completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Setup failed:', error)
      process.exit(1)
    })
}

export { setupVercelPostgres }