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
  await expect(page.getByRole('heading', { name: /admin login/i })).toBeVisible()
  
  // Fill in credentials using role-based selectors
  await page.getByRole('textbox', { name: /username/i }).fill(ADMIN_CREDENTIALS.username)
  await page.getByLabel(/password/i).fill(ADMIN_CREDENTIALS.password)
  
  // Click submit and wait for navigation away from login page
  await Promise.all([
    // Wait for navigation to any admin page that's not login
    page.waitForFunction(() => {
      const url = window.location.href
      return url.includes('/admin') && !url.includes('/admin/login')
    }, { timeout: 30000 }),
    // Click the submit button using role selector
    page.getByRole('button', { name: /sign in|login|submit/i }).click()
  ])
  
  // Verify we successfully navigated away from login page
  const currentUrl = page.url()
  console.log('✅ Successfully redirected to:', currentUrl)
  
  // Double-check we're not still on login page
  if (currentUrl.includes('/admin/login')) {
    // Wait a bit more for slower redirects
    await page.waitForTimeout(2000)
    const retryUrl = page.url()
    if (retryUrl.includes('/admin/login')) {
      throw new Error(`Still on login page after redirect. URL: ${retryUrl}`)
    }
  }
  
  // Verify we're logged in by checking for specific admin header (more reliable)
  await expect(page.locator('.admin-header')).toBeVisible({ timeout: 15000 })
  
  // Also verify we can see admin navigation
  await expect(page.getByRole('link', { name: /dashboard|admin/i })).toBeVisible({ timeout: 5000 })
  
  // Wait for dashboard content to load (not just loading state)
  await page.waitForFunction(() => {
    const loadingElements = document.querySelectorAll('.loading, [class*="loading"]')
    return loadingElements.length === 0 || Array.from(loadingElements).every(el => 
      el.textContent && !el.textContent.includes('Loading dashboard data')
    )
  }, { timeout: 10000 }).catch(() => {
    // If dashboard is still loading after 10 seconds, that's okay for login verification
    console.log('Dashboard still loading, but admin header and nav are visible - login successful')
  })
  
  console.log('✅ Admin login successful')
}

// Helper function to logout
export async function logout(page: Page) {
  // Check if logout button exists and click it using role-based selector
  const logoutBtn = page.getByRole('button', { name: /logout|sign out/i }).or(page.getByRole('link', { name: /logout|sign out/i }))
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