/**
 * Shared Component Test Utilities
 * 
 * Provides standardized mocking utilities for React components including:
 * - Provider wrappers (Auth, API client)
 * - Mock context values
 * - Common test setup patterns
 */

import React from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { AuthProvider, AuthContextType, User } from '@/contexts/AuthContext'
import { mockDashboardStats, mockDashboardActivity, mockAnalyticsResult } from './metrics-mocks'
import { mockContentResponse, mockContentList } from './endpoint-mocks'

// Mock Next.js navigation hooks
export function mockNextNavigation() {
  const mockPush = jest.fn()
  const mockReplace = jest.fn()
  const mockBack = jest.fn()
  const mockForward = jest.fn()
  const mockRefresh = jest.fn()
  const mockPrefetch = jest.fn()

  jest.mock('next/navigation', () => ({
    useRouter: () => ({
      push: mockPush,
      replace: mockReplace,
      back: mockBack,
      forward: mockForward,
      refresh: mockRefresh,
      prefetch: mockPrefetch
    }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => '/admin/dashboard'
  }))

  return {
    mockPush,
    mockReplace,
    mockBack,
    mockForward,
    mockRefresh,
    mockPrefetch
  }
}

// Mock fetch for component tests
export function mockFetch() {
  const mockFn = jest.fn()
  global.fetch = mockFn
  
  return {
    // Dashboard-specific responses
    mockDashboardSuccess: () => {
      mockFn
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDashboardStats
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDashboardActivity
        })
    },
    
    // Analytics responses
    mockAnalyticsSuccess: () => {
      mockFn.mockResolvedValue({
        ok: true,
        json: async () => mockAnalyticsResult
      })
    },
    
    // Content responses
    mockContentSuccess: () => {
      mockFn.mockResolvedValue({
        ok: true,
        json: async () => mockContentList
      })
    },
    
    // Error responses
    mockError: (error: Error | string = 'API Error') => {
      mockFn.mockRejectedValue(
        typeof error === 'string' ? new Error(error) : error
      )
    },
    
    // Generic success response
    mockSuccess: (data: any) => {
      mockFn.mockResolvedValue({
        ok: true,
        json: async () => data
      })
    },
    
    // HTTP error responses
    mockHttpError: (status: number, error: string) => {
      mockFn.mockResolvedValue({
        ok: false,
        status,
        json: async () => ({ error })
      })
    },
    
    // Reset all mocks
    reset: () => mockFn.mockReset(),
    
    // Access to the mock function
    mockFn
  }
}

// Mock user data for testing
export const mockAdminUser: User = {
  id: 1,
  username: 'admin',
  email: 'admin@test.com',
  full_name: 'Test Administrator',
  last_login_at: new Date('2025-09-12T10:00:00Z')
}

// Mock auth context values
export function createMockAuthContext(overrides: Partial<AuthContextType> = {}): AuthContextType {
  return {
    user: mockAdminUser,
    isLoading: false,
    isAuthenticated: true,
    login: jest.fn().mockResolvedValue(undefined),
    logout: jest.fn().mockResolvedValue(undefined),
    refreshUser: jest.fn().mockResolvedValue(undefined),
    ...overrides
  }
}

// Mock the useAuth hook directly  
export function mockUseAuth(authValue: Partial<AuthContextType> = {}) {
  const mockAuthContext = createMockAuthContext(authValue)
  
  // Mock the entire contexts/AuthContext module
  jest.doMock('@/contexts/AuthContext', () => ({
    useAuth: jest.fn(() => mockAuthContext),
    useRequireAuth: jest.fn(() => mockAuthContext),
    useRedirectIfAuthenticated: jest.fn(() => mockAuthContext),
    AuthProvider: ({ children }: { children: React.ReactNode }) => children
  }))
  
  return mockAuthContext
}

// Mock AuthProvider component for testing
interface MockAuthProviderProps {
  children: React.ReactNode
  value?: Partial<AuthContextType>
}

export function MockAuthProvider({ children, value = {} }: MockAuthProviderProps) {
  // Since we're using this in tests, we can just return children
  // The actual mocking happens at the module level
  return <>{children}</>
}

// Provider wrapper that includes all necessary providers
interface TestProvidersProps {
  children: React.ReactNode
  authValue?: Partial<AuthContextType>
  fetchMocks?: Record<string, any>
}

export function TestProviders({ children, authValue = {}, fetchMocks = {} }: TestProvidersProps) {
  // Setup fetch mocks based on provided mock responses
  React.useEffect(() => {
    if (Object.keys(fetchMocks).length > 0) {
      const mockFetchFn = jest.fn()
      
      // Setup route-based mocking
      mockFetchFn.mockImplementation((url: string) => {
        // Extract pathname from URL for matching
        const pathname = url.includes('http') ? new URL(url).pathname : url
        
        if (fetchMocks[pathname]) {
          return Promise.resolve({
            ok: true,
            json: async () => fetchMocks[pathname]
          })
        }
        
        // Default fallback
        return Promise.resolve({
          ok: true,
          json: async () => ({})
        })
      })
      
      global.fetch = mockFetchFn
    }
  }, [fetchMocks])
  
  return (
    <MockAuthProvider value={authValue}>
      {children}
    </MockAuthProvider>
  )
}

// Convenience function to wrap components with providers
export function withProviders(
  children: React.ReactNode,
  options: {
    authValue?: Partial<AuthContextType>
    fetchMocks?: Record<string, any>
  } = {}
) {
  return (
    <TestProviders
      authValue={options.authValue}
      fetchMocks={options.fetchMocks}
    >
      {children}
    </TestProviders>
  )
}

// Custom render function that includes providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  authValue?: Partial<AuthContextType>
  fetchMocks?: Record<string, any>
}

export function renderWithProviders(
  ui: React.ReactElement,
  options: CustomRenderOptions = {}
) {
  const { authValue, fetchMocks, ...renderOptions } = options
  
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <TestProviders authValue={authValue} fetchMocks={fetchMocks}>
      {children}
    </TestProviders>
  )

  return render(ui, { wrapper: Wrapper, ...renderOptions })
}

// Mock common API endpoints for component testing
export const defaultApiMocks = {
  '/api/admin/dashboard/stats': mockDashboardStats,
  '/api/admin/dashboard/activity': mockDashboardActivity,
  '/api/admin/analytics': mockAnalyticsResult,
  '/api/admin/content': mockContentList,
  '/api/admin/me': mockAdminUser
}

// Platform-specific mocks
export const mockPlatformResponses = {
  reddit: {
    enabled: true,
    healthy: true,
    lastChecked: '2025-09-12T10:00:00Z',
    contentFound: 45,
    lastScan: '2025-09-12T10:00:00Z',
    status: 'active',
    errorCount: 0,
    successRate: 0.95
  },
  youtube: {
    enabled: true,
    healthy: true,
    lastChecked: '2025-09-12T09:30:00Z',
    contentFound: 38,
    lastScan: '2025-09-12T09:30:00Z',
    status: 'active',
    errorCount: 0,
    successRate: 0.92
  },
  giphy: {
    enabled: true,
    healthy: true,
    lastChecked: '2025-09-12T08:00:00Z',
    contentFound: 20,
    lastScan: '2025-09-12T08:00:00Z',
    status: 'active',
    errorCount: 0,
    successRate: 0.88
  }
}

// Platform Configuration mock data for Platform Settings tests
export const mockPlatformConfig = {
  reddit: { 
    enabled: true, 
    lastScan: "2025-09-10T10:00:00Z",
    scanInterval: 3600,
    maxPosts: 50,
    filters: ['hotdog', 'hot dog'],
    status: 'active'
  },
  youtube: { 
    enabled: false, 
    lastScan: null,
    scanInterval: 7200,
    maxPosts: 25,
    filters: [],
    status: 'inactive'
  },
  pixabay: {
    enabled: true,
    lastScan: "2025-09-09T15:30:00Z",
    scanInterval: 3600,
    maxPosts: 30,
    filters: ['hotdog'],
    status: 'active'
  },
  giphy: {
    enabled: true,
    lastScan: "2025-09-10T08:00:00Z",
    scanInterval: 3600,
    maxPosts: 20,
    filters: ['hotdog', 'hot-dog'],
    status: 'active'
  }
}

// Helper to create platform-specific mocks for testing
export function withPlatformMocks(children: React.ReactNode, customMocks?: Record<string, any>) {
  const defaultPlatformMocks = {
    "/api/admin/platforms/reddit/config": { success: true, data: mockPlatformConfig.reddit },
    "/api/admin/platforms/youtube/config": { success: true, data: mockPlatformConfig.youtube },
    "/api/admin/platforms/pixabay/config": { success: true, data: mockPlatformConfig.pixabay },
    "/api/admin/platforms/giphy/config": { success: true, data: mockPlatformConfig.giphy },
    "/api/admin/platforms/scan": { success: true, message: "Scan initiated successfully" },
    "/api/admin/platforms/reddit/trigger": { success: true, message: "Reddit scan triggered" },
    "/api/admin/platforms/youtube/trigger": { success: true, message: "YouTube scan triggered" },
    "/api/admin/platforms/pixabay/trigger": { success: true, message: "Pixabay scan triggered" },
    "/api/admin/platforms/giphy/trigger": { success: true, message: "Giphy scan triggered" }
  }
  
  const allMocks = { ...defaultPlatformMocks, ...customMocks }
  
  return withProviders(children, { fetchMocks: allMocks })
}

// Mock console to reduce noise in tests
export function mockConsole() {
  const originalConsole = { ...console }
  
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })
  
  afterEach(() => {
    jest.restoreAllMocks()
  })
  
  return originalConsole
}

// Helper to wait for async state updates
export async function waitForNextUpdate() {
  await new Promise(resolve => setTimeout(resolve, 0))
}

// Helper to create mock event handlers
export function createMockHandlers() {
  return {
    onClick: jest.fn(),
    onChange: jest.fn(),
    onSubmit: jest.fn(),
    onApprove: jest.fn(),
    onReject: jest.fn(),
    onBulkAction: jest.fn(),
    onScan: jest.fn(),
    onToggle: jest.fn()
  }
}

// Mock timer functions for component tests with intervals
export function mockTimers() {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  
  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })
}

// Global test setup for component tests
export function setupComponentTests() {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks()
    
    // Mock console to reduce noise
    jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })
  
  afterEach(() => {
    // Restore all mocks
    jest.restoreAllMocks()
    
    // Clean up fetch mock
    if (global.fetch && jest.isMockFunction(global.fetch)) {
      (global.fetch as jest.Mock).mockClear()
    }
  })
}