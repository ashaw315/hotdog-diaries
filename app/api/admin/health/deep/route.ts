import { NextRequest, NextResponse } from 'next/server'
import { writeFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'
import { db } from '@/lib/db'
import jwt from 'jsonwebtoken'

interface HealthCheck {
  name: string
  ok: boolean
  duration_ms: number
  error?: string
  details?: Record<string, any>
}

interface DeepHealthResponse {
  ok: boolean
  timestamp: string
  version: string
  commit: string
  total_duration_ms: number
  checks: {
    db_ms: number
    jwt_ms: number
    fs_ms: number
    http_ms: number
    supabase_ms?: number
  }
  detailed_checks: HealthCheck[]
  environment: {
    node_env: string
    database_type: string
    supabase_configured: boolean
  }
}

async function performTimedCheck<T>(
  name: string, 
  checkFn: () => Promise<T>
): Promise<HealthCheck> {
  const start = Date.now()
  
  try {
    const result = await checkFn()
    const duration_ms = Date.now() - start
    
    return {
      name,
      ok: true,
      duration_ms,
      details: typeof result === 'object' && result !== null ? result : { result }
    }
  } catch (error) {
    const duration_ms = Date.now() - start
    
    return {
      name,
      ok: false,
      duration_ms,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

async function checkDatabase(): Promise<any> {
  // Test basic database connectivity
  const result = await db.query('SELECT 1 as test, NOW() as timestamp')
  
  if (!result.rows || result.rows.length === 0) {
    throw new Error('Database query returned no results')
  }
  
  return {
    test_value: result.rows[0].test || result.rows[0][0],
    timestamp: result.rows[0].timestamp || result.rows[0][1],
    row_count: result.rows.length
  }
}

async function checkSupabaseClient(): Promise<any> {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase configuration missing (SUPABASE_URL or SUPABASE_SERVICE_KEY)')
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey)
  
  // Test with a simple RPC call or table count
  const { data, error } = await supabase
    .from('content_queue')
    .select('id', { count: 'exact', head: true })
  
  if (error) {
    throw new Error(`Supabase client test failed: ${error.message}`)
  }
  
  return {
    url: supabaseUrl.substring(0, 20) + '...',
    key_length: supabaseKey.length,
    response_received: true
  }
}

async function checkJWT(): Promise<any> {
  const secret = process.env.JWT_SECRET
  
  if (!secret) {
    throw new Error('JWT_SECRET not configured')
  }
  
  const testPayload = {
    userId: 999,
    username: 'health-check',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60, // 1 minute
    aud: 'health',
    iss: 'hotdog-diaries'
  }
  
  // Sign token
  const token = jwt.sign(testPayload, secret, { algorithm: 'HS256' })
  
  // Verify token
  const decoded = jwt.verify(token, secret, { 
    algorithms: ['HS256'],
    audience: 'health',
    issuer: 'hotdog-diaries'
  }) as any
  
  return {
    token_length: token.length,
    decoded_userId: decoded.userId,
    sign_verify_cycle: 'success'
  }
}

async function checkFilesystem(): Promise<any> {
  const testFile = join(tmpdir(), `health-check-${Date.now()}-${Math.random().toString(36)}.tmp`)
  const testContent = `Health check test file created at ${new Date().toISOString()}`
  
  try {
    // Write test file
    await writeFile(testFile, testContent, 'utf8')
    
    // Clean up
    await unlink(testFile)
    
    return {
      temp_dir: tmpdir(),
      write_read_cycle: 'success',
      content_length: testContent.length
    }
  } catch (error) {
    // Attempt cleanup even if write failed
    try {
      await unlink(testFile)
    } catch {}
    throw error
  }
}

async function checkHTTP(): Promise<any> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 1000) // 1s timeout
  
  try {
    const response = await fetch('https://example.com', {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'HotdogDiaries-HealthCheck/1.0'
      }
    })
    
    clearTimeout(timeoutId)
    
    return {
      status: response.status,
      status_text: response.statusText,
      headers_received: Object.keys(Object.fromEntries(response.headers.entries())).length,
      ok: response.ok
    }
  } catch (error) {
    clearTimeout(timeoutId)
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('HTTP check timed out after 1000ms')
    }
    throw error
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now()
  
  try {
    // Perform all health checks
    const [
      dbCheck,
      jwtCheck,
      fsCheck,
      httpCheck,
      supabaseCheck
    ] = await Promise.all([
      performTimedCheck('database', checkDatabase),
      performTimedCheck('jwt', checkJWT),
      performTimedCheck('filesystem', checkFilesystem),
      performTimedCheck('http', checkHTTP),
      performTimedCheck('supabase', checkSupabaseClient)
    ])
    
    const totalDuration = Date.now() - startTime
    
    // Determine overall health status
    const allChecks = [dbCheck, jwtCheck, fsCheck, httpCheck, supabaseCheck]
    const overallOk = allChecks.every(check => check.ok)
    
    const response: DeepHealthResponse = {
      ok: overallOk,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 8) || 
              process.env.GITHUB_SHA?.substring(0, 8) || 
              'unknown',
      total_duration_ms: totalDuration,
      checks: {
        db_ms: dbCheck.duration_ms,
        jwt_ms: jwtCheck.duration_ms,
        fs_ms: fsCheck.duration_ms,
        http_ms: httpCheck.duration_ms,
        supabase_ms: supabaseCheck.duration_ms
      },
      detailed_checks: allChecks,
      environment: {
        node_env: process.env.NODE_ENV || 'unknown',
        database_type: process.env.DATABASE_URL ? 
          (process.env.DATABASE_URL.includes('postgres') ? 'postgresql' : 'sqlite') : 
          'unknown',
        supabase_configured: !!(process.env.SUPABASE_URL && 
          (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY))
      }
    }
    
    // Log health check results for monitoring
    console.log(`[HEALTH] Deep health check completed in ${totalDuration}ms`, {
      ok: overallOk,
      failed_checks: allChecks.filter(c => !c.ok).map(c => c.name),
      timing: response.checks
    })
    
    return NextResponse.json(response, {
      status: overallOk ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Content-Type': 'application/json'
      }
    })
    
  } catch (error) {
    const totalDuration = Date.now() - startTime
    
    console.error('[HEALTH] Deep health check failed:', error)
    
    const errorResponse: Partial<DeepHealthResponse> = {
      ok: false,
      timestamp: new Date().toISOString(),
      total_duration_ms: totalDuration,
      detailed_checks: [{
        name: 'health_check_execution',
        ok: false,
        duration_ms: totalDuration,
        error: error instanceof Error ? error.message : String(error)
      }],
      environment: {
        node_env: process.env.NODE_ENV || 'unknown',
        database_type: 'unknown',
        supabase_configured: false
      }
    }
    
    return NextResponse.json(errorResponse, {
      status: 500,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Content-Type': 'application/json'
      }
    })
  }
}