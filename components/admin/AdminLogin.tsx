'use client'

import { useState, FormEvent } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth, useRedirectIfAuthenticated } from '@/contexts/AuthContext'

interface LoginForm {
  username: string
  password: string
  rememberMe: boolean
}

interface LoginError {
  message: string
  field?: string
}

export default function AdminLogin() {
  const [form, setForm] = useState<LoginForm>({
    username: '',
    password: '',
    rememberMe: false
  })
  
  const [error, setError] = useState<LoginError | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  
  const { login } = useAuth()
  const searchParams = useSearchParams()
  
  // Redirect if already authenticated
  useRedirectIfAuthenticated()

  // Get any error from URL params
  const urlError = searchParams.get('error')

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      // Basic validation
      if (!form.username.trim()) {
        throw new Error('Username is required')
      }
      
      if (!form.password) {
        throw new Error('Password is required')
      }

      await login(form.username.trim(), form.password)
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed'
      setError({ message: errorMessage })
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: keyof LoginForm, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }))
    
    // Clear error when user starts typing
    if (error) {
      setError(null)
    }
  }

  const getErrorMessage = (): string | null => {
    if (error) return error.message
    
    if (urlError) {
      switch (urlError) {
        case 'auth_service_error':
          return 'Authentication service is temporarily unavailable. Please try again.'
        case 'session_expired':
          return 'Your session has expired. Please log in again.'
        default:
          return 'An error occurred. Please try logging in again.'
      }
    }
    
    return null
  }

  return (
    <div className="login-container" style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      <div className="login-card" style={{
        width: '100%',
        maxWidth: '400px',
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        padding: '40px',
        position: 'relative',
        animation: 'fadeIn 0.4s ease'
      }}>
        <div className="login-header" style={{
          textAlign: 'center',
          marginBottom: '32px'
        }}>
          {/* Logo/Icon */}
          <div style={{
            width: '64px',
            height: '64px',
            margin: '0 auto 16px',
            backgroundColor: '#667eea',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <svg width="32" height="32" fill="white" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
            </svg>
          </div>
          
          <h1 style={{
            fontSize: '24px',
            fontWeight: '600',
            color: '#1a1a1a',
            margin: '0 0 8px 0'
          }}>Admin Login</h1>
          
          <p style={{
            fontSize: '14px',
            color: '#666',
            margin: 0
          }}>Enter your credentials to access the dashboard</p>
        </div>
        
        {getErrorMessage() && (
          <div style={{
            padding: '12px',
            backgroundColor: '#fee2e2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            marginBottom: '20px'
          }}>
            <p style={{
              color: '#dc2626',
              fontSize: '14px',
              margin: 0,
              display: 'flex',
              alignItems: 'center'
            }}>
              <svg width="16" height="16" style={{ marginRight: '8px' }} fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 1.5A6.5 6.5 0 1014.5 8 6.507 6.507 0 008 1.5zm0 11.5a1 1 0 110-2 1 1 0 010 2zm1-3.5v-4a1 1 0 00-2 0v4a1 1 0 002 0z"/>
              </svg>
              {getErrorMessage()}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '8px'
            }}>
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              value={form.username}
              onChange={(e) => handleInputChange('username', e.target.value)}
              disabled={isLoading}
              placeholder="Enter username"
              className="login-input"
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '16px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                outline: 'none',
                transition: 'all 0.2s',
                backgroundColor: '#f9fafb',
                boxSizing: 'border-box'
              }}
            />
          </div>
          
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '8px'
            }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={form.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                disabled={isLoading}
                placeholder="Enter password"
                className="login-input"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  paddingRight: '48px',
                  fontSize: '16px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  outline: 'none',
                  transition: 'all 0.2s',
                  backgroundColor: '#f9fafb',
                  boxSizing: 'border-box'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  color: '#6b7280'
                }}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '16px'
          }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              fontSize: '14px',
              color: '#4b5563',
              cursor: 'pointer'
            }}>
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                checked={form.rememberMe}
                onChange={(e) => handleInputChange('rememberMe', e.target.checked)}
                disabled={isLoading}
                style={{
                  marginRight: '8px',
                  width: '16px',
                  height: '16px',
                  cursor: 'pointer'
                }}
              />
              Remember me
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="login-submit-btn"
            style={{
              width: '100%',
              padding: '14px',
              fontSize: '16px',
              fontWeight: '600',
              color: 'white',
              backgroundColor: '#667eea',
              border: 'none',
              borderRadius: '8px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1,
              transition: 'all 0.2s',
              marginTop: '24px'
            }}
          >
            {isLoading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" style={{ marginRight: '8px', animation: 'spin 1s linear infinite' }} fill="none" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25"/>
                  <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                Signing in...
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {process.env.NODE_ENV === 'development' && (
          <div style={{
            marginTop: '24px',
            padding: '12px',
            backgroundColor: '#fef3c7',
            border: '1px solid #f59e0b',
            borderRadius: '8px'
          }}>
            <h4 style={{
              fontSize: '14px',
              fontWeight: '500',
              color: '#92400e',
              margin: '0 0 4px 0'
            }}>Development Mode</h4>
            <p style={{
              fontSize: '12px',
              color: '#92400e',
              margin: 0
            }}>
              Demo credentials will be available after database setup.
            </p>
          </div>
        )}
      </div>
      
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        .login-input:focus {
          border-color: #667eea !important;
          background-color: white !important;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1) !important;
        }
        
        .login-submit-btn:hover:not(:disabled) {
          background-color: #5a67d8 !important;
        }
        
        @media (max-width: 480px) {
          .login-card {
            padding: 24px !important;
            margin: 16px !important;
          }
          
          .login-header h1 {
            font-size: 20px !important;
          }
        }
      `}</style>
    </div>
  )
}