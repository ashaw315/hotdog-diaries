'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
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

  const isAuthenticated = user !== null

  // Clear error message
  const clearError = () => setError(null)

  // Initialize auth state on mount
  useEffect(() => {
    checkAuthStatus()
  }, [])

  // Check current authentication status
  const checkAuthStatus = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await adminApi.verifyToken()
      
      if (response.success && response.data?.valid && response.data?.user) {
        setUser(response.data.user)
      } else {
        setUser(null)
        adminApi.clearAuthToken()
      }
    } catch (error) {
      console.error('Auth status check failed:', error)
      setUser(null)
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
    throw new Error('useAuth must be used within an AuthProvider')
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