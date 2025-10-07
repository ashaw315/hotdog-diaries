/**
 * Environment Configuration and Validation
 * 
 * This module provides type-safe environment variable access with runtime validation.
 * It ensures all required environment variables are present and properly formatted
 * before the application starts.
 */

import { z } from 'zod'
import { config } from 'dotenv'
import path from 'path'

// Load environment variables from .env files
let envLoaded = false

export function loadEnv() {
  if (envLoaded) return
  
  // Skip loading .env files during testing
  if (process.env.NODE_ENV === 'test' && process.env.JEST_WORKER_ID) {
    envLoaded = true
    return
  }
  
  // Load .env.local first (highest priority)
  config({ path: path.resolve(process.cwd(), '.env.local') })
  
  // Load .env as fallback
  config({ path: path.resolve(process.cwd(), '.env') })
  
  envLoaded = true
}

// Auto-load when imported (but not during tests)
if (process.env.NODE_ENV !== 'test' || !process.env.JEST_WORKER_ID) {
  loadEnv()
}

// ========================================
// Environment Schema Definition
// ========================================

/**
 * Core application schema
 */
const coreSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(32, 'NEXTAUTH_SECRET must be at least 32 characters').optional(),
})

/**
 * Database configuration schema
 */
const databaseSchema = z.object({
  // PostgreSQL settings
  DATABASE_HOST: z.string().default('localhost'),
  DATABASE_PORT: z.string().regex(/^\d+$/).default('5432'),
  DATABASE_NAME: z.string().default('hotdog_diaries_dev'),
  DATABASE_USER: z.string().optional(),
  DATABASE_PASSWORD: z.string().optional(),
  
  // SQLite settings
  DATABASE_URL_SQLITE: z.string().optional(),
  USE_POSTGRES_IN_DEV: z.string().default('false').transform(val => val === 'true'),
  
  // Vercel Postgres (production)
  POSTGRES_URL: z.string().optional(),
  POSTGRES_PRISMA_URL: z.string().optional(),
  POSTGRES_URL_NO_SSL: z.string().optional(),
  POSTGRES_URL_NON_POOLING: z.string().optional(),
  POSTGRES_USER: z.string().optional(),
  POSTGRES_HOST: z.string().optional(),
  POSTGRES_PASSWORD: z.string().optional(),
  POSTGRES_DATABASE: z.string().optional(),
  
  // Supabase (optional)
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
})

/**
 * Authentication and security schema
 */
const authSchema = z.object({
  JWT_SECRET: z.string().min(64, 'JWT_SECRET must be at least 64 characters (use: openssl rand -hex 64)'),
  JWT_REFRESH_SECRET: z.string().min(64, 'JWT_REFRESH_SECRET must be at least 64 characters').optional(),
  
  // Admin credentials
  ADMIN_USERNAME: z.string().default('admin'),
  ADMIN_PASSWORD: z.string().min(8, 'ADMIN_PASSWORD must be at least 8 characters'),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_FULL_NAME: z.string().optional(),
  
  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
})

/**
 * Social media API keys schema
 */
const socialMediaSchema = z.object({
  // Reddit API
  REDDIT_CLIENT_ID: z.string().optional(),
  REDDIT_CLIENT_SECRET: z.string().optional(),
  REDDIT_USERNAME: z.string().optional(),
  REDDIT_PASSWORD: z.string().optional(),
  REDDIT_USER_AGENT: z.string().default('HotdogDiaries/1.0'),
  
  // YouTube API
  YOUTUBE_API_KEY: z.string().optional(),
  
  // Giphy API
  GIPHY_API_KEY: z.string().optional(),
  
  // Pixabay API
  PIXABAY_API_KEY: z.string().optional(),
  
  // Imgur API
  IMGUR_CLIENT_ID: z.string().optional(),
  
  // Tumblr API
  TUMBLR_API_KEY: z.string().optional(),
  TUMBLR_API_SECRET: z.string().optional(),
  
  // Bluesky AT Protocol
  BLUESKY_IDENTIFIER: z.string().optional(),
  BLUESKY_APP_PASSWORD: z.string().optional(),
})

/**
 * Automation and cron settings schema
 */
const automationSchema = z.object({
  CRON_SECRET: z.string().min(16, 'CRON_SECRET must be at least 16 characters'),
  AUTH_TOKEN: z.string().optional(),
  
  ENABLE_AUTO_SCANNING: z.string().default('false').transform(val => val === 'true'),
  ENABLE_AUTO_POSTING: z.string().default('false').transform(val => val === 'true'),
  POSTING_TIMES: z.string().default('07:00,10:00,13:00,16:00,19:00,22:00'),
})

/**
 * Complete environment schema
 */
const envSchema = z.object({
  ...coreSchema.shape,
  ...databaseSchema.shape,
  ...authSchema.shape,
  ...socialMediaSchema.shape,
  ...automationSchema.shape,
})

// ========================================
// Environment Validation and Export
// ========================================

/**
 * Validates environment variables and provides type-safe access
 */
class Environment {
  private static instance: Environment
  private validated: z.infer<typeof envSchema> | null = null
  private errors: z.ZodError | null = null

  private constructor() {}

  static getInstance(): Environment {
    if (!Environment.instance) {
      Environment.instance = new Environment()
    }
    return Environment.instance
  }

  /**
   * Validates environment variables
   * @param strict - If true, throws error on validation failure. If false, logs warnings.
   */
  validate(strict = true): z.infer<typeof envSchema> {
    if (this.validated) {
      return this.validated
    }

    try {
      this.validated = envSchema.parse(process.env)
      
      // Log successful validation in development (but not in tests)
      if (process.env.NODE_ENV === 'development' && !process.env.JEST_WORKER_ID) {
        console.log('✅ Environment variables validated successfully')
        this.logLoadedServices()
      }
      
      return this.validated
    } catch (error) {
      if (error instanceof z.ZodError) {
        this.errors = error
        this.handleValidationError(error, strict)
        throw error
      }
      throw error
    }
  }

  /**
   * Get validated environment variables
   */
  get env(): z.infer<typeof envSchema> {
    if (!this.validated) {
      return this.validate()
    }
    return this.validated
  }

  /**
   * Reset validation state (for testing)
   */
  reset(): void {
    this.validated = null
    this.errors = null
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    if (Environment.instance) {
      Environment.instance.reset()
    }
  }

  /**
   * Check if a specific service is configured
   */
  isServiceConfigured(service: 'reddit' | 'youtube' | 'giphy' | 'pixabay' | 'imgur' | 'tumblr' | 'bluesky'): boolean {
    const env = this.env
    
    switch (service) {
      case 'reddit':
        return !!(env.REDDIT_CLIENT_ID && env.REDDIT_CLIENT_SECRET)
      case 'youtube':
        return !!env.YOUTUBE_API_KEY
      case 'giphy':
        return !!env.GIPHY_API_KEY
      case 'pixabay':
        return !!env.PIXABAY_API_KEY
      case 'imgur':
        return !!env.IMGUR_CLIENT_ID
      case 'tumblr':
        return !!(env.TUMBLR_API_KEY && env.TUMBLR_API_SECRET)
      case 'bluesky':
        return !!(env.BLUESKY_IDENTIFIER && env.BLUESKY_APP_PASSWORD)
      default:
        return false
    }
  }

  /**
   * Get database configuration based on environment
   */
  getDatabaseConfig() {
    const env = this.env
    const isProduction = env.NODE_ENV === 'production'
    const usePostgres = isProduction || env.USE_POSTGRES_IN_DEV
    
    if (usePostgres) {
      // Use Vercel Postgres in production
      if (isProduction && env.POSTGRES_URL) {
        return {
          type: 'vercel-postgres' as const,
          url: env.POSTGRES_URL,
          prismaUrl: env.POSTGRES_PRISMA_URL,
        }
      }
      
      // Use regular PostgreSQL
      return {
        type: 'postgres' as const,
        host: env.DATABASE_HOST,
        port: parseInt(env.DATABASE_PORT),
        database: env.DATABASE_NAME,
        user: env.DATABASE_USER,
        password: env.DATABASE_PASSWORD,
      }
    }
    
    // Use SQLite in development
    return {
      type: 'sqlite' as const,
      path: env.DATABASE_URL_SQLITE || './hotdog_diaries_dev.db',
    }
  }

  /**
   * Handle validation errors
   */
  private handleValidationError(error: z.ZodError, strict: boolean) {
    // Only log errors if not in test environment
    if (process.env.NODE_ENV !== 'test' || !process.env.JEST_WORKER_ID) {
      console.error('\n❌ Environment Variable Validation Failed!\n')
      console.error('Missing or invalid environment variables:')
    }
    
    const grouped = (error.errors || []).reduce((acc, err) => {
      const category = this.categorizeError(err.path[0] as string)
      if (!acc[category]) acc[category] = []
      acc[category].push(err)
      return acc
    }, {} as Record<string, z.ZodIssue[]>)
    
    // Only log detailed errors if not in test environment
    if (process.env.NODE_ENV !== 'test' || !process.env.JEST_WORKER_ID) {
      Object.entries(grouped).forEach(([category, errors]) => {
        console.error(`\n[${category}]`)
        errors.forEach(err => {
          const path = err.path.join('.')
          console.error(`  • ${path}: ${err.message}`)
        })
      })
      
      console.error('\n📝 To fix this:')
      console.error('  1. Copy .env.example to .env.local')
      console.error('  2. Fill in the required values')
      console.error('  3. Restart the application\n')
    }
    
    if (strict && process.env.NODE_ENV !== 'test') {
      process.exit(1)
    }
  }

  /**
   * Categorize error by variable name
   */
  private categorizeError(varName: string): string {
    if (varName.startsWith('DATABASE') || varName.startsWith('POSTGRES')) return 'Database'
    if (varName.startsWith('JWT') || varName.startsWith('ADMIN') || varName.includes('SECRET')) return 'Authentication'
    if (varName.includes('API_KEY') || varName.includes('CLIENT')) return 'Social Media APIs'
    if (varName.startsWith('CRON') || varName.startsWith('ENABLE_AUTO')) return 'Automation'
    return 'Core'
  }

  /**
   * Log loaded services for debugging
   */
  private logLoadedServices() {
    const services = ['reddit', 'youtube', 'giphy', 'pixabay', 'imgur', 'tumblr', 'bluesky'] as const
    const configured = services.filter(s => this.isServiceConfigured(s))
    
    if (configured.length > 0) {
      console.log('📦 Configured services:', configured.join(', '))
    }
    
    const dbConfig = this.getDatabaseConfig()
    console.log('🗄️  Database:', dbConfig.type)
  }
}

// ========================================
// Environment Detection Flags
// ========================================

// Environment detection
export const IS_CI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true'
export const IS_TEST = process.env.NODE_ENV === 'test'
export const IS_DEV = process.env.NODE_ENV === 'development'
export const IS_PROD = process.env.NODE_ENV === 'production'
export const IS_VERCEL = process.env.VERCEL === '1'

// Test/Mock mode detection - returns mocked data when true
export const USE_MOCK_DATA = IS_CI || IS_TEST

// Database configuration helpers
export const shouldUseSQLite = () => {
  return IS_DEV || (IS_TEST && !process.env.USE_POSTGRES_IN_DEV)
}

export const shouldUsePostgres = () => {
  return !shouldUseSQLite()
}

// API configuration
export const getBaseUrl = () => {
  if (IS_VERCEL) return `https://${process.env.VERCEL_URL}`
  if (process.env.BASE_URL) return process.env.BASE_URL
  if (process.env.PLAYWRIGHT_BASE_URL) return process.env.PLAYWRIGHT_BASE_URL
  return 'http://localhost:3000'
}

// Debug logging helper
export const debugLog = (message: string, ...args: any[]) => {
  if (IS_DEV || IS_TEST) {
    console.log(`[DEBUG] ${message}`, ...args)
  }
}

// Environment summary for debugging
export const getEnvironmentSummary = () => {
  return {
    IS_CI,
    IS_TEST,
    IS_DEV,
    IS_PROD,
    IS_VERCEL,
    USE_MOCK_DATA,
    shouldUseSQLite: shouldUseSQLite(),
    shouldUsePostgres: shouldUsePostgres(),
    baseUrl: getBaseUrl(),
    nodeEnv: process.env.NODE_ENV,
    platform: process.platform
  }
}

// ========================================
// Exports
// ========================================

// Export singleton instance
export const env = Environment.getInstance()

// Export validated environment variables (lazy evaluation - validates on first access)
export const ENV = new Proxy({} as z.infer<typeof envSchema>, {
  get(target, prop) {
    return env.env[prop as keyof z.infer<typeof envSchema>]
  }
})

// Export utility functions
export const isServiceConfigured = (service: Parameters<typeof env.isServiceConfigured>[0]) => 
  env.isServiceConfigured(service)

export const getDatabaseConfig = () => env.getDatabaseConfig()

// Export for testing
export { envSchema, Environment }