'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export default function AdminLoginHtmlStyle() {
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const usernameRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  
  const { login, isAuthenticated, isLoading: authLoading } = useAuth()
  
  // If user is already authenticated, they shouldn't be on the login page
  // This could be causing the double redirect issue
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      console.log('🔀 [AdminLoginHtmlStyle] User already authenticated, redirecting to /admin')
      // Use replace to prevent back button issues
      window.location.replace('/admin')
    }
  }, [authLoading, isAuthenticated])

  // Use refs and direct DOM manipulation like the emergency HTML
  useEffect(() => {
    // Focus first input after mount, like emergency HTML
    const timer = setTimeout(() => {
      if (usernameRef.current) {
        usernameRef.current.focus()
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    // Get values directly from DOM like emergency HTML
    const username = usernameRef.current?.value || ''
    const password = passwordRef.current?.value || ''

    try {
      if (!username.trim()) {
        throw new Error('Username is required')
      }
      
      if (!password) {
        throw new Error('Password is required')
      }

      await login(username.trim(), password)
      
      // Immediate redirect on successful login
      console.log('🔀 [AdminLoginHtmlStyle] Login successful, redirecting to /admin')
      window.location.replace('/admin')
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  // Emergency HTML style with aggressive CSS - FORCE BLACK TEXT
  const inputStyle = {
    width: '100%',
    padding: '15px',
    border: '2px solid #ddd',
    borderRadius: '5px',
    fontSize: '16px',
    boxSizing: 'border-box' as const,
    backgroundColor: 'white !important' as any,
    color: 'black !important' as any,  /* FORCE BLACK TEXT */
    outline: 'none',
    pointerEvents: 'auto !important' as any,
    userSelect: 'text !important' as any,
    WebkitUserSelect: 'text !important' as any,
    MozUserSelect: 'text !important' as any,
    cursor: 'text !important' as any,
    WebkitAppearance: 'none !important' as any,
    MozAppearance: 'none !important' as any,
    appearance: 'none !important' as any
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px',
      margin: 0,
      fontFamily: 'Arial, sans-serif'
    }} data-testid="admin-login-container">
      <div style={{
        background: 'white',
        padding: '40px',
        borderRadius: '10px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
        width: '100%',
        maxWidth: '400px'
      }} data-testid="admin-login-form-container">
        <div style={{
          textAlign: 'center',
          marginBottom: '30px'
        }} data-testid="admin-login-header">
          <div style={{
            fontSize: '48px',
            marginBottom: '10px'
          }} data-testid="admin-login-icon">🌭</div>
          <h1 style={{
            margin: 0,
            color: '#333',
            fontSize: '24px'
          }} data-testid="admin-login-title">Admin Login</h1>
          <p style={{
            margin: '8px 0 0 0',
            color: '#666',
            fontSize: '14px'
          }} data-testid="admin-login-subtitle">Hotdog Diaries</p>
        </div>
        
        {error && (
          <div 
            role="alert"
            style={{
            background: '#fee2e2',
            color: '#dc2626',
            padding: '10px',
            borderRadius: '5px',
            marginBottom: '20px',
            border: '1px solid #fecaca'
          }} data-testid="admin-login-error">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} data-testid="admin-login-form">
          <div style={{ marginBottom: '20px' }} data-testid="admin-login-username-field">
            <label 
              htmlFor="username-fixed" 
              style={{
                display: 'block',
                marginBottom: '5px',
                color: '#333',
                fontWeight: 'bold'
              }}
              data-testid="admin-login-username-label"
            >
              Username:
            </label>
            <input
              ref={usernameRef}
              id="username-fixed"
              name="username"
              type="text"
              autoComplete="username"
              required
              placeholder="Type 'admin' here"
              disabled={isLoading}
              style={inputStyle}
              data-testid="admin-login-username-input"
            />
          </div>
          
          <div style={{ marginBottom: '20px' }} data-testid="admin-login-password-field">
            <label 
              htmlFor="password-fixed"
              style={{
                display: 'block',
                marginBottom: '5px',
                color: '#333',
                fontWeight: 'bold'
              }}
              data-testid="admin-login-password-label"
            >
              Password:
            </label>
            <input
              ref={passwordRef}
              id="password-fixed"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="Type password here"
              disabled={isLoading}
              style={inputStyle}
              data-testid="admin-login-password-input"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '15px',
              background: isLoading ? '#ccc' : '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              fontSize: '16px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontWeight: 'bold'
            }}
            data-testid="admin-login-submit-button"
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div style={{
          background: '#fef3c7',
          color: '#92400e',
          padding: '15px',
          borderRadius: '5px',
          marginTop: '20px',
          fontSize: '14px'
        }} data-testid="admin-login-demo-credentials">
          <strong>Demo Credentials:</strong><br />
          Username: <code data-testid="demo-username">admin</code><br />
          Password: <code data-testid="demo-password">StrongAdminPass123!</code>
        </div>
      </div>
    </div>
  )
}