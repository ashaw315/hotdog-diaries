import { test, expect } from './utils/auth'

test.describe('Admin Logout Flow', () => {
  test('should successfully logout and clear session', async ({ authenticatedPage }) => {
    // We're already logged in via authenticatedPage fixture
    const page = authenticatedPage
    
    // Verify we're on admin page
    await expect(page).toHaveURL(/\/admin/)
    await expect(page.locator('.admin-header')).toBeVisible()
    
    // Find and click the logout button
    const logoutButton = page.locator('button:has-text("Sign Out"), button:has-text("Logout"), a:has-text("Sign Out"), a:has-text("Logout")')
    await expect(logoutButton).toBeVisible()
    await logoutButton.click()
    
    // Wait for redirect to login page
    await page.waitForURL('/admin/login', { timeout: 10000 })
    await expect(page).toHaveURL('/admin/login')
    
    // Verify we're logged out by checking for login form
    await expect(page.locator('input[name="username"]')).toBeVisible()
    await expect(page.locator('input[name="password"]')).toBeVisible()
    
    // Try to access admin page directly - should redirect to login
    await page.goto('/admin')
    await page.waitForURL('**/admin/login**', { timeout: 10000 })
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
    
    // Get cookies before logout
    const cookiesBefore = await page.context().cookies()
    const authCookieBefore = cookiesBefore.find(c => c.name === 'auth-token')
    const refreshCookieBefore = cookiesBefore.find(c => c.name === 'refresh-token')
    
    // Verify cookies exist before logout
    expect(authCookieBefore).toBeDefined()
    expect(refreshCookieBefore).toBeDefined()
    expect(authCookieBefore?.value).toBeTruthy()
    expect(refreshCookieBefore?.value).toBeTruthy()
    
    // Perform logout
    const logoutButton = page.locator('button:has-text("Sign Out"), button:has-text("Logout")')
    await logoutButton.click()
    
    // Wait for redirect
    await page.waitForURL('/admin/login', { timeout: 10000 })
    
    // Get cookies after logout
    const cookiesAfter = await page.context().cookies()
    const authCookieAfter = cookiesAfter.find(c => c.name === 'auth-token')
    const refreshCookieAfter = cookiesAfter.find(c => c.name === 'refresh-token')
    
    // Verify cookies are cleared (either removed or have empty values)
    if (authCookieAfter) {
      expect(authCookieAfter.value).toBe('')
    }
    if (refreshCookieAfter) {
      expect(refreshCookieAfter.value).toBe('')
    }
  })
  
  test('should handle multiple logout attempts gracefully', async ({ authenticatedPage }) => {
    const page = authenticatedPage
    
    // First logout
    const logoutButton = page.locator('button:has-text("Sign Out"), button:has-text("Logout")')
    await logoutButton.click()
    await page.waitForURL('/admin/login', { timeout: 10000 })
    
    // Try to call logout API directly again
    const logoutResponse = await page.request.delete('/api/admin/auth')
    expect(logoutResponse.ok()).toBe(true)
    
    // Should still be on login page
    await expect(page).toHaveURL('/admin/login')
  })
  
  test('should prevent access to protected routes after logout', async ({ authenticatedPage }) => {
    const page = authenticatedPage
    
    // Logout
    const logoutButton = page.locator('button:has-text("Sign Out"), button:has-text("Logout")')
    await logoutButton.click()
    await page.waitForURL('/admin/login', { timeout: 10000 })
    
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
      await page.waitForURL('**/admin/login**', { timeout: 5000 })
      await expect(page).toHaveURL(/\/admin\/login/)
    }
  })
})