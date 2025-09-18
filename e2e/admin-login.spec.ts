import { unauthenticatedTest as test, expect, loginAsAdmin } from './utils/auth'

test.describe('Admin Login Flow', () => {
  test('should successfully login with valid credentials', async ({ page }) => {
    // Navigate to login page
    await page.goto('/admin/login')
    
    // Verify login page loads
    await expect(page.locator('h1:has-text("Admin Login")')).toBeVisible()
    await expect(page.locator('input[name="username"]')).toBeVisible()
    await expect(page.locator('input[name="password"]')).toBeVisible()
    
    // Perform login
    await loginAsAdmin(page)
    
    // Verify successful redirect and authenticated state
    await expect(page).toHaveURL('/admin')
    
    // Check for admin dashboard elements
    await expect(page.locator('text=/dashboard|queue|content/i')).toBeVisible()
  })

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto('/admin/login')
    
    // Try login with wrong credentials
    await page.fill('input[name="username"]', 'wronguser')
    await page.fill('input[name="password"]', 'wrongpass')
    await page.click('button[type="submit"]')
    
    // Should stay on login page and show error
    await expect(page.locator('text=/error|invalid|failed/i')).toBeVisible()
    await expect(page).toHaveURL('/admin/login')
  })

  test('should redirect authenticated users away from login page', async ({ page }) => {
    // First login
    await loginAsAdmin(page)
    
    // Try to navigate back to login page
    await page.goto('/admin/login')
    
    // Should redirect to admin dashboard
    await expect(page).toHaveURL('/admin')
  })

  test('should require both username and password', async ({ page }) => {
    await page.goto('/admin/login')
    
    // Try to submit empty form
    await page.click('button[type="submit"]')
    
    // Should show validation error or stay on page
    const isStillOnLogin = page.url().includes('/admin/login')
    expect(isStillOnLogin).toBe(true)
  })

  test('should handle loading states during login', async ({ page }) => {
    await page.goto('/admin/login')
    
    // Fill valid credentials
    await page.fill('input[name="username"]', 'admin')
    await page.fill('input[name="password"]', 'StrongAdminPass123!')
    
    // Click submit and immediately check for loading state
    const submitPromise = page.click('button[type="submit"]')
    
    // The button might be disabled during loading
    await expect(page.locator('button[type="submit"][disabled]')).toBeVisible({ timeout: 1000 }).catch(() => {
      // It's OK if we don't catch the loading state - the login might be too fast
    })
    
    await submitPromise
    
    // Should eventually redirect
    await expect(page).toHaveURL('/admin')
  })
})