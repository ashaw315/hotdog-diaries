import { render, screen, waitFor } from '@testing-library/react'
import AdminDashboard from '@/components/admin/AdminDashboard'
import { useAuth } from '@/contexts/AuthContext'
import { 
  mockFetch,
  createMockAuthContext
} from '@/__tests__/utils/component-mocks'
import { mockDashboardStats, mockDashboardActivity } from '@/__tests__/utils/metrics-mocks'

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn()
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/admin/dashboard'
}))

// Mock ContentStatusDashboard component to avoid additional complexity
jest.mock('@/components/admin/ContentStatusDashboard', () => ({
  ContentStatusDashboard: function MockContentStatusDashboard() {
    return <div data-testid="content-status-dashboard">Content Status Dashboard</div>
  }
}))

// Mock AuthContext
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn()
}))

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>

describe('AdminDashboard', () => {
  const fetchMock = mockFetch()
  
  beforeEach(() => {
    fetchMock.reset()
    jest.clearAllMocks()
    
    // Setup auth mock
    mockUseAuth.mockReturnValue(createMockAuthContext())
  })

  it('renders dashboard with loading state', () => {
    // Mock API calls to never resolve
    fetchMock.mockFn.mockImplementation(() => new Promise(() => {}))

    render(<AdminDashboard />)

    // Should show loading state (component renders 4 loading cards)
    expect(screen.getAllByText('Loading dashboard data...')).toHaveLength(4)
  })

  it('renders dashboard with statistics data', async () => {
    // Mock the two API calls the component makes
    fetchMock.mockFn
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockDashboardStats
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockDashboardActivity
      })

    render(<AdminDashboard />)

    await waitFor(() => {
      expect(screen.getByText('150')).toBeInTheDocument() // Total content from mockDashboardStats
      expect(screen.getByText('125')).toBeInTheDocument() // Approved (totalContent - pendingContent = 150 - 25)
      expect(screen.getByText('25')).toBeInTheDocument() // Pending content
      expect(screen.getByText('6')).toBeInTheDocument() // Posted today
    })

    // Check that platform status is rendered (multiple platforms show 'active' when enabled)
    await waitFor(() => {
      expect(screen.getAllByText('active')).toHaveLength(3) // Reddit, YouTube, Unsplash are enabled
      expect(screen.getByText('45')).toBeInTheDocument() // Reddit content found
    })
  })

  it('handles API errors gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    fetchMock.mockError(new Error('API Error'))

    render(<AdminDashboard />)

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch dashboard data:', expect.any(Error))
    })

    consoleSpy.mockRestore()
  })

  it('displays quick action buttons', async () => {
    fetchMock.mockFn
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalContent: 0,
          pendingContent: 0,
          postedToday: 0,
          totalViews: 0,
          avgEngagement: 0,
          systemStatus: 'online'
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => []
      })

    render(<AdminDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Scan All Platforms')).toBeInTheDocument()
      expect(screen.getByText('Review Content')).toBeInTheDocument()
      expect(screen.getByText('View Analytics')).toBeInTheDocument()
      expect(screen.getByText('System Settings')).toBeInTheDocument()
    })
  })

  it('refreshes data every 30 seconds', async () => {
    jest.useFakeTimers()

    fetchMock.mockFn.mockResolvedValue({
      ok: true,
      json: async () => ({
        totalContent: 0,
        pendingContent: 0,
        postedToday: 0,
        totalViews: 0,
        avgEngagement: 0,
        systemStatus: 'online'
      })
    })

    render(<AdminDashboard />)

    // Initial calls
    await waitFor(() => {
      expect(fetchMock.mockFn).toHaveBeenCalledTimes(2)
    })

    // Fast forward 30 seconds
    jest.advanceTimersByTime(30000)

    await waitFor(() => {
      expect(fetchMock.mockFn).toHaveBeenCalledTimes(4) // 2 more calls
    })

    jest.useRealTimers()
  })
})