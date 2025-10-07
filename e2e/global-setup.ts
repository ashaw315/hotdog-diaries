/**
 * Playwright Global Setup
 * Performs one-time authentication and saves state for all E2E tests
 */

import { chromium, FullConfig } from '@playwright/test'
import { debugLog } from '@/lib/env'

async function globalSetup(config: FullConfig) {
  debugLog('🎭 Starting Playwright global setup...')
  
  const { baseURL, storageState } = config.projects[0].use
  
  debugLog(`🌐 Base URL: ${baseURL}`)
  debugLog(`💾 Storage State: ${storageState}`)
  
  // Launch browser for authentication
  const browser = await chromium.launch()
  const page = await browser.newPage()
  
  try {
    // Navigate to login page
    debugLog('🔐 Navigating to admin login page...')
    await page.goto(`${baseURL}/admin/login`)
    
    // Wait for login form to be ready
    debugLog('⏳ Waiting for login form...')
    await page.waitForSelector('[data-testid="admin-login-form"]', { timeout: 30000 })
    
    // Fill in credentials
    debugLog('📝 Filling in login credentials...')
    await page.fill('[data-testid="admin-login-username-input"]', 'admin')
    await page.fill('[data-testid="admin-login-password-input"]', 'StrongAdminPass123!')
    
    // Submit login form
    debugLog('🚀 Submitting login form...')
    await page.click('[data-testid="admin-login-submit-button"]')
    
    // Wait for successful login redirect
    debugLog('🔍 Waiting for successful login redirect...')
    await page.waitForURL(`${baseURL}/admin`, { timeout: 30000 })
    
    // Verify we're on the admin dashboard
    debugLog('✅ Verifying admin dashboard loaded...')
    await page.waitForSelector('[data-testid="admin-dashboard"]', { timeout: 15000 })
    
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
    
    throw error
  } finally {
    await browser.close()
  }
}

export default globalSetup