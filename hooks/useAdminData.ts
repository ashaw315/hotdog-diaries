'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { adminApi, DashboardData, ContentItem, SystemHealth, ApiHelpers, PaginatedResponse, ScanResult } from '@/lib/api-client'
import { useAuth } from '@/components/providers/AuthProvider'

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
  
  // Get auth context for authentication guard
  const authContext = useAuth()

  // Disable polling in CI environments and reduce frequency in production
  const isCI = process.env.NEXT_PUBLIC_CI === 'true'
  const isProd = process.env.NODE_ENV === 'production'
  const actualRefreshInterval = isCI ? 0 : (isProd ? 0 : refreshInterval)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      // 🔍 Authentication Guard
      if (!authContext.isAuthenticated || !authContext.token) {
        console.group('🔍 Dashboard Data Authentication Guard')
        console.log('Authentication status:', {
          isAuthenticated: authContext.isAuthenticated,
          hasToken: !!authContext.token,
          hasUser: !!authContext.user,
          isLoading: authContext.isLoading
        })
        console.log('⏸️ Waiting for authentication before API call')
        console.groupEnd()
        
        setLoading(false)
        return
      }
      
      // 🔍 Dashboard Data Diagnostics
      console.group('🔍 Dashboard Data Diagnostics')
      console.log('✅ Authentication confirmed, proceeding with API call')
      console.log('Auth context token present?', !!authContext.token)
      console.log('Auth context token length:', authContext.token?.length ?? 0)
      console.log('LocalStorage token present?', !!localStorage.getItem('admin_auth_token'))
      console.log('LocalStorage token length:', localStorage.getItem('admin_auth_token')?.length ?? 0)
      console.log('Environment:', { isCI, isProd: process.env.NODE_ENV === 'production' })
      console.log('Calling /admin/dashboard API...')
      
      const response = await adminApi.getDashboard()
      
      console.log('Dashboard API response:', response)
      console.log('Response success:', response.success)
      console.log('Response data present:', !!response.data)
      if (response.data) {
        console.log('Queue stats:', {
          totalApproved: response.data.queueStats?.totalApproved,
          daysOfContent: response.data.queueStats?.daysOfContent,
          needsScanning: response.data.queueStats?.needsScanning
        })
        console.log('Posting schedule:', {
          todaysPosts: response.data.postingSchedule?.todaysPosts,
          upcomingCount: response.data.postingSchedule?.upcomingPosts?.length
        })
      }
      console.groupEnd()
      
      if (response.success && response.data) {
        console.log("useDashboardData final:", response.data)
        setData(response.data)
      } else {
        throw new Error(response.error || 'Failed to fetch dashboard data')
      }
    } catch (err) {
      console.group('❌ Dashboard Data Error')
      console.error('Fetch error details:', err)
      if (err instanceof Error) {
        console.error('Error message:', err.message)
        console.error('Error stack:', err.stack)
      }
      console.groupEnd()
      
      const errorMessage = ApiHelpers.handleError(err)
      setError(errorMessage)
      if (!isCI) {
        console.error('Dashboard fetch error:', err)
      }
    } finally {
      setLoading(false)
    }
  }, [isCI, authContext.isAuthenticated, authContext.token])

  const refresh = useCallback(() => fetchData(), [fetchData])

  useEffect(() => {
    // Only start fetching data when authentication is confirmed
    if (authContext.isAuthenticated && authContext.token) {
      fetchData()

      // Set up refresh interval (disabled in CI)
      if (actualRefreshInterval > 0) {
        intervalRef.current = setInterval(fetchData, actualRefreshInterval)
        if (!isCI) {
          console.log(`🔄 Dashboard auto-refresh enabled: ${actualRefreshInterval}ms`)
        }
      } else if (isCI) {
        console.log('🧪 [CI] Dashboard auto-refresh disabled for CI environment')
      } else if (isProd) {
        console.log('🚀 [PROD] Dashboard auto-refresh disabled for production environment')
      }
    } else {
      console.log('⏸️ Dashboard data fetch deferred until authentication completes')
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [fetchData, actualRefreshInterval, isCI, authContext.isAuthenticated, authContext.token])

  return { data, loading, error, refresh }
}

// Content management hook
export function useContentData(params?: {
  page?: number
  limit?: number
  status?: 'pending' | 'approved' | 'scheduled' | 'rejected' | 'posted'
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
      
      // 🧩 Diagnostic logging for queue data flow
      console.group('🧩 [Queue Data Flow] useContentData fetchData')
      console.log('Request params:', params)
      
      const response = await adminApi.getContent(params) as PaginatedResponse<ContentItem>
      
      console.log('Raw API response:', response)
      console.log('Response success:', response.success)
      console.log('Response data structure:', {
        hasData: !!response.data,
        dataType: typeof response.data,
        isArray: Array.isArray(response.data),
        hasNestedContent: response.data && typeof response.data === 'object' && 'content' in response.data,
        dataKeys: response.data && typeof response.data === 'object' ? Object.keys(response.data) : null
      })
      
      if (response.success && response.data) {
        // 🧠 Fix: Handle both flattened and nested API response structures
        const contentData = Array.isArray(response.data)
          ? response.data
          : response.data?.content || []
        const paginationData = response.data?.pagination || response.pagination

        console.log('Extracted content data:', {
          contentLength: contentData.length,
          firstItem: contentData[0],
          pagination: paginationData
        })
        console.log('✅ useContentData loaded items:', contentData.length)
        
        setData(contentData)
        setPagination(paginationData)
        console.groupEnd()
      } else {
        console.warn('⚠️ useContentData: No data received', response)
        console.groupEnd()
        throw new Error(response.error || 'Failed to fetch content data')
      }
    } catch (err) {
      console.group('❌ useContentData Error')
      console.error('Fetch error details:', err)
      console.groupEnd()
      
      const errorMessage = ApiHelpers.handleError(err)
      setError(errorMessage)
      console.error('Content fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [params?.page, params?.limit, params?.status, params?.platform, params?.type])

  const refresh = useCallback(() => fetchData(), [fetchData])

  // Client-side fallback sorting for scheduled content
  useEffect(() => {
    if (params?.status === 'scheduled' && data?.length > 0) {
      console.log('🧩 [useContentData] Applying client-side chronological sorting for scheduled content')
      const sorted = [...data].sort((a, b) => {
        const timeA = a.scheduled_post_time || a.scheduled_for
        const timeB = b.scheduled_post_time || b.scheduled_for
        
        if (!timeA && !timeB) return 0
        if (!timeA) return 1
        if (!timeB) return -1
        
        return new Date(timeA).getTime() - new Date(timeB).getTime()
      })
      
      // Only update if order actually changed to avoid infinite loops
      const orderChanged = sorted.some((item, index) => item.id !== data[index]?.id)
      if (orderChanged) {
        console.log('🧩 [useContentData] Sorted order changed, updating data')
        setData(sorted)
      }
    }
  }, [params?.status, data])

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

  // Auto-refresh if enabled (disabled in CI and production)
  useEffect(() => {
    const isCI = process.env.NEXT_PUBLIC_CI === 'true'
    const isProd = process.env.NODE_ENV === 'production'
    
    if (params?.autoRefresh && !isCI && !isProd) {
      const interval = setInterval(refresh, 30000) // 30 seconds
      console.log('🔄 Content auto-refresh enabled: 30s interval')
      return () => clearInterval(interval)
    } else if (params?.autoRefresh && isCI) {
      console.log('🧪 [CI] Content auto-refresh disabled for CI environment')
    } else if (params?.autoRefresh && isProd) {
      console.log('🚀 [PROD] Content auto-refresh disabled for production environment')
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

  // Auto-refresh if enabled (disabled in CI and production)
  useEffect(() => {
    const isCI = process.env.NEXT_PUBLIC_CI === 'true'
    const isProd = process.env.NODE_ENV === 'production'
    
    if (autoRefresh && !isCI && !isProd) {
      const interval = setInterval(refresh, 60000) // 1 minute
      console.log('🔄 System health auto-refresh enabled: 60s interval')
      return () => clearInterval(interval)
    } else if (autoRefresh && isCI) {
      console.log('🧪 [CI] System health auto-refresh disabled for CI environment')
    } else if (autoRefresh && isProd) {
      console.log('🚀 [PROD] System health auto-refresh disabled for production environment')
    }
  }, [autoRefresh, refresh])

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