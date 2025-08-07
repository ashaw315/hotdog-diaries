import { NextRequest, NextResponse } from 'next/server'
import { blueskyService } from '@/lib/services/bluesky-scanning'

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing Bluesky integration...')
    
    const testResults = {
      timestamp: new Date().toISOString(),
      tests: {}
    }

    // Test 1: API Connection
    try {
      const connectionTest = await blueskyService.testConnection()
      testResults.tests.connection = {
        success: connectionTest.success,
        message: connectionTest.message,
        details: connectionTest.details
      }
    } catch (error) {
      testResults.tests.connection = {
        success: false,
        message: `Connection test failed: ${error.message}`,
        error: error.message
      }
    }

    // Test 2: Get configuration
    try {
      const config = await blueskyService.getScanConfig()
      testResults.tests.configuration = {
        success: true,
        data: config
      }
    } catch (error) {
      testResults.tests.configuration = {
        success: false,
        message: `Configuration test failed: ${error.message}`,
        error: error.message
      }
    }

    // Test 3: Get statistics  
    try {
      const stats = await blueskyService.getScanningStats()
      testResults.tests.statistics = {
        success: true,
        data: stats
      }
    } catch (error) {
      testResults.tests.statistics = {
        success: false,
        message: `Statistics test failed: ${error.message}`,
        error: error.message
      }
    }

    // Test 4: Small scan test (only 3 posts)
    try {
      const scanResult = await blueskyService.performScan({ maxPosts: 3 })
      testResults.tests.scanning = {
        success: true,
        message: 'Scan test completed',
        data: scanResult
      }
    } catch (error) {
      testResults.tests.scanning = {
        success: false,
        message: `Scanning test failed: ${error.message}`,
        error: error.message
      }
    }

    // Overall success
    const overallSuccess = Object.values(testResults.tests).every(test => test.success)
    
    console.log(`✅ Bluesky integration test completed: ${overallSuccess ? 'SUCCESS' : 'PARTIAL'}`)
    
    return NextResponse.json({
      success: overallSuccess,
      message: overallSuccess ? 'All Bluesky tests passed' : 'Some Bluesky tests failed',
      data: testResults
    })

  } catch (error) {
    console.error('Bluesky integration test error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Bluesky integration test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}