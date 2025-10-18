/**
 * Tests for Health Status Dashboard Component
 * 
 * Validates health monitoring UI behavior and API integration.
 */

import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import HealthStatusDashboard from '../../../components/admin/HealthStatusDashboard'

// Mock fetch globally
global.fetch = jest.fn()

const mockFetch = fetch as jest.MockedFunction<typeof fetch>

describe('HealthStatusDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock console methods to reduce test noise
    jest.spyOn(console, 'log').mockImplementation()
    jest.spyOn(console, 'error').mockImplementation()
  })

  const createMockResponse = (data: any, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data
  }) as Response

  describe('loading state', () => {
    it('should show loading state initially', async () => {
      // Mock pending fetch requests
      mockFetch.mockImplementation(() => new Promise(() => {}))

      render(<HealthStatusDashboard />)

      expect(screen.getByText('Checking timezone conversions...')).toBeInTheDocument()
      expect(screen.getByText('Checking posting system integrity...')).toBeInTheDocument()
      
      // Should show loading icons
      const loadingIcons = screen.getAllByRole('img', { hidden: true })
      expect(loadingIcons.some(icon => icon.classList.contains('animate-spin'))).toBeTruthy()
    })
  })

  describe('healthy system', () => {
    beforeEach(() => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse({
          status: 'healthy',
          current_time_et: '2025-01-15 10:30:00 EST',
          current_time_utc: '2025-01-15T15:30:00.000Z',
          timezone_offset_hours: -5,
          slot_conversions: [
            { slot_index: 0, time_et: '08:00', time_utc: '2025-01-15T13:00:00.000Z', is_valid: true },
            { slot_index: 1, time_et: '12:00', time_utc: '2025-01-15T17:00:00.000Z', is_valid: true }
          ],
          issues: [],
          metadata: { timezone: 'America/New_York', dst_active: false, check_timestamp: '2025-01-15T15:30:00.000Z' }
        }))
        .mockResolvedValueOnce(createMockResponse({
          status: 'healthy',
          feature_flag_active: true,
          total_recent_posts: 20,
          linked_posts: 20,
          orphan_posts: 0,
          orphan_percentage: 0,
          scheduled_posts_count: 25,
          posting_compliance_score: 100,
          issues: [],
          recommendations: []
        }))
    })

    it('should display healthy status', async () => {
      render(<HealthStatusDashboard />)

      await waitFor(() => {
        expect(screen.getByText('System Health: All Systems Operational')).toBeInTheDocument()
      })

      expect(screen.getByText('Timezone Handling')).toBeInTheDocument()
      expect(screen.getByText('Posting Source of Truth')).toBeInTheDocument()
      expect(screen.getByText('All checks passed')).toBeInTheDocument()
    })

    it('should show green healthy styling', async () => {
      render(<HealthStatusDashboard />)

      await waitFor(() => {
        const summaryElement = screen.getByTestId('health-summary')
        expect(summaryElement).toHaveClass('healthy')
      })

      const healthChecks = screen.getAllByTestId(/health-check-\d+/)
      healthChecks.forEach(check => {
        expect(check).toHaveClass('border-green-200', 'bg-green-50')
      })
    })
  })

  describe('warning system', () => {
    beforeEach(() => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse({
          status: 'healthy',
          issues: []
        }))
        .mockResolvedValueOnce(createMockResponse({
          status: 'warning',
          feature_flag_active: true,
          total_recent_posts: 20,
          linked_posts: 18,
          orphan_posts: 2,
          orphan_percentage: 10,
          posting_compliance_score: 90,
          issues: ['2 orphan posts found (10.0% of recent posts)'],
          recommendations: ['Run backfill job: npx tsx scripts/ops/backfill-post-links.ts --date YYYY-MM-DD --write']
        }))
    })

    it('should display warning status', async () => {
      render(<HealthStatusDashboard />)

      await waitFor(() => {
        expect(screen.getByText('System Health: Some Issues Detected')).toBeInTheDocument()
      })

      expect(screen.getByText('2 issues found')).toBeInTheDocument()
    })

    it('should show warning styling', async () => {
      render(<HealthStatusDashboard />)

      await waitFor(() => {
        const summaryElement = screen.getByTestId('health-summary')
        expect(summaryElement).toHaveClass('warning')
      })
    })

    it('should display system recommendations', async () => {
      render(<HealthStatusDashboard />)

      await waitFor(() => {
        expect(screen.getByTestId('health-recommendations')).toBeInTheDocument()
      })

      expect(screen.getByText('🔧 System Recommendations')).toBeInTheDocument()
      expect(screen.getByText(/Run backfill job/)).toBeInTheDocument()
    })
  })

  describe('error system', () => {
    beforeEach(() => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse({
          status: 'error',
          issues: ['Unexpected timezone offset during standard time: -8 hours (expected ~-5)']
        }))
        .mockResolvedValueOnce(createMockResponse({
          status: 'error',
          feature_flag_active: false,
          total_recent_posts: 10,
          linked_posts: 5,
          orphan_posts: 5,
          orphan_percentage: 50,
          posting_compliance_score: 50,
          issues: ['ENFORCE_SCHEDULE_SOURCE_OF_TRUTH feature flag is not active', '5 orphan posts found (50.0% of recent posts)'],
          recommendations: ['Set ENFORCE_SCHEDULE_SOURCE_OF_TRUTH=true', 'Run backfill job immediately']
        }))
    })

    it('should display error status', async () => {
      render(<HealthStatusDashboard />)

      await waitFor(() => {
        expect(screen.getByText('System Health: Critical Issues Found')).toBeInTheDocument()
      })

      expect(screen.getByText('Unexpected timezone offset')).toBeInTheDocument()
      expect(screen.getByText('ENFORCE_SCHEDULE_SOURCE_OF_TRUTH feature flag is not active')).toBeInTheDocument()
    })

    it('should show error styling', async () => {
      render(<HealthStatusDashboard />)

      await waitFor(() => {
        const summaryElement = screen.getByTestId('health-summary')
        expect(summaryElement).toHaveClass('error')
      })

      const errorChecks = screen.getAllByTestId(/health-check-\d+/)
      errorChecks.forEach(check => {
        expect(check).toHaveClass('border-red-200', 'bg-red-50')
      })
    })

    it('should show retry buttons for failed checks', async () => {
      render(<HealthStatusDashboard />)

      await waitFor(() => {
        const retryButtons = screen.getAllByTestId(/health-retry-btn-\d+/)
        expect(retryButtons.length).toBeGreaterThan(0)
      })
    })
  })

  describe('user interactions', () => {
    beforeEach(() => {
      mockFetch
        .mockResolvedValue(createMockResponse({
          status: 'healthy',
          issues: []
        }))
    })

    it('should refresh all health checks when refresh button clicked', async () => {
      render(<HealthStatusDashboard />)

      await waitFor(() => {
        expect(screen.getByTestId('health-refresh-btn')).toBeInTheDocument()
      })

      const refreshButton = screen.getByTestId('health-refresh-btn')
      fireEvent.click(refreshButton)

      // Should make new API calls (initial 2 + refresh 2 = 4 total)
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(4)
      })
    })

    it('should show details when details button clicked', async () => {
      // Mock with detailed response
      mockFetch
        .mockResolvedValueOnce(createMockResponse({
          status: 'healthy',
          issues: [],
          details: { some: 'detailed data' }
        }))
        .mockResolvedValueOnce(createMockResponse({
          status: 'healthy',
          issues: []
        }))

      const consoleSpy = jest.spyOn(console, 'log')

      render(<HealthStatusDashboard />)

      await waitFor(() => {
        expect(screen.getByTestId('health-details-btn-0')).toBeInTheDocument()
      })

      const detailsButton = screen.getByTestId('health-details-btn-0')
      fireEvent.click(detailsButton)

      expect(consoleSpy).toHaveBeenCalledWith(
        'Health details for Timezone Handling:',
        { some: 'detailed data' }
      )
    })

    it('should retry individual health check when retry button clicked', async () => {
      // First call returns error, second call returns success
      mockFetch
        .mockResolvedValueOnce(createMockResponse({
          status: 'error',
          issues: ['Connection failed']
        }))
        .mockResolvedValueOnce(createMockResponse({
          status: 'healthy',
          issues: []
        }))
        // Retry call
        .mockResolvedValueOnce(createMockResponse({
          status: 'healthy',
          issues: []
        }))

      render(<HealthStatusDashboard />)

      await waitFor(() => {
        expect(screen.getByTestId('health-retry-btn-0')).toBeInTheDocument()
      })

      const retryButton = screen.getByTestId('health-retry-btn-0')
      fireEvent.click(retryButton)

      // Should update that specific health check
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(3)
      })
    })
  })

  describe('network error handling', () => {
    it('should handle fetch failures gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      render(<HealthStatusDashboard />)

      await waitFor(() => {
        expect(screen.getByText('Connection failed: Network error')).toBeInTheDocument()
      })

      // Should still show the dashboard structure
      expect(screen.getByTestId('health-dashboard')).toBeInTheDocument()
      expect(screen.getByText('System Health: Critical Issues Found')).toBeInTheDocument()
    })

    it('should handle non-200 HTTP responses', async () => {
      mockFetch.mockResolvedValue(createMockResponse(
        { error: 'Internal server error' },
        500
      ))

      render(<HealthStatusDashboard />)

      await waitFor(() => {
        expect(screen.getByText(/Health check failed/)).toBeInTheDocument()
      })
    })
  })

  describe('automatic refresh', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('should automatically refresh every 2 minutes', async () => {
      mockFetch.mockResolvedValue(createMockResponse({
        status: 'healthy',
        issues: []
      }))

      render(<HealthStatusDashboard />)

      // Initial load
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2)
      })

      // Fast forward 2 minutes
      jest.advanceTimersByTime(120000)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(4) // 2 initial + 2 refresh
      })
    })

    it('should clear interval on component unmount', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval')

      const { unmount } = render(<HealthStatusDashboard />)
      
      unmount()

      expect(clearIntervalSpy).toHaveBeenCalled()
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })
})