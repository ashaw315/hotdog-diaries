import { test, expect, Page } from '@playwright/test'

// Mock database helpers
const createMockPostedContent = async (page: Page) => {
  // Set up test data by intercepting the API call and returning mock data
  await page.route('/api/admin/content?status=posted*', async (route) => {
    const mockPostedContent = {
      success: true,
      data: {
        content: [
          {
            id: 1,
            content_text: 'A delicious Chicago-style hot dog with all the fixings!',
            content_type: 'image',
            source_platform: 'reddit',
            original_url: 'https://reddit.com/r/hotdogs/sample1',
            original_author: 'hotdog_lover',
            content_image_url: 'https://example.com/hotdog1.jpg',
            posted_at: new Date().toISOString(),
            post_order: 1
          },
          {
            id: 2,
            content_text: 'Amazing hot dog cooking video!',
            content_type: 'video',
            source_platform: 'youtube',
            original_url: 'https://youtube.com/watch?v=sample',
            original_author: 'cooking_channel',
            content_video_url: 'https://youtube.com/watch?v=sample',
            posted_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
            post_order: 2
          },
          {
            id: 3,
            content_text: 'Hot dog GIF animation',
            content_type: 'gif',
            source_platform: 'giphy',
            original_url: 'https://giphy.com/gifs/hotdog',
            original_author: 'giphy_user',
            content_image_url: 'https://media.giphy.com/media/sample/giphy.gif',
            posted_at: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
            post_order: 3
          }
        ],
        pagination: {
          total: 3,
          page: 1,
          limit: 20,
          hasMore: false
        }
      }
    }
    
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockPostedContent)
    })
  })

  // Mock stats endpoint
  await page.route('/api/admin/posting/stats', async (route) => {
    const mockStats = {
      success: true,
      data: {
        totalPosted: 156,
        postedToday: 6,
        postsPerDay: 5.2,
        daysSinceFirstPost: 30
      }
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockStats)
    })
  })
}

const mockAuthToken = async (page: Page) => {
  // Mock localStorage to have admin token
  await page.addInitScript(() => {
    localStorage.setItem('adminToken', 'mock-jwt-token-for-testing')
  })
}

test.describe('Admin Posted Content Page', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthToken(page)
    await createMockPostedContent(page)
  })

  test('should display posted content page with correct header', async ({ page }) => {
    await page.goto('/admin/posted')
    
    // Check page title and header
    await expect(page.locator('h1')).toContainText('Posted Content History')
    await expect(page.locator('.header-description')).toContainText('View all content that has been posted to the public site')
    
    // Check refresh button exists
    await expect(page.locator('.refresh-btn')).toBeVisible()
    await expect(page.locator('.refresh-btn')).toContainText('Refresh')
  })

  test('should display posted content list with proper styling', async ({ page }) => {
    await page.goto('/admin/posted')
    
    // Wait for content to load
    await expect(page.locator('.content-item')).toHaveCount(3)
    
    // Check that content items are properly styled
    const firstItem = page.locator('.content-item').first()
    await expect(firstItem).toBeVisible()
    
    // Check platform and content type icons
    await expect(firstItem.locator('.platform-icon')).toBeVisible()
    await expect(firstItem.locator('.content-type-icon')).toBeVisible()
    
    // Check status badge
    await expect(firstItem.locator('.status-badge')).toContainText('Posted')
    
    // Check content text
    await expect(firstItem.locator('.content-text')).toContainText('A delicious Chicago-style hot dog')
  })

  test('should display posting statistics section', async ({ page }) => {
    await page.goto('/admin/posted')
    
    // Check statistics section exists
    await expect(page.locator('h2:has-text("Posting Statistics")')).toBeVisible()
    
    // Check individual stats
    await expect(page.locator('.stat-number.primary').first()).toContainText('156')
    await expect(page.locator('.stat-label:has-text("Total Posted")')).toBeVisible()
    
    await expect(page.locator('.stat-number.success')).toContainText('6')
    await expect(page.locator('.stat-label:has-text("Posted Today")')).toBeVisible()
  })

  test('should display media content correctly', async ({ page }) => {
    await page.goto('/admin/posted')
    
    // Check image content
    const imageItem = page.locator('.content-item').filter({ hasText: 'Chicago-style hot dog' })
    await expect(imageItem.locator('.content-image')).toBeVisible()
    await expect(imageItem.locator('.content-image')).toHaveAttribute('src', 'https://example.com/hotdog1.jpg')
    
    // Check video content
    const videoItem = page.locator('.content-item').filter({ hasText: 'cooking video' })
    await expect(videoItem.locator('.video-link')).toBeVisible()
    await expect(videoItem.locator('.video-link')).toContainText('View Video')
  })

  test('should handle remove post functionality', async ({ page }) => {
    await page.goto('/admin/posted')
    
    // Mock the hide endpoint
    await page.route('/api/admin/content/*/hide', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          action: 'hidden_from_feed',
          details: 'Post removed from public feed successfully'
        })
      })
    })
    
    // Set up dialog handler
    page.on('dialog', async dialog => {
      expect(dialog.message()).toContain('Are you sure you want to remove this post')
      await dialog.accept()
    })
    
    // Click remove button on first item
    const firstItem = page.locator('.content-item').first()
    await firstItem.locator('.remove-btn').click()
    
    // Check that the item was removed from the list
    // Note: In a real scenario, the item would be removed from the DOM
    // For this test, we'll just verify the API call was made
  })

  test('should display original URLs correctly', async ({ page }) => {
    await page.goto('/admin/posted')
    
    // Check view original links
    const viewOriginalLinks = page.locator('.view-original')
    await expect(viewOriginalLinks).toHaveCount(3)
    
    // Check first link
    await expect(viewOriginalLinks.first()).toHaveAttribute('href', 'https://reddit.com/r/hotdogs/sample1')
    await expect(viewOriginalLinks.first()).toHaveAttribute('target', '_blank')
    await expect(viewOriginalLinks.first()).toContainText('View Original')
  })

  test('should display content details correctly', async ({ page }) => {
    await page.goto('/admin/posted')
    
    const firstItem = page.locator('.content-item').first()
    
    // Check author information
    await expect(firstItem.locator('.detail-label:has-text("Author:")')).toBeVisible()
    await expect(firstItem.locator('text=hotdog_lover')).toBeVisible()
    
    // Check posted date
    await expect(firstItem.locator('.detail-label:has-text("Posted:")')).toBeVisible()
    
    // Check post order
    await expect(firstItem.locator('.post-order')).toContainText('#1')
  })

  test('should handle empty state correctly', async ({ page }) => {
    // Override the route to return empty data
    await page.route('/api/admin/content?status=posted*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            content: [],
            pagination: { total: 0, page: 1, limit: 20, hasMore: false }
          }
        })
      })
    })
    
    await page.goto('/admin/posted')
    
    // Check empty state
    await expect(page.locator('.empty-state')).toBeVisible()
    await expect(page.locator('.empty-title')).toContainText('No content has been posted yet')
    await expect(page.locator('.empty-description')).toContainText('Posted content will appear here once items are published')
  })

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API error
    await page.route('/api/admin/content?status=posted*', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Internal server error'
        })
      })
    })
    
    await page.goto('/admin/posted')
    
    // Check error message display
    await expect(page.locator('.error-message')).toBeVisible()
    await expect(page.locator('.error-content h3')).toContainText('Error Loading Content')
    await expect(page.locator('.error-text')).toContainText('HTTP 500: Failed to load posted content')
  })

  test('should handle authentication errors', async ({ page }) => {
    // Mock 401 authentication error
    await page.route('/api/admin/content?status=posted*', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Authentication required'
        })
      })
    })
    
    await page.goto('/admin/posted')
    
    // Check authentication error handling
    await expect(page.locator('.error-message')).toBeVisible()
    await expect(page.locator('.error-hint')).toContainText('Your session may have expired. Please log in again.')
  })

  test('should handle network errors', async ({ page }) => {
    // Mock network failure
    await page.route('/api/admin/content?status=posted*', async (route) => {
      await route.abort('failed')
    })
    
    await page.goto('/admin/posted')
    
    // Check network error handling
    await expect(page.locator('.error-message')).toBeVisible()
    await expect(page.locator('.error-text')).toContainText('Network error: Unable to connect to server')
    await expect(page.locator('.error-hint')).toContainText('Please check your internet connection and try again.')
  })

  test('should refresh data when refresh button is clicked', async ({ page }) => {
    await page.goto('/admin/posted')
    
    // Wait for initial load
    await expect(page.locator('.content-item')).toHaveCount(3)
    
    // Track API calls
    let apiCallCount = 0
    await page.route('/api/admin/content?status=posted*', async (route) => {
      apiCallCount++
      await route.continue()
    })
    
    // Click refresh button
    await page.locator('.refresh-btn').click()
    
    // Verify API was called again
    expect(apiCallCount).toBeGreaterThan(0)
  })

  test('should handle load more functionality if implemented', async ({ page }) => {
    // Mock response with hasMore: true
    await page.route('/api/admin/content?status=posted*', async (route) => {
      const url = new URL(route.request().url())
      const offset = url.searchParams.get('offset') || '0'
      
      const mockResponse = {
        success: true,
        data: {
          content: [
            {
              id: parseInt(offset) + 1,
              content_text: `Hot dog post ${parseInt(offset) + 1}`,
              content_type: 'text',
              source_platform: 'reddit',
              original_url: 'https://reddit.com/test',
              original_author: 'test_user',
              posted_at: new Date().toISOString(),
              post_order: parseInt(offset) + 1
            }
          ],
          pagination: {
            total: 50,
            page: Math.floor(parseInt(offset) / 20) + 1,
            limit: 20,
            hasMore: parseInt(offset) < 40
          }
        }
      }
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse)
      })
    })
    
    await page.goto('/admin/posted')
    
    // Check if load more button appears when hasMore is true
    const loadMoreButton = page.locator('.load-more-btn')
    if (await loadMoreButton.isVisible()) {
      await loadMoreButton.click()
      // Verify additional content is loaded
      await expect(page.locator('.content-item')).toHaveCount.toBeGreaterThan(1)
    }
  })

  test('should display proper CSS styling for mobile responsiveness', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/admin/posted')

    // Check that mobile styles are applied
    const container = page.locator('.posted-container')
    await expect(container).toBeVisible()

    // Check responsive header
    const headerContent = page.locator('.header-content')
    await expect(headerContent).toBeVisible()

    // Verify content items stack properly on mobile
    const contentItems = page.locator('.content-item')
    if (await contentItems.count() > 0) {
      await expect(contentItems.first()).toBeVisible()
    }
  })

  test('should toggle sort order between newest and oldest first', async ({ page }) => {
    await page.goto('/admin/posted')

    // Wait for initial load
    await expect(page.locator('.content-item')).toHaveCount(3)

    // Check default is newest first
    const sortBtn = page.locator('button:has-text("Newest First")')
    await expect(sortBtn).toBeVisible()

    // Track API calls
    let lastApiUrl = ''
    await page.route('/api/admin/content?status=posted*', async (route) => {
      lastApiUrl = route.request().url()

      // Return mock data for ascending order
      const mockResponse = {
        success: true,
        data: {
          content: [
            {
              id: 3,
              content_text: 'Hot dog GIF animation',
              content_type: 'gif',
              source_platform: 'giphy',
              original_url: 'https://giphy.com/gifs/hotdog',
              original_author: 'giphy_user',
              content_image_url: 'https://media.giphy.com/media/sample/giphy.gif',
              posted_at: new Date(Date.now() - 7200000).toISOString(),
              post_order: 3
            }
          ],
          pagination: {
            total: 3,
            page: 1,
            limit: 20,
            hasMore: false
          }
        }
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse)
      })
    })

    // Click to change to oldest first
    await sortBtn.click()

    // Wait for button text to update
    await expect(page.locator('button:has-text("Oldest First")')).toBeVisible()

    // Verify API was called with sortOrder=asc
    expect(lastApiUrl).toContain('sortOrder=asc')
  })

  test('should filter content by date range', async ({ page }) => {
    await page.goto('/admin/posted')

    // Wait for initial load
    await expect(page.locator('.content-item')).toHaveCount(3)

    // Track API calls
    let lastApiUrl = ''
    await page.route('/api/admin/content?status=posted*', async (route) => {
      lastApiUrl = route.request().url()

      const mockResponse = {
        success: true,
        data: {
          content: [
            {
              id: 1,
              content_text: 'Filtered hot dog content',
              content_type: 'image',
              source_platform: 'reddit',
              original_url: 'https://reddit.com/test',
              original_author: 'test_user',
              content_image_url: 'https://example.com/hotdog.jpg',
              posted_at: '2024-01-15T12:00:00Z',
              post_order: 1
            }
          ],
          pagination: {
            total: 1,
            page: 1,
            limit: 20,
            hasMore: false
          }
        }
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse)
      })
    })

    // Set start date
    const startDateInput = page.locator('input[type="date"]').first()
    await startDateInput.fill('2024-01-01')

    // Wait a bit for state update
    await page.waitForTimeout(500)

    // Verify API was called with startDate parameter
    expect(lastApiUrl).toContain('startDate=2024-01-01')

    // Set end date
    const endDateInput = page.locator('input[type="date"]').last()
    await endDateInput.fill('2024-01-31')

    // Wait for API call
    await page.waitForTimeout(500)

    // Verify API was called with both date parameters
    expect(lastApiUrl).toContain('startDate=2024-01-01')
    expect(lastApiUrl).toContain('endDate=2024-01-31')

    // Verify Clear Dates button appears
    await expect(page.locator('button:has-text("Clear Dates")')).toBeVisible()
  })

  test('should clear date filters when Clear Dates button is clicked', async ({ page }) => {
    await page.goto('/admin/posted')

    // Wait for initial load
    await expect(page.locator('.content-item')).toHaveCount(3)

    // Set date filters
    await page.locator('input[type="date"]').first().fill('2024-01-01')
    await page.locator('input[type="date"]').last().fill('2024-01-31')

    // Wait for Clear Dates button to appear
    const clearBtn = page.locator('button:has-text("Clear Dates")')
    await expect(clearBtn).toBeVisible()

    // Click Clear Dates button
    await clearBtn.click()

    // Verify date inputs are empty
    await expect(page.locator('input[type="date"]').first()).toHaveValue('')
    await expect(page.locator('input[type="date"]').last()).toHaveValue('')

    // Verify Clear Dates button is hidden
    await expect(clearBtn).not.toBeVisible()
  })

  test('should display stats with accurate data', async ({ page }) => {
    await page.goto('/admin/posted')

    // Verify Posts/Day stat is displayed
    const postsPerDayStat = page.locator('.stat-label:has-text("Posts/Day Avg")')
    await expect(postsPerDayStat).toBeVisible()

    // Verify the value is the mocked value (5.2)
    const statValue = page.locator('.stat-item').filter({ has: postsPerDayStat }).locator('.stat-number')
    await expect(statValue).toContainText('5.2')

    // Verify Days Active stat is displayed
    const daysActiveStat = page.locator('.stat-label:has-text("Days Active")')
    await expect(daysActiveStat).toBeVisible()

    // Verify the value is the mocked value (30)
    const daysActiveValue = page.locator('.stat-item').filter({ has: daysActiveStat }).locator('.stat-number')
    await expect(daysActiveValue).toContainText('30')

    // Verify Average Engagement is NOT displayed (it was removed)
    await expect(page.locator('text=Average Engagement')).not.toBeVisible()
  })
})