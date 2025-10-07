import { defineConfig, devices } from '@playwright/test'

const PORT = 3000
const HOST = '127.0.0.1'
const BASE_URL = `http://${HOST}:${PORT}`

export default defineConfig({
  testDir: './e2e',
  // No global setup for this test
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 10000 },

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  reporter: 'list',

  webServer: {
    command: 'npm run start:test',
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: true,
    timeout: 60000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { 
      CI: 'true', 
      DISABLE_HEALTH_LOOPS: 'true',
      NODE_ENV: 'test',
      NEXT_PUBLIC_CI: 'true'
    },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})