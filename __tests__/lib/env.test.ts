/**
 * Environment Configuration Tests
 * 
 * Tests the environment variable validation and loading system
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { z } from 'zod'
import { 
  withEnv, 
  createValidTestEnv, 
  createInvalidTestEnv, 
  createSocialMediaTestEnv,
  createPostgreSQLTestEnv,
  createVercelPostgresTestEnv,
  resetEnvironmentInstance
} from '@/__tests__/utils/env-mocks'

// Import after mocking utilities are set up
let env: any
let envSchema: z.ZodType<any>
let isServiceConfigured: any
let getDatabaseConfig: any

beforeEach(async () => {
  // Reset the environment singleton before each test
  resetEnvironmentInstance()
  
  // Re-import the modules to get fresh instances
  const envModule = await import('@/lib/env')
  env = envModule.env
  envSchema = envModule.envSchema
  isServiceConfigured = envModule.isServiceConfigured
  getDatabaseConfig = envModule.getDatabaseConfig
})

describe('Environment Configuration', () => {
  describe('Schema Validation', () => {
    it('should validate minimal required environment variables', () => {
      withEnv(createValidTestEnv(), () => {
        const result = envSchema.safeParse(process.env)
        expect(result.success).toBe(true)
      })
    })

    it('should reject JWT_SECRET that is too short', () => {
      withEnv(createValidTestEnv({ JWT_SECRET: 'too-short' }), () => {
        const result = envSchema.safeParse(process.env)
        expect(result.success).toBe(false)
        if (!result.success) {
          const jwtError = result.error.issues.find(e => e.path[0] === 'JWT_SECRET')
          expect(jwtError).toBeDefined()
          expect(jwtError?.message).toContain('at least 64 characters')
        }
      })
    })

    it('should reject ADMIN_PASSWORD that is too short', () => {
      withEnv(createValidTestEnv({ ADMIN_PASSWORD: 'short' }), () => {
        const result = envSchema.safeParse(process.env)
        expect(result.success).toBe(false)
        if (!result.success) {
          const passwordError = result.error.issues.find(e => e.path[0] === 'ADMIN_PASSWORD')
          expect(passwordError).toBeDefined()
          expect(passwordError?.message).toContain('at least 8 characters')
        }
      })
    })

    it('should validate optional social media API keys', () => {
      withEnv(createSocialMediaTestEnv(), () => {
        const result = envSchema.safeParse(process.env)
        expect(result.success).toBe(true)
      })
    })

    it('should transform boolean string values correctly', () => {
      withEnv(createValidTestEnv({
        ENABLE_AUTO_SCANNING: 'true',
        ENABLE_AUTO_POSTING: 'false',
        USE_POSTGRES_IN_DEV: 'true',
      }), () => {
        const result = envSchema.parse(process.env)
        expect(result.ENABLE_AUTO_SCANNING).toBe(true)
        expect(result.ENABLE_AUTO_POSTING).toBe(false)
        expect(result.USE_POSTGRES_IN_DEV).toBe(true)
      })
    })
  })

  describe('Service Configuration Detection', () => {
    it('should detect Reddit service when credentials are present', () => {
      withEnv(createValidTestEnv({
        REDDIT_CLIENT_ID: 'test-client-id',
        REDDIT_CLIENT_SECRET: 'test-client-secret'
      }), () => {
        expect(isServiceConfigured('reddit')).toBe(true)
      })
    })

    it('should not detect Reddit service when credentials are missing', () => {
      withEnv(createValidTestEnv({
        REDDIT_CLIENT_ID: 'test-client-id'
        // Missing REDDIT_CLIENT_SECRET
      }), () => {
        expect(isServiceConfigured('reddit')).toBe(false)
      })
    })

    it('should detect YouTube service when API key is present', () => {
      withEnv(createValidTestEnv({
        YOUTUBE_API_KEY: 'test-youtube-key'
      }), () => {
        expect(isServiceConfigured('youtube')).toBe(true)
      })
    })

    it('should detect multiple services correctly', () => {
      withEnv(createSocialMediaTestEnv(), () => {
        expect(isServiceConfigured('youtube')).toBe(true)
        expect(isServiceConfigured('giphy')).toBe(true)
        expect(isServiceConfigured('pixabay')).toBe(true)
        expect(isServiceConfigured('reddit')).toBe(true)
        expect(isServiceConfigured('tumblr')).toBe(true)
        expect(isServiceConfigured('bluesky')).toBe(true)
      })
    })
  })

  describe('Database Configuration', () => {
    it('should use SQLite in development by default', () => {
      withEnv(createValidTestEnv({ NODE_ENV: 'development' }), () => {
        const dbConfig = getDatabaseConfig()
        expect(dbConfig.type).toBe('sqlite')
        expect(dbConfig).toHaveProperty('path')
      })
    })

    it('should use PostgreSQL when USE_POSTGRES_IN_DEV is true', () => {
      withEnv(createPostgreSQLTestEnv(), () => {
        const dbConfig = getDatabaseConfig()
        expect(dbConfig.type).toBe('postgres')
        expect(dbConfig).toHaveProperty('host', 'localhost')
        expect(dbConfig).toHaveProperty('port', 5432)
      })
    })

    it('should use Vercel Postgres in production when POSTGRES_URL is set', () => {
      withEnv(createVercelPostgresTestEnv(), () => {
        const dbConfig = getDatabaseConfig()
        expect(dbConfig.type).toBe('vercel-postgres')
        expect(dbConfig).toHaveProperty('url', 'postgres://user:pass@host:5432/db')
      })
    })

    it('should use regular PostgreSQL in production when POSTGRES_URL is not set', () => {
      withEnv(createValidTestEnv({
        NODE_ENV: 'production',
        DATABASE_HOST: 'prod-host',
        DATABASE_PORT: '5432',
        DATABASE_NAME: 'prod_db',
        DATABASE_USER: 'prod_user',
        DATABASE_PASSWORD: 'prod_pass'
      }), () => {
        const dbConfig = getDatabaseConfig()
        expect(dbConfig.type).toBe('postgres')
        expect(dbConfig).toHaveProperty('host', 'prod-host')
      })
    })
  })

  describe('Error Handling', () => {
    it('should provide helpful error messages for missing required variables', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      
      // Temporarily set environment to non-test to enable error logging
      const originalNodeEnv = process.env.NODE_ENV
      const originalJestWorker = process.env.JEST_WORKER_ID
      process.env.NODE_ENV = 'development'
      delete process.env.JEST_WORKER_ID
      
      withEnv(createInvalidTestEnv(['JWT_SECRET', 'ADMIN_PASSWORD']), () => {
        expect(() => env.validate(true)).toThrow()
        
        // Check that helpful error messages were logged
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('Environment Variable Validation Failed')
        )
      })
      
      // Restore test environment
      process.env.NODE_ENV = originalNodeEnv
      if (originalJestWorker) {
        process.env.JEST_WORKER_ID = originalJestWorker
      }
      
      consoleErrorSpy.mockRestore()
    })

    it('should not exit process when strict mode is false', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      const processExitSpy = jest.spyOn(process, 'exit').mockImplementation((code?: number) => {
        throw new Error(`Process.exit called with code ${code}`)
      })
      
      withEnv(createInvalidTestEnv(['JWT_SECRET']), () => {
        expect(() => env.validate(false)).toThrow()
        expect(processExitSpy).not.toHaveBeenCalled()
      })
      
      consoleErrorSpy.mockRestore()
      processExitSpy.mockRestore()
    })
  })

  describe('Environment Types', () => {
    it('should only allow valid NODE_ENV values', () => {
      const validEnvs = ['development', 'test', 'production']
      
      validEnvs.forEach(nodeEnv => {
        withEnv(createValidTestEnv({ NODE_ENV: nodeEnv }), () => {
          const result = envSchema.safeParse(process.env)
          expect(result.success).toBe(true)
        })
      })
      
      withEnv(createValidTestEnv({ NODE_ENV: 'staging' }), () => {
        const result = envSchema.safeParse(process.env)
        expect(result.success).toBe(false)
      })
    })
  })

  describe('Environment Integration', () => {
    it('should validate complete environment configuration', () => {
      withEnv(createValidTestEnv(), () => {
        expect(() => env.validate()).not.toThrow()
        const envVars = env.env
        expect(envVars.NODE_ENV).toBe('test')
        expect(envVars.JWT_SECRET).toHaveLength(64)
        expect(envVars.ADMIN_USERNAME).toBe('admin')
      })
    })

    it('should handle missing optional variables gracefully', () => {
      withEnv(createValidTestEnv(), () => {
        expect(() => env.validate()).not.toThrow()
        
        // Optional variables should not cause failures
        expect(isServiceConfigured('reddit')).toBe(false)
        expect(isServiceConfigured('youtube')).toBe(false)
        expect(isServiceConfigured('giphy')).toBe(false)
      })
    })

    it('should provide database configuration based on environment', () => {
      // Test SQLite configuration
      withEnv(createValidTestEnv({ NODE_ENV: 'development' }), () => {
        const dbConfig = getDatabaseConfig()
        expect(dbConfig.type).toBe('sqlite')
        expect(dbConfig.path).toMatch(/\.db$/)
      })
    })
  })
})