/**
 * Playwright Global Setup
 * Performs one-time authentication and saves state for all E2E tests
 * Enhanced for CI with environment detection and mock configuration
 */

import { chromium, FullConfig } from '@playwright/test'

// CI-friendly logging function
function debugLog(message: string) {
  console.log(`[GLOBAL SETUP] ${message}`)
}

async function globalSetup(config: FullConfig) {
  debugLog('🎭 Starting Playwright global setup...')
  
  // Set up CI-specific environment variables
  if (process.env.CI) {
    process.env.MOCK_ADMIN_DATA = 'true'
    process.env.NODE_ENV = 'test'
    debugLog('🧪 CI detected - enabling mock data mode')
  }
  
  const { baseURL, storageState } = config.projects[0].use
  const adminUsername = process.env.ADMIN_USERNAME || 'admin'
  const adminPassword = process.env.ADMIN_PASSWORD || 'StrongAdminPass123!'
  
  debugLog(`🌐 Base URL: ${baseURL}`)
  debugLog(`💾 Storage State: ${storageState}`)
  debugLog(`👤 Admin Username: ${adminUsername}`)
  debugLog(`🔐 Admin Password: ${adminPassword ? '[SET]' : '[NOT SET]'}`)
  
  // Launch browser for authentication
  const browser = await chromium.launch()
  const page = await browser.newPage()
  
  try {
    // Navigate to login page
    debugLog('🔐 Navigating to admin login page...')
    await page.goto(`${baseURL}/admin/login`)
    
    // Wait for login form to be ready - use more flexible selectors
    debugLog('⏳ Waiting for login form...')
    const loginFormSelector = 'input[name="username"], [data-testid="admin-login-username-input"], form'
    await page.waitForSelector(loginFormSelector, { timeout: 30000 })
    
    // Fill in credentials using flexible selectors
    debugLog('📝 Filling in login credentials...')
    const usernameInput = page.locator('input[name="username"]').or(page.locator('[data-testid="admin-login-username-input"]'))
    const passwordInput = page.locator('input[name="password"]').or(page.locator('[data-testid="admin-login-password-input"]'))
    
    await usernameInput.fill(adminUsername)
    await passwordInput.fill(adminPassword)
    
    // Submit login form
    debugLog('🚀 Submitting login form...')
    const submitButton = page.locator('button[type="submit"]').or(page.locator('[data-testid="admin-login-submit-button"]'))
    await submitButton.click()
    
    // Wait for successful login redirect with more flexible URL matching
    debugLog('🔍 Waiting for successful login redirect...')
    await page.waitForURL(/\/admin(?!\/(login|auth))/, { timeout: 30000 })
    
    // Verify we're on an admin page (not necessarily dashboard)
    debugLog('✅ Verifying admin area access...')
    const adminIndicators = page.locator('text=/admin|dashboard|logout|sign out/i').or(
      page.locator('[data-testid*="admin"]')
    )
    await adminIndicators.first().waitFor({ timeout: 15000 })
    
    // Save authentication state
    debugLog('💾 Saving authentication state...')
    await page.context().storageState({ path: storageState as string })
    
    debugLog('🎉 Global setup completed successfully!')
    
  } catch (error) {
    debugLog(`❌ Global setup failed: ${error}`)
    
    // Take screenshot for debugging
    await page.screenshot({ 
      path: 'playwright-report/global-setup-failure.png',
      fullPage: true 
    })
    
    // Log page content for debugging
    const content = await page.content()
    console.error('📄 Page content at failure:', content.substring(0, 1000))
    
    // Log current URL
    debugLog(`📍 Current URL: ${page.url()}`)
    
    // Check if we can find any login-related elements
    const loginElements = await page.locator('input, button, form').count()
    debugLog(`🔍 Found ${loginElements} interactive elements`)
    
    throw error
  } finally {
    await browser.close()
  }
}

export default globalSetup