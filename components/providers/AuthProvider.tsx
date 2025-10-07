'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react'
import { adminApi, AdminApiClient, AuthResult, ApiHelpers } from '@/lib/api-client'

// Auth context types
interface User {
  id: number
  username: string
  email: string
  lastLogin?: string
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  token: string | null
  login: (username: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  clearError: () => void
  refreshAuth: () => Promise<void>
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Auth provider props
interface AuthProviderProps {
  children: ReactNode
}

// Auth provider component
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  
  // Prevent double mount with useRef guard
  const isInitialized = useRef(false)

  const isAuthenticated = user !== null && token !== null

  // Clear error message
  const clearError = () => setError(null)

  // Token rehydration helper
  const rehydrateToken = useCallback(() => {
    if (typeof window === 'undefined') return null
    
    // Try localStorage first
    let storedToken = localStorage.getItem('admin_auth_token')
    
    // If not found, try cookies as fallback
    if (!storedToken) {
      const cookies = document.cookie.split(';')
      const authCookie = cookies.find(cookie => cookie.trim().startsWith('admin_auth_token='))
      if (authCookie) {
        storedToken = authCookie.split('=')[1]
        // Sync back to localStorage
        localStorage.setItem('admin_auth_token', storedToken)
      }
    }
    
    return storedToken
  }, [])

  // Initialize auth state on mount
  useEffect(() => {
    // Prevent double initialization with useRef guard
    if (isInitialized.current) {
      console.log('⏸️ AuthProvider already initialized, skipping to prevent double mount')
      return
    }
    
    console.log('🏗️ [AuthProvider] First initialization starting...')
    isInitialized.current = true
    
    // 🔍 AuthProvider Mount Diagnostics & Token Rehydration
    const storedToken = rehydrateToken()
    console.group('🔍 AuthProvider Mount Diagnostics & Token Rehydration')
    console.log('Window available:', typeof window !== 'undefined')
    console.log('Token found after rehydration?', !!storedToken)
    console.log('Token length:', storedToken?.length ?? 0)
    console.log('Token preview:', storedToken ? `${storedToken.substring(0, 20)}...` : 'None')
    
    // Immediately set token state if found
    if (storedToken) {
      setToken(storedToken)
      // Also ensure adminApi has the token
      adminApi.setAuthToken(storedToken)
      console.log('✅ Token immediately set in state and adminApi after rehydration')
    } else {
      console.log('❌ No token found after rehydration, will need authentication')
    }
    console.groupEnd()
    
    checkAuthStatus()
  }, [rehydrateToken])

  // Rehydrate token on visibility change (useful for SSR scenarios)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && !token) {
        console.log('🔄 Page became visible, attempting token rehydration...')
        const rehydratedToken = rehydrateToken()
        if (rehydratedToken) {
          setToken(rehydratedToken)
          adminApi.setAuthToken(rehydratedToken)
          console.log('✅ Token rehydrated on visibility change')
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [token, rehydrateToken])

  // Check current authentication status
  const checkAuthStatus = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      console.group('🔍 AuthProvider Token Verification')
      console.log('Starting auth verification...')
      
      const response = await adminApi.verifyToken()
      
      console.log('Verify token response:', {
        success: response.success,
        valid: response.data?.valid,
        hasUser: !!response.data?.user,
        error: response.error
      })
      
      if (response.success && response.data?.valid && response.data?.user) {
        console.log('✅ Authentication valid, setting user:', response.data.user.username)
        setUser(response.data.user)
        // Ensure token is synced if not already set
        const currentToken = localStorage.getItem('admin_auth_token')
        if (currentToken && !token) {
          setToken(currentToken)
          adminApi.setAuthToken(currentToken)
        }
      } else {
        console.log('❌ Authentication invalid, clearing token')
        setUser(null)
        setToken(null)
        adminApi.clearAuthToken()
      }
      console.groupEnd()
    } catch (error) {
      console.group('❌ AuthProvider Token Verification Error')
      console.error('Auth status check failed:', error)
      console.groupEnd()
      
      setUser(null)
      setToken(null)
      adminApi.clearAuthToken()
      // Don't set error for initial auth check to avoid showing error on load
    } finally {
      setIsLoading(false)
    }
  }

  // Login function
  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await adminApi.login({ username, password })

      if (response.success && response.data) {
        // Set the auth token for future requests
        adminApi.setAuthToken(response.data.tokens.accessToken)
        
        // Set token state
        setToken(response.data.tokens.accessToken)
        
        // Set user data
        setUser(response.data.user)
        
        return true
      } else {
        setError(response.error || 'Login failed')
        return false
      }
    } catch (error) {
      const errorMessage = ApiHelpers.handleError(error)
      setError(errorMessage)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  // Logout function
  const logout = async (): Promise<void> => {
    try {
      setIsLoading(true)
      
      // Call logout endpoint to invalidate tokens
      await adminApi.logout()
    } catch (error) {
      // Continue with logout even if API call fails
      console.error('Logout API call failed:', error)
    } finally {
      // Clear local state regardless of API call result
      setUser(null)
      setToken(null)
      adminApi.clearAuthToken()
      setError(null)
      setIsLoading(false)
      
      // Redirect to login page
      window.location.href = '/admin/login'
    }
  }

  // Refresh authentication
  const refreshAuth = async (): Promise<void> => {
    await checkAuthStatus()
  }

  // Context value
  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    error,
    token,
    login,
    logout,
    clearError,
    refreshAuth
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Hook to use auth context
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  
  if (context === undefined) {
    // Enhanced defensive error logging
    console.group('❌ useAuth Context Boundary Error')
    console.error('useAuth was called outside of an AuthProvider')
    console.error('Current component stack:', new Error().stack)
    console.error('Ensure the component is wrapped in <AuthProvider>')
    console.groupEnd()
    
    throw new Error('useAuth must be used within an AuthProvider. Check that your component is wrapped in <AuthProvider> and imported from @/components/providers/AuthProvider')
  }
  
  return context
}

// Hook to require authentication
export function useRequireAuth(): AuthContextType {
  const auth = useAuth()
  
  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      // Redirect to login if not authenticated
      window.location.href = '/admin/login'
    }
  }, [auth.isLoading, auth.isAuthenticated])

  return auth
}

// Hook to redirect authenticated users (used on login page)
export function useRedirectIfAuthenticated(redirectTo: string = '/admin'): AuthContextType {
  const auth = useAuth()
  
  useEffect(() => {
    if (!auth.isLoading && auth.isAuthenticated) {
      // Redirect authenticated users away from login page
      window.location.href = redirectTo
    }
  }, [auth.isLoading, auth.isAuthenticated, redirectTo])

  return auth
}

// Higher-order component to protect routes
export function withAuth<P extends object>(Component: React.ComponentType<P>) {
  return function AuthenticatedComponent(props: P) {
    const auth = useRequireAuth()

    if (auth.isLoading) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      )
    }

    if (!auth.isAuthenticated) {
      return null // Will redirect to login
    }

    return <Component {...props} />
  }
}

// Auth guard component
interface AuthGuardProps {
  children: ReactNode
  fallback?: ReactNode
}

export function AuthGuard({ children, fallback }: AuthGuardProps) {
  const auth = useAuth()

  if (auth.isLoading) {
    return fallback || (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!auth.isAuthenticated) {
    return null // Will redirect to login via useRequireAuth
  }

  return <>{children}</>
}