'use client'

import { useState } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'

interface AdminHeaderProps {
  onMenuToggle: () => void
  isMobileMenuOpen: boolean
}

export default function AdminHeader({ onMenuToggle, isMobileMenuOpen }: AdminHeaderProps) {
  const { user, logout } = useAuth()
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
  }

  const formatLastLogin = (lastLogin?: Date) => {
    if (!lastLogin) return 'Never'
    
    const date = new Date(lastLogin)
    const now = new Date()
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffMinutes < 60) {
      return `${diffMinutes} minutes ago`
    } else if (diffMinutes < 1440) {
      return `${Math.floor(diffMinutes / 60)} hours ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  return (
    <header className="site-header">
      <div className="container">
        <div className="flex justify-between align-center">
          <div className="flex align-center gap-sm">
            <button
              type="button"
              className="mobile-menu-toggle"
              onClick={onMenuToggle}
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? '✕' : '☰'}
            </button>
            
            <div className="flex align-center gap-sm">
              <span>🌭</span>
              <div>
                <h2>Hotdog Diaries Admin</h2>
                <p className="text-muted">Content Management System</p>
              </div>
            </div>
          </div>

          <div className="flex align-center gap-sm">
            <button
              type="button"
              className="btn"
              aria-label="View notifications"
            >
              🔔
            </button>

            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="btn flex align-center gap-sm"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                aria-expanded={isUserMenuOpen}
                aria-haspopup="true"
              >
                <div className="text-right">
                  <p><strong>{user?.full_name || user?.username}</strong></p>
                  <p className="text-muted">
                    Last login: {formatLastLogin(user?.last_login_at)}
                  </p>
                </div>
                <div style={{ 
                  width: '32px', 
                  height: '32px', 
                  borderRadius: '50%', 
                  backgroundColor: 'var(--color-black)', 
                  color: 'var(--color-white)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {(user?.full_name || user?.username || 'A')[0].toUpperCase()}
                </div>
                <span>{isUserMenuOpen ? '▲' : '▼'}</span>
              </button>

              {isUserMenuOpen && (
                <div style={{
                  position: 'absolute',
                  right: '0',
                  top: '100%',
                  marginTop: '4px',
                  width: '200px',
                  zIndex: 10
                }} className="card">
                  <div className="card-body">
                    <div className="mb-sm">
                      <p><strong>{user?.full_name || user?.username}</strong></p>
                      <p className="text-muted">{user?.email}</p>
                    </div>
                    
                    <div className="grid gap-xs">
                      <a
                        href="/admin/profile"
                        className="nav-link"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        Your Profile
                      </a>
                      
                      <a
                        href="/admin/settings"
                        className="nav-link"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        Settings
                      </a>
                      
                      <button
                        onClick={handleLogout}
                        className="btn btn-danger"
                        style={{ width: '100%', textAlign: 'left' }}
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}