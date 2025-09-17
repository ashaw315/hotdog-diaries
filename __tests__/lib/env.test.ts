/**
 * Environment Configuration Tests
 * 
 * Tests the environment variable validation and loading system
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { z } from 'zod'
import { env, envSchema, isServiceConfigured, getDatabaseConfig } from '@/lib/env'

describe('Environment Configuration', () => {
  // Store original env vars
  const originalEnv = { ...process.env }
  
  beforeEach(() => {
    // Clear environment for each test
    Object.keys(process.env).forEach(key => {
      if (!key.startsWith('NODE_')) {
        delete process.env[key]
      }
    })
  })
  
  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv }
  })

  describe('Schema Validation', () => {
    it('should validate minimal required environment variables', () => {
      const minimalEnv = {
        NODE_ENV: 'test',
        JWT_SECRET: 'a'.repeat(64),
        ADMIN_USERNAME: 'admin',
        ADMIN_PASSWORD: 'TestPass123!',
        CRON_SECRET: 'test-cron-secret-123',
      }
      
      const result = envSchema.safeParse(minimalEnv)
      expect(result.success).toBe(true)
    })

    it('should reject JWT_SECRET that is too short', () => {
      const invalidEnv = {
        NODE_ENV: 'test',
        JWT_SECRET: 'too-short',
        ADMIN_USERNAME: 'admin',
        ADMIN_PASSWORD: 'TestPass123!',
        CRON_SECRET: 'test-cron-secret',
      }
      
      const result = envSchema.safeParse(invalidEnv)
      expect(result.success).toBe(false)
      if (!result.success) {
        const jwtError = result.error.errors.find(e => e.path[0] === 'JWT_SECRET')
        expect(jwtError).toBeDefined()
        expect(jwtError?.message).toContain('at least 64 characters')
      }
    })

    it('should reject ADMIN_PASSWORD that is too short', () => {
      const invalidEnv = {
        NODE_ENV: 'test',
        JWT_SECRET: 'a'.repeat(64),
        ADMIN_USERNAME: 'admin',
        ADMIN_PASSWORD: 'short',
        CRON_SECRET: 'test-cron-secret',
      }
      
      const result = envSchema.safeParse(invalidEnv)
      expect(result.success).toBe(false)
      if (!result.success) {
        const passwordError = result.error.errors.find(e => e.path[0] === 'ADMIN_PASSWORD')
        expect(passwordError).toBeDefined()
        expect(passwordError?.message).toContain('at least 8 characters')
      }
    })

    it('should validate optional social media API keys', () => {
      const envWithAPIs = {
        NODE_ENV: 'test',
        JWT_SECRET: 'a'.repeat(64),
        ADMIN_USERNAME: 'admin',
        ADMIN_PASSWORD: 'TestPass123!',
        CRON_SECRET: 'test-cron-secret',
        YOUTUBE_API_KEY: 'test-youtube-key',
        REDDIT_CLIENT_ID: 'test-reddit-id',
        REDDIT_CLIENT_SECRET: 'test-reddit-secret',
      }
      
      const result = envSchema.safeParse(envWithAPIs)
      expect(result.success).toBe(true)
    })

    it('should transform boolean string values correctly', () => {
      const envWithBooleans = {
        NODE_ENV: 'test',
        JWT_SECRET: 'a'.repeat(64),
        ADMIN_USERNAME: 'admin',
        ADMIN_PASSWORD: 'TestPass123!',
        CRON_SECRET: 'test-cron-secret',
        ENABLE_AUTO_SCANNING: 'true',
        ENABLE_AUTO_POSTING: 'false',
        USE_POSTGRES_IN_DEV: 'true',
      }
      
      const result = envSchema.parse(envWithBooleans)
      expect(result.ENABLE_AUTO_SCANNING).toBe(true)
      expect(result.ENABLE_AUTO_POSTING).toBe(false)
      expect(result.USE_POSTGRES_IN_DEV).toBe(true)
    })
  })

  describe('Service Configuration Detection', () => {
    beforeEach(() => {
      // Set minimal required env vars
      process.env.NODE_ENV = 'test'
      process.env.JWT_SECRET = 'a'.repeat(64)
      process.env.ADMIN_USERNAME = 'admin'
      process.env.ADMIN_PASSWORD = 'TestPass123!'
      process.env.CRON_SECRET = 'test-cron-secret'
    })

    it('should detect Reddit service when credentials are present', () => {
      process.env.REDDIT_CLIENT_ID = 'test-client-id'
      process.env.REDDIT_CLIENT_SECRET = 'test-client-secret'
      
      expect(isServiceConfigured('reddit')).toBe(true)
    })

    it('should not detect Reddit service when credentials are missing', () => {
      process.env.REDDIT_CLIENT_ID = 'test-client-id'
      // Missing REDDIT_CLIENT_SECRET
      
      expect(isServiceConfigured('reddit')).toBe(false)
    })

    it('should detect YouTube service when API key is present', () => {
      process.env.YOUTUBE_API_KEY = 'test-youtube-key'
      
      expect(isServiceConfigured('youtube')).toBe(true)
    })

    it('should detect multiple services correctly', () => {
      process.env.YOUTUBE_API_KEY = 'test-youtube-key'
      process.env.GIPHY_API_KEY = 'test-giphy-key'
      process.env.PIXABAY_API_KEY = 'test-pixabay-key'
      
      expect(isServiceConfigured('youtube')).toBe(true)
      expect(isServiceConfigured('giphy')).toBe(true)
      expect(isServiceConfigured('pixabay')).toBe(true)
      expect(isServiceConfigured('reddit')).toBe(false)
    })
  })

  describe('Database Configuration', () => {
    beforeEach(() => {
      // Set minimal required env vars
      process.env.NODE_ENV = 'test'
      process.env.JWT_SECRET = 'a'.repeat(64)
      process.env.ADMIN_USERNAME = 'admin'
      process.env.ADMIN_PASSWORD = 'TestPass123!'
      process.env.CRON_SECRET = 'test-cron-secret'
    })

    it('should use SQLite in development by default', () => {
      process.env.NODE_ENV = 'development'
      
      const dbConfig = getDatabaseConfig()
      expect(dbConfig.type).toBe('sqlite')
      expect(dbConfig).toHaveProperty('path')
    })

    it('should use PostgreSQL when USE_POSTGRES_IN_DEV is true', () => {
      process.env.NODE_ENV = 'development'
      process.env.USE_POSTGRES_IN_DEV = 'true'
      process.env.DATABASE_HOST = 'localhost'
      process.env.DATABASE_PORT = '5432'
      process.env.DATABASE_NAME = 'test_db'
      process.env.DATABASE_USER = 'test_user'
      process.env.DATABASE_PASSWORD = 'test_pass'
      
      const dbConfig = getDatabaseConfig()
      expect(dbConfig.type).toBe('postgres')
      expect(dbConfig).toHaveProperty('host', 'localhost')
      expect(dbConfig).toHaveProperty('port', 5432)
    })

    it('should use Vercel Postgres in production when POSTGRES_URL is set', () => {
      process.env.NODE_ENV = 'production'
      process.env.POSTGRES_URL = 'postgres://user:pass@host:5432/db'
      process.env.POSTGRES_PRISMA_URL = 'postgres://user:pass@host:5432/db?pgbouncer=true'
      
      const dbConfig = getDatabaseConfig()
      expect(dbConfig.type).toBe('vercel-postgres')
      expect(dbConfig).toHaveProperty('url', process.env.POSTGRES_URL)
    })

    it('should use regular PostgreSQL in production when POSTGRES_URL is not set', () => {
      process.env.NODE_ENV = 'production'
      process.env.DATABASE_HOST = 'prod-host'
      process.env.DATABASE_PORT = '5432'
      process.env.DATABASE_NAME = 'prod_db'
      process.env.DATABASE_USER = 'prod_user'
      process.env.DATABASE_PASSWORD = 'prod_pass'
      
      const dbConfig = getDatabaseConfig()
      expect(dbConfig.type).toBe('postgres')
      expect(dbConfig).toHaveProperty('host', 'prod-host')
    })
  })

  describe('Error Handling', () => {
    it('should provide helpful error messages for missing required variables', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      const processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit')
      })
      
      process.env.NODE_ENV = 'test'
      // Missing JWT_SECRET and other required vars
      
      expect(() => env.validate(true)).toThrow()
      
      // Check that helpful error messages were logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Environment Variable Validation Failed')
      )
      
      consoleErrorSpy.mockRestore()
      processExitSpy.mockRestore()
    })

    it('should not exit process when strict mode is false', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      const processExitSpy = jest.spyOn(process, 'exit').mockImplementation()
      
      process.env.NODE_ENV = 'test'
      // Missing required vars
      
      expect(() => env.validate(false)).toThrow()
      expect(processExitSpy).not.toHaveBeenCalled()
      
      consoleErrorSpy.mockRestore()
      processExitSpy.mockRestore()
    })
  })

  describe('Environment Types', () => {
    it('should only allow valid NODE_ENV values', () => {
      const validEnvs = ['development', 'test', 'production']
      
      validEnvs.forEach(nodeEnv => {
        const testEnv = {
          NODE_ENV: nodeEnv,
          JWT_SECRET: 'a'.repeat(64),
          ADMIN_USERNAME: 'admin',
          ADMIN_PASSWORD: 'TestPass123!',
          CRON_SECRET: 'test-cron-secret',
        }
        
        const result = envSchema.safeParse(testEnv)
        expect(result.success).toBe(true)
      })
      
      const invalidEnv = {
        NODE_ENV: 'staging', // Not allowed
        JWT_SECRET: 'a'.repeat(64),
        ADMIN_USERNAME: 'admin',
        ADMIN_PASSWORD: 'TestPass123!',
        CRON_SECRET: 'test-cron-secret',
      }
      
      const result = envSchema.safeParse(invalidEnv)
      expect(result.success).toBe(false)
    })
  })
})