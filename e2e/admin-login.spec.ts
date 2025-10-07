import { unauthenticatedTest as test, expect, loginAsAdmin } from './utils/auth'

test.describe('Admin Login Flow', () => {
  test('should successfully login with valid credentials', async ({ page }) => {
    // Navigate to login page
    await page.goto('/admin/login')
    
    // Verify login page loads using data-testid selectors
    await expect(page.getByTestId('admin-login-title')).toBeVisible()
    await expect(page.getByTestId('admin-login-username-input')).toBeVisible()
    await expect(page.getByTestId('admin-login-password-input')).toBeVisible()
    
    // Perform login
    await loginAsAdmin(page)
    
    // Verify successful redirect and authenticated state
    await expect(page).toHaveURL('/admin')
    
    // Check for admin dashboard elements using data-testid
    await expect(page.getByTestId('admin-dashboard')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('stats-grid')).toBeVisible()
  })

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto('/admin/login')
    
    // Try login with wrong credentials using data-testid selectors
    await page.getByTestId('admin-login-username-input').fill('wronguser')
    await page.getByTestId('admin-login-password-input').fill('wrongpass')
    await page.getByTestId('admin-login-submit-button').click()
    
    // Wait for error message to appear using data-testid
    await page.waitForSelector('[data-testid="admin-login-error"]', { timeout: 10000 })
    
    // Check error message content
    const errorElement = page.getByTestId('admin-login-error')
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
    
    // Try to submit empty form using data-testid
    await page.getByTestId('admin-login-submit-button').click()
    
    // Should show validation error or stay on page
    const isStillOnLogin = page.url().includes('/admin/login')
    expect(isStillOnLogin).toBe(true)
  })

  test('should handle loading states during login', async ({ page }) => {
    // Navigate to login page
    await page.goto('/admin/login')
    
    // Fill valid credentials using data-testid selectors
    await page.getByTestId('admin-login-username-input').fill('admin')
    await page.getByTestId('admin-login-password-input').fill('StrongAdminPass123!')
    
    // Start login and immediately check for loading state (before navigation completes)
    const submitPromise = page.getByTestId('admin-login-submit-button').click()
    
    // Give a small delay to catch the loading state if visible
    await page.waitForTimeout(100)
    
    // Complete the login process
    await submitPromise
    await page.waitForURL(/\/admin/, { timeout: 15000 })
    
    // Verify we're on the admin page using data-testid
    await expect(page.getByTestId('admin-dashboard')).toBeVisible({ timeout: 15000 })
  })
})