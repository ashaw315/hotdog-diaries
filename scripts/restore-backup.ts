#!/usr/bin/env npx tsx

import { db } from '@/lib/db'
import * as fs from 'fs'
import * as path from 'path'

interface BackupContent {
  id: number
  content_text: string | null
  content_image_url: string | null
  content_video_url: string | null
  content_type: string
  source_platform: string
  original_url: string
  original_author: string | null
  original_score?: number
  scraped_at: string
  content_hash: string
  is_posted: boolean
  posted_at: string | null
  is_approved: boolean | null
  admin_notes: string | null
  created_at: string
  updated_at: string
  content_status: string
  reviewed_at: string | null
  reviewed_by: string | null
  rejection_reason: string | null
  scheduled_for: string | null
  edit_history: any[]
  scheduled_post_time: string | null
  posting_priority: number
  posting_attempt_count: number
  last_posting_attempt: string | null
  // JSONB fields
  twitter_data: any
  tiktok_data: any
  instagram_data: any
  youtube_data: any
  flickr_data: any
  unsplash_data: any
  news_data: any
  mastodon_data: any
}

async function restoreBackup() {
  console.log('🔄 Starting backup restoration to SQLite...\n')
  
  try {
    // Connect to database
    await db.connect()
    console.log('✅ Connected to SQLite database')
    
    // Read backup file
    const backupPath = path.join(process.cwd(), 'backups', 'content_queue_backup_2025-08-12_19-31-53.json')
    if (!fs.existsSync(backupPath)) {
      throw new Error('Backup file not found: ' + backupPath)
    }
    
    const backupData: BackupContent[] = JSON.parse(fs.readFileSync(backupPath, 'utf8'))
    console.log(`📊 Found ${backupData.length} items in backup\n`)
    
    // Get the highest ID from the backup to adjust SQLite sequence
    const maxBackupId = Math.max(...backupData.map(item => item.id))
    
    // Clear existing content to avoid duplicates
    console.log('🗑️  Clearing existing content_queue...')
    await db.query('DELETE FROM content_queue')
    console.log('✅ Cleared existing content\n')
    
    // Convert timestamp format
    const convertTimestamp = (pgTimestamp: string | null): string | null => {
      if (!pgTimestamp) return null
      // PostgreSQL: "2025-08-10T02:53:17.288Z"
      // SQLite: "2025-08-10 02:53:17"
      return pgTimestamp.replace('T', ' ').replace(/\.\d+Z$/, '')
    }
    
    // Convert JSONB to JSON string
    const convertJsonb = (data: any): string | null => {
      if (!data) return null
      return JSON.stringify(data)
    }
    
    // Insert each item
    let successCount = 0
    let errorCount = 0
    const errors: { id: number, error: string }[] = []
    
    for (const item of backupData) {
      try {
        const query = `
          INSERT INTO content_queue (
            id, content_text, content_image_url, content_video_url, content_type,
            source_platform, original_url, original_author, original_score,
            scraped_at, content_hash, is_posted, posted_at, is_approved,
            admin_notes, created_at, updated_at, content_status,
            reviewed_at, reviewed_by, rejection_reason, scheduled_for,
            edit_history
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
          )
        `
        
        const values = [
          item.id,
          item.content_text,
          item.content_image_url,
          item.content_video_url,
          item.content_type,
          item.source_platform,
          item.original_url,
          item.original_author,
          item.original_score || 0,
          convertTimestamp(item.scraped_at),
          item.content_hash,
          item.is_posted ? 1 : 0,
          convertTimestamp(item.posted_at),
          item.is_approved === null ? null : (item.is_approved ? 1 : 0),
          item.admin_notes,
          convertTimestamp(item.created_at),
          convertTimestamp(item.updated_at),
          item.content_status || 'discovered',
          convertTimestamp(item.reviewed_at),
          item.reviewed_by,
          item.rejection_reason,
          convertTimestamp(item.scheduled_for),
          convertJsonb(item.edit_history)
        ]
        
        await db.query(query, values)
        successCount++
        
        if (successCount % 10 === 0) {
          process.stdout.write(`\r📥 Restored ${successCount}/${backupData.length} items...`)
        }
      } catch (error) {
        errorCount++
        errors.push({ id: item.id, error: error.message })
      }
    }
    
    console.log(`\n\n✅ Successfully restored ${successCount} items`)
    if (errorCount > 0) {
      console.log(`❌ Failed to restore ${errorCount} items`)
      console.log('Errors:', errors.slice(0, 5))
    }
    
    // Update SQLite sequence to avoid ID conflicts
    console.log(`\n🔧 Setting SQLite sequence to start at ${maxBackupId + 1}...`)
    await db.query(`UPDATE sqlite_sequence SET seq = ? WHERE name = 'content_queue'`, [maxBackupId])
    
    // Verify restoration
    console.log('\n📊 Verification Report:\n')
    
    // Count by platform
    const platformCounts = await db.query(`
      SELECT source_platform, COUNT(*) as count 
      FROM content_queue 
      GROUP BY source_platform 
      ORDER BY count DESC
    `)
    console.log('Content by Platform:')
    for (const row of platformCounts.rows) {
      console.log(`  ${row.source_platform}: ${row.count}`)
    }
    
    // Count by status
    const statusCounts = await db.query(`
      SELECT content_status, COUNT(*) as count 
      FROM content_queue 
      GROUP BY content_status 
      ORDER BY count DESC
    `)
    console.log('\nContent by Status:')
    for (const row of statusCounts.rows) {
      console.log(`  ${row.content_status}: ${row.count}`)
    }
    
    // Count posted items
    const postedCount = await db.query(`
      SELECT COUNT(*) as count FROM content_queue WHERE is_posted = true
    `)
    console.log(`\nPosted Content: ${postedCount.rows[0].count}`)
    
    // Count approved items
    const approvedCount = await db.query(`
      SELECT 
        SUM(CASE WHEN is_approved = true THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN is_approved = false THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN is_approved IS NULL THEN 1 ELSE 0 END) as pending
      FROM content_queue
    `)
    console.log('\nApproval Status:')
    console.log(`  Approved: ${approvedCount.rows[0].approved}`)
    console.log(`  Rejected: ${approvedCount.rows[0].rejected}`)
    console.log(`  Pending: ${approvedCount.rows[0].pending}`)
    
    // Show some sample restored content
    const samples = await db.query(`
      SELECT id, content_text, source_platform, is_posted, content_status 
      FROM content_queue 
      LIMIT 5
    `)
    console.log('\nSample Restored Content:')
    for (const row of samples.rows) {
      console.log(`  ID ${row.id}: ${row.content_text?.substring(0, 50)}... [${row.source_platform}] Posted: ${row.is_posted}`)
    }
    
    console.log('\n🎉 Backup restoration complete!')
    
  } catch (error) {
    console.error('❌ Restoration failed:', error)
    throw error
  } finally {
    await db.disconnect()
  }
}

// Run if called directly
// ES module check for direct execution
const isMainModule = process.argv[1] && process.argv[1].includes('restore-backup')
if (isMainModule) {
  restoreBackup().catch(console.error)
}

export { restoreBackup }