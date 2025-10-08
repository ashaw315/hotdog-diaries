#!/usr/bin/env tsx

/**
 * Test Script for Admin API Endpoints
 * Tests the new scheduling API endpoints
 */

import { scheduleNextBatch } from '../lib/services/schedule-content'
import { db } from '../lib/db'

async function testAPI(endpoint: string, options: any = {}) {
  try {
    const baseUrl = 'http://localhost:3000'
    const url = `${baseUrl}${endpoint}`
    
    const defaultOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoiYWRtaW4iLCJpYXQiOjE3NTk4ODM1OTksImV4cCI6MTc1OTk2OTk5OSwiYXVkIjoiYWRtaW4iLCJpc3MiOiJob3Rkb2ctZGlhcmllcyJ9.CHmKuG1gab9PSrP2PGiG6FO2AaG-eVXxHHpl2lVwVSQ'
      },
      ...options
    }

    console.log(`🔗 Testing ${defaultOptions.method} ${endpoint}`)
    
    const response = await fetch(url, defaultOptions)
    const data = await response.json()
    
    console.log(`📊 Response Status: ${response.status}`)
    console.log(`📋 Response Data:`, JSON.stringify(data, null, 2))
    
    return { response, data }
    
  } catch (error) {
    console.error(`❌ API Test Failed for ${endpoint}:`, error.message)
    return { response: null, data: null }
  }
}

async function main() {
  try {
    console.log('🧪 Testing Admin API Endpoints...\n')
    
    // Ensure we have some scheduled content first
    console.log('📅 Ensuring we have scheduled content...')
    await db.connect()
    const result = await scheduleNextBatch(3, 6)
    console.log(`✅ Pre-scheduled ${result.summary.totalScheduled} items`)
    await db.disconnect()
    
    // Test 1: GET scheduled queue
    console.log('\n📋 Test 1: GET /api/admin/queue/schedule')
    const getResult = await testAPI('/api/admin/queue/schedule?days=7&limit=10')
    
    if (getResult.data?.success) {
      console.log(`✅ Retrieved ${getResult.data.data.total} scheduled items`)
      console.log(`🎯 Platform distribution:`, getResult.data.data.summary.platformDistribution)
    }
    
    // Test 2: POST schedule new batch  
    console.log('\n📅 Test 2: POST /api/admin/queue/schedule')
    const postResult = await testAPI('/api/admin/queue/schedule', {
      method: 'POST',
      body: JSON.stringify({
        daysAhead: 2,
        postsPerDay: 6
      })
    })
    
    if (postResult.data?.success) {
      console.log(`✅ Scheduled ${postResult.data.data.summary.totalScheduled} new items`)
    }
    
    // Test 3: GET posting execution stats
    console.log('\n📊 Test 3: GET /api/admin/posting/execute')
    const statsResult = await testAPI('/api/admin/posting/execute?days=7')
    
    if (statsResult.data?.success) {
      console.log(`✅ Retrieved posting stats:`)
      console.log(`   - Total posted: ${statsResult.data.data.stats.totalPosted}`)
      console.log(`   - Scheduled posts: ${statsResult.data.data.stats.scheduledPosted}`)
      console.log(`   - Manual posts: ${statsResult.data.data.stats.manualPosted}`)
    }
    
    // Test 4: POST execute next posting
    console.log('\n🎯 Test 4: POST /api/admin/posting/execute (next)')
    const executeResult = await testAPI('/api/admin/posting/execute', {
      method: 'POST',
      body: JSON.stringify({
        type: 'next'
      })
    })
    
    if (executeResult.data?.success) {
      console.log(`✅ Posted content:`)
      console.log(`   - Content ID: ${executeResult.data.data.content.contentId}`)
      console.log(`   - Platform: ${executeResult.data.data.content.platform}`)
      console.log(`   - Time slot: ${executeResult.data.data.content.timeSlot}`)
    }
    
    // Test 5: POST execute scheduled posting
    console.log('\n📅 Test 5: POST /api/admin/posting/execute (scheduled)')
    const scheduledPostResult = await testAPI('/api/admin/posting/execute', {
      method: 'POST',
      body: JSON.stringify({
        type: 'scheduled'
      })
    })
    
    if (scheduledPostResult.data?.success) {
      console.log(`✅ Posted ${scheduledPostResult.data.data.summary.totalPosted} scheduled items`)
      if (scheduledPostResult.data.data.summary.platformDistribution) {
        console.log(`🎯 Platform distribution:`, scheduledPostResult.data.data.summary.platformDistribution)
      }
    }
    
    // Test 6: Test invalid requests
    console.log('\n❌ Test 6: Testing validation (should fail)')
    const invalidResult = await testAPI('/api/admin/queue/schedule', {
      method: 'POST',
      body: JSON.stringify({
        daysAhead: 50, // Invalid - too high
        postsPerDay: 20 // Invalid - too high
      })
    })
    
    if (invalidResult.response?.status === 400) {
      console.log(`✅ Validation working correctly - rejected invalid parameters`)
    }
    
    console.log('\n🎉 Admin API testing completed!')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

// Run test if called directly
if (require.main === module) {
  main()
}

export { main as testAdminAPI }