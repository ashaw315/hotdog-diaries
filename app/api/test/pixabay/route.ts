import { NextRequest, NextResponse } from 'next/server'
import { pixabayScanningService } from '@/lib/services/pixabay-scanning'

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing Pixabay integration with debugging...')
    
    const testResults = {
      timestamp: new Date().toISOString(),
      tests: {}
    }

    // Test 1: API Connection
    try {
      const connectionTest = await pixabayScanningService.testConnection()
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

    // Test 2: Small scan test with detailed debugging (only 3 posts)
    try {
      console.log('🔍 Starting Pixabay scan with detailed debugging...')
      const scanResult = await pixabayScanningService.performScan({ maxPosts: 3 })
      console.log('✅ Pixabay scan completed:', scanResult)
      
      testResults.tests.scanning = {
        success: true,
        message: 'Scan test completed',
        data: scanResult
      }
    } catch (error) {
      console.error('❌ Pixabay scan failed:', error)
      testResults.tests.scanning = {
        success: false,
        message: `Scanning test failed: ${error.message}`,
        error: error.message,
        stack: error.stack
      }
    }

    // Overall success
    const overallSuccess = Object.values(testResults.tests).every(test => test.success)
    
    console.log(`✅ Pixabay integration test completed: ${overallSuccess ? 'SUCCESS' : 'PARTIAL'}`)
    
    return NextResponse.json({
      success: overallSuccess,
      message: overallSuccess ? 'All Pixabay tests passed' : 'Some Pixabay tests failed',
      data: testResults
    })

  } catch (error) {
    console.error('Pixabay integration test error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Pixabay integration test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}