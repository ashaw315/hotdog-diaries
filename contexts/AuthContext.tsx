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
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const searchParams = useSearchParams()

  // Simple fetch current user
  const fetchCurrentUser = async (): Promise<User | null> => {
    try {
      const response = await fetch('/api/admin/me', {
        method: 'GET',
        credentials: 'include'
      })

      if (response.ok) {
        const result = await response.json()
        return result.data || null
      }
      
      return null
    } catch (error) {
      console.error('Failed to fetch user:', error)
      return null
    }
  }

  // Initialize auth on mount - just call API once
  useEffect(() => {
    fetchCurrentUser().then(userData => {
      setUser(userData)
      setIsLoading(false)
    })
  }, [])

  // Login function
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

      // Update local state
      setUser(result.data.user)
      
      // Redirect
      const redirectTo = searchParams.get('from') || '/admin'
      router.push(redirectTo)
      
    } catch (error) {
      console.error('Login failed:', error)
      throw error
    }
  }

  // Logout function
  const logout = async (): Promise<void> => {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'include'
      })
    } catch (error) {
      console.error('Logout failed:', error)
    } finally {
      setUser(null)
      router.push('/admin/login')
    }
  }

  // Refresh user data
  const refreshUser = async (): Promise<void> => {
    const userData = await fetchCurrentUser()
    setUser(userData)
  }

  const contextValue: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
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