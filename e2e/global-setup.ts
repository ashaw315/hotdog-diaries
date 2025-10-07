/**
 * Playwright Global Setup
 * Performs one-time authentication and saves state for all E2E tests
 * Enhanced for CI with browser installation checks and environment detection
 */

import { chromium, FullConfig } from '@playwright/test'
import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

// CI-friendly logging function
function debugLog(message: string) {
  console.log(`[GLOBAL SETUP] ${message}`)
}

async function ensureBrowsersInstalled() {
  debugLog('🔍 Checking if Playwright browsers are installed...')
  
  try {
    // Check if chromium is available by trying to get its executable path
    const testBrowser = await chromium.launch({ headless: true })
    await testBrowser.close()
    debugLog('✅ Chromium browser is available')
    return true
  } catch (error) {
    debugLog('❌ Chromium browser not found, installing...')
    
    try {
      // Install Playwright browsers in CI environment
      debugLog('📦 Running: npx playwright install chromium --with-deps')
      execSync('npx playwright install chromium --with-deps', { 
        stdio: 'inherit',
        timeout: 120000 // 2 minute timeout
      })
      debugLog('✅ Playwright browsers installed successfully')
      return true
    } catch (installError) {
      debugLog(`❌ Failed to install browsers: ${installError.message}`)
      return false
    }
  }
}

async function globalSetup(config: FullConfig) {
  debugLog('🎭 Starting Playwright global setup...')
  
  // Set up CI-specific environment variables
  if (process.env.CI) {
    process.env.MOCK_ADMIN_DATA = 'true'
    process.env.NODE_ENV = 'test'
    debugLog('🧪 CI detected - enabling mock data mode')
  }
  
  // Ensure browsers are installed before proceeding
  const browsersReady = await ensureBrowsersInstalled()
  if (!browsersReady) {
    debugLog('❌ Cannot proceed without browsers - exiting')
    process.exit(1)
  }
  
  const { baseURL, storageState } = config.projects[0].use
  const adminUsername = process.env.ADMIN_USERNAME || 'admin'
  const adminPassword = process.env.ADMIN_PASSWORD || 'StrongAdminPass123!'
  
  debugLog(`🌐 Base URL: ${baseURL}`)
  debugLog(`💾 Storage State: ${storageState}`)
  debugLog(`👤 Admin Username: ${adminUsername}`)
  debugLog(`🔐 Admin Password: ${adminPassword ? '[SET]' : '[NOT SET]'}`)
  
  // Launch browser for authentication
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'] // CI-friendly args
  })
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
    
    // Ensure storage state directory exists
    const storageDir = path.dirname(storageState as string)
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true })
      debugLog(`📁 Created storage directory: ${storageDir}`)
    }
    
    // Save authentication state
    debugLog('💾 Saving authentication state...')
    await page.context().storageState({ path: storageState as string })
    
    debugLog('🎉 Global setup completed successfully!')
    
  } catch (error) {
    debugLog(`❌ Global setup failed: ${error}`)
    
    // Take screenshot for debugging
    try {
      const reportDir = 'playwright-report'
      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true })
      }
      
      await page.screenshot({ 
        path: path.join(reportDir, 'global-setup-failure.png'),
        fullPage: true 
      })
      debugLog('📸 Screenshot saved for debugging')
    } catch (screenshotError) {
      debugLog(`⚠️ Could not take screenshot: ${screenshotError.message}`)
    }
    
    // Log page content for debugging
    try {
      const content = await page.content()
      debugLog('📄 Page content at failure:')
      console.log(content.substring(0, 1000))
    } catch (contentError) {
      debugLog(`⚠️ Could not get page content: ${contentError.message}`)
    }
    
    // Log current URL
    debugLog(`📍 Current URL: ${page.url()}`)
    
    // Check if we can find any login-related elements
    try {
      const loginElements = await page.locator('input, button, form').count()
      debugLog(`🔍 Found ${loginElements} interactive elements`)
    } catch (elementError) {
      debugLog(`⚠️ Could not count elements: ${elementError.message}`)
    }
    
    throw error
  } finally {
    await browser.close()
  }
}

export default globalSetup