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
    name: 'Twitter Integration',
    href: '/admin/twitter',
    icon: '🐦',
    description: 'Twitter content scanning'
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
    <div className="flex flex-col h-full">
      {/* Logo/Brand section for mobile */}
      <div className="md:hidden flex items-center px-4 py-4 border-b border-gray-200">
        <span className="text-2xl mr-3">🌭</span>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Admin Panel</h2>
          <p className="text-xs text-gray-500">Content Management</p>
        </div>
        <button
          onClick={onMobileMenuClose}
          className="ml-auto p-2 text-gray-400 hover:text-gray-500"
          aria-label="Close menu"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        <div className="space-y-1">
          {navigationItems.map((item) => {
            const isActive = isActiveRoute(item.href)
            
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onMobileMenuClose}
                className={`
                  group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-150 ease-in-out
                  ${isActive
                    ? 'bg-indigo-100 text-indigo-900 border-r-2 border-indigo-500'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }
                `}
              >
                <span className="text-lg mr-3" role="img" aria-label={item.name}>
                  {item.icon}
                </span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className={isActive ? 'font-semibold' : ''}>{item.name}</span>
                    {item.count && (
                      <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {item.count}
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                  )}
                </div>
              </Link>
            )
          })}
        </div>

        {/* Quick Actions Section */}
        <div className="pt-6 border-t border-gray-200 mt-6">
          <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Quick Actions
          </h3>
          <div className="mt-2 space-y-1">
            <button
              type="button"
              className="group flex items-center w-full px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 hover:text-gray-900"
            >
              <span className="text-lg mr-3">➕</span>
              <span>Add Content</span>
            </button>
            <button
              type="button"
              className="group flex items-center w-full px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 hover:text-gray-900"
            >
              <span className="text-lg mr-3">🔄</span>
              <span>Refresh Data</span>
            </button>
            <button
              type="button"
              className="group flex items-center w-full px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 hover:text-gray-900"
            >
              <span className="text-lg mr-3">📤</span>
              <span>Export Data</span>
            </button>
          </div>
        </div>

        {/* System Status */}
        <div className="pt-6 border-t border-gray-200 mt-6">
          <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            System Status
          </h3>
          <div className="mt-2 px-3">
            <div className="flex items-center text-sm">
              <div className="flex items-center">
                <div className="h-2 w-2 bg-green-400 rounded-full mr-2"></div>
                <span className="text-gray-600">Database</span>
              </div>
              <span className="ml-auto text-green-600 font-medium">Online</span>
            </div>
            <div className="flex items-center text-sm mt-1">
              <div className="flex items-center">
                <div className="h-2 w-2 bg-yellow-400 rounded-full mr-2"></div>
                <span className="text-gray-600">Bot Service</span>
              </div>
              <span className="ml-auto text-yellow-600 font-medium">Idle</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Footer info */}
      <div className="p-4 border-t border-gray-200">
        <div className="text-xs text-gray-500 text-center">
          <p>Hotdog Diaries v1.0</p>
          <p className="mt-1">Last updated: {new Date().toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile sidebar overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          aria-hidden="true"
        >
          <div
            className="fixed inset-0 bg-gray-600 bg-opacity-75"
            onClick={onMobileMenuClose}
          ></div>
        </div>
      )}

      {/* Mobile sidebar */}
      <div
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out md:hidden
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {sidebarContent}
      </div>

      {/* Desktop sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
        <div className="flex flex-col flex-grow pt-5 bg-white overflow-y-auto border-r border-gray-200">
          {sidebarContent}
        </div>
      </div>
    </>
  )
}