import { test, expect } from './utils/auth'
import { mockApiResponses } from './utils/fixtures'

test.describe('Dashboard Analytics', () => {
  test('should load dashboard with analytics stats', async ({ authenticatedPage: page }) => {
    // Set up API mocks for consistent test data
    await mockApiResponses(page)
    
    // Navigate to dashboard
    await page.goto('/admin/dashboard')
    
    // Wait for dashboard to load
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible()
    
    // Check for stats cards or metrics using more specific selectors
    await expect(page.getByText(/total|content|queue|approved|pending/i).first()).toBeVisible()
    
    // Look for numerical values indicating stats are loaded
    await expect(page.locator('[data-testid*="stat"], .stat, .metric').first()).toBeVisible({ timeout: 15000 })
    
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
    await expect(page.getByText(/platform|source|reddit|youtube|giphy/i).first()).toBeVisible()
  })

  test('should show queue health status', async ({ authenticatedPage: page }) => {
    await mockApiResponses(page)
    await page.goto('/admin/dashboard')
    
    // Look for queue health indicators
    await expect(page.getByText(/queue.*health|health.*queue|status.*queue|healthy|warning|critical/i).first()).toBeVisible()
  })

  test('should handle dashboard loading states', async ({ authenticatedPage: page }) => {
    await page.goto('/admin/dashboard')
    
    // Page should eventually show content (even if loading states are fast)
    await expect(page.getByText(/dashboard|stats|content|queue/i).first()).toBeVisible({ timeout: 15000 })
    
    // Should not show error states
    await expect(page.getByText(/error.*loading|failed.*load/i)).not.toBeVisible()
  })

  test('should navigate between dashboard sections', async ({ authenticatedPage: page }) => {
    await page.goto('/admin/dashboard')
    
    // Look for navigation links or tabs
    const navLinks = [
      'content', 'queue', 'analytics', 'platforms', 'settings'
    ]
    
    for (const linkText of navLinks) {
      const link = page.getByRole('link', { name: new RegExp(linkText, 'i') }).or(
        page.getByRole('button', { name: new RegExp(linkText, 'i') })
      )
      const isVisible = await link.isVisible().catch(() => false)
      
      if (isVisible) {
        console.log(`✅ Found navigation link: ${linkText}`)
        await link.click()
        
        // Wait for navigation
        await page.waitForTimeout(1000)
        
        // Should not show errors
        await expect(page.getByText(/error|failed|not found/i)).not.toBeVisible()
        
        // Go back to dashboard
        await page.goto('/admin/dashboard')
        break
      }
    }
  })
})