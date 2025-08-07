import { NextRequest, NextResponse } from 'next/server'
import { imgurScanningService } from '@/lib/services/imgur-scanning'
import { logToDatabase } from '@/lib/db'
import { LogLevel } from '@/types'

export async function GET(request: NextRequest) {
  try {
    // Authentication is handled by middleware
    // User info is available in headers if needed: x-user-id, x-username

    await logToDatabase(
      LogLevel.INFO,
      'IMGUR_CONNECTION_TEST_INITIATED',
      'Imgur API connection test initiated from admin panel'
    )

    // Check environment variable availability
    const clientId = process.env.IMGUR_CLIENT_ID
    const hasClientId = Boolean(clientId)
    const mode = hasClientId ? 'api' : 'mock'

    // Test the actual connection using the service
    const connectionResult = await imgurScanningService.testConnection()

    // Prepare detailed response
    const testDetails = {
      environment: {
        hasClientId,
        clientIdLength: clientId ? clientId.length : 0,
        clientIdMasked: clientId ? `${clientId.substring(0, 4)}***${clientId.substring(clientId.length - 3)}` : null,
        mode,
        nodeEnv: process.env.NODE_ENV
      },
      connection: connectionResult,
      timestamp: new Date().toISOString()
    }

    if (connectionResult.success) {
      await logToDatabase(
        LogLevel.INFO,
        'IMGUR_CONNECTION_TEST_SUCCESS',
        `Imgur API connection test successful (mode: ${mode})`,
        { details: testDetails }
      )

      return NextResponse.json({
        success: true,
        data: testDetails,
        message: `Imgur ${mode === 'api' ? 'API' : 'mock mode'} connection successful`,
        mode
      })
    } else {
      await logToDatabase(
        LogLevel.WARNING,
        'IMGUR_CONNECTION_TEST_FAILED',
        `Imgur API connection test failed: ${connectionResult.message}`,
        { details: testDetails }
      )

      return NextResponse.json(
        {
          success: false,
          error: connectionResult.message,
          details: testDetails,
          message: 'Connection test failed',
          mode
        },
        { status: 503 } // Service Unavailable
      )
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    await logToDatabase(
      LogLevel.ERROR,
      'IMGUR_CONNECTION_TEST_ERROR',
      `Imgur API connection test error: ${errorMessage}`,
      { error: errorMessage }
    )

    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        message: 'Connection test failed due to system error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  // Allow POST for compatibility, but just redirect to GET
  return GET(request)
}