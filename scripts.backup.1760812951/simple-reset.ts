#!/usr/bin/env ts-node

import { db } from '../lib/db'
import { format } from 'date-fns'
import * as fs from 'fs'
import * as path from 'path'

async function backupAndReset() {
  console.log('🚀 Starting Simple Database Reset\n')
  
  try {
    // Step 1: Backup content_queue
    console.log('📦 Backing up content_queue...')
    const result = await db.query('SELECT * FROM content_queue ORDER BY id')
    
    if (result.rows.length > 0) {
      const backupsDir = path.join(process.cwd(), 'backups')
      if (!fs.existsSync(backupsDir)) {
        fs.mkdirSync(backupsDir)
      }
      
      const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss')
      const filename = `content_queue_backup_${timestamp}.json`
      const filepath = path.join(backupsDir, filename)
      
      fs.writeFileSync(filepath, JSON.stringify(result.rows, null, 2))
      console.log(`✅ Backed up ${result.rows.length} rows to ${filename}`)
    } else {
      console.log('⚠️  No data to backup')
    }
    
    // Step 2: Clear main content tables
    console.log('\n🗑️  Clearing content tables...')
    
    const tablesToClear = [
      'content_queue',
      'content_analysis', 
      'processing_queue',
      'posted_content',
      'posting_history'
    ]
    
    let clearedCount = 0
    for (const table of tablesToClear) {
      try {
        await db.query(`TRUNCATE TABLE ${table} CASCADE`)
        console.log(`✅ Cleared ${table}`)
        clearedCount++
      } catch (err) {
        console.log(`⚠️  Could not clear ${table}: ${err.message}`)
      }
    }
    
    // Step 3: Reset scan timestamps
    console.log('\n⏰ Resetting scan timestamps...')
    
    let resetCount = 0
    
    // Main scan config
    try {
      await db.query(`
        UPDATE scan_config 
        SET last_scan_at = NULL, updated_at = NOW()
      `)
      console.log('✅ Reset scan_config')
      resetCount++
    } catch (err) {
      console.log('⚠️  Could not reset scan_config')
    }
    
    // Reddit config
    try {
      await db.query(`
        UPDATE reddit_scan_config 
        SET last_scan_time = NULL, last_scan_id = NULL, updated_at = NOW()
      `)
      console.log('✅ Reset reddit_scan_config')
      resetCount++
    } catch (err) {
      console.log('⚠️  Could not reset reddit_scan_config')
    }
    
    // YouTube config
    try {
      await db.query(`
        UPDATE youtube_scan_config 
        SET last_scan_time = NULL, last_scan_id = NULL, updated_at = NOW()
      `)
      console.log('✅ Reset youtube_scan_config')
      resetCount++
    } catch (err) {
      console.log('⚠️  Could not reset youtube_scan_config')
    }
    
    // Step 4: Verify reset
    console.log('\n📊 Verifying reset...')
    const contentCount = await db.query('SELECT COUNT(*) FROM content_queue')
    console.log(`Content queue rows: ${contentCount.rows[0].count}`)
    
    const scanConfig = await db.query('SELECT last_scan_at FROM scan_config LIMIT 1')
    console.log(`Scan config last_scan_at: ${scanConfig.rows[0]?.last_scan_at || 'NULL'}`)
    
    console.log('\n✅ Simple reset completed successfully!')
    console.log('📋 Summary:')
    console.log(`- Tables cleared: ${clearedCount}`)
    console.log(`- Configs reset: ${resetCount}`)
    console.log('\n💡 Note: Some platform configs may not exist yet - they will be created when platforms are first scanned')
    
  } catch (error) {
    console.error('\n❌ Reset failed:', error)
    process.exit(1)
  }
}

// Run if executed directly
if (require.main === module) {
  backupAndReset().catch(console.error)
}

export { backupAndReset }