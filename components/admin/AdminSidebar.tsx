'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

interface AdminSidebarProps {
  isMobileMenuOpen: boolean
  onMobileMenuClose: () => void
}

interface NavItem {
  name: string
  href: string
  icon: string
  count?: number
  description?: string
}

const navigationItems: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/admin',
    icon: '📊',
    description: 'Overview and statistics'
  },
  {
    name: 'Social Platforms',
    href: '/admin/social',
    icon: '🌐',
    description: 'Platform management'
  },
  {
    name: 'Reddit',
    href: '/admin/reddit',
    icon: '🔴',
    description: 'Reddit content scanning'
  },
  {
    name: 'YouTube',
    href: '/admin/youtube',
    icon: '📺',
    description: 'YouTube video content'
  },
  {
    name: 'Flickr',
    href: '/admin/flickr',
    icon: '📸',
    description: 'Flickr photo content'
  },
  {
    name: 'Unsplash',
    href: '/admin/unsplash',
    icon: '🖼️',
    description: 'Professional photography'
  },
  {
    name: 'Mastodon',
    href: '/admin/mastodon',
    icon: '🐘',
    description: 'Mastodon content scanning'
  },
  {
    name: 'Content Queue',
    href: '/admin/queue',
    icon: '📝',
    description: 'Manage pending content'
  },
  {
    name: 'Posted Content',
    href: '/admin/history',
    icon: '📋',
    description: 'View content history'
  },
  {
    name: 'Content Filtering',
    href: '/admin/filtering',
    icon: '🔍',
    description: 'Content filtering rules'
  },
  {
    name: 'Review Queue',
    href: '/admin/review',
    icon: '👁️',
    description: 'Review flagged content'
  },
  {
    name: 'Content Analytics',
    href: '/admin/analytics',
    icon: '📈',
    description: 'Performance metrics'
  },
  {
    name: 'Settings',
    href: '/admin/settings',
    icon: '⚙️',
    description: 'System configuration'
  }
]

export default function AdminSidebar({ isMobileMenuOpen, onMobileMenuClose }: AdminSidebarProps) {
  const pathname = usePathname()

  const isActiveRoute = (href: string): boolean => {
    if (href === '/admin') {
      return pathname === '/admin'
    }
    return pathname.startsWith(href)
  }

  const sidebarContent = (
    <div className="flex flex-col" style={{ height: '100vh' }}>
      <div className="flex align-center justify-between p-sm" style={{ borderBottom: '1px solid var(--color-gray-light)' }}>
        <div className="flex align-center gap-sm">
          <span>🌭</span>
          <div>
            <h3>Admin Panel</h3>
            <p className="text-muted">Content Management</p>
          </div>
        </div>
        <button
          onClick={onMobileMenuClose}
          className="btn mobile-menu-toggle"
          aria-label="Close menu"
        >
          ✕
        </button>
      </div>

      <nav className="p-sm flex-1" style={{ overflowY: 'auto' }}>
        <ul className="nav nav-vertical">
          {navigationItems.map((item) => {
            const isActive = isActiveRoute(item.href)
            
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  onClick={onMobileMenuClose}
                  className={`nav-link flex align-center gap-sm ${isActive ? 'active' : ''}`}
                >
                  <span role="img" aria-label={item.name}>
                    {item.icon}
                  </span>
                  <div className="flex-1">
                    <div className="flex justify-between align-center">
                      <span className={isActive ? 'font-bold' : ''}>{item.name}</span>
                      {item.count && (
                        <span className="text-muted">
                          {item.count}
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-muted">{item.description}</p>
                    )}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>

        <div className="mt-md" style={{ borderTop: '1px solid var(--color-gray-light)', paddingTop: 'var(--spacing-md)' }}>
          <h3 className="text-muted mb-sm">Quick Actions</h3>
          <div className="grid gap-xs">
            <button type="button" className="btn flex align-center gap-sm" style={{ width: '100%', textAlign: 'left' }}>
              <span>➕</span>
              <span>Add Content</span>
            </button>
            <button type="button" className="btn flex align-center gap-sm" style={{ width: '100%', textAlign: 'left' }}>
              <span>🔄</span>
              <span>Refresh Data</span>
            </button>
            <button type="button" className="btn flex align-center gap-sm" style={{ width: '100%', textAlign: 'left' }}>
              <span>📤</span>
              <span>Export Data</span>
            </button>
          </div>
        </div>

        <div className="mt-md" style={{ borderTop: '1px solid var(--color-gray-light)', paddingTop: 'var(--spacing-md)' }}>
          <h3 className="text-muted mb-sm">System Status</h3>
          <div className="grid gap-xs">
            <div className="flex justify-between align-center">
              <div className="flex align-center gap-xs">
                <span className="text-success">●</span>
                <span className="text-muted">Database</span>
              </div>
              <span className="text-success">Online</span>
            </div>
            <div className="flex justify-between align-center">
              <div className="flex align-center gap-xs">
                <span>●</span>
                <span className="text-muted">Bot Service</span>
              </div>
              <span>Idle</span>
            </div>
          </div>
        </div>
      </nav>

      <div className="p-sm text-center" style={{ borderTop: '1px solid var(--color-gray-light)' }}>
        <div className="text-muted">
          <p>Hotdog Diaries v1.0</p>
          <p>Last updated: {new Date().toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {isMobileMenuOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 40
          }}
          onClick={onMobileMenuClose}
          className="mobile-menu-hidden"
        ></div>
      )}

      <div
        className={`mobile-menu-hidden ${isMobileMenuOpen ? '' : 'hidden'}`}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: '250px',
          backgroundColor: 'var(--color-white)',
          borderRight: '1px solid var(--color-gray-light)',
          zIndex: 50
        }}
      >
        {sidebarContent}
      </div>

      <div
        className="mobile-menu-hidden"
        style={{
          width: '250px',
          backgroundColor: 'var(--color-white)',
          borderRight: '1px solid var(--color-gray-light)'
        }}
      >
        {sidebarContent}
      </div>
    </>
  )
}