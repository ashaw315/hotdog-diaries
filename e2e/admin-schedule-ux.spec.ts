import { test, expect } from '@playwright/test'

test.describe('Admin Schedule UX', () => {
  test.beforeEach(async ({ page }) => {
    // Setup test data with two days of schedules
    await page.goto('/admin/queue')
    
    // Wait for page to load
    await page.waitForSelector('[data-testid="content-queue"]', { timeout: 10000 })
  })

  test('seeds two days of schedules and verifies display', async ({ page }) => {
    // Seed test data via API
    const today = new Date().toISOString().split('T')[0]
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    const testContent = [
      {
        date: today,
        content: [
          { slot: 0, time: '08:00', platform: 'reddit', text: 'Breakfast hotdog content', hasEnrichment: true },
          { slot: 1, time: '12:00', platform: 'pixabay', text: 'Lunch hotdog special', hasEnrichment: true },
          { slot: 2, time: '15:00', platform: 'youtube', text: 'Afternoon hotdog video', hasEnrichment: false }, // Missing enrichment
          { slot: 3, time: '18:00', platform: 'tumblr', text: 'Dinner hotdog post', hasEnrichment: true },
          { slot: 4, time: '21:00', platform: 'imgur', text: 'Evening hotdog meme', hasEnrichment: true },
          { slot: 5, time: '23:30', platform: 'giphy', text: 'Late night hotdog GIF', hasEnrichment: true }
        ]
      },
      {
        date: tomorrow,
        content: [
          { slot: 0, time: '08:00', platform: 'bluesky', text: 'Tomorrow breakfast hotdog', hasEnrichment: true },
          { slot: 1, time: '12:00', platform: 'lemmy', text: 'Tomorrow lunch discussion', hasEnrichment: false }, // Missing enrichment
          { slot: 2, time: '15:00', platform: 'reddit', text: 'Tomorrow snack time', hasEnrichment: true },
          { slot: 3, time: '18:00', platform: 'pixabay', text: 'Tomorrow dinner image', hasEnrichment: true }
          // Slots 4-5 intentionally left empty for testing
        ]
      }
    ]

    // Seed the test data
    await page.evaluate(async (testContent) => {
      for (const day of testContent) {
        for (const item of day.content) {
          // Create scheduled content via admin API
          const response = await fetch('/api/admin/test/seed-schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              date: day.date,
              slot: item.slot,
              time: item.time,
              platform: item.platform,
              text: item.hasEnrichment ? item.text : null, // Null text for missing enrichment
              content_id: Math.floor(Math.random() * 10000) + 1000
            })
          })
          
          if (!response.ok) {
            console.warn('Failed to seed test data:', await response.text())
          }
        }
      }
    }, testContent)

    // Refresh the page to see seeded data
    await page.reload()
    await page.waitForSelector('[data-testid="content-queue"]')

    // Take screenshot of initial state
    await page.screenshot({ 
      path: './e2e/screenshots/admin-schedule-initial.png',
      fullPage: true 
    })

    // Test 1: Verify default sort is scheduled_post_time ascending
    const sortSelect = page.locator('select#sort')
    await expect(sortSelect).toHaveValue('scheduled_post_time')
    
    // Check URL parameter
    expect(page.url()).toContain('sort=scheduled_post_time')
    expect(page.url()).toContain('dir=asc')

    // Test 2: Verify ET time display and badges
    const scheduleBadges = page.locator('[data-testid="schedule-badge"]')
    await expect(scheduleBadges).toHaveCount(10) // 6 today + 4 tomorrow
    
    // Check specific time slot badges
    const breakfastBadge = page.locator('[data-testid="schedule-badge"]:has-text("08:00"):has-text("Breakfast")').first()
    await expect(breakfastBadge).toBeVisible()
    await expect(breakfastBadge).toContainText('🌅')
    
    const lunchBadge = page.locator('[data-testid="schedule-badge"]:has-text("12:00"):has-text("Lunch")').first()
    await expect(lunchBadge).toBeVisible()
    await expect(lunchBadge).toContainText('☀️')
    
    const snackBadge = page.locator('[data-testid="schedule-badge"]:has-text("15:00"):has-text("Snack")').first()
    await expect(snackBadge).toBeVisible()
    await expect(snackBadge).toContainText('🍎')
    
    const dinnerBadge = page.locator('[data-testid="schedule-badge"]:has-text("18:00"):has-text("Dinner")').first()
    await expect(dinnerBadge).toBeVisible()
    await expect(dinnerBadge).toContainText('🌆')
    
    const eveningBadge = page.locator('[data-testid="schedule-badge"]:has-text("21:00"):has-text("Evening")').first()
    await expect(eveningBadge).toBeVisible()
    await expect(eveningBadge).toContainText('🌃')
    
    const lateNightBadge = page.locator('[data-testid="schedule-badge"]:has-text("23:30"):has-text("Late Night")').first()
    await expect(lateNightBadge).toBeVisible()
    await expect(lateNightBadge).toContainText('🌙')

    // Test 3: Verify correct sort order (ascending by scheduled time)
    const contentItems = page.locator('[data-testid="content-item"]')
    await expect(contentItems).toHaveCount(10)
    
    // First item should be today's 08:00 (breakfast)
    const firstItem = contentItems.first()
    await expect(firstItem).toContainText('08:00')
    await expect(firstItem).toContainText('Breakfast')
    
    // Last visible item should be tomorrow's 18:00 (latest scheduled)
    const lastItem = contentItems.last()
    await expect(lastItem).toContainText('18:00')
    await expect(lastItem).toContainText('Dinner')

    // Test 4: Verify reconcile tooltip and action for missing enrichment
    const warningIcons = page.locator('[data-testid="reconcile-warning"]')
    await expect(warningIcons).toHaveCount(2) // 2 items with missing enrichment
    
    // Check first warning (slot 2 today)
    const firstWarning = warningIcons.first()
    await expect(firstWarning).toContainText('⚠︎')
    
    // Hover to see tooltip
    await firstWarning.hover()
    await expect(page.locator('[title="Missing content enrichment"]')).toBeVisible()
    
    // Test reconcile button
    const reconcileBtn = firstWarning.locator('[data-testid="reconcile-btn"]')
    await expect(reconcileBtn).toBeVisible()
    await expect(reconcileBtn).toContainText('Reconcile')
    
    // Click reconcile (mock the API response)
    await page.route('/api/admin/content/*/reconcile', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      })
    })
    
    await reconcileBtn.click()
    
    // Take screenshot after reconcile action
    await page.screenshot({ 
      path: './e2e/screenshots/admin-schedule-after-reconcile.png',
      fullPage: true 
    })

    // Test 5: Verify sticky sort state (URL persistence)
    // Change sort to confidence_score
    await sortSelect.selectOption('confidence_score')
    await page.waitForTimeout(500) // Wait for URL update
    
    // Check URL updated
    expect(page.url()).toContain('sort=confidence_score')
    
    // Refresh page and verify sort persists
    await page.reload()
    await page.waitForSelector('select#sort')
    await expect(page.locator('select#sort')).toHaveValue('confidence_score')
    expect(page.url()).toContain('sort=confidence_score')
    
    // Change back to scheduled_post_time
    await page.locator('select#sort').selectOption('scheduled_post_time')
    await page.waitForTimeout(500)
    
    // Test 6: Verify sort direction toggle
    const currentUrl = page.url()
    expect(currentUrl).toContain('dir=asc') // Should be ascending by default for scheduled_post_time
    
    // Click the same sort option to toggle direction
    await page.locator('select#sort').selectOption('scheduled_post_time')
    await page.waitForTimeout(500)
    
    // Direction should now be descending
    expect(page.url()).toContain('dir=desc')
    
    // Content should now be in reverse order
    const firstItemReversed = contentItems.first()
    await expect(firstItemReversed).toContainText('18:00') // Tomorrow's latest time should be first
    
    // Final screenshot
    await page.screenshot({ 
      path: './e2e/screenshots/admin-schedule-final.png',
      fullPage: true 
    })
  })

  test('verifies badge styling and hover effects', async ({ page }) => {
    // Navigate to a scheduled content item
    await page.waitForSelector('[data-testid="schedule-badge"]')
    
    const breakfastBadge = page.locator('[data-testid="schedule-badge"]').first()
    
    // Test initial styling
    const initialBg = await breakfastBadge.evaluate(el => 
      window.getComputedStyle(el).background
    )
    expect(initialBg).toContain('linear-gradient') // Should have gradient background
    
    // Test hover effect
    await breakfastBadge.hover()
    
    const hoveredBg = await breakfastBadge.evaluate(el => 
      window.getComputedStyle(el).background
    )
    expect(hoveredBg).not.toBe(initialBg) // Background should change on hover
    
    // Take screenshot of hover state
    await page.screenshot({ 
      path: './e2e/screenshots/badge-hover-effect.png',
      clip: { x: 0, y: 0, width: 400, height: 200 }
    })
  })

  test('verifies mobile responsive layout', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    
    await page.waitForSelector('[data-testid="content-queue"]')
    
    // Verify badges stack properly on mobile
    const badgeGrid = page.locator('[data-testid="schedule-badge-grid"]')
    const gridColumns = await badgeGrid.evaluate(el => 
      window.getComputedStyle(el).gridTemplateColumns
    )
    
    // Should be single column or 2 columns on mobile
    expect(gridColumns).toMatch(/(1fr|repeat\(2, 1fr\))/)
    
    // Take mobile screenshot
    await page.screenshot({ 
      path: './e2e/screenshots/admin-schedule-mobile.png',
      fullPage: true 
    })
  })
})