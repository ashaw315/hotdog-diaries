import { defineConfig, devices } from '@playwright/test'

// Debug logging for CI
console.log('🎭 ================================')
console.log('🎭 PLAYWRIGHT CONFIGURATION DEBUG')
console.log('🎭 ================================')
console.log('💡 NODE_ENV:', process.env.NODE_ENV || 'NOT SET')
console.log('💡 CI:', process.env.CI || 'NOT SET')
console.log('💡 GITHUB_ACTIONS:', process.env.GITHUB_ACTIONS || 'NOT SET')
console.log('💡 DATABASE_URL:', process.env.DATABASE_URL ? 'SET (PostgreSQL)' : 'NOT SET')
console.log('💡 DATABASE_URL_SQLITE:', process.env.DATABASE_URL_SQLITE || 'NOT SET')
console.log('💡 JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'NOT SET')
console.log('💡 PLAYWRIGHT_BASE_URL:', process.env.PLAYWRIGHT_BASE_URL || 'NOT SET (will use default)')
console.log('💡 Using baseURL:', process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000')
console.log('💡 Worker count:', process.env.CI ? '1 (CI mode)' : 'undefined (auto)')
console.log('💡 Retry count:', process.env.CI ? '2 (CI mode)' : '0 (dev mode)')
console.log('🎭 ================================\n')

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  /* Global setup for authentication */
  globalSetup: './e2e/global-setup.ts',
  /* Test timeout for individual tests */
  timeout: 120_000,
  /* Extended timeout for expectations in CI */
  expect: { timeout: 15_000 },
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI ? 'list' : 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000',
    
    /* Use saved authentication state */
    storageState: './e2e/auth-state.json',
    
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    
    /* Take screenshot only when tests fail */
    screenshot: 'only-on-failure',
    
    /* Record video only when tests fail */
    video: 'retain-on-failure',
    
    /* Extend action timeout for CI environments */
    actionTimeout: 30_000,
    
    /* Extended navigation timeout */
    navigationTimeout: 60_000,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: undefined, // Don't use auth state for setup
      },
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      dependencies: ['setup'],
    },

    // Disable webkit and mobile for now to reduce CI complexity
    // Can be re-enabled once stability is confirmed
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    //   dependencies: ['setup'],
    // },
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    //   dependencies: ['setup'],
    // },
  ],

  /* Run production server for tests - Playwright manages this automatically */
  webServer: {
    command: 'npm run start:test',
    port: 3000,
    url: 'http://127.0.0.1:3000/api/health', // ✅ Use health endpoint for readiness check
    reuseExistingServer: true, // ✅ Reuse existing server if already running (prevents port conflicts)
    timeout: 120_000, // 2 minutes for server startup
    stdout: 'pipe',
    stderr: 'pipe',
  },
})