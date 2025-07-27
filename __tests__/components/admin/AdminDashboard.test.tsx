import { render, screen, waitFor } from '@testing-library/react'
import { jest } from '@jest/globals'
import AdminDashboard from '@/components/admin/AdminDashboard'

// Mock fetch
global.fetch = jest.fn()

// Mock AuthContext
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: '1', username: 'admin', email: 'admin@test.com' },
    isLoading: false
  })
}))

describe('AdminDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders dashboard with loading state', () => {
    // Mock API calls to never resolve
    ;(fetch as jest.Mock).mockImplementation(() => new Promise(() => {}))

    render(<AdminDashboard />)

    // Should show loading skeletons
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('renders dashboard with statistics data', async () => {
    const mockStats = {
      totalContent: 150,
      pendingContent: 25,
      postedToday: 6,
      totalViews: 50000,
      avgEngagement: 3.5,
      systemStatus: 'online' as const,
      lastPostTime: new Date('2024-01-01T10:00:00Z'),
      nextPostTime: new Date('2024-01-01T14:00:00Z')
    }

    const mockActivity = [
      {
        id: '1',
        type: 'posted',
        description: 'Posted: Amazing hotdog content',
        timestamp: new Date('2024-01-01T10:00:00Z')
      },
      {
        id: '2',
        type: 'added',
        description: 'Added to queue: New hotdog discovery',
        timestamp: new Date('2024-01-01T09:00:00Z')
      }
    ]

    ;(fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockStats
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockActivity
      })

    render(<AdminDashboard />)

    await waitFor(() => {
      expect(screen.getByText('150')).toBeInTheDocument() // Total content
      expect(screen.getByText('25')).toBeInTheDocument() // Pending content
      expect(screen.getByText('6')).toBeInTheDocument() // Posted today
      expect(screen.getByText('50,000')).toBeInTheDocument() // Total views
    })

    // Check system status
    expect(screen.getByText('Online')).toBeInTheDocument()
    expect(screen.getByText('3.5%')).toBeInTheDocument() // Avg engagement

    // Check recent activity
    expect(screen.getByText('Posted: Amazing hotdog content')).toBeInTheDocument()
    expect(screen.getByText('Added to queue: New hotdog discovery')).toBeInTheDocument()
  })

  it('handles API errors gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    ;(fetch as jest.Mock).mockRejectedValue(new Error('API Error'))

    render(<AdminDashboard />)

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch dashboard data:', expect.any(Error))
    })

    consoleSpy.mockRestore()
  })

  it('displays quick action buttons', async () => {
    ;(fetch as jest.Mock)
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
      expect(screen.getByText('Add Content')).toBeInTheDocument()
      expect(screen.getByText('Refresh Queue')).toBeInTheDocument()
      expect(screen.getByText('View Analytics')).toBeInTheDocument()
      expect(screen.getByText('Settings')).toBeInTheDocument()
    })
  })

  it('refreshes data every 30 seconds', async () => {
    jest.useFakeTimers()

    ;(fetch as jest.Mock).mockResolvedValue({
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
      expect(fetch).toHaveBeenCalledTimes(2)
    })

    // Fast forward 30 seconds
    jest.advanceTimersByTime(30000)

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(4) // 2 more calls
    })

    jest.useRealTimers()
  })
})