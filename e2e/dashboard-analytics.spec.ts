import { test, expect } from './utils/auth'
import { mockApiResponses } from './utils/fixtures'

test.describe('Dashboard Analytics', () => {
  test('should load dashboard with analytics stats', async ({ authenticatedPage: page }) => {
    // Set up API mocks for consistent test data
    await mockApiResponses(page)
    
    // Navigate to dashboard
    await page.goto('/admin/dashboard')
    
    // Wait for dashboard to load
    await expect(page.locator('h1:has-text(/dashboard/i), h2:has-text(/dashboard/i)')).toBeVisible()
    
    // Check for stats cards or metrics
    await expect(page.locator('text=/total.*posts?|content.*queue|approved|pending/i')).toBeVisible()
    
    // Look for numerical values indicating stats are loaded
    await expect(page.locator('text=/\\d+/')).toBeVisible()
    
    // Check for charts or visual elements (if present)
    const hasCharts = await page.locator('canvas, svg, [data-chart], .chart').count()
    if (hasCharts > 0) {
      await expect(page.locator('canvas, svg, [data-chart], .chart').first()).toBeVisible()
    }
    
    console.log('✅ Dashboard loaded with analytics data')
  })

  test('should display platform breakdown stats', async ({ authenticatedPage: page }) => {
    await mockApiResponses(page)
    await page.goto('/admin/dashboard')
    
    // Look for platform-specific stats
    const platformNames = ['reddit', 'youtube', 'giphy', 'pixabay', 'bluesky']
    
    for (const platform of platformNames) {
      // Check if platform stats are visible (at least one should be)
      const platformText = page.locator(`text=/${platform}/i`)
      const isVisible = await platformText.isVisible().catch(() => false)
      
      if (isVisible) {
        console.log(`✅ Found ${platform} platform stats`)
        break
      }
    }
    
    // Should have some platform statistics
    await expect(page.locator('text=/platform|source|reddit|youtube|giphy/i')).toBeVisible()
  })

  test('should show queue health status', async ({ authenticatedPage: page }) => {
    await mockApiResponses(page)
    await page.goto('/admin/dashboard')
    
    // Look for queue health indicators
    await expect(page.locator('text=/queue.*health|health.*queue|status.*queue/i, text=/healthy|warning|critical/i')).toBeVisible()
  })

  test('should handle dashboard loading states', async ({ authenticatedPage: page }) => {
    await page.goto('/admin/dashboard')
    
    // Page should eventually show content (even if loading states are fast)
    await expect(page.locator('text=/dashboard|stats|content|queue/i')).toBeVisible({ timeout: 15000 })
    
    // Should not show error states
    await expect(page.locator('text=/error.*loading|failed.*load/i')).not.toBeVisible()
  })

  test('should navigate between dashboard sections', async ({ authenticatedPage: page }) => {
    await page.goto('/admin/dashboard')
    
    // Look for navigation links or tabs
    const navLinks = [
      'content', 'queue', 'analytics', 'platforms', 'settings'
    ]
    
    for (const linkText of navLinks) {
      const link = page.locator(`a:has-text("${linkText}"), button:has-text("${linkText}")`)
      const isVisible = await link.isVisible().catch(() => false)
      
      if (isVisible) {
        console.log(`✅ Found navigation link: ${linkText}`)
        await link.click()
        
        // Wait for navigation
        await page.waitForTimeout(1000)
        
        // Should not show errors
        await expect(page.locator('text=/error|failed|not found/i')).not.toBeVisible()
        
        // Go back to dashboard
        await page.goto('/admin/dashboard')
        break
      }
    }
  })
})