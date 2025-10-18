#!/usr/bin/env tsx

/**
 * Supabase Schema Migration Script
 * 
 * This script applies the comprehensive schema migration to Supabase.
 * It's safe to run multiple times as all operations use IF NOT EXISTS.
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { db } from '../lib/db'

async function runSupabaseMigration() {
  console.log('🚀 Starting Supabase schema migration...')
  
  try {
    // Connect to the database
    await db.connect()
    console.log('✅ Connected to database')
    
    // Read the migration SQL file
    const migrationPath = join(process.cwd(), 'migrations', 'supabase_schema_fix.sql')
    const migrationSQL = readFileSync(migrationPath, 'utf8')
    
    console.log('📄 Loaded migration file:', migrationPath)
    
    // Split the migration into individual statements (roughly)
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
    
    console.log(`📋 Found ${statements.length} SQL statements to execute`)
    
    let successCount = 0
    let errorCount = 0
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';'
      
      // Skip comments and empty statements
      if (statement.trim().startsWith('--') || statement.trim() === ';') {
        continue
      }
      
      try {
        console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`)
        
        // For debugging, show the type of statement
        const statementType = statement.trim().substring(0, 30).replace(/\s+/g, ' ')
        console.log(`   ${statementType}...`)
        
        await db.query(statement)
        successCount++
        
      } catch (error: any) {
        // Some errors are expected (like trying to create indexes that already exist)
        if (error.message?.includes('already exists') || 
            error.message?.includes('IF NOT EXISTS') ||
            error.message?.includes('column already exists')) {
          console.log(`   ⚠️  Statement already applied (skipping): ${error.message}`)
          successCount++
        } else {
          console.error(`   ❌ Error executing statement: ${error.message}`)
          console.error(`   Statement: ${statement.substring(0, 100)}...`)
          errorCount++
        }
      }
    }
    
    // Run verification queries
    console.log('\n🔍 Verifying migration results...')
    
    const verificationQueries = [
      {
        name: 'Check all tables exist',
        query: `SELECT table_name FROM information_schema.tables 
                WHERE table_schema = 'public' 
                ORDER BY table_name`
      },
      {
        name: 'Check system_logs table',
        query: 'SELECT COUNT(*) as count FROM system_logs LIMIT 1'
      },
      {
        name: 'Check system_alerts table', 
        query: 'SELECT COUNT(*) as count FROM system_alerts LIMIT 1'
      },
      {
        name: 'Check content_analysis table',
        query: 'SELECT COUNT(*) as count FROM content_analysis LIMIT 1'
      },
      {
        name: 'Check posted_content columns',
        query: `SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'posted_content' 
                AND table_schema = 'public'
                ORDER BY column_name`
      }
    ]
    
    for (const verification of verificationQueries) {
      try {
        console.log(`   ✓ ${verification.name}`)
        const result = await db.query(verification.query)
        
        if (verification.name === 'Check all tables exist') {
          const tables = result.rows.map((row: any) => row.table_name).sort()
          console.log(`     Found tables: ${tables.join(', ')}`)
        } else if (verification.name === 'Check posted_content columns') {
          const columns = result.rows.map((row: any) => row.column_name).sort()
          console.log(`     Columns: ${columns.join(', ')}`)
        }
        
      } catch (error: any) {
        console.error(`   ❌ Verification failed for ${verification.name}: ${error.message}`)
      }
    }
    
    // Summary
    console.log('\n📊 Migration Summary:')
    console.log(`   ✅ Successful statements: ${successCount}`)
    console.log(`   ❌ Failed statements: ${errorCount}`)
    
    if (errorCount === 0) {
      console.log('\n🎉 Migration completed successfully!')
    } else {
      console.log('\n⚠️  Migration completed with some errors. Please review the output above.')
    }
    
    // Record migration in migrations table
    try {
      await db.query(
        `INSERT INTO migrations (id, filename) 
         VALUES (999, 'supabase_schema_fix.sql') 
         ON CONFLICT (id) DO UPDATE SET executed_at = NOW()`
      )
      console.log('✅ Migration recorded in migrations table')
    } catch (error: any) {
      console.log(`⚠️  Could not record migration: ${error.message}`)
    }
    
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message)
    console.error('Stack trace:', error.stack)
    process.exit(1)
  } finally {
    try {
      await db.disconnect()
      console.log('✅ Database connection closed')
    } catch (error) {
      console.error('⚠️  Error closing database connection:', error)
    }
  }
}

// Check if DATABASE_URL is configured for Supabase
function validateEnvironment() {
  const databaseUrl = process.env.DATABASE_URL
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set')
    console.error('   Please configure your DATABASE_URL to point to your Supabase database')
    process.exit(1)
  }
  
  if (!databaseUrl.includes('supabase.co')) {
    console.error('❌ DATABASE_URL does not appear to be a Supabase connection string')
    console.error('   Expected URL to contain "supabase.co"')
    console.error('   Current URL type:', databaseUrl.includes('postgres') ? 'postgres' : 'unknown')
    process.exit(1)
  }
  
  console.log('✅ Environment validation passed')
  console.log('   Using Supabase database:', databaseUrl.split('@')[1]?.split(':')[0] || 'unknown host')
}

// Main execution
if (require.main === module) {
  validateEnvironment()
  runSupabaseMigration().catch(console.error)
}

export { runSupabaseMigration }