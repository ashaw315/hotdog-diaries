import { NextResponse } from 'next/server'

/**
 * GET /api/test-auth
 * Quick endpoint to test if AUTH_TOKEN env var is accessible
 * Returns token info without exposing the actual value
 */
export async function GET() {
  const authToken = process.env.AUTH_TOKEN
  const cronSecret = process.env.CRON_SECRET

  return NextResponse.json({
    auth_token_exists: !!authToken,
    auth_token_length: authToken?.length || 0,
    auth_token_type: typeof authToken,
    auth_token_prefix: authToken?.substring(0, 5) + '...' || 'N/A',
    cron_secret_exists: !!cronSecret,
    cron_secret_length: cronSecret?.length || 0,
    test_comparison: authToken === 'test',
    trim_test: authToken?.trim().length !== authToken?.length ? 'HAS_WHITESPACE' : 'NO_WHITESPACE',
    env_check: {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL,
      VERCEL_ENV: process.env.VERCEL_ENV
    }
  })
}
