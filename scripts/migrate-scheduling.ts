#!/usr/bin/env tsx

/**
 * Database Migration: Add Scheduling Fields
 * Adds priority and status fields for the content scheduling system
 */

import { db } from '../lib/db'

async function main() {
  try {
    console.log('🚀 Starting scheduling fields migration...')
    
    // Connect to database
    await db.connect()
    
    // Check current schema
    console.log('📋 Checking current schema...')
    const schema = await db.query(`PRAGMA table_info(content_queue)`)
    const columns = schema.rows.map((row: any) => row.name)
    
    console.log('📊 Current columns:', columns)
    
    // Add priority column if it doesn't exist
    if (!columns.includes('priority')) {
      console.log('➕ Adding priority column...')
      await db.query(`ALTER TABLE content_queue ADD COLUMN priority INTEGER DEFAULT 0`)
      console.log('✅ Priority column added')
    } else {
      console.log('✅ Priority column already exists')
    }
    
    // Add status column if it doesn't exist
    if (!columns.includes('status')) {
      console.log('➕ Adding status column...')
      await db.query(`ALTER TABLE content_queue ADD COLUMN status TEXT DEFAULT 'approved'`)
      console.log('✅ Status column added')
    } else {
      console.log('✅ Status column already exists')
    }
    
    // Create indexes for scheduling performance
    console.log('🔍 Creating performance indexes...')
    
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_content_queue_scheduled_for ON content_queue(scheduled_for)',
      'CREATE INDEX IF NOT EXISTS idx_content_queue_status_new ON content_queue(status)',
      'CREATE INDEX IF NOT EXISTS idx_content_queue_priority ON content_queue(priority DESC)',
      'CREATE INDEX IF NOT EXISTS idx_content_queue_scheduling ON content_queue(status, scheduled_for, priority)',
      'CREATE INDEX IF NOT EXISTS idx_content_queue_scheduler ON content_queue(is_approved, is_posted, status, source_platform, scheduled_for)'
    ]
    
    for (const indexSQL of indexes) {
      try {
        await db.query(indexSQL)
        console.log('✅ Index created:', indexSQL.split(' ')[5])
      } catch (error) {
        console.warn('⚠️ Index creation skipped (may already exist):', error.message)
      }
    }
    
    // Update existing content to have proper status values
    console.log('🔄 Updating existing content status...')
    
    const updateResult = await db.query(`
      UPDATE content_queue SET status = 
        CASE 
          WHEN is_posted = 1 THEN 'posted'
          WHEN scheduled_for IS NOT NULL AND scheduled_for > datetime('now') THEN 'scheduled'
          WHEN is_approved = 1 THEN 'approved'
          ELSE 'approved'
        END
      WHERE status = 'approved' OR status IS NULL
    `)
    
    console.log(`✅ Updated ${updateResult.rowCount} content items with status`)
    
    // Verify the migration
    console.log('🔍 Verifying migration...')
    const verification = await db.query(`
      SELECT 
        status,
        COUNT(*) as count,
        COUNT(CASE WHEN scheduled_for IS NOT NULL THEN 1 END) as with_schedule
      FROM content_queue 
      GROUP BY status
    `)
    
    console.log('📊 Content status distribution:')
    console.table(verification.rows)
    
    // Check schema after migration
    const finalSchema = await db.query(`PRAGMA table_info(content_queue)`)
    const finalColumns = finalSchema.rows.map((row: any) => row.name)
    
    const addedColumns = finalColumns.filter(col => !columns.includes(col))
    if (addedColumns.length > 0) {
      console.log('✅ New columns added:', addedColumns)
    }
    
    console.log('🎉 Migration completed successfully!')
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await db.disconnect()
  }
}

// Run migration if called directly
if (require.main === module) {
  main()
}

export { main as migrateDatabaseForScheduling }