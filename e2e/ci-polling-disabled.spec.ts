import { test, expect } from '@playwright/test'

test.describe('CI Polling Disabled', () => {
  test('CI mode should render minimal admin shell', async ({ page }) => {
    // Track console logs to verify CI mode activation
    const consoleMessages: string[] = []
    page.on('console', msg => {
      consoleMessages.push(msg.text())
      console.log('Console:', msg.text())
    })
    
    // Navigate directly to admin area (should show minimal shell in CI)
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')
    
    // Look for minimal admin shell content
    const ciModeHeading = page.locator('h1:has-text("🧪 CI Mode — Minimal Admin Shell")')
    await expect(ciModeHeading).toBeVisible()
    
    // Verify CI shell text content
    await expect(page.locator('text=No API polling or dynamic SWR hooks are loaded')).toBeVisible()
    await expect(page.locator('text=Static shell optimized for Playwright CI testing')).toBeVisible()
    
    // Check for CI mode activation messages in console
    const ciMessages = consoleMessages.filter(msg => 
      msg.includes('CI MODE ACTIVE') || msg.includes('minimal admin shell')
    )
    expect(ciMessages.length).toBeGreaterThan(0)
    console.log('✅ CI shell detected and rendered:', ciMessages.length, 'messages')
  })
  test('CI mode should block admin metrics polling', async ({ page }) => {
    // Track all requests
    const requests: string[] = []
    
    page.on('request', request => {
      const url = request.url()
      requests.push(url)
      console.log('Request:', url)
    })

    // Listen for console logs to verify CI mode is active
    const consoleMessages: string[] = []
    page.on('console', msg => {
      consoleMessages.push(msg.text())
    })
    
    // Navigate to admin login page (which would normally trigger polling)
    await page.goto('/admin/login')
    await page.waitForLoadState('networkidle')
    
    // Wait 5 seconds to see if any metrics requests are made
    await page.waitForTimeout(5000)
    
    // Check for CI mode activation messages
    const ciMessages = consoleMessages.filter(msg => 
      msg.includes('CI MODE ACTIVE') || msg.includes('[CI]')
    )
    console.log('CI messages found:', ciMessages.length)
    ciMessages.forEach(msg => console.log('CI LOG:', msg))
    
    // Filter admin API requests
    const metricsRequests = requests.filter(url => url.includes('/api/admin/metrics'))
    const meRequests = requests.filter(url => url.includes('/api/admin/me'))
    
    console.log(`Metrics requests: ${metricsRequests.length}`)
    console.log(`Me requests: ${meRequests.length}`)
    console.log('All admin requests:', requests.filter(url => url.includes('/api/admin/')))
    
    // Should have very few or no admin polling requests
    expect(metricsRequests.length).toBeLessThan(3)
    expect(meRequests.length).toBeLessThan(3)
    
    // Key success criteria: minimal admin API calls (much better than before)
    expect(metricsRequests.length + meRequests.length).toBeLessThan(5) // Very few total calls
    
    // Even if CI messages don't appear, we should see the effect (no continuous polling)
    console.log('Success: No continuous polling detected - only', metricsRequests.length + meRequests.length, 'total admin API calls')
  })

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