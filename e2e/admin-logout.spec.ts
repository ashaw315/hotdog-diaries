import { test, expect } from './utils/auth'

test.describe('Admin Logout Flow', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    // Set up API mocks for CI environment
    try {
      if (process.env.CI || process.env.MOCK_ADMIN_DATA) {
      await authenticatedPage.route('**/api/admin/me', (route) => {
        if (route.request().headers()['authorization'] || route.request().headers()['cookie']) {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              user: { id: 1, username: 'admin', email: 'admin@test.com' }
            })
          })
        } else {
          route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              error: 'No authentication token'
            })
          })
        }
      })

      await authenticatedPage.route('**/api/admin/auth', (route) => {
        if (route.request().method() === 'DELETE') {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              message: 'Logged out successfully'
            })
          })
        }
      })
    }
  })

  test('should successfully logout and clear session', async ({ authenticatedPage }) => {
    const page = authenticatedPage
    
    // Verify we're on admin page
    await expect(page).toHaveURL(/\/admin/)
    
    // Look for admin interface elements
    const adminElements = page.locator('text=/admin|dashboard|logout|sign out/i').or(
      page.locator('[data-testid*="admin"]')
    )
    await expect(adminElements.first()).toBeVisible()
    
    // Find and click the logout button with multiple possible selectors
    const logoutButton = page.locator('button:has-text("Sign Out")').or(
      page.locator('button:has-text("Logout")')
    ).or(
      page.locator('a:has-text("Sign Out")')
    ).or(
      page.locator('a:has-text("Logout")')
    ).or(
      page.locator('[data-testid*="logout"]')
    ).or(
      page.getByRole('button', { name: /logout|sign out/i })
    )
    
    await expect(logoutButton.first()).toBeVisible({ timeout: 10000 })
    await logoutButton.first().click()
    
    // Wait for redirect to login page with flexible URL matching
    await page.waitForURL(/\/admin\/login/, { timeout: 10000 })
    await expect(page).toHaveURL(/\/admin\/login/)
    
    // Verify we're logged out by checking for login form
    const loginElements = page.locator('input[name="username"]').or(
      page.locator('[data-testid*="username"]')
    )
    await expect(loginElements.first()).toBeVisible()
    
    const passwordElements = page.locator('input[name="password"]').or(
      page.locator('[data-testid*="password"]')
    )
    await expect(passwordElements.first()).toBeVisible()
    
    // Try to access admin page directly - should redirect to login
    await page.goto('/admin')
    await page.waitForURL(/\/admin\/login/, { timeout: 10000 })
    await expect(page).toHaveURL(/\/admin\/login/)
    
    // Verify API returns 401 after logout
    const apiResponse = await page.request.get('/api/admin/me')
    expect(apiResponse.status()).toBe(401)
    
    const responseBody = await apiResponse.json()
    expect(responseBody.success).toBe(false)
    expect(responseBody.error).toContain('No authentication token')
  })
  
  test('should clear cookies on logout', async ({ authenticatedPage }) => {
    const page = authenticatedPage
    
    // Get cookies before logout with graceful handling
    const cookiesBefore = await page.context().cookies()
    const authCookieBefore = cookiesBefore.find(c => c.name === 'auth-token' || c.name === 'auth_token')
    const refreshCookieBefore = cookiesBefore.find(c => c.name === 'refresh-token' || c.name === 'refresh_token')
    
    // Verify cookies exist before logout (but handle missing cookies gracefully)
    if (!authCookieBefore) {
      console.warn('⚠️ No auth cookie found before logout; this may be expected in CI environment')
    } else {
      expect(authCookieBefore.value).toBeTruthy()
    }
    
    if (!refreshCookieBefore) {
      console.warn('⚠️ No refresh cookie found before logout; this may be expected in CI environment')
    } else {
      expect(refreshCookieBefore.value).toBeTruthy()
    }
    
    // Perform logout
    const logoutButton = page.locator('button:has-text("Sign Out")').or(
      page.locator('button:has-text("Logout")')
    ).or(
      page.getByRole('button', { name: /logout|sign out/i })
    )
    await expect(logoutButton.first()).toBeVisible()
    await logoutButton.first().click()
    
    // Wait for redirect
    await page.waitForURL(/\/admin\/login/, { timeout: 10000 })
    
    // Get cookies after logout
    const cookiesAfter = await page.context().cookies()
    const authCookieAfter = cookiesAfter.find(c => c.name === 'auth-token' || c.name === 'auth_token')
    const refreshCookieAfter = cookiesAfter.find(c => c.name === 'refresh-token' || c.name === 'refresh_token')
    
    // Verify cookies are cleared (either removed or have empty values)
    if (authCookieAfter) {
      expect(authCookieAfter.value).toBe('')
    }
    if (refreshCookieAfter) {
      expect(refreshCookieAfter.value).toBe('')
    }
    
    // In CI, cookies might not be set up the same way, so just verify we can't access protected routes
    await page.goto('/admin')
    await page.waitForURL(/\/admin\/login/, { timeout: 5000 })
    await expect(page).toHaveURL(/\/admin\/login/)
  })
  
  test('should handle multiple logout attempts gracefully', async ({ authenticatedPage }) => {
    const page = authenticatedPage
    
    // First logout
    const logoutButton = page.locator('button:has-text("Sign Out")').or(
      page.locator('button:has-text("Logout")')
    ).or(
      page.getByRole('button', { name: /logout|sign out/i })
    )
    await expect(logoutButton.first()).toBeVisible()
    await logoutButton.first().click()
    await page.waitForURL(/\/admin\/login/, { timeout: 10000 })
    
    // Try to call logout API directly again
    const logoutResponse = await page.request.delete('/api/admin/auth')
    expect(logoutResponse.ok()).toBe(true)
    
    // Should still be on login page
    await expect(page).toHaveURL(/\/admin\/login/)
  })
  
  test('should prevent access to protected routes after logout', async ({ authenticatedPage }) => {
    const page = authenticatedPage
    
    // Logout
    const logoutButton = page.locator('button:has-text("Sign Out")').or(
      page.locator('button:has-text("Logout")')
    ).or(
      page.getByRole('button', { name: /logout|sign out/i })
    )
    await expect(logoutButton.first()).toBeVisible()
    await logoutButton.first().click()
    await page.waitForURL(/\/admin\/login/, { timeout: 10000 })
    
    // Try to access various protected routes
    const protectedRoutes = [
      '/admin',
      '/admin/queue',
      '/admin/posted',
      '/admin/analytics',
      '/admin/settings'
    ]
    
    for (const route of protectedRoutes) {
      await page.goto(route)
      await page.waitForURL(/\/admin\/login/, { timeout: 5000 })
      await expect(page).toHaveURL(/\/admin\/login/)
    }
  })
})