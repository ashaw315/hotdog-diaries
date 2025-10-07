import { Page } from '@playwright/test'

// Test data for content management
export const TEST_CONTENT = {
  sampleText: 'Test hotdog content for E2E testing',
  sampleImage: 'https://example.com/test-hotdog.jpg',
  samplePlatform: 'test-platform'
}

// Enhanced Mock API responses for CI testing
export async function mockApiResponses(page: Page) {
  // Mock successful content queue API
  await page.route('**/api/admin/content**', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            content: [
              {
                id: 1,
                content_text: TEST_CONTENT.sampleText,
                source_platform: TEST_CONTENT.samplePlatform,
                is_approved: false,
                is_posted: false,
                confidence_score: 0.8,
                created_at: new Date().toISOString()
              },
              {
                id: 2,
                content_text: 'Another test hotdog post',
                source_platform: 'reddit',
                is_approved: false,
                is_posted: false,
                confidence_score: 0.9,
                created_at: new Date().toISOString()
              }
            ],
            pagination: {
              page: 1,
              totalPages: 1,
              totalItems: 2,
              itemsPerPage: 20
            }
          }
        })
      })
    }
  })

  // Mock admin metrics API for dashboard
  await page.route('**/api/admin/metrics**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          contentCount: 150,
          approvedCount: 120,
          pendingCount: 20,
          rejectedCount: 10,
          queueHealth: 'Healthy',
          platformStats: {
            reddit: 45,
            youtube: 30,
            giphy: 25,
            pixabay: 20
          }
        }
      })
    })
  })

  // Mock successful dashboard stats
  await page.route('**/api/admin/dashboard*', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            totalPosts: 125,
            approvedPosts: 95,
            rejectedPosts: 15,
            pendingPosts: 15,
            queueHealth: 'healthy',
            platformStats: {
              reddit: 45,
              youtube: 30,
              giphy: 25,
              pixabay: 25
            }
          }
        })
      })
    }
  })

  // Mock platform scan trigger
  await page.route('**/api/admin/**/scan*', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Scan triggered successfully',
          data: {
            scanId: 'test-scan-123',
            platform: 'test-platform',
            status: 'initiated'
          }
        })
      })
    }
  })

  // Mock content approval/rejection
  await page.route('**/api/admin/content/*/approve*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'Content approved successfully'
      })
    })
  })

  await page.route('**/api/admin/content/*/reject*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'Content rejected successfully'
      })
    })
  })
}

// Helper to add test content to the database (when needed)
export async function seedTestData(page: Page) {
  // This could be used to call a special test endpoint that seeds data
  // For now, we'll rely on mocked responses
  console.log('📊 Using mocked test data for E2E tests')
}

// Helper to clean up test data
export async function cleanupTestData(page: Page) {
  // Clean up any test-specific data if needed
  console.log('🧹 Test data cleanup (mocked)')
}