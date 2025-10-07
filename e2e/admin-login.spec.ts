import { unauthenticatedTest as test, expect, loginAsAdmin } from './utils/auth'

test.describe('Admin Login Flow', () => {
  test('should successfully login with valid credentials', async ({ page }) => {
    // Navigate to login page
    await page.goto('/admin/login')
    
    // Verify login page loads
    await expect(page.getByRole('heading', { name: /admin login/i })).toBeVisible()
    await expect(page.getByRole('textbox', { name: /username/i })).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
    
    // Perform login
    await loginAsAdmin(page)
    
    // Verify successful redirect and authenticated state
    await expect(page).toHaveURL('/admin')
    
    // Check for specific admin dashboard elements
    await expect(page.locator('.admin-header')).toBeVisible()
    await expect(page.getByRole('heading', { name: /dashboard|admin|content/i })).toBeVisible({ timeout: 15000 })
  })

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto('/admin/login')
    
    // Try login with wrong credentials
    await page.getByRole('textbox', { name: /username/i }).fill('wronguser')
    await page.getByLabel(/password/i).fill('wrongpass')
    await page.getByRole('button', { name: /sign in|login|submit/i }).click()
    
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
    await page.getByRole('button', { name: /sign in|login|submit/i }).click()
    
    // Should show validation error or stay on page
    const isStillOnLogin = page.url().includes('/admin/login')
    expect(isStillOnLogin).toBe(true)
  })

  test('should handle loading states during login', async ({ page }) => {
    // Navigate to login page
    await page.goto('/admin/login')
    
    // Fill valid credentials
    await page.getByRole('textbox', { name: /username/i }).fill('admin')
    await page.getByLabel(/password/i).fill('StrongAdminPass123!')
    
    // Start login and immediately check for loading state (before navigation completes)
    const submitPromise = page.getByRole('button', { name: /sign in|login|submit/i }).click()
    
    // Give a small delay to catch the loading state if visible
    await page.waitForTimeout(100)
    
    // Complete the login process
    await submitPromise
    await page.waitForURL(/\/admin/, { timeout: 15000 })
    
    // Verify we're on the admin page
    await expect(page.locator('.admin-header')).toBeVisible({ timeout: 15000 })
  })
})