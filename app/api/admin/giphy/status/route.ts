import { NextRequest, NextResponse } from 'next/server'
import { giphyScanningService } from '@/lib/services/giphy-scanning'

export async function GET(request: NextRequest) {
  try {
    // Authentication is handled by middleware
    // User info is available in headers if needed: x-user-id, x-username

    // Get environment variable status
    const apiKey = process.env.GIPHY_API_KEY
    const hasApiKey = Boolean(apiKey)
    const mode = hasApiKey ? 'api' : 'mock'

    // Get scan configuration
    const config = await giphyScanningService.getScanConfig()

    // Test connection status
    const connectionTest = await giphyScanningService.testConnection()

    const status = {
      platform: 'giphy',
      timestamp: new Date().toISOString(),
      environment: {
        hasApiKey,
        apiKeyConfigured: hasApiKey,
        apiKeyLength: apiKey ? apiKey.length : 0,
        apiKeyMasked: apiKey ? `${apiKey.substring(0, 4)}***${apiKey.substring(apiKey.length - 3)}` : null,
        mode,
        nodeEnv: process.env.NODE_ENV
      },
      configuration: {
        ...config,
        searchTermsCount: config.searchTerms.length,
        searchTerms: config.searchTerms,
        rateLimits: {
          hourly: config.hourlyRequestCount || 0,
          daily: config.dailyRequestCount || 0,
          hourlyLimit: 42,
          dailyLimit: 1000
        }
      },
      connection: {
        isConnected: connectionTest.success,
        message: connectionTest.message,
        lastTested: new Date().toISOString(),
        details: connectionTest.details
      },
      capabilities: {
        canScan: true, // Always true since we have mock mode
        canSearch: hasApiKey,
        realTimeMode: mode === 'api',
        mockMode: mode === 'mock',
        rateLimiting: hasApiKey ? '42 requests/hour, 1000/day' : 'No rate limiting in mock mode'
      }
    }

    return NextResponse.json({
      success: true,
      data: status,
      message: `Giphy status retrieved successfully (${mode} mode)`
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        message: 'Failed to retrieve Giphy status'
      },
      { status: 500 }
    )
  }
}