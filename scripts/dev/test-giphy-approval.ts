#!/usr/bin/env npx tsx

import { db } from '@/lib/db'

async function testGiphyApproval() {
  console.log('🔍 Testing Giphy Approval Pipeline\n')
  
  try {
    await db.connect()
    
    // First, let's manually search Giphy API
    const apiKey = process.env.GIPHY_API_KEY
    if (!apiKey) {
      console.error('❌ Giphy API key not configured')
      return
    }
    
    console.log('=== GIPHY API SEARCH TEST ===')
    const url = 'https://api.giphy.com/v1/gifs/search'
    const params = new URLSearchParams({
      api_key: apiKey,
      q: 'hotdog',
      limit: '5',
      offset: '0'
    })
    
    const response = await fetch(`${url}?${params}`)
    const data = await response.json()
    
    console.log(`Found ${data.data.length} GIFs for "hotdog"\n`)
    
    // Calculate confidence for each
    const hotdogKeywords = ['hot dog', 'hotdog', 'bratwurst', 'sausage', 'corn dog', 'chili dog', 'chicago', 'frankfurter']
    
    data.data.forEach((gif: any, i: number) => {
      console.log(`\n${i + 1}. ${gif.title}`)
      console.log(`   URL: ${gif.url}`)
      console.log(`   Username: ${gif.username || 'Anonymous'}`)
      console.log(`   Tags: ${gif.tags?.join(', ') || 'none'}`)
      
      // Calculate confidence
      let confidence = 0.5 // Base score
      
      // Title relevance
      const title = gif.title.toLowerCase()
      const relevantKeywords = hotdogKeywords.filter(keyword => title.includes(keyword))
      confidence += Math.min(relevantKeywords.length * 0.1, 0.3)
      
      // Tag relevance
      const relevantTags = (gif.tags || []).filter((tag: string) => 
        hotdogKeywords.some(keyword => tag.toLowerCase().includes(keyword))
      )
      confidence += Math.min(relevantTags.length * 0.05, 0.15)
      
      console.log(`   Calculated confidence: ${confidence}`)
      console.log(`   Relevant keywords in title: ${relevantKeywords.join(', ') || 'none'}`)
      console.log(`   Relevant tags: ${relevantTags.join(', ') || 'none'}`)
      
      // Check what ContentProcessor would do
      console.log(`   Would be ${confidence >= 0.6 ? 'APPROVED' : 'REJECTED'} (threshold: 0.6)`)
    })
    
    // Now check actual database content
    console.log('\n\n=== DATABASE CHECK ===')
    const dbCheck = await db.query(`
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
      LIMIT 5
    `)
    
    if (dbCheck.rows.length === 0) {
      console.log('No Giphy content found in database')
    } else {
      console.log(`Found ${dbCheck.rows.length} Giphy items in database:`)
      dbCheck.rows.forEach((row, i) => {
        console.log(`\n${i + 1}. ID ${row.id}: ${row.content_text}`)
        console.log(`   Approved: ${row.is_approved}, Confidence: ${row.confidence_score}`)
        console.log(`   Valid hotdog: ${row.is_valid_hotdog}`)
      })
    }
    
    // Check filtering service thresholds
    console.log('\n\n=== FILTERING THRESHOLDS ===')
    console.log('ContentProcessor defaults:')
    console.log('  autoApprovalThreshold: 0.55')
    console.log('  autoRejectionThreshold: 0.25')
    console.log('\nGiphy uses:')
    console.log('  autoApprovalThreshold: 0.6')
    console.log('  autoRejectionThreshold: 0.2')
    console.log('\nThis means Giphy content needs confidence >= 0.6 to be approved')
    console.log('Most Giphy content has base 0.5 + keywords, rarely reaching 0.6')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  } finally {
    await db.disconnect()
  }
}

// Run if called directly
// ES module check for direct execution
const isMainModule = process.argv[1] && process.argv[1].includes('test-giphy-approval')
if (isMainModule) {
  testGiphyApproval().catch(console.error)
}

export { testGiphyApproval }