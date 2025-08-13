#!/usr/bin/env ts-node

import { db } from '../lib/db'

async function inspectDatabase() {
  try {
    console.log('🔍 Inspecting Database Structure...\n')
    
    // Get all tables
    const tables = await db.query(`
      SELECT tablename 
      FROM pg_catalog.pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename
    `)
    
    console.log('📋 Available Tables:')
    for (const table of tables.rows) {
      console.log(`  - ${table.tablename}`)
    }
    
    console.log('\n📊 Content Queue Info:')
    try {
      const contentCount = await db.query('SELECT COUNT(*) FROM content_queue')
      console.log(`  Content rows: ${contentCount.rows[0].count}`)
      
      const platforms = await db.query(`
        SELECT source_platform, COUNT(*) as count 
        FROM content_queue 
        GROUP BY source_platform 
        ORDER BY source_platform
      `)
      
      console.log('  By platform:')
      for (const platform of platforms.rows) {
        console.log(`    ${platform.source_platform}: ${platform.count}`)
      }
    } catch (err) {
      console.log('  ⚠️  Could not query content_queue')
    }
    
    console.log('\n🔧 Config Tables:')
    const configTables = [
      'scan_config',
      'reddit_scan_config', 
      'youtube_scan_config',
      'imgur_scan_config',
      'lemmy_scan_config',
      'tumblr_scan_config',
      'pixabay_scan_config',
      'bluesky_scan_config',
      'giphy_scan_config'
    ]
    
    for (const table of configTables) {
      try {
        const exists = await db.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = '${table}'
          )
        `)
        
        if (exists.rows[0].exists) {
          const count = await db.query(`SELECT COUNT(*) FROM ${table}`)
          console.log(`  ✅ ${table} (${count.rows[0].count} rows)`)
          
          // Show columns for config tables
          const columns = await db.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = '${table}'
            ORDER BY column_name
          `)
          console.log(`      Columns: ${columns.rows.map(c => c.column_name).join(', ')}`)
        } else {
          console.log(`  ❌ ${table} (does not exist)`)
        }
      } catch (err) {
        console.log(`  ⚠️  ${table} (error: ${err.message})`)
      }
    }
    
  } catch (error) {
    console.error('❌ Database inspection failed:', error)
  }
}

// Run if executed directly
if (require.main === module) {
  inspectDatabase().catch(console.error)
}

export { inspectDatabase }