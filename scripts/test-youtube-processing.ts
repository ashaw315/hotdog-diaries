#!/usr/bin/env npx tsx

import { ContentProcessor } from '@/lib/services/content-processor'

// Test YouTube content processing fix
async function testYouTubeProcessing() {
  console.log('🎬 Testing YouTube Content Processing Fix\n')
  
  try {
    const contentProcessor = new ContentProcessor()
    
    // Test with existing YouTube content ID 156
    console.log('Processing YouTube content ID 156: "Nashville style hot dogs are ON TOP!"')
    
    const result = await contentProcessor.processContent(156, {
      autoApprovalThreshold: 0.5, // Lower threshold for YouTube videos
      autoRejectionThreshold: 0.2,
      enableDuplicateDetection: true
    })
    
    console.log('\n📊 Processing Result:')
    console.log(`✓ Success: ${result.success}`)
    console.log(`✓ Action: ${result.action}`)
    console.log(`✓ Content ID: ${result.contentId}`)
    console.log(`✓ Confidence Score: ${result.analysis.confidence_score}`)
    console.log(`✓ Is Valid Hotdog: ${result.analysis.is_valid_hotdog}`)
    console.log(`✓ Processing Notes: ${result.analysis.processing_notes}`)
    
    if (result.reason) {
      console.log(`✓ Reason: ${result.reason}`)
    }
    
    console.log('\n🎯 This should now create a content_analysis record!')
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
  }
}

testYouTubeProcessing().catch(console.error)