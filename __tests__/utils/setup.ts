/**
 * Common test setup utilities and global configuration
 * Imported by all test files for consistent behavior
 */

import '@testing-library/jest-dom'
import { jest } from '@jest/globals'

// Common error handling pattern - suppress console.error in tests
const originalError = console.error
global.console.error = jest.fn()

// Common warning suppression
const originalWarn = console.warn
global.console.warn = jest.fn()

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks()
  // Reset console mocks to allow specific error testing
  ;(console.error as jest.Mock).mockClear()
  ;(console.warn as jest.Mock).mockClear()
})

// Cleanup after all tests
afterAll(() => {
  global.console.error = originalError
  global.console.warn = originalWarn
})

// Helper to test console.error calls in specific tests
export function expectConsoleError(message?: string) {
  if (message) {
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining(message)
    )
  } else {
    expect(console.error).toHaveBeenCalled()
  }
}

// Helper to test console.warn calls
export function expectConsoleWarn(message?: string) {
  if (message) {
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining(message)
    )
  } else {
    expect(console.warn).toHaveBeenCalled()
  }
}

// Helper to restore console for specific tests that need real console output
export function restoreConsole() {
  global.console.error = originalError
  global.console.warn = originalWarn
}

// Common test patterns
export const testPatterns = {
  // Standard authenticated request test
  authenticatedRequest: async (handler: Function, request: any) => {
    const response = await handler(request)
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    return data
  },

  // Standard unauthorized request test  
  unauthorizedRequest: async (handler: Function, request: any) => {
    const response = await handler(request)
    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toContain('Authentication')
    return data
  },

  // Standard validation error test
  validationError: async (handler: Function, request: any) => {
    const response = await handler(request)
    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBeDefined()
    return data
  },

  // Standard server error test
  serverError: async (handler: Function, request: any) => {
    const response = await handler(request)
    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toBeDefined()
    return data
  }
}

// Database mock helper
export function mockDatabase() {
  return jest.doMock('@/lib/db', () => ({
    db: {
      query: jest.fn(),
      getClient: jest.fn().mockResolvedValue({
        query: jest.fn(),
        release: jest.fn()
      })
    },
    logToDatabase: jest.fn().mockResolvedValue(undefined)
  }))
}

// NextRequest helper for consistent request creation
export function createMockRequest(
  url: string, 
  options: {
    method?: string
    body?: any
    headers?: Record<string, string>
  } = {}
) {
  const { method = 'GET', body, headers = {} } = options
  
  return new Request(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  })
}