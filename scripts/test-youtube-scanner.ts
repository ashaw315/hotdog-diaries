#!/usr/bin/env tsx

// Force load environment variables
process.env.YOUTUBE_API_KEY = 'AIzaSyBUeB1_I_qu3Tl2zu0JD5tdC6NuVXwiKxA'

import { youtubeScanningService } from '../lib/services/youtube-scanning'

console.log('🧪 Testing YouTube Scanner with Real API...\n')

async function main() {
  try {
    console.log('1. Testing API connection...')
    const connectionTest = await youtubeScanningService.testConnection()
    console.log('   Connection result:', connectionTest.success ? '✅' : '❌', connectionTest.message)
    if (connectionTest.details) {
      console.log('   Details:', connectionTest.details)
    }
    
    if (!connectionTest.success) {
      console.log('❌ Cannot proceed - API connection failed')
      process.exit(1)
    }
    
    console.log('\n2. Running real YouTube scan...')
    const scanResult = await youtubeScanningService.performScan({ maxPosts: 20 })
    
    console.log('   Scan results:')
    console.log('   - Total found:', scanResult.totalFound)
    console.log('   - Processed:', scanResult.processed)
    console.log('   - Approved:', scanResult.approved)
    console.log('   - Rejected:', scanResult.rejected)
    console.log('   - Duplicates:', scanResult.duplicates)
    console.log('   - Errors:', scanResult.errors.length)
    
    if (scanResult.errors.length > 0) {
      console.log('   Error details:')
      scanResult.errors.forEach(error => {
        console.log('     -', error)
      })
    }
    
    console.log('\n🎉 YouTube scanner test completed!')
    
  } catch (error) {
    console.error('\n❌ Test failed:', error)
  } finally {
    process.exit(0)
  }
}

main()