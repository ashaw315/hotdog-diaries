/**
 * Test: Admin Queue Page - Scheduled Content Display
 * 
 * Verifies that the admin queue page correctly displays scheduled content
 * when filtering by 'scheduled' status.
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import ContentQueue from '@/components/admin/ContentQueue'
import { adminApi } from '@/lib/api-client'

// Mock the API client
jest.mock('@/lib/api-client', () => ({
  adminApi: {
    getContent: jest.fn(),
  },
  ApiHelpers: {
    handleError: jest.fn((error) => error.message || 'Unknown error'),
  },
}))

// Mock the auth provider
jest.mock('@/components/providers/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 1, username: 'admin', email: 'admin@test.com' },
    token: 'mock-token',
    isAuthenticated: true,
    isLoading: false,
    login: jest.fn(),
    logout: jest.fn(),
    checkAuth: jest.fn()
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children
}))

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// Mock scheduled content data
const mockScheduledContent = [
  {
    id: 1,
    content_text: 'Scheduled hotdog post 1',
    content_type: 'text',
    source_platform: 'reddit',
    original_url: 'https://reddit.com/r/hotdogs/post1',
    original_author: 'hotdog_lover',
    content_image_url: null,
    content_video_url: null,
    scraped_at: '2024-01-15T10:00:00Z',
    is_posted: false,
    is_approved: true,
    admin_notes: null,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T11:00:00Z',
    post_order: 1,
    content_status: 'scheduled',
    status: 'scheduled',
    scheduled_for: '2024-01-16T14:30:00Z',
    reviewed_at: '2024-01-15T10:30:00Z',
    reviewed_by: 'admin',
    rejection_reason: null,
    confidence_score: 0.85,
    is_spam: false,
    is_inappropriate: false,
    is_unrelated: false,
    is_valid_hotdog: true
  },
  {
    id: 2,
    content_text: 'Scheduled hotdog post 2',
    content_type: 'image',
    source_platform: 'instagram',
    original_url: 'https://instagram.com/p/hotdog123',
    original_author: 'hotdog_chef',
    content_image_url: 'https://example.com/hotdog.jpg',
    content_video_url: null,
    scraped_at: '2024-01-15T11:00:00Z',
    is_posted: false,
    is_approved: true,
    admin_notes: 'Great quality image',
    created_at: '2024-01-15T11:00:00Z',
    updated_at: '2024-01-15T12:00:00Z',
    post_order: 2,
    content_status: 'scheduled',
    status: 'scheduled',
    scheduled_for: '2024-01-16T17:00:00Z',
    reviewed_at: '2024-01-15T11:30:00Z',
    reviewed_by: 'admin',
    rejection_reason: null,
    confidence_score: 0.92,
    is_spam: false,
    is_inappropriate: false,
    is_unrelated: false,
    is_valid_hotdog: true
  }
]

const mockApiResponse = {
  success: true,
  data: {
    content: mockScheduledContent,
    pagination: {
      page: 1,
      limit: 50,
      total: 2,
      totalPages: 1,
      hasMore: false
    },
    filter: 'scheduled'
  },
  message: 'Retrieved 2 content items'
}

describe('Admin Queue - Scheduled Content', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup default API response
    ;(adminApi.getContent as jest.Mock).mockResolvedValue(mockApiResponse)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should display scheduled content when scheduled filter is selected', async () => {
    render(<ContentQueue />)

    // Wait for initial load
    await waitFor(() => {
      expect(screen.queryByText('Loading content queue...')).not.toBeInTheDocument()
    })

    // Find and select the scheduled filter
    const filterSelect = screen.getByLabelText('Filter:')
    fireEvent.change(filterSelect, { target: { value: 'scheduled' } })

    // Wait for the API call to complete
    await waitFor(() => {
      expect(adminApi.getContent).toHaveBeenCalledWith({
        page: 1,
        limit: 50,
        status: 'scheduled',
        autoRefresh: true
      })
    })

    // Verify scheduled content is displayed
    expect(screen.getByText('Scheduled hotdog post 1')).toBeInTheDocument()
    expect(screen.getByText('Scheduled hotdog post 2')).toBeInTheDocument()

    // Verify scheduled status tags are shown
    const scheduledTags = screen.getAllByText('scheduled')
    expect(scheduledTags).toHaveLength(2)

    // Verify scheduled timestamps are displayed
    expect(screen.getByText(/Scheduled:/)).toBeInTheDocument()

    // Verify confidence scores are displayed
    expect(screen.getByText('85% confidence')).toBeInTheDocument()
    expect(screen.getByText('92% confidence')).toBeInTheDocument()
  })

  it('should show empty state when no scheduled content exists', async () => {
    // Mock empty response
    const emptyResponse = {
      ...mockApiResponse,
      data: {
        ...mockApiResponse.data,
        content: [],
        pagination: {
          ...mockApiResponse.data.pagination,
          total: 0
        }
      }
    }
    
    ;(adminApi.getContent as jest.Mock).mockResolvedValue(emptyResponse)

    render(<ContentQueue />)

    // Wait for initial load
    await waitFor(() => {
      expect(screen.queryByText('Loading content queue...')).not.toBeInTheDocument()
    })

    // Select scheduled filter
    const filterSelect = screen.getByLabelText('Filter:')
    fireEvent.change(filterSelect, { target: { value: 'scheduled' } })

    // Wait for API call
    await waitFor(() => {
      expect(adminApi.getContent).toHaveBeenCalledWith({
        page: 1,
        limit: 50,
        status: 'scheduled',
        autoRefresh: true
      })
    })

    // Verify empty state is shown
    expect(screen.getByText('No content found')).toBeInTheDocument()
    expect(screen.getByText(/No content matches the current filter/)).toBeInTheDocument()
  })

  it('should handle API errors gracefully when loading scheduled content', async () => {
    const errorResponse = {
      success: false,
      error: 'Database connection failed',
      data: null
    }
    
    ;(adminApi.getContent as jest.Mock).mockResolvedValue(errorResponse)

    render(<ContentQueue />)

    // Wait for error state
    await waitFor(() => {
      expect(screen.getByText('Content Queue Error')).toBeInTheDocument()
      expect(screen.getByText('Database connection failed')).toBeInTheDocument()
    })

    // Verify retry button is available
    expect(screen.getByText('🔄 Retry Loading')).toBeInTheDocument()
  })

  it('should refresh scheduled content when refresh button is clicked', async () => {
    render(<ContentQueue />)

    // Wait for initial load
    await waitFor(() => {
      expect(screen.queryByText('Loading content queue...')).not.toBeInTheDocument()
    })

    // Select scheduled filter
    const filterSelect = screen.getByLabelText('Filter:')
    fireEvent.change(filterSelect, { target: { value: 'scheduled' } })

    // Clear the mock call count
    jest.clearAllMocks()
    ;(adminApi.getContent as jest.Mock).mockResolvedValue(mockApiResponse)

    // Click refresh button
    const refreshButton = screen.getByText('🔄 Refresh')
    fireEvent.click(refreshButton)

    // Verify API is called again with scheduled status
    await waitFor(() => {
      expect(adminApi.getContent).toHaveBeenCalledWith({
        page: 1,
        limit: 50,
        status: 'scheduled',
        autoRefresh: true
      })
    })
  })

  it('should display all required scheduled content fields', async () => {
    render(<ContentQueue />)

    // Wait for initial load and select scheduled filter
    await waitFor(() => {
      expect(screen.queryByText('Loading content queue...')).not.toBeInTheDocument()
    })

    const filterSelect = screen.getByLabelText('Filter:')
    fireEvent.change(filterSelect, { target: { value: 'scheduled' } })

    await waitFor(() => {
      expect(screen.getByText('Scheduled hotdog post 1')).toBeInTheDocument()
    })

    // Verify platform tags
    expect(screen.getByText('reddit')).toBeInTheDocument()
    expect(screen.getByText('instagram')).toBeInTheDocument()

    // Verify scheduled status tags
    const scheduledTags = screen.getAllByText('scheduled')
    expect(scheduledTags.length).toBeGreaterThan(0)

    // Verify original URLs are linked
    const originalLinks = screen.getAllByText('View Original')
    expect(originalLinks).toHaveLength(2)

    // Verify timestamps
    expect(screen.getAllByText(/Created:/)).toHaveLength(2)
    expect(screen.getAllByText(/Updated:/)).toHaveLength(2)
    expect(screen.getAllByText(/Scheduled:/)).toHaveLength(2)
    expect(screen.getAllByText(/Reviewed:/)).toHaveLength(2)
  })
})