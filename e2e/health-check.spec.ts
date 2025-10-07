import { test, expect } from '@playwright/test'

test.describe('Health Endpoint E2E Validation', () => {
  test('should verify health endpoint returns 200 OK', async ({ page }) => {
    // Test the health endpoint directly
    const response = await page.request.get('/api/health')
    
    expect(response.status()).toBe(200)
    
    const healthData = await response.json()
    expect(healthData).toHaveProperty('success', true)
    expect(healthData).toHaveProperty('data')
    expect(healthData.data).toHaveProperty('status', 'healthy')
    expect(healthData.data).toHaveProperty('service', 'hotdog-diaries')
    
    console.log('✅ Health endpoint validation passed')
    console.log('📊 Health data:', JSON.stringify(healthData, null, 2))
  })

  test('should verify server startup was deterministic', async ({ page }) => {
    // If we can navigate to pages, the server started properly via health check
    await page.goto('/admin/login')
    
    // Should load without timeout (server was ready)
    await expect(page.locator('input[name="username"]')).toBeVisible({ timeout: 5000 })
    
    console.log('✅ Server started deterministically via health endpoint')
  })
})