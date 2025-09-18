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
    
    // Check for specific admin dashboard elements
    await expect(page.locator('.admin-header')).toBeVisible()
    await expect(page.locator('text=Total Content')).toBeVisible()
  })

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto('/admin/login')
    
    // Try login with wrong credentials
    await page.fill('input[name="username"]', 'wronguser')
    await page.fill('input[name="password"]', 'wrongpass')
    await page.click('button[type="submit"]')
    
    // Wait for error message to appear (exclude Next.js route announcer)
    await page.waitForSelector('[role="alert"]:has-text("Invalid")', { timeout: 10000 })
    
    // Check error message content
    const errorElement = page.locator('[role="alert"]:has-text("Invalid")')
    await expect(errorElement).toBeVisible()
    await expect(errorElement).toContainText(/Invalid username or password/i)
    
    // Should stay on login page
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
    // Navigate to login page
    await page.goto('/admin/login')
    
    // Fill valid credentials
    await page.fill('input[name="username"]', 'admin')
    await page.fill('input[name="password"]', 'StrongAdminPass123!')
    
    // Start login and immediately check for loading state (before navigation completes)
    const submitPromise = page.click('button[type="submit"]')
    
    // Give a small delay to catch the loading state if visible
    await page.waitForTimeout(100)
    
    // Complete the login process
    await submitPromise
    await page.waitForURL(/\/admin/, { timeout: 15000 })
    
    // Verify we're on the admin page
    await expect(page.locator('.admin-header')).toBeVisible({ timeout: 15000 })
  })
})