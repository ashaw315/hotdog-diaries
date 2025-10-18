#!/usr/bin/env tsx
/**
 * Schema Repair Script for Supabase Production Database
 * Automatically adds missing columns to ensure compatibility
 * 
 * Usage: npx tsx scripts/fix-supabase-schema.ts
 */

import { db } from '../lib/db'
import { verifyTableColumns } from '../lib/db-schema-utils'

interface ColumnDefinition {
  name: string
  type: string
  defaultValue?: string
  nullable?: boolean
}

async function main() {
  console.log('🔧 Starting Supabase Schema Repair...')
  console.log('Environment:', process.env.NODE_ENV)
  console.log('Database URL set:', Boolean(process.env.DATABASE_URL))
  
  try {
    // Check database connection
    const healthCheck = await db.healthCheck()
    console.log('Database health:', healthCheck)
    
    if (!healthCheck.connected) {
      throw new Error('Database connection failed')
    }
    
    // Define required columns for each table
    const requiredSchema: Record<string, ColumnDefinition[]> = {
      content_queue: [
        { name: 'id', type: 'SERIAL PRIMARY KEY', nullable: false },
        { name: 'content_text', type: 'TEXT', nullable: true },
        { name: 'content_type', type: 'VARCHAR(50)', nullable: false },
        { name: 'source_platform', type: 'VARCHAR(50)', nullable: false },
        { name: 'original_url', type: 'TEXT', nullable: true },
        { name: 'original_author', type: 'VARCHAR(255)', nullable: true },
        { name: 'content_image_url', type: 'TEXT', nullable: true },
        { name: 'content_video_url', type: 'TEXT', nullable: true },
        { name: 'scraped_at', type: 'TIMESTAMPTZ', defaultValue: 'NOW()', nullable: true },
        { name: 'is_posted', type: 'BOOLEAN', defaultValue: 'FALSE', nullable: false },
        { name: 'is_approved', type: 'BOOLEAN', defaultValue: 'FALSE', nullable: false },
        { name: 'admin_notes', type: 'TEXT', nullable: true },
        { name: 'created_at', type: 'TIMESTAMPTZ', defaultValue: 'NOW()', nullable: false },
        { name: 'updated_at', type: 'TIMESTAMPTZ', defaultValue: 'NOW()', nullable: false },
        { name: 'confidence_score', type: 'DECIMAL(3,2)', defaultValue: '0.50', nullable: true },
        { name: 'content_hash', type: 'VARCHAR(255)', nullable: true },
        { name: 'is_rejected', type: 'BOOLEAN', defaultValue: 'FALSE', nullable: true },
        { name: 'content_status', type: 'VARCHAR(50)', defaultValue: "'pending'", nullable: true },
        { name: 'reviewed_at', type: 'TIMESTAMPTZ', nullable: true },
        { name: 'reviewed_by', type: 'VARCHAR(255)', nullable: true },
        { name: 'rejection_reason', type: 'TEXT', nullable: true }
      ],
      posted_content: [
        { name: 'id', type: 'SERIAL PRIMARY KEY', nullable: false },
        { name: 'content_queue_id', type: 'INTEGER REFERENCES content_queue(id)', nullable: false },
        { name: 'posted_at', type: 'TIMESTAMPTZ', defaultValue: 'NOW()', nullable: false },
        { name: 'post_order', type: 'INTEGER', nullable: true },
        { name: 'scheduled_time', type: 'TIMESTAMPTZ', nullable: true },
        { name: 'created_at', type: 'TIMESTAMPTZ', defaultValue: 'NOW()', nullable: false }
      ],
      admin_users: [
        { name: 'id', type: 'SERIAL PRIMARY KEY', nullable: false },
        { name: 'username', type: 'VARCHAR(255) UNIQUE', nullable: false },
        { name: 'password_hash', type: 'TEXT', nullable: false },
        { name: 'email', type: 'VARCHAR(255)', nullable: true },
        { name: 'full_name', type: 'VARCHAR(255)', nullable: true },
        { name: 'is_active', type: 'BOOLEAN', defaultValue: 'TRUE', nullable: false },
        { name: 'created_at', type: 'TIMESTAMPTZ', defaultValue: 'NOW()', nullable: false },
        { name: 'last_login_at', type: 'TIMESTAMPTZ', nullable: true },
        { name: 'login_count', type: 'INTEGER', defaultValue: '0', nullable: false }
      ]
    }
    
    const fixes: string[] = []
    const errors: string[] = []
    
    // Process each table
    for (const [table, columns] of Object.entries(requiredSchema)) {
      console.log(`\n📊 Checking table: ${table}`)
      
      try {
        // Get existing columns
        const existingColumns = await verifyTableColumns(table)
        
        if (existingColumns.length === 0) {
          console.log(`❌ Table '${table}' does not exist`)
          errors.push(`Table '${table}' does not exist - manual creation required`)
          continue
        }
        
        console.log(`Found ${existingColumns.length} existing columns`)
        
        // Check for missing columns
        for (const column of columns) {
          if (!existingColumns.includes(column.name)) {
            console.log(`⚠️  Missing column: ${column.name}`)
            
            // Skip primary keys - can't add them after table creation
            if (column.type.includes('PRIMARY KEY')) {
              console.log(`   Skipping PRIMARY KEY column - requires manual intervention`)
              continue
            }
            
            // Build ALTER TABLE statement
            let alterSql = `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column.name} ${column.type}`
            
            if (column.defaultValue) {
              alterSql += ` DEFAULT ${column.defaultValue}`
            }
            
            if (column.nullable === false && !column.defaultValue) {
              // For non-nullable columns without defaults, we need to add them as nullable first
              alterSql = `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column.name} ${column.type}`
            }
            
            try {
              console.log(`   Executing: ${alterSql}`)
              await db.query(alterSql)
              fixes.push(`Added column ${table}.${column.name}`)
              console.log(`   ✅ Column added successfully`)
            } catch (err: any) {
              if (err.code === '42701') {
                console.log(`   ℹ️  Column already exists (duplicate)`)
              } else {
                console.error(`   ❌ Failed to add column: ${err.message}`)
                errors.push(`Failed to add ${table}.${column.name}: ${err.message}`)
              }
            }
          }
        }
      } catch (error: any) {
        console.error(`❌ Error processing table ${table}:`, error.message)
        errors.push(`Error processing table ${table}: ${error.message}`)
      }
    }
    
    // Create indexes for better performance
    console.log('\n📈 Creating indexes...')
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_content_queue_status ON content_queue(is_posted, is_approved)',
      'CREATE INDEX IF NOT EXISTS idx_content_queue_platform ON content_queue(source_platform)',
      'CREATE INDEX IF NOT EXISTS idx_content_queue_created ON content_queue(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_posted_content_queue_id ON posted_content(content_queue_id)',
      'CREATE INDEX IF NOT EXISTS idx_posted_content_posted_at ON posted_content(posted_at DESC)'
    ]
    
    for (const indexSql of indexes) {
      try {
        await db.query(indexSql)
        console.log(`✅ Index created/verified`)
      } catch (err: any) {
        if (err.code !== '42P07') { // Index already exists
          console.error(`❌ Index creation failed: ${err.message}`)
        }
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60))
    console.log('📋 SCHEMA REPAIR SUMMARY')
    console.log('='.repeat(60))
    
    if (fixes.length > 0) {
      console.log('\n✅ Fixes Applied:')
      fixes.forEach(fix => console.log(`   - ${fix}`))
    } else {
      console.log('\n✅ No fixes needed - schema is complete')
    }
    
    if (errors.length > 0) {
      console.log('\n❌ Errors:')
      errors.forEach(error => console.log(`   - ${error}`))
    }
    
    console.log('\n🎉 Schema repair complete!')
    
  } catch (error) {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  } finally {
    await db.disconnect()
  }
}

// Run if executed directly
// ES module check for direct execution
const isMainModule = process.argv[1] && process.argv[1].includes('fix-supabase-schema')
if (isMainModule) {
  main().catch(console.error)
}

export { main as fixSupabaseSchema }