import { test as base, expect, Page } from '@playwright/test'

// Test credentials for admin user
const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'StrongAdminPass123!',
  email: 'admin@hotdogdiaries.com'
}

// Helper function to perform admin login
export async function loginAsAdmin(page: Page) {
  console.log('🔐 Performing admin login...')
  
  // Navigate to login page
  await page.goto('/admin/login')
  
  // Wait for the form to be visible
  await expect(page.locator('h1:has-text("Admin Login")')).toBeVisible()
  
  // Fill in credentials using the correct selectors
  await page.fill('input[name="username"]', ADMIN_CREDENTIALS.username)
  await page.fill('input[name="password"]', ADMIN_CREDENTIALS.password)
  
  // Click submit button
  await page.click('button[type="submit"]')
  
  // Wait for successful redirect to admin dashboard with more robust error handling
  try {
    await page.waitForURL('/admin', { timeout: 20000 })
  } catch (timeoutError) {
    // If URL didn't change, check if we're on a redirect loop or error state
    const currentUrl = page.url()
    console.log('❌ Redirect timeout. Current URL:', currentUrl)
    
    // Check page content for debugging
    const pageContent = await page.textContent('body')
    console.log('Page content (first 200 chars):', pageContent?.substring(0, 200))
    
    // If we're still on login page, wait a bit more and check again
    if (currentUrl.includes('/admin/login')) {
      console.log('Still on login page, waiting additional time...')
      await page.waitForTimeout(5000)
      
      const finalUrl = page.url()
      if (finalUrl.includes('/admin') && !finalUrl.includes('/admin/login')) {
        console.log('✅ Eventually redirected to:', finalUrl)
      } else {
        throw new Error(`Failed to redirect. Final URL: ${finalUrl}`)
      }
    }
  }
  
  // Verify we're logged in by checking for admin elements (more flexible)
  // Wait for either loading state to complete or admin content to appear
  await Promise.race([
    expect(page.locator('text=/dashboard|queue|content|analytics/i')).toBeVisible({ timeout: 15000 }),
    expect(page.locator('[data-testid="admin-dashboard"], .admin-header, .admin-nav')).toBeVisible({ timeout: 15000 }),
    expect(page.locator('body')).toContainText(/Dashboard|Content Queue|Posted Content/i, { timeout: 15000 })
  ])
  
  console.log('✅ Admin login successful')
}

// Helper function to logout
export async function logout(page: Page) {
  // Check if logout button exists and click it
  const logoutBtn = page.locator('button:has-text("logout"), a:has-text("logout")')
  if (await logoutBtn.isVisible()) {
    await logoutBtn.click()
    await page.waitForURL('/admin/login')
  }
}

// Extended test with authenticated session
export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ browser }, use) => {
    // Create a new context for each test
    const context = await browser.newContext()
    const page = await context.newPage()
    
    // Login before each test
    await loginAsAdmin(page)
    
    // Use the authenticated page
    await use(page)
    
    // Cleanup
    await context.close()
  },
})

// Unauthenticated test for login flow testing
export const unauthenticatedTest = base

// Helper to wait for content to load
export async function waitForContentLoad(page: Page, selector?: string) {
  const defaultSelector = '[data-testid="content-loaded"], .content-table, .dashboard-stats'
  await page.waitForSelector(selector || defaultSelector, { timeout: 10000 })
}

// Helper to wait for network idle (useful for API calls)
export async function waitForNetworkIdle(page: Page) {
  await page.waitForLoadState('networkidle')
}

// Helper to check if we're authenticated
export async function isAuthenticated(page: Page): Promise<boolean> {
  try {
    // Check for presence of admin navigation or dashboard elements
    const adminElements = page.locator('text=/dashboard|queue|content|logout/i')
    await adminElements.first().waitFor({ timeout: 2000 })
    return true
  } catch {
    return false
  }
}

export { expect } from '@playwright/test'