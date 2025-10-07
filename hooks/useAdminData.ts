'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { adminApi, DashboardData, ContentItem, SystemHealth, ApiHelpers, PaginatedResponse, ScanResult } from '@/lib/api-client'

// Generic hook state interface
interface UseAsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

// Dashboard data hook
export function useDashboardData(refreshInterval = 5 * 60 * 1000): UseAsyncState<DashboardData> {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<NodeJS.Timeout>()

  // Disable polling in CI environments
  const isCI = process.env.NEXT_PUBLIC_CI === 'true'
  const actualRefreshInterval = isCI ? 0 : refreshInterval

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await adminApi.getDashboard()
      
      if (response.success && response.data) {
        setData(response.data)
      } else {
        throw new Error(response.error || 'Failed to fetch dashboard data')
      }
    } catch (err) {
      const errorMessage = ApiHelpers.handleError(err)
      setError(errorMessage)
      if (!isCI) {
        console.error('Dashboard fetch error:', err)
      }
    } finally {
      setLoading(false)
    }
  }, [isCI])

  const refresh = useCallback(() => fetchData(), [fetchData])

  useEffect(() => {
    fetchData()

    // Set up refresh interval (disabled in CI)
    if (actualRefreshInterval > 0) {
      intervalRef.current = setInterval(fetchData, actualRefreshInterval)
      if (!isCI) {
        console.log(`🔄 Dashboard auto-refresh enabled: ${actualRefreshInterval}ms`)
      }
    } else if (isCI) {
      console.log('🧪 [CI] Dashboard auto-refresh disabled for CI environment')
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [fetchData, actualRefreshInterval, isCI])

  return { data, loading, error, refresh }
}

// Content management hook
export function useContentData(params?: {
  page?: number
  limit?: number
  status?: 'pending' | 'approved' | 'rejected' | 'posted'
  platform?: string
  type?: string
  autoRefresh?: boolean
}) {
  const [data, setData] = useState<ContentItem[]>([])
  const [pagination, setPagination] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await adminApi.getContent(params) as PaginatedResponse<ContentItem>
      
      if (response.success && response.data) {
        setData(response.data)
        setPagination(response.pagination)
      } else {
        throw new Error(response.error || 'Failed to fetch content data')
      }
    } catch (err) {
      const errorMessage = ApiHelpers.handleError(err)
      setError(errorMessage)
      console.error('Content fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [params?.page, params?.limit, params?.status, params?.platform, params?.type])

  const refresh = useCallback(() => fetchData(), [fetchData])

  // Update content status
  const updateContentStatus = useCallback(async (
    id: number, 
    status: 'approved' | 'rejected' | 'scheduled' | 'posted',
    options?: { reason?: string; notes?: string; scheduledAt?: string }
  ) => {
    try {
      const response = await adminApi.updateContentStatus(id, status, options)
      
      if (response.success && response.data) {
        // Update local data
        setData(prevData => 
          prevData.map(item => 
            item.id === id ? response.data! : item
          )
        )
        return true
      } else {
        throw new Error(response.error || 'Failed to update content status')
      }
    } catch (err) {
      const errorMessage = ApiHelpers.handleError(err)
      setError(errorMessage)
      return false
    }
  }, [])

  // Bulk update content
  const bulkUpdate = useCallback(async (
    ids: number[],
    action: 'approve' | 'reject' | 'delete'
  ) => {
    try {
      const response = await adminApi.bulkUpdateContent(ids, action)
      
      if (response.success) {
        // Refresh data after bulk operation
        await refresh()
        return response.data
      } else {
        throw new Error(response.error || 'Bulk update failed')
      }
    } catch (err) {
      const errorMessage = ApiHelpers.handleError(err)
      setError(errorMessage)
      return null
    }
  }, [refresh])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Auto-refresh if enabled (disabled in CI)
  useEffect(() => {
    const isCI = process.env.NEXT_PUBLIC_CI === 'true'
    
    if (params?.autoRefresh && !isCI) {
      const interval = setInterval(refresh, 30000) // 30 seconds
      console.log('🔄 Content auto-refresh enabled: 30s interval')
      return () => clearInterval(interval)
    } else if (params?.autoRefresh && isCI) {
      console.log('🧪 [CI] Content auto-refresh disabled for CI environment')
    }
  }, [params?.autoRefresh, refresh])

  return { 
    data, 
    pagination, 
    loading, 
    error, 
    refresh, 
    updateContentStatus, 
    bulkUpdate 
  }
}

// Platform status hook
export function usePlatformStatus() {
  const [data, setData] = useState<Record<string, any> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await adminApi.getPlatformStatus()
      
      if (response.success && response.data) {
        setData(response.data)
      } else {
        throw new Error(response.error || 'Failed to fetch platform status')
      }
    } catch (err) {
      const errorMessage = ApiHelpers.handleError(err)
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [])

  const refresh = useCallback(() => fetchData(), [fetchData])

  // Test platform connection
  const testConnection = useCallback(async (platform: string) => {
    try {
      const response = await adminApi.testPlatformConnection(platform)
      return response.success ? response.data : null
    } catch (err) {
      console.error(`Platform ${platform} connection test failed:`, err)
      return null
    }
  }, [])

  // Trigger platform scan
  const scanPlatform = useCallback(async (
    platform: string, 
    maxPosts = 25, 
    options?: Record<string, any>
  ) => {
    try {
      setError(null)
      const response = await adminApi.scanPlatform({
        platform: platform as any,
        maxPosts,
        options
      })
      
      if (response.success) {
        // Refresh platform status after scan
        await refresh()
        return response.data as ScanResult | ScanResult[]
      } else {
        throw new Error(response.error || 'Scan failed')
      }
    } catch (err) {
      const errorMessage = ApiHelpers.handleError(err)
      setError(errorMessage)
      return null
    }
  }, [refresh])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { 
    data, 
    loading, 
    error, 
    refresh, 
    testConnection, 
    scanPlatform 
  }
}

// System health hook
export function useSystemHealth(autoRefresh = false) {
  const [data, setData] = useState<SystemHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await adminApi.getSystemHealth()
      
      if (response.success && response.data) {
        setData(response.data)
      } else {
        throw new Error(response.error || 'Failed to fetch system health')
      }
    } catch (err) {
      const errorMessage = ApiHelpers.handleError(err)
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [])

  const refresh = useCallback(() => fetchData(), [fetchData])

  // Run health check
  const runHealthCheck = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await adminApi.runHealthCheck()
      
      if (response.success && response.data) {
        setData(response.data)
        return response.data
      } else {
        throw new Error(response.error || 'Health check failed')
      }
    } catch (err) {
      const errorMessage = ApiHelpers.handleError(err)
      setError(errorMessage)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Auto-refresh if enabled (disabled in CI)
  useEffect(() => {
    const isCI = process.env.NEXT_PUBLIC_CI === 'true'
    
    if (autoRefresh && !isCI) {
      const interval = setInterval(refresh, 60000) // 1 minute
      console.log('🔄 System health auto-refresh enabled: 60s interval')
      return () => clearInterval(interval)
    } else if (autoRefresh && isCI) {
      console.log('🧪 [CI] System health auto-refresh disabled for CI environment')
    }
  }, [autoRefresh, refresh, isCI])

  return { 
    data, 
    loading, 
    error, 
    refresh, 
    runHealthCheck 
  }
}

// Schedule management hook
export function useScheduleData() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await adminApi.getSchedule()
      
      if (response.success && response.data) {
        setData(response.data)
      } else {
        throw new Error(response.error || 'Failed to fetch schedule data')
      }
    } catch (err) {
      const errorMessage = ApiHelpers.handleError(err)
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [])

  const refresh = useCallback(() => fetchData(), [fetchData])

  // Update schedule configuration
  const updateSchedule = useCallback(async (config: Partial<{
    meal_times: string[]
    timezone: string
    is_enabled: boolean
  }>) => {
    try {
      const response = await adminApi.updateSchedule(config)
      
      if (response.success && response.data) {
        // Update local data
        setData((prevData: any) => ({
          ...prevData,
          config: response.data
        }))
        return true
      } else {
        throw new Error(response.error || 'Failed to update schedule')
      }
    } catch (err) {
      const errorMessage = ApiHelpers.handleError(err)
      setError(errorMessage)
      return false
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { 
    data, 
    loading, 
    error, 
    refresh, 
    updateSchedule 
  }
}

// Queue analytics hook
export function useQueueAnalytics() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await adminApi.getQueueAnalytics()
      
      if (response.success && response.data) {
        setData(response.data)
      } else {
        throw new Error(response.error || 'Failed to fetch queue analytics')
      }
    } catch (err) {
      const errorMessage = ApiHelpers.handleError(err)
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [])

  const refresh = useCallback(() => fetchData(), [fetchData])

  // Optimize queue
  const optimizeQueue = useCallback(async () => {
    try {
      const response = await adminApi.optimizeQueue()
      
      if (response.success) {
        // Refresh data after optimization
        await refresh()
        return response.data
      } else {
        throw new Error(response.error || 'Queue optimization failed')
      }
    } catch (err) {
      const errorMessage = ApiHelpers.handleError(err)
      setError(errorMessage)
      return null
    }
  }, [refresh])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { 
    data, 
    loading, 
    error, 
    refresh, 
    optimizeQueue 
  }
}

// Metrics hook
export function useMetrics(params?: {
  timeframe?: '24h' | '7d' | '30d'
  platform?: string
}) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await adminApi.getMetrics(params)
      
      if (response.success && response.data) {
        setData(response.data)
      } else {
        throw new Error(response.error || 'Failed to fetch metrics')
      }
    } catch (err) {
      const errorMessage = ApiHelpers.handleError(err)
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [params?.timeframe, params?.platform])

  const refresh = useCallback(() => fetchData(), [fetchData])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { 
    data, 
    loading, 
    error, 
    refresh 
  }
}

// Generic mutation hook for actions
export function useMutation<T, P>(
  mutationFn: (params: P) => Promise<T>,
  options?: {
    onSuccess?: (data: T) => void
    onError?: (error: string) => void
  }
) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mutate = useCallback(async (params: P): Promise<T | null> => {
    try {
      setLoading(true)
      setError(null)
      
      const result = await mutationFn(params)
      
      options?.onSuccess?.(result)
      return result
    } catch (err) {
      const errorMessage = ApiHelpers.handleError(err)
      setError(errorMessage)
      options?.onError?.(errorMessage)
      return null
    } finally {
      setLoading(false)
    }
  }, [mutationFn, options])

  const reset = useCallback(() => {
    setError(null)
    setLoading(false)
  }, [])

  return { mutate, loading, error, reset }
}