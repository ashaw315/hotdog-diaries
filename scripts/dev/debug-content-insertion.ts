#!/usr/bin/env npx tsx

import { db } from '@/lib/db'
import { pixabayScanningService } from '@/lib/services/pixabay-scanning'
import { giphyScanningService } from '@/lib/services/giphy-scanning'

async function debugContentInsertion() {
  console.log('🔍 Debugging Content Insertion Pipeline\n')
  
  try {
    await db.connect()
    console.log('✅ Connected to database\n')
    
    // First, check current state
    const beforeCount = await db.query('SELECT COUNT(*) as count FROM content_queue')
    console.log(`📊 Content count BEFORE scan: ${beforeCount.rows[0].count}\n`)
    
    // Test 1: Direct database insert
    console.log('=== TEST 1: Direct Database Insert ===')
    try {
      const testInsert = await db.query(`
        INSERT INTO content_queue (
          content_text, content_image_url, content_type,
          source_platform, original_url, original_author,
          scraped_at, content_hash
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)
      `, [
        'Debug test hotdog',
        'https://example.com/test.jpg',
        'image',
        'test',
        'https://example.com/test',
        'Test Author',
        'debug_hash_' + Date.now()
      ])
      
      console.log('✅ Direct insert result:', {
        rowCount: testInsert.rowCount,
        rows: testInsert.rows
      })
    } catch (error) {
      console.error('❌ Direct insert failed:', error.message)
    }
    
    // Test 2: Single Pixabay scan with detailed logging
    console.log('\n=== TEST 2: Pixabay Single Item Scan ===')
    
    // Monkey-patch console.log to capture all logs
    const originalLog = console.log
    const logs: string[] = []
    console.log = (...args) => {
      logs.push(args.join(' '))
      originalLog(...args)
    }
    
    try {
      // Scan with just one search term
      const pixabayResult = await pixabayScanningService.scanForContent({
        searchTerms: ['hotdog'],
        maxResults: 3
      })
      
      console.log = originalLog // Restore console.log
      
      console.log('\nPixabay scan result:', {
        totalFound: pixabayResult.totalFound,
        processed: pixabayResult.processed,
        approved: pixabayResult.approved,
        rejected: pixabayResult.rejected,
        errors: pixabayResult.errors
      })
      
      // Check for insertion-related logs
      const insertLogs = logs.filter(log => 
        log.includes('INSERT') || 
        log.includes('RETURNING') || 
        log.includes('returned no rows') ||
        log.includes('Post-processing verification')
      )
      
      if (insertLogs.length > 0) {
        console.log('\n📝 Insert-related logs:')
        insertLogs.forEach(log => console.log('  ', log))
      }
      
    } catch (error) {
      console.log = originalLog // Restore console.log
      console.error('❌ Pixabay scan failed:', error)
    }
    
    // Test 3: Check Giphy rejection reasons
    console.log('\n=== TEST 3: Giphy Rejection Analysis ===')
    
    console.log = (...args) => {
      logs.push(args.join(' '))
      originalLog(...args)
    }
    
    try {
      const giphyResult = await giphyScanningService.scanForContent({
        searchTerms: ['hotdog'],
        maxResults: 3
      })
      
      console.log = originalLog // Restore console.log
      
      console.log('\nGiphy scan result:', {
        totalFound: giphyResult.totalFound,
        processed: giphyResult.processed,
        approved: giphyResult.approved,
        rejected: giphyResult.rejected,
        errors: giphyResult.errors
      })
      
      // Look for filtering/rejection logs
      const filterLogs = logs.filter(log => 
        log.includes('confidence') || 
        log.includes('rejected') || 
        log.includes('approved') ||
        log.includes('is_valid_hotdog') ||
        log.includes('ContentProcessor result')
      )
      
      if (filterLogs.length > 0) {
        console.log('\n📝 Filtering/approval logs:')
        filterLogs.slice(-10).forEach(log => console.log('  ', log))
      }
      
    } catch (error) {
      console.log = originalLog // Restore console.log
      console.error('❌ Giphy scan failed:', error)
    }
    
    // Final check
    const afterCount = await db.query('SELECT COUNT(*) as count FROM content_queue')
    console.log(`\n📊 Content count AFTER scans: ${afterCount.rows[0].count}`)
    console.log(`📈 New items added: ${afterCount.rows[0].count - beforeCount.rows[0].count}`)
    
    // Check for any content_analysis records
    const analysisCount = await db.query('SELECT COUNT(*) as count FROM content_analysis')
    console.log(`📊 Content analysis records: ${analysisCount.rows[0].count}`)
    
    // Sample rejected content
    console.log('\n=== REJECTED CONTENT ANALYSIS ===')
    const rejectedSample = await db.query(`
      SELECT 
        cq.content_text,
        cq.source_platform,
        ca.confidence_score,
        ca.is_valid_hotdog,
        ca.is_spam,
        ca.is_inappropriate,
        ca.is_unrelated,
        ca.processing_notes
      FROM content_queue cq
      JOIN content_analysis ca ON ca.content_queue_id = cq.id
      WHERE cq.is_approved = 0
      ORDER BY cq.id DESC
      LIMIT 5
    `)
    
    if (rejectedSample.rows.length > 0) {
      console.log('Recent rejected content:')
      rejectedSample.rows.forEach((row, i) => {
        console.log(`\n${i + 1}. [${row.source_platform}] ${row.content_text?.substring(0, 50)}...`)
        console.log(`   Confidence: ${row.confidence_score}`)
        console.log(`   Valid hotdog: ${row.is_valid_hotdog}`)
        console.log(`   Flags: Spam=${row.is_spam}, Inappropriate=${row.is_inappropriate}, Unrelated=${row.is_unrelated}`)
        console.log(`   Notes: ${row.processing_notes?.substring(0, 100)}`)
      })
    }
    
  } catch (error) {
    console.error('❌ Debug script failed:', error)
  } finally {
    await db.disconnect()
  }
}

// Run if called directly
if (require.main === module) {
  debugContentInsertion().catch(console.error)
}

export { debugContentInsertion }