/**
 * @jest-environment node
 */

import { GET } from '@/app/api/admin/health/deep/route'
import { NextRequest } from 'next/server'

// Mock environment variables
const originalEnv = process.env
beforeAll(() => {
  process.env = {
    ...originalEnv,
    JWT_SECRET: 'test-secret-for-health-check-unit-tests-only',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    NODE_ENV: 'test'
  }
})

afterAll(() => {
  process.env = originalEnv
})

describe('/api/admin/health/deep', () => {
  it('should return expected response structure', async () => {
    const request = new NextRequest('http://localhost:3000/api/admin/health/deep', {
      method: 'GET'
    })

    const response = await GET(request)
    const data = await response.json()

    // Test response structure
    expect(response.status).toBeOneOf([200, 503, 500])
    expect(data).toHaveProperty('ok')
    expect(data).toHaveProperty('timestamp')
    expect(data).toHaveProperty('version')
    expect(data).toHaveProperty('commit')
    expect(data).toHaveProperty('total_duration_ms')
    expect(data).toHaveProperty('checks')
    expect(data).toHaveProperty('detailed_checks')
    expect(data).toHaveProperty('environment')

    // Test timing checks structure
    expect(data.checks).toHaveProperty('db_ms')
    expect(data.checks).toHaveProperty('jwt_ms')
    expect(data.checks).toHaveProperty('fs_ms')
    expect(data.checks).toHaveProperty('http_ms')
    expect(data.checks).toHaveProperty('supabase_ms')

    // Ensure all timing values are numbers
    expect(typeof data.checks.db_ms).toBe('number')
    expect(typeof data.checks.jwt_ms).toBe('number')
    expect(typeof data.checks.fs_ms).toBe('number')
    expect(typeof data.checks.http_ms).toBe('number')
    expect(typeof data.checks.supabase_ms).toBe('number')

    // Test detailed checks array
    expect(Array.isArray(data.detailed_checks)).toBe(true)
    expect(data.detailed_checks.length).toBeGreaterThan(0)

    // Test each detailed check structure
    data.detailed_checks.forEach((check: any) => {
      expect(check).toHaveProperty('name')
      expect(check).toHaveProperty('ok')
      expect(check).toHaveProperty('duration_ms')
      expect(typeof check.ok).toBe('boolean')
      expect(typeof check.duration_ms).toBe('number')
      
      if (!check.ok) {
        expect(check).toHaveProperty('error')
        expect(typeof check.error).toBe('string')
      }
    })

    // Test environment structure
    expect(data.environment).toHaveProperty('node_env')
    expect(data.environment).toHaveProperty('database_type')
    expect(data.environment).toHaveProperty('supabase_configured')
    expect(typeof data.environment.supabase_configured).toBe('boolean')
  })

  it('should have reasonable response times', async () => {
    const request = new NextRequest('http://localhost:3000/api/admin/health/deep', {
      method: 'GET'
    })

    const startTime = Date.now()
    const response = await GET(request)
    const endTime = Date.now()
    const totalTime = endTime - startTime

    const data = await response.json()

    // Health check should complete within reasonable time (10 seconds max)
    expect(totalTime).toBeLessThan(10000)
    expect(data.total_duration_ms).toBeLessThan(10000)

    // Individual checks should be reasonably fast
    expect(data.checks.jwt_ms).toBeLessThan(1000) // JWT should be very fast
    expect(data.checks.fs_ms).toBeLessThan(1000)  // Filesystem should be fast
    expect(data.checks.http_ms).toBeLessThan(2000) // HTTP might be slower but reasonable
  })

  it('should include cache-control headers', async () => {
    const request = new NextRequest('http://localhost:3000/api/admin/health/deep', {
      method: 'GET'
    })

    const response = await GET(request)

    expect(response.headers.get('Cache-Control')).toContain('no-store')
    expect(response.headers.get('Content-Type')).toBe('application/json')
  })

  it('should handle missing environment gracefully', async () => {
    // Temporarily remove critical env vars
    const tempJwtSecret = process.env.JWT_SECRET
    const tempSupabaseUrl = process.env.SUPABASE_URL
    
    delete process.env.JWT_SECRET
    delete process.env.SUPABASE_URL

    const request = new NextRequest('http://localhost:3000/api/admin/health/deep', {
      method: 'GET'
    })

    const response = await GET(request)
    const data = await response.json()

    // Should still return structured response but with failures
    expect(data).toHaveProperty('ok')
    expect(data).toHaveProperty('detailed_checks')
    
    // Some checks should fail
    const failedChecks = data.detailed_checks.filter((check: any) => !check.ok)
    expect(failedChecks.length).toBeGreaterThan(0)

    // Restore env vars
    if (tempJwtSecret) process.env.JWT_SECRET = tempJwtSecret
    if (tempSupabaseUrl) process.env.SUPABASE_URL = tempSupabaseUrl
  })

  it('should validate JWT check specifically', async () => {
    const request = new NextRequest('http://localhost:3000/api/admin/health/deep', {
      method: 'GET'
    })

    const response = await GET(request)
    const data = await response.json()

    // Find JWT check
    const jwtCheck = data.detailed_checks.find((check: any) => check.name === 'jwt')
    expect(jwtCheck).toBeDefined()

    if (jwtCheck.ok) {
      expect(jwtCheck.details).toHaveProperty('sign_verify_cycle')
      expect(jwtCheck.details.sign_verify_cycle).toBe('success')
    } else {
      expect(jwtCheck.error).toContain('JWT_SECRET')
    }
  })

  it('should validate filesystem check specifically', async () => {
    const request = new NextRequest('http://localhost:3000/api/admin/health/deep', {
      method: 'GET'
    })

    const response = await GET(request)
    const data = await response.json()

    // Find filesystem check
    const fsCheck = data.detailed_checks.find((check: any) => check.name === 'filesystem')
    expect(fsCheck).toBeDefined()

    if (fsCheck.ok) {
      expect(fsCheck.details).toHaveProperty('write_read_cycle')
      expect(fsCheck.details.write_read_cycle).toBe('success')
      expect(fsCheck.details).toHaveProperty('temp_dir')
    }
  })

  it('should validate HTTP check specifically', async () => {
    const request = new NextRequest('http://localhost:3000/api/admin/health/deep', {
      method: 'GET'
    })

    const response = await GET(request)
    const data = await response.json()

    // Find HTTP check
    const httpCheck = data.detailed_checks.find((check: any) => check.name === 'http')
    expect(httpCheck).toBeDefined()

    if (httpCheck.ok) {
      expect(httpCheck.details).toHaveProperty('status')
      expect(httpCheck.details).toHaveProperty('ok')
      expect(httpCheck.details.status).toBeGreaterThanOrEqual(200)
    }
  })
})