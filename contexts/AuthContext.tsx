'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export interface User {
  id: number
  username: string
  email?: string
  full_name?: string
  last_login_at?: Date
}

export interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
}

export interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false
  })
  
  const router = useRouter()
  const searchParams = useSearchParams()

  /**
   * Fetch current user from API
   */
  const fetchCurrentUser = async (): Promise<User | null> => {
    try {
      const response = await fetch('/api/admin/me', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const result = await response.json()
        return result.data
      }
      
      return null
    } catch (error) {
      console.error('Failed to fetch current user:', error)
      return null
    }
  }

  /**
   * Initialize auth state
   */
  const initializeAuth = async () => {
    setState(prev => ({ ...prev, isLoading: true }))
    
    try {
      const user = await fetchCurrentUser()
      
      setState({
        user,
        isLoading: false,
        isAuthenticated: !!user
      })
    } catch (error) {
      console.error('Auth initialization failed:', error)
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false
      })
    }
  }

  /**
   * Login function
   */
  const login = async (username: string, password: string): Promise<void> => {
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Login failed')
      }

      // Update auth state
      setState({
        user: result.data.user,
        isLoading: false,
        isAuthenticated: true
      })

      // Redirect after successful login
      const redirectTo = searchParams.get('from') || '/admin'
      router.push(redirectTo)
      
    } catch (error) {
      console.error('Login failed:', error)
      throw error
    }
  }

  /**
   * Logout function
   */
  const logout = async (): Promise<void> => {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })
    } catch (error) {
      console.error('Logout request failed:', error)
    } finally {
      // Always clear local state regardless of API call success
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false
      })
      
      // Redirect to login page
      router.push('/admin/login')
    }
  }

  /**
   * Refresh user data
   */
  const refreshUser = async (): Promise<void> => {
    const user = await fetchCurrentUser()
    
    setState(prev => ({
      ...prev,
      user,
      isAuthenticated: !!user
    }))
  }

  /**
   * Handle token refresh
   */
  const handleTokenRefresh = async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/admin/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        // Token refreshed successfully, fetch updated user info
        await refreshUser()
        return true
      }
      
      return false
    } catch (error) {
      console.error('Token refresh failed:', error)
      return false
    }
  }

  /**
   * Setup automatic token refresh
   */
  useEffect(() => {
    let refreshInterval: NodeJS.Timeout

    if (state.isAuthenticated) {
      // Refresh token every 23 hours (1 hour before expiry)
      refreshInterval = setInterval(() => {
        handleTokenRefresh()
      }, 23 * 60 * 60 * 1000)
    }

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval)
      }
    }
  }, [state.isAuthenticated])

  /**
   * Handle API responses with 401 status
   */
  useEffect(() => {
    const handleUnauthorized = async () => {
      // Try to refresh token first
      const refreshSuccess = await handleTokenRefresh()
      
      if (!refreshSuccess) {
        // Refresh failed, log out user
        setState({
          user: null,
          isLoading: false,
          isAuthenticated: false
        })
        
        // Only redirect if we're not already on the login page
        if (window.location.pathname !== '/admin/login') {
          router.push('/admin/login')
        }
      }
    }

    // Listen for 401 responses from fetch requests
    const originalFetch = window.fetch
    window.fetch = async (...args) => {
      const response = await originalFetch(...args)
      
      if (response.status === 401 && state.isAuthenticated) {
        await handleUnauthorized()
      }
      
      return response
    }

    return () => {
      window.fetch = originalFetch
    }
  }, [state.isAuthenticated, router])

  /**
   * Initialize auth on mount
   */
  useEffect(() => {
    initializeAuth()
  }, [])

  const contextValue: AuthContextType = {
    ...state,
    login,
    logout,
    refreshUser
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * Hook to use auth context
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  
  return context
}

/**
 * Hook to require authentication
 */
export function useRequireAuth(): AuthContextType {
  const auth = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      router.push('/admin/login')
    }
  }, [auth.isLoading, auth.isAuthenticated, router])

  return auth
}

/**
 * Hook to redirect authenticated users
 */
export function useRedirectIfAuthenticated(redirectTo: string = '/admin'): AuthContextType {
  const auth = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!auth.isLoading && auth.isAuthenticated) {
      router.push(redirectTo)
    }
  }, [auth.isLoading, auth.isAuthenticated, router, redirectTo])

  return auth
}