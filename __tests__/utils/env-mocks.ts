/**
 * Environment testing utilities
 * 
 * Provides utilities for testing environment variable validation
 * without polluting the actual environment or causing test interference.
 */

/**
 * Test wrapper that temporarily sets environment variables for a test
 * @param mockEnv - Object containing environment variables to set
 * @param fn - Test function to execute with the mocked environment
 */
export function withEnv(mockEnv: Record<string, string>, fn: () => void) {
  const original = { ...process.env }
  
  // Clear current environment (except NODE_* variables to keep Jest working)
  Object.keys(process.env).forEach(key => {
    if (!key.startsWith('NODE_') && !key.startsWith('JEST_') && !key.startsWith('CI') && key !== 'PWD') {
      delete process.env[key]
    }
  })
  
  // Set mock environment variables
  Object.assign(process.env, mockEnv)
  
  try {
    fn()
  } finally {
    // Restore original environment
    process.env = { ...original }
  }
}

/**
 * Create a minimal valid environment for testing
 */
export function createValidTestEnv(overrides: Record<string, string> = {}) {
  return {
    NODE_ENV: 'test',
    JWT_SECRET: 'a'.repeat(64), // 64 character minimum
    ADMIN_USERNAME: 'admin',
    ADMIN_PASSWORD: 'TestPass123!',
    CRON_SECRET: 'test-cron-secret-min-16-chars',
    ...overrides
  }
}

/**
 * Create environment missing required variables
 */
export function createInvalidTestEnv(missingVars: string[] = ['JWT_SECRET']) {
  const validEnv = createValidTestEnv()
  
  missingVars.forEach(varName => {
    delete validEnv[varName as keyof typeof validEnv]
  })
  
  return validEnv
}

/**
 * Create environment with social media API keys
 */
export function createSocialMediaTestEnv() {
  return createValidTestEnv({
    REDDIT_CLIENT_ID: 'test-reddit-client-id',
    REDDIT_CLIENT_SECRET: 'test-reddit-client-secret',
    YOUTUBE_API_KEY: 'test-youtube-api-key',
    GIPHY_API_KEY: 'test-giphy-api-key',
    PIXABAY_API_KEY: 'test-pixabay-api-key',
    IMGUR_CLIENT_ID: 'test-imgur-client-id',
    TUMBLR_API_KEY: 'test-tumblr-api-key',
    TUMBLR_API_SECRET: 'test-tumblr-api-secret',
    BLUESKY_IDENTIFIER: 'test.handle.bsky.social',
    BLUESKY_APP_PASSWORD: 'test-bluesky-app-password',
  })
}

/**
 * Create environment for PostgreSQL testing
 */
export function createPostgreSQLTestEnv() {
  return createValidTestEnv({
    USE_POSTGRES_IN_DEV: 'true',
    DATABASE_HOST: 'localhost',
    DATABASE_PORT: '5432',
    DATABASE_NAME: 'test_db',
    DATABASE_USER: 'test_user',
    DATABASE_PASSWORD: 'test_password',
  })
}

/**
 * Create environment for Vercel Postgres testing
 */
export function createVercelPostgresTestEnv() {
  return createValidTestEnv({
    NODE_ENV: 'production',
    POSTGRES_URL: 'postgres://user:pass@host:5432/db',
    POSTGRES_PRISMA_URL: 'postgres://user:pass@host:5432/db?pgbouncer=true',
    POSTGRES_URL_NO_SSL: 'postgres://user:pass@host:5432/db',
    POSTGRES_URL_NON_POOLING: 'postgres://user:pass@host:5432/db?pgbouncer=false',
  })
}

/**
 * Reset environment singleton instance for testing
 * This is needed because the Environment class is a singleton
 */
export function resetEnvironmentInstance() {
  const { Environment } = require('@/lib/env')
  Environment.resetInstance()
}