'use client'

import { Suspense, useState, useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { createPortal } from 'react-dom'
import { AuthProvider, useRequireAuth } from '@/contexts/AuthContext'
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
              {children}
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
  
  const isActivePage = (href: string) => {
    if (href === '/admin') {
      return pathname === '/admin'
    }
    return pathname.startsWith(href)
  }
  
  const getNavLinkClass = (href: string) => {
    return isActivePage(href)
      ? "border-blue-500 text-blue-600 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200"
      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200"
  }

  // Check if any content source page is active
  const contentSourcePages = ['/admin/reddit', '/admin/bluesky', '/admin/youtube', '/admin/social']
  const isContentSourceActive = contentSourcePages.some(page => pathname.startsWith(page))
  
  const handleDropdownEnter = () => {
    if (dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom,
        left: rect.left
      })
    }
    setDropdownOpen(true)
  }

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
                onMouseEnter={handleDropdownEnter}
                onMouseLeave={() => setDropdownOpen(false)}
              >
                <button className={`dropdown-trigger ${isContentSourceActive ? 'active' : ''}`}>
                  🔗 Content Sources
                  <span className="dropdown-arrow">▼</span>
                </button>
                
                <DropdownPortal isOpen={dropdownOpen}>
                  <div 
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
                      marginTop: '0.5rem',
                      padding: '0.5rem 0'
                    }}
                    onMouseEnter={() => setDropdownOpen(true)}
                    onMouseLeave={() => setDropdownOpen(false)}
                  >
                    <a href="/admin/reddit" className={`dropdown-item ${isActivePage('/admin/reddit') ? 'active' : ''}`}>
                      🤖 Reddit Settings
                    </a>
                    <a href="/admin/bluesky" className={`dropdown-item ${isActivePage('/admin/bluesky') ? 'active' : ''}`}>
                      🦋 Bluesky Settings
                    </a>
                    <a href="/admin/youtube" className={`dropdown-item ${isActivePage('/admin/youtube') ? 'active' : ''}`}>
                      📺 YouTube Settings
                    </a>
                    <a href="/admin/social" className={`dropdown-item ${isActivePage('/admin/social') ? 'active' : ''}`}>
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
  return (
    <AuthProvider>
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      }>
        <AdminContent>{children}</AdminContent>
      </Suspense>
    </AuthProvider>
  )
}