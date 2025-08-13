import { NextRequest, NextResponse } from 'next/server'
import { giphyScanningService } from '@/lib/services/giphy-scanning'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export async function GET(request: NextRequest) {
  try {
    // Authentication is handled by middleware
    // User info is available in headers if needed: x-user-id, x-username

    const apiKey = process.env.GIPHY_API_KEY
    const mode = apiKey ? 'api' : 'mock'

    await logToDatabase(
      LogLevel.INFO,
      'GIPHY_CONNECTION_TEST',
      `Giphy connection test initiated from admin panel (${mode} mode)`,
      { mode }
    )

    const testResult = await giphyScanningService.testConnection()

    const response = {
      success: testResult.success,
      data: {
        ...testResult,
        mode,
        timestamp: new Date().toISOString(),
        environment: {
          hasApiKey: Boolean(apiKey),
          apiKeyLength: apiKey ? apiKey.length : 0,
          apiKeyMasked: apiKey ? `${apiKey.substring(0, 4)}***${apiKey.substring(apiKey.length - 3)}` : null,
          nodeEnv: process.env.NODE_ENV
        },
        rateLimits: {
          hourlyLimit: 42,
          dailyLimit: 1000,
          currentUsage: testResult.details?.quotaUsed || 0,
          remaining: testResult.details?.quotaRemaining || 0
        }
      },
      message: testResult.message
    }

    await logToDatabase(
      LogLevel.INFO,
      'GIPHY_CONNECTION_TEST_COMPLETED',
      `Giphy connection test completed: ${testResult.success ? 'Success' : 'Failed'}`,
      { result: response.data }
    )

    return NextResponse.json(response, { 
      status: testResult.success ? 200 : 503 
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    await logToDatabase(
      LogLevel.ERROR,
      'GIPHY_CONNECTION_TEST_ERROR',
      `Giphy connection test error: ${errorMessage}`,
      { error: errorMessage }
    )

    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        message: 'Giphy connection test failed',
        data: {
          mode: process.env.GIPHY_API_KEY ? 'api' : 'mock',
          timestamp: new Date().toISOString()
        }
      },
      { status: 500 }
    )
  }
}