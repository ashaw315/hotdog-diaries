#!/usr/bin/env tsx
/**
 * Database Schema Audit Script
 * Compares local SQLite schema with expected production schema
 * Usage: npm run db:audit
 */

import { db } from '../lib/db'

interface TableInfo {
  name: string
  exists: boolean
  rowCount: number
  columns?: string[]
  error?: string
}

async function auditDatabase() {
  console.log('🔍 DATABASE SCHEMA AUDIT')
  console.log('========================\n')

  try {
    await db.connect()
    
    console.log('📊 Environment Information:')
    console.log(`- NODE_ENV: ${process.env.NODE_ENV}`)
    console.log(`- DATABASE_URL type: ${getDatabaseType()}`)
    console.log(`- Database connected: ${await isDatabaseConnected()}`)
    console.log('')

    // Define expected tables and their key columns
    const expectedTables = [
      { 
        name: 'content_queue', 
        keyColumns: ['id', 'content_text', 'source_platform', 'is_approved', 'is_posted', 'created_at']
      },
      { 
        name: 'posted_content', 
        keyColumns: ['id', 'content_queue_id', 'posted_at', 'post_order']
      },
      { 
        name: 'posting_history', 
        keyColumns: ['id', 'content_queue_id', 'posted_at', 'success']
      },
      { 
        name: 'admin_users', 
        keyColumns: ['id', 'username', 'password_hash', 'is_active']
      },
      { 
        name: 'system_logs', 
        keyColumns: ['id', 'log_level', 'message', 'component', 'created_at']
      }
    ]

    const auditResults: TableInfo[] = []

    console.log('🔍 Checking tables and columns...\n')

    for (const expectedTable of expectedTables) {
      const tableInfo: TableInfo = {
        name: expectedTable.name,
        exists: false,
        rowCount: 0
      }

      try {
        // Check if table exists by trying to count rows
        const countResult = await db.query(`SELECT COUNT(*) as count FROM ${expectedTable.name}`)
        tableInfo.exists = true
        tableInfo.rowCount = parseInt(countResult.rows[0]?.count || '0')

        // Check columns exist by trying to select them
        try {
          const columnCheck = expectedTable.keyColumns.join(', ')
          await db.query(`SELECT ${columnCheck} FROM ${expectedTable.name} LIMIT 1`)
          tableInfo.columns = expectedTable.keyColumns
          console.log(`✅ ${expectedTable.name}: EXISTS (${tableInfo.rowCount} rows) - All key columns present`)
        } catch (columnError) {
          tableInfo.error = `Column check failed: ${columnError.message}`
          console.log(`⚠️  ${expectedTable.name}: EXISTS (${tableInfo.rowCount} rows) - Column issues detected`)
          console.log(`   Error: ${columnError.message}`)
        }

      } catch (error) {
        tableInfo.error = error.message
        console.log(`❌ ${expectedTable.name}: MISSING - ${error.message}`)
      }

      auditResults.push(tableInfo)
    }

    console.log('\n📈 Content Analysis:')
    console.log('==================')

    // Analyze content_queue if it exists
    const contentQueueTable = auditResults.find(t => t.name === 'content_queue')
    if (contentQueueTable?.exists) {
      try {
        // Platform distribution
        const platformQuery = `
          SELECT source_platform, COUNT(*) as count
          FROM content_queue
          GROUP BY source_platform
          ORDER BY count DESC
          LIMIT 10
        `
        const platformResult = await db.query(platformQuery)
        console.log('\n📊 Platform Distribution:')
        platformResult.rows.forEach(row => {
          console.log(`   ${row.source_platform}: ${row.count} items`)
        })

        // Status distribution
        const statusQuery = `
          SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN is_approved = true THEN 1 END) as approved,
            COUNT(CASE WHEN is_posted = true THEN 1 END) as posted,
            COUNT(CASE WHEN is_approved = false AND is_posted = false THEN 1 END) as pending
          FROM content_queue
        `
        const statusResult = await db.query(statusQuery)
        if (statusResult.rows.length > 0) {
          const row = statusResult.rows[0]
          console.log('\n📋 Content Status:')
          console.log(`   Total: ${row.total}`)
          console.log(`   Approved: ${row.approved}`)
          console.log(`   Posted: ${row.posted}`)
          console.log(`   Pending: ${row.pending}`)
        }

      } catch (error) {
        console.log(`   Error analyzing content: ${error.message}`)
      }
    }

    // Check for table relationship issues
    console.log('\n🔗 Relationship Analysis:')
    console.log('========================')

    const postedContentExists = auditResults.find(t => t.name === 'posted_content')?.exists
    const postingHistoryExists = auditResults.find(t => t.name === 'posting_history')?.exists

    if (postedContentExists && postingHistoryExists) {
      try {
        // Check for orphaned records
        const orphanCheck = await db.query(`
          SELECT COUNT(*) as orphaned
          FROM posted_content pc
          LEFT JOIN content_queue cq ON pc.content_queue_id = cq.id
          WHERE cq.id IS NULL
        `)
        console.log(`🔍 Orphaned posted_content records: ${orphanCheck.rows[0]?.orphaned || 0}`)

        // Check for duplicate postings
        const duplicateCheck = await db.query(`
          SELECT content_queue_id, COUNT(*) as count
          FROM posted_content
          GROUP BY content_queue_id
          HAVING COUNT(*) > 1
          LIMIT 5
        `)
        console.log(`🔍 Content posted multiple times: ${duplicateCheck.rows.length} items`)

      } catch (error) {
        console.log(`   Error checking relationships: ${error.message}`)
      }
    } else {
      console.log(`⚠️  Missing tables for relationship analysis`)
      console.log(`   posted_content exists: ${postedContentExists}`)
      console.log(`   posting_history exists: ${postingHistoryExists}`)
    }

    // Generate summary report
    console.log('\n📄 AUDIT SUMMARY')
    console.log('===============')
    
    const existingTables = auditResults.filter(t => t.exists).length
    const totalTables = auditResults.length
    const totalRows = auditResults.reduce((sum, t) => sum + t.rowCount, 0)
    const hasErrors = auditResults.some(t => t.error)

    console.log(`📊 Tables: ${existingTables}/${totalTables} exist`)
    console.log(`📊 Total rows: ${totalRows}`)
    console.log(`📊 Health: ${hasErrors ? '⚠️  ISSUES DETECTED' : '✅ HEALTHY'}`)

    if (hasErrors) {
      console.log('\n🔧 ISSUES TO FIX:')
      auditResults.filter(t => t.error).forEach(table => {
        console.log(`   - ${table.name}: ${table.error}`)
      })
    }

    console.log('\n💡 RECOMMENDATIONS:')
    if (!postedContentExists && !postingHistoryExists) {
      console.log('   - Run database migration to create missing posting tables')
    }
    if (existingTables < totalTables) {
      console.log('   - Execute supabase_schema_fix.sql to create missing tables')
    }
    if (totalRows === 0) {
      console.log('   - Database is empty - run content scanning to populate')
    }

  } catch (error) {
    console.error('❌ Audit failed:', error.message)
    console.error('Stack:', error.stack)
  } finally {
    await db.disconnect()
  }
}

function getDatabaseType(): string {
  if (process.env.DATABASE_URL?.includes('supabase')) return 'Supabase PostgreSQL'
  if (process.env.DATABASE_URL?.includes('postgres')) return 'PostgreSQL'
  if (process.env.DATABASE_URL?.includes('sqlite')) return 'SQLite'
  if (process.env.NODE_ENV === 'development') return 'SQLite (dev default)'
  return 'Unknown'
}

async function isDatabaseConnected(): Promise<boolean> {
  try {
    const health = await db.healthCheck()
    return health.connected
  } catch {
    return false
  }
}

// Run if executed directly
// ES module check for direct execution
const isMainModule = process.argv[1] && process.argv[1].includes('db-audit')
if (isMainModule) {
  auditDatabase()
}