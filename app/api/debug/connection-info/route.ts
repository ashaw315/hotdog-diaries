// Debug endpoint to check database connection configuration
import { NextRequest } from 'next/server'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store, max-age=0',
    },
  })
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const providedToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null
    
    // Only allow if proper auth token is provided (simple security)
    if (!providedToken || providedToken !== 'debug-connection-info-2025') {
      return json({ error: 'Unauthorized - use Authorization: Bearer debug-connection-info-2025' }, 401)
    }

    // Check environment variables
    const postgres_url = process.env.POSTGRES_URL
    const database_url = process.env.DATABASE_URL
    const vercel = process.env.VERCEL
    const vercel_env = process.env.VERCEL_ENV
    const node_env = process.env.NODE_ENV

    // Parse connection string to see what user it's trying to use
    let connectionDetails = null
    if (postgres_url) {
      try {
        const url = new URL(postgres_url)
        connectionDetails = {
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.port,
          username: url.username,
          database: url.pathname.substring(1),
          hasPassword: !!url.password,
          passwordLength: url.password ? url.password.length : 0,
          searchParams: Object.fromEntries(url.searchParams.entries())
        }
      } catch (parseError) {
        connectionDetails = { error: 'Failed to parse POSTGRES_URL', details: parseError.message }
      }
    }

    return json({
      environment: {
        NODE_ENV: node_env,
        VERCEL: vercel,
        VERCEL_ENV: vercel_env,
        has_POSTGRES_URL: !!postgres_url,
        has_DATABASE_URL: !!database_url,
        POSTGRES_URL_prefix: postgres_url ? postgres_url.substring(0, 30) + '...' : null,
        DATABASE_URL_prefix: database_url ? database_url.substring(0, 30) + '...' : null
      },
      connection_details: connectionDetails,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    return json({
      error: 'Failed to get connection info',
      message: error.message,
      timestamp: new Date().toISOString()
    }, 500)
  }
}