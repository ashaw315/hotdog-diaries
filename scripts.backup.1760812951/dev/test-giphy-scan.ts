#!/usr/bin/env npx tsx

import { db } from '@/lib/db'

// Import the Giphy service - need to find the correct import
async function testGiphyScan() {
  console.log('🎬 Testing Giphy Scan with New Thresholds\n')
  
  try {
    // Force SQLite mode for testing by removing PostgreSQL env vars
    delete process.env.USE_POSTGRES_IN_DEV
    delete process.env.DATABASE_URL
    // process.env.NODE_ENV = 'development' // Read-only in TypeScript
    await db.connect()
    
    // Get count before
    const beforeCount = await db.query(`
      SELECT COUNT(*) as count FROM content_queue WHERE source_platform = 'giphy'
    `)
    console.log(`Giphy content before scan: ${beforeCount.rows[0].count}`)
    
    // Since we can't easily import the service, let's use the mock scan
    // Or check if we can trigger it via the API by creating a simple endpoint
    
    console.log('\n📊 Current Giphy analysis:')
    
    // Check if there are any Giphy items in analysis
    const analysisCheck = await db.query(`
      SELECT 
        cq.id,
        cq.content_text,
        cq.is_approved,
        ca.confidence_score,
        ca.is_valid_hotdog,
        ca.processing_notes
      FROM content_queue cq
      LEFT JOIN content_analysis ca ON ca.content_queue_id = cq.id
      WHERE cq.source_platform = 'giphy'
      ORDER BY cq.id DESC
      LIMIT 10
    `)
    
    if (analysisCheck.rows.length === 0) {
      console.log('No Giphy content found in database')
      console.log('\n💡 Need to run a scan to test the new thresholds')
      console.log('The thresholds have been lowered to:')
      console.log('  - autoApprovalThreshold: 0.40 (was 0.60)')
      console.log('  - autoRejectionThreshold: 0.15 (was 0.25)')
      console.log('  - Base confidence: 0.6 (was 0.5)')
      console.log('  - More generous keyword scoring')
      console.log('  - Added food-related terms boost')
    } else {
      console.log(`Found ${analysisCheck.rows.length} Giphy items:`)
      analysisCheck.rows.forEach((row, i) => {
        console.log(`\n${i + 1}. ID ${row.id}: ${row.content_text}`)
        console.log(`   Approved: ${row.is_approved}, Confidence: ${row.confidence_score}`)
        console.log(`   Valid hotdog: ${row.is_valid_hotdog}`)
      })
    }
    
    await db.disconnect()
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

testGiphyScan().catch(console.error)