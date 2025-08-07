import { NextRequest, NextResponse } from 'next/server'
import { imgurScanningService } from '@/lib/services/imgur-scanning'

export async function GET(request: NextRequest) {
  try {
    // Authentication is handled by middleware
    // User info is available in headers if needed: x-user-id, x-username

    // Get environment variable status
    const clientId = process.env.IMGUR_CLIENT_ID
    const hasClientId = Boolean(clientId)
    const mode = hasClientId ? 'api' : 'mock'

    // Get scan configuration
    const config = await imgurScanningService.getScanConfig()

    // Test connection status
    const connectionTest = await imgurScanningService.testConnection()

    const status = {
      platform: 'imgur',
      timestamp: new Date().toISOString(),
      environment: {
        hasClientId,
        clientIdConfigured: hasClientId,
        clientIdLength: clientId ? clientId.length : 0,
        clientIdMasked: clientId ? `${clientId.substring(0, 4)}***${clientId.substring(clientId.length - 3)}` : null,
        mode,
        nodeEnv: process.env.NODE_ENV
      },
      configuration: {
        ...config,
        searchTermsCount: config.searchTerms.length,
        searchTerms: config.searchTerms
      },
      connection: {
        isConnected: connectionTest.success,
        message: connectionTest.message,
        lastTested: new Date().toISOString(),
        details: connectionTest.details
      },
      capabilities: {
        canScan: true, // Always true since we have mock mode
        canSearch: hasClientId,
        realTimeMode: mode === 'api',
        mockMode: mode === 'mock',
        rateLimiting: hasClientId ? 'Imgur API limits apply' : 'No rate limiting in mock mode'
      }
    }

    return NextResponse.json({
      success: true,
      data: status,
      message: `Imgur status retrieved successfully (${mode} mode)`
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        message: 'Failed to retrieve Imgur status'
      },
      { status: 500 }
    )
  }
}