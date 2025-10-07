import { test, expect } from '@playwright/test'

test.describe('CI Polling Disabled', () => {
  test('health endpoint should respond quickly without hanging', async ({ page }) => {
    const startTime = Date.now()
    
    // Navigate directly to health endpoint (no auth required)
    await page.goto('/api/health')
    
    // Wait for response
    await page.waitForLoadState('networkidle')
    
    const endTime = Date.now()
    const duration = endTime - startTime
    
    console.log(`Health endpoint responded in ${duration}ms`)
    
    // Should respond quickly without hanging
    expect(duration).toBeLessThan(10000) // 10 seconds
    
    // Check that we got a response (not an error page)
    const content = await page.textContent('body')
    expect(content).toBeTruthy()
  })

  test('should not make continuous API requests after page load', async ({ page }) => {
    // Track API requests
    const apiRequests: string[] = []
    
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        apiRequests.push(request.url())
      }
    })
    
    // Navigate to home page (doesn't require auth)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    // Record initial API calls
    const initialCallCount = apiRequests.length
    
    // Wait 8 seconds to see if more API calls are made
    await page.waitForTimeout(8000)
    
    // Check that no additional polling requests were made
    const finalCallCount = apiRequests.length
    const additionalCalls = finalCallCount - initialCallCount
    
    console.log(`Initial API calls: ${initialCallCount}`)
    console.log(`Additional API calls after 8s: ${additionalCalls}`)
    console.log('API requests:', apiRequests.slice(0, 10)) // Log first 10
    
    // Should have no or very minimal additional calls (since no polling should occur)
    // Allow for feed API and client-error calls, but no continuous polling
    expect(additionalCalls).toBeLessThanOrEqual(3)
  })

  test('CI environment should complete quickly', async ({ page }) => {
    const startTime = Date.now()
    
    // Navigate through basic pages without admin auth
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    
    await page.goto('/api/health')
    await page.waitForLoadState('networkidle')
    
    const endTime = Date.now()
    const duration = endTime - startTime
    
    console.log(`Test completed in ${duration}ms`)
    
    // Should complete very quickly (much less than 30 seconds)
    expect(duration).toBeLessThan(15000) // 15 seconds
  })
})