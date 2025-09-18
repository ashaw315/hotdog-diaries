'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

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
  console.log('🏗️ [AuthContext] AuthProvider component mounting/re-mounting at:', new Date().toISOString())
  
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true) // Always start with loading true
  const [initialized, setInitialized] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  
  console.log('🏗️ [AuthContext] Initial state set - user:', user, 'isLoading:', isLoading)

  // Simple fetch current user
  const fetchCurrentUser = async (): Promise<User | null> => {
    console.log('🌐 [AuthContext] fetchCurrentUser called - making API request to /api/admin/me')
    
    // Log current cookies state
    if (typeof window !== 'undefined') {
      console.log('🍪 [AuthContext] Current browser cookies:', document.cookie)
    }
    
    try {
      // Use absolute URL for fetch to work in all contexts
      const baseUrl = typeof window !== 'undefined' 
        ? window.location.origin 
        : 'http://localhost:3000'
      const fullUrl = `${baseUrl}/api/admin/me`
      
      console.log('🌐 [AuthContext] Fetching from URL:', fullUrl)
      
      // Don't need Authorization header since we use httpOnly cookies
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      }

      const response = await fetch(fullUrl, {
        method: 'GET',
        credentials: 'include',
        headers
      })

      console.log('🌐 [AuthContext] /api/admin/me response status:', response.status)
      console.log('🌐 [AuthContext] Response headers:', Object.fromEntries(response.headers.entries()))

      if (response.ok) {
        const result = await response.json()
        console.log('✅ [AuthContext] User data received:', result.data?.username || 'Unknown')
        console.log('✅ [AuthContext] Full response data:', result)
        return result.data || null
      }
      
      console.log('❌ [AuthContext] /api/admin/me failed with status:', response.status)
      
      // Log response body for failed requests
      try {
        const errorData = await response.json()
        console.log('❌ [AuthContext] Error response data:', errorData)
      } catch (e) {
        console.log('❌ [AuthContext] Could not parse error response')
      }
      
      return null
    } catch (error) {
      console.error('❌ [AuthContext] Failed to fetch user:', error)
      return null
    }
  }

  // Handle client-side mounting to prevent hydration mismatch
  useEffect(() => {
    console.log('🔄 [AuthContext] Client mount useEffect triggered')
    setIsMounted(true)
  }, [])

  // Initialize auth on client-side only, with smart retry logic
  useEffect(() => {
    console.log('🔄 [AuthContext] Auth initialization useEffect triggered')
    console.log('🔄 [AuthContext] Current state:', { 
      isMounted, 
      initialized, 
      isLoading, 
      hasUser: !!user,
      pathname 
    })
    
    // Only run on client-side after mounting
    if (!isMounted) {
      console.log('🔄 [AuthContext] Not mounted yet, skipping initialization')
      return
    }

    // Skip initialization for non-admin paths
    if (!pathname.startsWith('/admin')) {
      console.log('🔄 [AuthContext] Not on admin path, skipping initialization')
      // Reset state for non-admin paths only if we're currently initialized
      if (initialized) {
        setInitialized(false)
        setUser(null)
        setIsLoading(false)
      }
      return
    }

    // CRITICAL: If we already have a user, don't re-initialize EVER
    if (user) {
      console.log('🔄 [AuthContext] User already exists, skipping all initialization to prevent race condition')
      setIsLoading(false) // Ensure loading is false
      return
    }

    // CRITICAL: If we're already in process of initializing, don't start again
    if (initialized && isLoading) {
      console.log('🔄 [AuthContext] Already initializing, skipping to prevent concurrent calls')
      return
    }

    // SMART: Only skip re-initialization if we're not on login page and already tried
    if (initialized && !user && !pathname.includes('/admin/login')) {
      console.log('🔄 [AuthContext] Already initialized and no user found (not on login page), skipping re-initialization to prevent loops')
      setIsLoading(false) // Ensure we're not stuck in loading state
      return
    }
    
    console.log('🔄 [AuthContext] Starting auth initialization - fresh initialization needed')
    setInitialized(true)
    setIsLoading(true)
    
    fetchCurrentUser().then(userData => {
      console.log('🔄 [AuthContext] fetchCurrentUser completed, setting user:', userData ? `User found: ${userData.username}` : 'No user')
      setUser(userData)
      setIsLoading(false)
      console.log('🔄 [AuthContext] State updated - isLoading set to false, isAuthenticated:', !!userData)
    }).catch(error => {
      console.error('🔄 [AuthContext] fetchCurrentUser error:', error)
      setUser(null)
      setIsLoading(false)
      console.log('🔄 [AuthContext] Error - State updated - isLoading set to false, isAuthenticated: false')
    })
    
  }, [isMounted, pathname]) // CRITICAL: Only re-run on mount or pathname change

  // Login function
  const login = async (username: string, password: string): Promise<void> => {
    console.log('🔐 [AuthContext] Login function called')
    try {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      })

      const result = await response.json()
      console.log('🔐 [AuthContext] Login API response status:', response.status)

      if (!response.ok) {
        throw new Error(result.error || 'Login failed')
      }

      console.log('✅ [AuthContext] Login successful, user:', result.data.user.username)
      
      // Update local state immediately
      setUser(result.data.user)
      setInitialized(true) // Mark as initialized with user
      setIsLoading(false) // Stop loading state
      
      // Get redirect URL from query params or default to /admin
      const redirectTo = searchParams.get('from') || '/admin'
      console.log('🔀 [AuthContext] About to redirect to:', redirectTo)
      
      // Small delay to ensure state is updated before redirect
      setTimeout(() => {
        // Use replace instead of push to avoid back button issues
        router.replace(redirectTo)
      }, 100)
      
    } catch (error) {
      console.error('❌ [AuthContext] Login failed:', error)
      throw error
    }
  }

  // Logout function
  const logout = async (): Promise<void> => {
    console.log('🚪 [AuthContext] Logout function called')
    try {
      await fetch('/api/admin/auth', {
        method: 'DELETE',
        credentials: 'include'
      })
    } catch (error) {
      console.error('Logout failed:', error)
    } finally {
      console.log('🚪 [AuthContext] Clearing user state and resetting ALL flags for fresh login')
      setUser(null)
      setInitialized(false) // Reset initialization so auth can be re-initialized after logout
      setIsLoading(false)
      
      // Force a clean state before redirect
      setTimeout(() => {
        router.push('/admin/login')
      }, 100)
    }
  }

  // Refresh user data
  const refreshUser = async (): Promise<void> => {
    const userData = await fetchCurrentUser()
    setUser(userData)
  }

  const contextValue: AuthContextType = {
    user: isMounted ? user : null, // Prevent hydration mismatch by ensuring server/client consistency
    isLoading: isMounted ? isLoading : true, // Always loading on server-side
    isAuthenticated: isMounted ? !!user : false, // Not authenticated on server-side
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
  
  console.log('🛡️ [useRequireAuth] Hook called, auth state:', { 
    isLoading: auth.isLoading, 
    isAuthenticated: auth.isAuthenticated,
    hasUser: !!auth.user 
  })

  useEffect(() => {
    console.log('🛡️ [useRequireAuth] useEffect triggered:', { 
      isLoading: auth.isLoading, 
      isAuthenticated: auth.isAuthenticated,
      hasUser: !!auth.user 
    })
    
    if (!auth.isLoading && !auth.isAuthenticated) {
      console.log('🛡️ [useRequireAuth] Not authenticated, redirecting to login')
      const currentPath = window.location.pathname
      // Use replace instead of push to prevent back button issues
      router.replace(`/admin/login?from=${encodeURIComponent(currentPath)}`)
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