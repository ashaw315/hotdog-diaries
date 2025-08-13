#!/usr/bin/env ts-node

import { db } from '../lib/db'
import { format } from 'date-fns'
import * as fs from 'fs'
import * as path from 'path'

interface BackupResult {
  success: boolean
  filename?: string
  rowCount?: number
  error?: string
}

interface ResetResult {
  backupResult: BackupResult
  tablesCleared: string[]
  timestampsReset: string[]
  errors: string[]
}

async function backupContentQueue(): Promise<BackupResult> {
  try {
    console.log('📦 Backing up content_queue table...')
    
    // Create backups directory if it doesn't exist
    const backupsDir = path.join(process.cwd(), 'backups')
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir)
    }

    // Get all content from content_queue
    const result = await db.query('SELECT * FROM content_queue ORDER BY id')
    const rowCount = result.rows.length

    if (rowCount === 0) {
      console.log('⚠️  No data to backup in content_queue')
      return { success: true, rowCount: 0 }
    }

    // Create backup filename with timestamp
    const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss')
    const filename = `content_queue_backup_${timestamp}.json`
    const filepath = path.join(backupsDir, filename)

    // Write backup to file
    fs.writeFileSync(filepath, JSON.stringify(result.rows, null, 2))
    
    console.log(`✅ Backed up ${rowCount} rows to ${filename}`)
    return { success: true, filename, rowCount }

  } catch (error) {
    console.error('❌ Backup failed:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

async function clearContentTables(): Promise<string[]> {
  const tablesCleared: string[] = []
  
  try {
    console.log('🗑️  Clearing content tables...')
    
    // Tables to clear in order
    const tablesToClear = [
      'content_queue',
      'content_analysis', 
      'processing_queue',
      'content_metadata'
    ]
    
    for (const table of tablesToClear) {
      try {
        // Check if table exists first
        const tableExists = await db.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = '${table}'
          )
        `)
        
        if (tableExists.rows[0].exists) {
          await db.query(`TRUNCATE TABLE ${table} CASCADE`)
          tablesCleared.push(table)
          console.log(`✅ Cleared ${table}`)
        } else {
          console.log(`⚠️  Table ${table} does not exist`)
        }
      } catch (err) {
        console.log(`⚠️  Could not clear ${table}:`, err.message)
      }
    }
    
    return tablesCleared
    
  } catch (error) {
    console.error('❌ Error clearing tables:', error)
    throw error
  }
}

async function resetScanTimestamps(): Promise<string[]> {
  const timestampsReset: string[] = []
  
  try {
    // Reset scan config timestamps
    console.log('⏰ Resetting scan timestamps...')
    
    // Main scan config
    try {
      await db.query(`
        UPDATE scan_config 
        SET last_scan_at = NULL,
            updated_at = NOW()
      `)
      timestampsReset.push('scan_config')
      console.log('✅ Reset scan_config')
    } catch (err) {
      console.log('⚠️  Could not reset scan_config (might not exist)')
    }
    
    // Platform-specific configs - check what actually exists
    const platformConfigs = [
      { table: 'reddit_scan_config', timeField: 'last_scan_time' },
      { table: 'youtube_scan_config', timeField: 'last_scan_time' },
      { table: 'imgur_scan_config', timeField: 'last_scan_time' },
      { table: 'lemmy_scan_config', timeField: 'last_scan_time' },
      { table: 'tumblr_scan_config', timeField: 'last_scan_time' },
      { table: 'pixabay_scan_config', timeField: 'last_scan_time' },
      { table: 'bluesky_scan_config', timeField: 'last_scan_time' },
      { table: 'giphy_scan_config', timeField: 'last_scan_time' }
    ]
    
    for (const config of platformConfigs) {
      try {
        // First check if table exists
        const tableExists = await db.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = '${config.table}'
          )
        `)
        
        if (!tableExists.rows[0].exists) {
          console.log(`⚠️  Table ${config.table} does not exist`)
          continue
        }
        
        // Get column names for this table
        const columns = await db.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = '${config.table}'
        `)
        
        const columnNames = columns.rows.map(row => row.column_name)
        
        // Build dynamic update query based on existing columns
        const updates: string[] = []
        
        if (columnNames.includes(config.timeField)) {
          updates.push(`${config.timeField} = NULL`)
        }
        if (columnNames.includes('last_scan_id')) {
          updates.push('last_scan_id = NULL')
        }
        if (columnNames.includes('hourly_request_count')) {
          updates.push('hourly_request_count = 0')
        }
        if (columnNames.includes('daily_request_count')) {
          updates.push('daily_request_count = 0')
        }
        if (columnNames.includes('last_request_reset')) {
          updates.push('last_request_reset = NOW()')
        }
        if (columnNames.includes('updated_at')) {
          updates.push('updated_at = NOW()')
        }
        
        if (updates.length > 0) {
          await db.query(`UPDATE ${config.table} SET ${updates.join(', ')}`)
          timestampsReset.push(config.table)
          console.log(`✅ Reset ${config.table}`)
        }
        
      } catch (err) {
        console.log(`⚠️  Error resetting ${config.table}:`, err.message)
      }
    }
    
    return timestampsReset
    
  } catch (error) {
    console.error('❌ Error resetting timestamps:', error)
    throw error
  }
}

async function verifyReset(): Promise<void> {
  console.log('\n📊 Verifying reset...')
  
  // Check content_queue is empty
  const contentCount = await db.query('SELECT COUNT(*) FROM content_queue')
  console.log(`Content queue rows: ${contentCount.rows[0].count}`)
  
  // Check scan config
  const scanConfig = await db.query('SELECT last_scan_at FROM scan_config LIMIT 1')
  console.log(`Scan config last_scan_at: ${scanConfig.rows[0]?.last_scan_at || 'NULL'}`)
}

async function main() {
  console.log('🚀 Starting Hotdog Diaries Database Reset\n')
  
  const result: ResetResult = {
    backupResult: { success: false },
    tablesCleared: [],
    timestampsReset: [],
    errors: []
  }
  
  try {
    // Step 1: Backup current data
    result.backupResult = await backupContentQueue()
    
    if (!result.backupResult.success) {
      throw new Error('Backup failed, aborting reset')
    }
    
    // Step 2: Clear content tables
    result.tablesCleared = await clearContentTables()
    
    // Step 3: Reset timestamps
    result.timestampsReset = await resetScanTimestamps()
    
    // Step 4: Verify reset
    await verifyReset()
    
    console.log('\n✅ Database reset completed successfully!')
    console.log('📋 Summary:')
    console.log(`- Backed up ${result.backupResult.rowCount || 0} rows`)
    console.log(`- Cleared ${result.tablesCleared.length} tables`)
    console.log(`- Reset ${result.timestampsReset.length} scan configs`)
    
    if (result.backupResult.filename) {
      console.log(`\n💾 Backup saved to: backups/${result.backupResult.filename}`)
    }
    
  } catch (error) {
    console.error('\n❌ Reset failed:', error)
    result.errors.push(error instanceof Error ? error.message : 'Unknown error')
    process.exit(1)
  } finally {
    // Database connection is managed by the db module
    console.log('\n🏁 Reset process complete')
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error)
}

export { backupContentQueue, clearContentTables, resetScanTimestamps }