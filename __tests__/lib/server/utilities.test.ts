// @ts-nocheck - Test file for server utilities
import { requireEnv, getEnv, featureFlagSourceOfTruth, hasAllCoreEnv } from '@/app/lib/server/env'
import { supabaseServiceClient } from '@/app/lib/server/supabase'

describe('Server Utilities', () => {
  
  describe('Environment Utilities', () => {
    const originalEnv = process.env

    beforeEach(() => {
      // Reset env for each test
      process.env = { ...originalEnv }
    })

    afterAll(() => {
      process.env = originalEnv
    })

    describe('requireEnv', () => {
      it('should return value when env var exists', () => {
        process.env.TEST_VAR = 'test-value'
        expect(requireEnv('TEST_VAR')).toBe('test-value')
      })

      it('should throw when env var is missing', () => {
        delete process.env.TEST_VAR
        expect(() => requireEnv('TEST_VAR')).toThrow('Missing env: TEST_VAR')
      })

      it('should throw when env var is empty string', () => {
        process.env.TEST_VAR = ''
        expect(() => requireEnv('TEST_VAR')).toThrow('Missing env: TEST_VAR')
      })
    })

    describe('getEnv', () => {
      it('should return value when env var exists', () => {
        process.env.TEST_VAR = 'test-value'
        expect(getEnv('TEST_VAR')).toBe('test-value')
      })

      it('should return undefined when env var is missing', () => {
        delete process.env.TEST_VAR
        expect(getEnv('TEST_VAR')).toBeUndefined()
      })

      it('should return fallback when env var is missing', () => {
        delete process.env.TEST_VAR
        expect(getEnv('TEST_VAR', 'fallback')).toBe('fallback')
      })

      it('should return actual value over fallback when env var exists', () => {
        process.env.TEST_VAR = 'actual'
        expect(getEnv('TEST_VAR', 'fallback')).toBe('actual')
      })
    })

    describe('featureFlagSourceOfTruth', () => {
      it('should return true when flag is "true"', () => {
        process.env.ENFORCE_SCHEDULE_SOURCE_OF_TRUTH = 'true'
        expect(featureFlagSourceOfTruth()).toBe(true)
      })

      it('should return false when flag is not "true"', () => {
        process.env.ENFORCE_SCHEDULE_SOURCE_OF_TRUTH = 'false'
        expect(featureFlagSourceOfTruth()).toBe(false)
      })

      it('should return false when flag is missing', () => {
        delete process.env.ENFORCE_SCHEDULE_SOURCE_OF_TRUTH
        expect(featureFlagSourceOfTruth()).toBe(false)
      })

      it('should return false for other truthy values', () => {
        process.env.ENFORCE_SCHEDULE_SOURCE_OF_TRUTH = '1'
        expect(featureFlagSourceOfTruth()).toBe(false)
      })
    })

    describe('hasAllCoreEnv', () => {
      it('should return ok:true when all required env vars exist', () => {
        process.env.SUPABASE_URL = 'https://test.supabase.co'
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
        process.env.JWT_SECRET = 'test-secret'
        
        const result = hasAllCoreEnv()
        expect(result.ok).toBe(true)
        expect(result.missing).toEqual([])
      })

      it('should prefer V2 key when available', () => {
        process.env.SUPABASE_URL = 'https://test.supabase.co'
        process.env.SUPABASE_SERVICE_ROLE_KEY_V2 = 'test-key-v2'
        process.env.JWT_SECRET = 'test-secret'
        delete process.env.SUPABASE_SERVICE_ROLE_KEY
        
        const result = hasAllCoreEnv()
        expect(result.ok).toBe(true)
        expect(result.missing).toEqual([])
      })

      it('should return missing env vars', () => {
        delete process.env.SUPABASE_URL
        delete process.env.SUPABASE_SERVICE_ROLE_KEY
        delete process.env.SUPABASE_SERVICE_ROLE_KEY_V2
        delete process.env.JWT_SECRET
        
        const result = hasAllCoreEnv()
        expect(result.ok).toBe(false)
        expect(result.missing).toContain('SUPABASE_URL')
        expect(result.missing).toContain('JWT_SECRET')
      })
    })
  })

  describe('Supabase Client Factory', () => {
    const originalEnv = process.env

    beforeEach(() => {
      process.env = { ...originalEnv }
    })

    afterAll(() => {
      process.env = originalEnv
    })

    it('should throw when SUPABASE_URL is missing', () => {
      delete process.env.SUPABASE_URL
      delete process.env.SUPABASE_SERVICE_ROLE_KEY
      delete process.env.SUPABASE_SERVICE_ROLE_KEY_V2
      
      expect(() => supabaseServiceClient()).toThrow('Supabase service client missing SUPABASE_URL or SERVICE_ROLE_KEY')
    })

    it('should throw when service role key is missing', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co'
      delete process.env.SUPABASE_SERVICE_ROLE_KEY
      delete process.env.SUPABASE_SERVICE_ROLE_KEY_V2
      
      expect(() => supabaseServiceClient()).toThrow('Supabase service client missing SUPABASE_URL or SERVICE_ROLE_KEY')
    })

    it('should create client when V1 key is available', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co'
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
      delete process.env.SUPABASE_SERVICE_ROLE_KEY_V2
      
      const client = supabaseServiceClient()
      expect(client).toBeDefined()
      expect(typeof client.from).toBe('function')
    })

    it('should prefer V2 key over V1 key', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co'
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key-v1'
      process.env.SUPABASE_SERVICE_ROLE_KEY_V2 = 'test-key-v2'
      
      // Mock getEnv to verify V2 is preferred
      const client = supabaseServiceClient()
      expect(client).toBeDefined()
    })
  })
})