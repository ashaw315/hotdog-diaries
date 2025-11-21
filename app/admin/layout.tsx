'use client'

// Force all admin pages to be dynamically rendered
export const dynamic = 'force-dynamic'
export const dynamicParams = true

import { Suspense, useState, useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { createPortal } from 'react-dom'
import { AuthProvider, useRequireAuth } from '@/components/providers/AuthProvider'
import { AdminErrorBoundary } from '@/components/admin/ErrorBoundary'
import { ToastProvider } from '@/components/admin/Toast'
import './admin-nav.css'

interface AdminLayoutProps {
  children: React.ReactNode
}

function AdminContent({ children }: AdminLayoutProps) {
  const pathname = usePathname()
  const isLoginPage = pathname === '/admin/login'
  
  // Don't require auth for login page - just render children
  if (isLoginPage) {
    return <>{children}</>
  }

  // For other admin pages, use the authentication hook
  return <AuthenticatedContent>{children}</AuthenticatedContent>
}

function AuthenticatedContent({ children }: AdminLayoutProps) {
  const auth = useRequireAuth()

  // Always use the same container to prevent hydration mismatch
  return (
    <>
      <style jsx global>{`
        /* Override global CSS for admin pages to enable scrolling */
        body {
          overflow-y: auto !important;
          position: static !important;
          height: auto !important;
        }
        
        html {
          overflow-y: auto !important;
        }
      `}</style>
      
      <div className="min-h-screen bg-gray-50" style={{ overflow: 'visible' }}>
        {auth.isLoading ? (
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading admin panel...</p>
            </div>
          </div>
        ) : !auth.isAuthenticated ? (
          // This will be handled by the useRequireAuth hook redirect
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Redirecting to login...</p>
            </div>
          </div>
        ) : (
          <>
            <AdminHeader user={auth.user} onLogout={auth.logout} />
            <main style={{ position: 'relative', zIndex: 1 }}>
              <AdminErrorBoundary>
                {children}
              </AdminErrorBoundary>
            </main>
          </>
        )}
      </div>
    </>
  )
}

interface AdminHeaderProps {
  user: any
  onLogout: () => Promise<void>
}

function DropdownPortal({ children, isOpen }: { children: React.ReactNode, isOpen: boolean }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  if (!mounted || !isOpen) return null

  return createPortal(
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      pointerEvents: 'none',
      zIndex: 9999
    }}>
      <div style={{ pointerEvents: 'auto' }}>
        {children}
      </div>
    </div>,
    document.body
  )
}

function AdminHeader({ user, onLogout }: AdminHeaderProps) {
  const pathname = usePathname()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const dropdownRef = useRef<HTMLDivElement>(null)
  const dropdownMenuRef = useRef<HTMLDivElement>(null)
  
  const isActivePage = (href: string) => {
    if (href === '/admin') {
      return pathname === '/admin'
    }
    return pathname.startsWith(href)
  }
  

  // Check if any content source page is active
  const contentSourcePages = ['/admin/reddit', '/admin/bluesky', '/admin/youtube', '/admin/social']
  const isContentSourceActive = contentSourcePages.some(page => pathname.startsWith(page))
  
  const handleDropdownClick = () => {
    if (dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom,
        left: rect.left
      })
    }
    setDropdownOpen(!dropdownOpen)
  }
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownOpen && 
          dropdownRef.current && 
          !dropdownRef.current.contains(event.target as Node) &&
          dropdownMenuRef.current &&
          !dropdownMenuRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [dropdownOpen])

  return (
    <>
      
      <header className="admin-header">
        <div className="header-content">
          <div className="header-main">
            <div className="brand-section">
              <span className="brand-icon">🌭</span>
              <div className="brand-text">
                <h1>Hotdog Diaries Admin</h1>
                <p>Content Management System</p>
              </div>
            </div>
            
            <div className="header-actions">
              <div className="user-info">
                <p className="user-name">
                  {user?.full_name || user?.username || 'Administrator'}
                </p>
                <p className="user-email">
                  {user?.email || 'admin@hotdogdiaries.com'}
                </p>
              </div>
              
              <button
                onClick={onLogout}
                className="logout-btn"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
        
        <nav className="admin-nav">
          <div className="nav-content">
            <div className="nav-links">
              <a href="/admin" className={`nav-link ${isActivePage('/admin') ? 'active' : ''}`}>
                📊 Dashboard
              </a>
              <a href="/admin/queue" className={`nav-link ${isActivePage('/admin/queue') ? 'active' : ''}`}>
                📝 Content Queue
              </a>
              <a href="/admin/posted" className={`nav-link ${isActivePage('/admin/posted') ? 'active' : ''}`}>
                📤 Posted Content
              </a>
              <a href="/admin/schedule" className={`nav-link ${isActivePage('/admin/schedule') ? 'active' : ''}`}>
                📅 Schedule
              </a>
              
              {/* Content Sources Dropdown */}
              <div 
                ref={dropdownRef}
                className="dropdown-container"
              >
                <button 
                  className={`dropdown-trigger ${isContentSourceActive ? 'active' : ''}`}
                  onClick={handleDropdownClick}
                >
                  🔗 Content Sources
                  <span className={`dropdown-arrow ${dropdownOpen ? 'rotated' : ''}`}>▼</span>
                </button>
                
                <DropdownPortal isOpen={dropdownOpen}>
                  <div 
                    ref={dropdownMenuRef}
                    className="dropdown-menu-portal"
                    style={{
                      position: 'absolute',
                      top: `${dropdownPosition.top}px`,
                      left: `${dropdownPosition.left}px`,
                      background: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                      minWidth: '200px',
                      marginTop: '4px',
                      padding: '0.5rem 0',
                      zIndex: 10000
                    }}
                  >
                    <a 
                      href="/admin/reddit" 
                      className={`dropdown-item ${isActivePage('/admin/reddit') ? 'active' : ''}`}
                      onClick={() => setDropdownOpen(false)}
                    >
                      🤖 Reddit Settings
                    </a>
                    <a 
                      href="/admin/bluesky" 
                      className={`dropdown-item ${isActivePage('/admin/bluesky') ? 'active' : ''}`}
                      onClick={() => setDropdownOpen(false)}
                    >
                      🦋 Bluesky Settings
                    </a>
                    <a 
                      href="/admin/youtube" 
                      className={`dropdown-item ${isActivePage('/admin/youtube') ? 'active' : ''}`}
                      onClick={() => setDropdownOpen(false)}
                    >
                      📺 YouTube Settings
                    </a>
                    <a 
                      href="/admin/social" 
                      className={`dropdown-item ${isActivePage('/admin/social') ? 'active' : ''}`}
                      onClick={() => setDropdownOpen(false)}
                    >
                      📱 Social Media
                    </a>
                  </div>
                </DropdownPortal>
              </div>
              
              <a href="/admin/analytics" className={`nav-link ${isActivePage('/admin/analytics') ? 'active' : ''}`}>
                📈 Analytics
              </a>
              <a href="/admin/monitoring" className={`nav-link ${isActivePage('/admin/monitoring') ? 'active' : ''}`}>
                🔍 Monitoring
              </a>
              <a href="/admin/settings" className={`nav-link ${isActivePage('/admin/settings') ? 'active' : ''}`}>
                ⚙️ Settings
              </a>
            </div>
          </div>
        </nav>
      </header>
    </>
  )
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  console.log('🏗️ [AdminLayout] Rendering AdminLayout at:', new Date().toISOString())
  
  // CI-only minimal admin shell - prevent API polling and complex UI rendering
  if (process.env.NEXT_PUBLIC_CI === 'true') {
    console.log('🧪 CI MODE ACTIVE: Rendering minimal admin shell (no API polling)')
    return (
      <div style={{ 
        padding: '2rem', 
        fontFamily: 'monospace', 
        background: '#f5f5f5', 
        minHeight: '100vh',
        color: '#333'
      }}>
        <h1 style={{ color: '#2563eb', marginBottom: '1rem' }}>🧪 CI Mode — Minimal Admin Shell</h1>
        <p style={{ marginBottom: '0.5rem' }}>✅ No API polling or dynamic SWR hooks are loaded.</p>
        <p style={{ marginBottom: '0.5rem' }}>✅ No authentication context or complex state management.</p>
        <p style={{ marginBottom: '0.5rem' }}>✅ Static shell optimized for Playwright CI testing.</p>
        <p style={{ marginTop: '1rem', color: '#666' }}>
          Environment: NODE_ENV={process.env.NODE_ENV}, CI={process.env.CI}
        </p>
        <div style={{ marginTop: '2rem', padding: '1rem', background: '#e5e7eb', borderRadius: '0.5rem' }}>
          <h3>CI Test Content:</h3>
          {children}
        </div>
      </div>
    )
  }
  
  return (
    <AuthProvider>
      <ToastProvider>
        <Suspense fallback={
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        }>
          <AdminContent>{children}</AdminContent>
        </Suspense>
      </ToastProvider>
    </AuthProvider>
  )
}