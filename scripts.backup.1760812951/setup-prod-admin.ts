#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'
import { AdminService } from '../lib/services/admin'
import bcrypt from 'bcryptjs'

/**
 * Script to set up admin user in production Supabase database
 * This script should be run once to initialize the admin user
 */
async function setupProductionAdmin() {
  try {
    console.log('🔧 Setting up admin user in production Supabase database...')
    
    // Validate required environment variables
    const requiredEnvVars = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'ADMIN_USERNAME',
      'ADMIN_PASSWORD'
    ]
    
    const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar])
    if (missingVars.length > 0) {
      console.error('❌ Missing required environment variables:', missingVars)
      process.exit(1)
    }
    
    // Create Supabase client with service role key (bypasses RLS)
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
    
    console.log('✅ Connected to Supabase')
    
    // First, check if the admin_users table exists
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'admin_users')
    
    if (tablesError) {
      console.error('❌ Error checking tables:', tablesError)
      process.exit(1)
    }
    
    if (!tables || tables.length === 0) {
      console.log('📋 admin_users table does not exist. Creating table...')
      
      // Create the admin_users table
      const { error: createTableError } = await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS admin_users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            email VARCHAR(100) UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            full_name VARCHAR(100),
            is_active BOOLEAN DEFAULT TRUE,
            last_login TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          
          CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);
          CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
          CREATE INDEX IF NOT EXISTS idx_admin_users_last_login ON admin_users(last_login);
          
          CREATE OR REPLACE FUNCTION update_updated_at_admin_users()
          RETURNS TRIGGER AS $$
          BEGIN
              NEW.updated_at = NOW();
              RETURN NEW;
          END;
          $$ language 'plpgsql';
          
          CREATE TRIGGER update_admin_users_updated_at 
              BEFORE UPDATE ON admin_users 
              FOR EACH ROW EXECUTE FUNCTION update_updated_at_admin_users();
        `
      })
      
      if (createTableError) {
        console.error('❌ Error creating admin_users table:', createTableError)
        process.exit(1)
      }
      
      console.log('✅ admin_users table created successfully')
    } else {
      console.log('✅ admin_users table already exists')
    }
    
    // Check if admin user already exists
    const { data: existingAdmin, error: checkError } = await supabase
      .from('admin_users')
      .select('id, username, email')
      .eq('username', process.env.ADMIN_USERNAME!)
      .single()
    
    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('❌ Error checking for existing admin:', checkError)
      process.exit(1)
    }
    
    if (existingAdmin) {
      console.log('✅ Admin user already exists:', {
        id: existingAdmin.id,
        username: existingAdmin.username,
        email: existingAdmin.email
      })
      
      // Optionally update the password
      const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD!, 10)
      const { error: updateError } = await supabase
        .from('admin_users')
        .update({ password_hash: passwordHash })
        .eq('username', process.env.ADMIN_USERNAME!)
      
      if (updateError) {
        console.error('❌ Error updating admin password:', updateError)
        process.exit(1)
      }
      
      console.log('✅ Admin password updated')
    } else {
      console.log('👤 Creating new admin user...')
      
      // Hash the password
      const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD!, 10)
      
      // Create the admin user
      const { data: newAdmin, error: createError } = await supabase
        .from('admin_users')
        .insert({
          username: process.env.ADMIN_USERNAME!,
          email: `${process.env.ADMIN_USERNAME!}@hotdogdiaries.com`,
          password_hash: passwordHash,
          full_name: 'Administrator',
          is_active: true
        })
        .select()
        .single()
      
      if (createError) {
        console.error('❌ Error creating admin user:', createError)
        process.exit(1)
      }
      
      console.log('✅ Admin user created successfully:', {
        id: newAdmin.id,
        username: newAdmin.username,
        email: newAdmin.email
      })
    }
    
    console.log('🎉 Production admin setup completed successfully!')
    console.log('')
    console.log('📋 Admin Login Credentials:')
    console.log(`Username: ${process.env.ADMIN_USERNAME!}`)
    console.log(`Password: ${process.env.ADMIN_PASSWORD!}`)
    console.log('')
    console.log('🌐 You can now login at your production admin URL')
    
  } catch (error) {
    console.error('❌ Failed to set up production admin:', error)
    process.exit(1)
  }
}

// Run the setup if this script is executed directly
if (require.main === module) {
  setupProductionAdmin()
}