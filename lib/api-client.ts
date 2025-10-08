/**
 * API Client for Hotdog Diaries Admin Interface
 * Provides type-safe access to consolidated admin API endpoints
 */

import { NextResponse } from 'next/server'

// Types for API responses
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  code?: string
  timestamp?: string
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

// Dashboard data types
export interface DashboardData {
  queueStats: {
    totalApproved: number
    daysOfContent: number
    needsScanning: boolean
    contentBalance: {
      video: number
      gif: number
      image: number
      text: number
    }
  }
  postingSchedule: {
    todaysPosts: number
    nextPost: Date | null
    upcomingPosts: Array<{
      time: string
      content: ContentItem | null
      type: string
      platform: string
    }>
  }
  platformStatus: Record<string, {
    operational: boolean
    itemCount: number
    lastScan: Date | null
    status: string
  }>
  apiSavings: {
    callsSavedToday: number
    estimatedMonthlySavings: number
    nextScanDate: Date | null
  }
  alerts: Array<{
    type: 'critical' | 'warning' | 'info'
    message: string
    action?: string
  }>
}

// Content types
export interface ContentItem {
  id: number
  source_platform: string
  content_text: string | null
  content_image_url: string | null
  content_video_url: string | null
  content_type: string
  is_approved: boolean
  is_posted: boolean
  confidence_score: number
  created_at: string
  updated_at: string
  admin_notes?: string
}

// Auth types
export interface LoginCredentials {
  username: string
  password: string
}

export interface AuthResult {
  user: {
    id: number
    username: string
    email: string
    lastLogin?: string
  }
  tokens: {
    accessToken: string
    refreshToken: string
  }
  expiresAt: string
}

// Platform scanning types
export interface ScanRequest {
  platform: 'reddit' | 'youtube' | 'bluesky' | 'imgur' | 'lemmy' | 'tumblr' | 'pixabay' | 'giphy' | 'all'
  maxPosts?: number
  options?: Record<string, any>
}

export interface ScanResult {
  platform: string
  totalFound: number
  processed: number
  approved: number
  rejected: number
  duplicates: number
  errors: string[]
  executionTime: number
}

// Health and metrics types
export interface SystemHealth {
  overallStatus: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  uptime: number
  checks: {
    database: { status: string; responseTime: number }
    apis: Record<string, { status: string; responseTime: number; quota?: number }>
    queue: { status: string; contentDays: number }
  }
}

// Schedule configuration types
export interface ScheduleConfig {
  id: number
  meal_times: string[]
  timezone: string
  is_enabled: boolean
  created_at: string
  updated_at: string
}

// Error handling
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Main API Client class
 */
export class AdminApiClient {
  private baseUrl: string
  private authToken: string | null = null

  constructor(baseUrl = '/api/admin') {
    this.baseUrl = baseUrl
    this.initializeAuthToken()
  }

  /**
   * Set authentication token for API calls
   */
  setAuthToken(token: string): void {
    this.authToken = token
    // Persist to localStorage for session management
    if (typeof window !== 'undefined') {
      localStorage.setItem('admin_auth_token', token)
    }
  }

  /**
   * Clear authentication token
   */
  clearAuthToken(): void {
    this.authToken = null
    // Remove from localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('admin_auth_token')
    }
  }

  /**
   * Initialize auth token from localStorage
   */
  private initializeAuthToken(): void {
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem('admin_auth_token')
      if (storedToken) {
        this.authToken = storedToken
      }
    }
  }

  /**
   * Get current auth token with fallback to localStorage
   */
  private getCurrentToken(): string | null {
    // First try instance token
    if (this.authToken) {
      return this.authToken
    }
    
    // Fallback to localStorage
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem('admin_auth_token')
      if (storedToken) {
        // Auto-sync instance token if found in localStorage
        this.authToken = storedToken
        return storedToken
      }
    }
    
    return null
  }

  /**
   * Make authenticated request
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers
    }

    // Add auth token if available (with fallback to localStorage)
    const currentToken = this.getCurrentToken()
    if (currentToken) {
      headers['Authorization'] = `Bearer ${currentToken}`
    }

    // 🔍 AdminAPI Request Diagnostics
    console.group(`[AdminAPI] ${options.method || 'GET'} ${endpoint}`)
    console.log('Full URL:', url)
    console.log('Instance token:', !!this.authToken)
    console.log('Current token (with fallback):', !!currentToken)
    console.log('Auth token length:', currentToken?.length ?? 0)
    console.log('Request headers:', {
      'Content-Type': headers['Content-Type'],
      'Authorization': currentToken ? `Bearer ${currentToken.substring(0, 20)}...` : 'None'
    })

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include' // Ensure cookies are sent for authentication
      })

      console.log('Response status:', response.status, response.statusText)
      console.log('Response headers:', Object.fromEntries(response.headers.entries()))

      const data = await response.json()
      
      console.log('Response body preview:', {
        success: data.success,
        hasData: !!data.data,
        error: data.error,
        dataKeys: data.data ? Object.keys(data.data) : null
      })
      console.groupEnd()

      if (!response.ok) {
        throw new ApiError(
          data.error || `HTTP ${response.status}`,
          response.status,
          data.code
        )
      }

      return data
    } catch (error) {
      console.error('Request failed:', error)
      console.groupEnd()
      
      if (error instanceof ApiError) {
        throw error
      }
      
      throw new ApiError(
        error instanceof Error ? error.message : 'Network error',
        0
      )
    }
  }

  // Authentication APIs
  async login(credentials: LoginCredentials): Promise<ApiResponse<AuthResult>> {
    return this.request<AuthResult>('/auth', {
      method: 'POST',
      body: JSON.stringify(credentials)
    })
  }

  async logout(): Promise<ApiResponse<void>> {
    return this.request<void>('/auth', {
      method: 'DELETE'
    })
  }

  async verifyToken(): Promise<ApiResponse<{ valid: boolean; user?: any }>> {
    return this.request<{ valid: boolean; user?: any }>('/auth')
  }

  // Dashboard APIs
  async getDashboard(): Promise<ApiResponse<DashboardData>> {
    return this.request<DashboardData>('/dashboard')
  }

  async refreshDashboard(): Promise<ApiResponse<DashboardData>> {
    return this.request<DashboardData>('/dashboard?refresh=true')
  }

  // Content Management APIs
  async getContent(params?: {
    page?: number
    limit?: number
    status?: 'pending' | 'approved' | 'scheduled' | 'rejected' | 'posted'
    platform?: string
    type?: string
  }): Promise<PaginatedResponse<ContentItem>> {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set('page', params.page.toString())
    if (params?.limit) searchParams.set('limit', params.limit.toString())
    if (params?.status) searchParams.set('status', params.status)
    if (params?.platform) searchParams.set('platform', params.platform)
    if (params?.type) searchParams.set('type', params.type)

    const query = searchParams.toString()
    return this.request<ContentItem[]>(`/content${query ? `?${query}` : ''}`)
  }

  async getContentById(id: number): Promise<ApiResponse<ContentItem>> {
    return this.request<ContentItem>(`/content/${id}`)
  }

  async updateContentStatus(
    id: number, 
    status: 'approved' | 'rejected' | 'scheduled' | 'posted',
    options?: {
      reason?: string
      notes?: string
      scheduledAt?: string
    }
  ): Promise<ApiResponse<ContentItem>> {
    return this.request<ContentItem>(`/content/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status,
        ...options
      })
    })
  }

  async deleteContent(id: number): Promise<ApiResponse<void>> {
    return this.request<void>(`/content/${id}`, {
      method: 'DELETE'
    })
  }

  async bulkUpdateContent(
    ids: number[],
    action: 'approve' | 'reject' | 'delete'
  ): Promise<ApiResponse<{ updated: number; failed: number }>> {
    return this.request<{ updated: number; failed: number }>('/content/bulk', {
      method: 'PATCH',
      body: JSON.stringify({
        ids,
        action
      })
    })
  }

  // Platform Scanning APIs
  async scanPlatform(request: ScanRequest): Promise<ApiResponse<ScanResult | ScanResult[]>> {
    return this.request<ScanResult | ScanResult[]>('/platforms/scan', {
      method: 'POST',
      body: JSON.stringify(request)
    })
  }

  async testPlatformConnection(platform: string): Promise<ApiResponse<{
    success: boolean
    message: string
    details?: any
  }>> {
    return this.request<{
      success: boolean
      message: string
      details?: any
    }>(`/platforms/${platform}/test-connection`)
  }

  async getPlatformStatus(): Promise<ApiResponse<Record<string, {
    operational: boolean
    itemCount: number
    lastScan: Date | null
    status: string
  }>>> {
    return this.request<Record<string, any>>('/platforms/status')
  }

  // System Health APIs
  async getSystemHealth(): Promise<ApiResponse<SystemHealth>> {
    return this.request<SystemHealth>('/health')
  }

  async runHealthCheck(): Promise<ApiResponse<SystemHealth>> {
    return this.request<SystemHealth>('/health', {
      method: 'POST'
    })
  }

  // Schedule Management APIs
  async getSchedule(): Promise<ApiResponse<{
    config: ScheduleConfig
    schedule: any
    queueStatus: any
    stats: any
  }>> {
    return this.request<any>('/schedule')
  }

  async updateSchedule(config: Partial<{
    meal_times: string[]
    timezone: string
    is_enabled: boolean
  }>): Promise<ApiResponse<ScheduleConfig>> {
    return this.request<ScheduleConfig>('/schedule', {
      method: 'PUT',
      body: JSON.stringify(config)
    })
  }

  // Metrics APIs
  async getMetrics(params?: {
    timeframe?: '24h' | '7d' | '30d'
    platform?: string
  }): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams()
    if (params?.timeframe) searchParams.set('timeframe', params.timeframe)
    if (params?.platform) searchParams.set('platform', params.platform)

    const query = searchParams.toString()
    return this.request<any>(`/metrics${query ? `?${query}` : ''}`)
  }

  // Admin User Management APIs
  async getUsers(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('/users')
  }

  async createUser(userData: {
    username: string
    email: string
    password: string
    full_name?: string
  }): Promise<ApiResponse<any>> {
    return this.request<any>('/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    })
  }

  async updateUser(id: number, userData: Partial<{
    email: string
    full_name: string
    is_active: boolean
  }>): Promise<ApiResponse<any>> {
    return this.request<any>(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(userData)
    })
  }

  async deleteUser(id: number): Promise<ApiResponse<void>> {
    return this.request<void>(`/users/${id}`, {
      method: 'DELETE'
    })
  }

  // Queue Management APIs
  async getQueueAnalytics(): Promise<ApiResponse<{
    contentDistribution: any
    platformBreakdown: any
    approvalStats: any
    projections: any
  }>> {
    return this.request<any>('/queue/analytics')
  }

  async optimizeQueue(): Promise<ApiResponse<{
    rebalanced: number
    message: string
  }>> {
    return this.request<any>('/queue/optimize', {
      method: 'POST'
    })
  }

  // Configuration APIs
  async getConfig(): Promise<ApiResponse<Record<string, any>>> {
    return this.request<Record<string, any>>('/config')
  }

  async updateConfig(config: Record<string, any>): Promise<ApiResponse<Record<string, any>>> {
    return this.request<Record<string, any>>('/config', {
      method: 'PUT',
      body: JSON.stringify(config)
    })
  }
}

// Export singleton instance
export const adminApi = new AdminApiClient()

// Helper functions for common patterns
export const ApiHelpers = {
  /**
   * Handle API errors with user-friendly messages
   */
  handleError(error: unknown): string {
    if (error instanceof ApiError) {
      switch (error.code) {
        case 'UNAUTHORIZED':
          return 'Please log in to continue'
        case 'FORBIDDEN':
          return 'You do not have permission to perform this action'
        case 'VALIDATION_ERROR':
          return error.message
        case 'RATE_LIMITED':
          return 'Too many requests. Please try again later'
        default:
          return error.message
      }
    }
    
    return error instanceof Error ? error.message : 'An unexpected error occurred'
  },

  /**
   * Retry API calls with exponential backoff
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    baseDelay = 1000
  ): Promise<T> {
    let lastError: Error

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
        
        if (attempt === maxRetries) {
          throw lastError
        }

        // Don't retry on client errors (4xx), only server errors (5xx) and network errors
        if (error instanceof ApiError && error.statusCode >= 400 && error.statusCode < 500) {
          throw error
        }

        // Exponential backoff
        const delay = baseDelay * Math.pow(2, attempt)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    throw lastError!
  },

  /**
   * Format API responses for UI display
   */
  formatResponse<T>(response: ApiResponse<T>): {
    success: boolean
    data?: T
    message: string
  } {
    return {
      success: response.success,
      data: response.data,
      message: response.message || (response.success ? 'Operation completed successfully' : response.error || 'Operation failed')
    }
  }
}