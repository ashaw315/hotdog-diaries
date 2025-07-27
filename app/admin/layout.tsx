'use client'

import { Suspense } from 'react'
import { usePathname } from 'next/navigation'
import { AuthProvider, useRequireAuth } from '@/contexts/AuthContext'

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

  if (auth.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin panel...</p>
        </div>
      </div>
    )
  }

  if (!auth.isAuthenticated) {
    // This will be handled by the useRequireAuth hook redirect
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader user={auth.user} onLogout={auth.logout} />
      <main className="py-6">
        {children}
      </main>
    </div>
  )
}

interface AdminHeaderProps {
  user: any
  onLogout: () => Promise<void>
}

function AdminHeader({ user, onLogout }: AdminHeaderProps) {
  return (
    <header className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center">
            <span className="text-2xl mr-3">🌭</span>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Hotdog Diaries Admin
              </h1>
              <p className="text-sm text-gray-600">
                Content Management System
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">
                {user?.full_name || user?.username}
              </p>
              <p className="text-xs text-gray-500">
                {user?.email}
              </p>
            </div>
            
            <div className="relative">
              <button
                onClick={onLogout}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <nav className="bg-gray-50 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <a
              href="/admin"
              className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm"
            >
              Dashboard
            </a>
            <a
              href="/admin/content"
              className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm"
            >
              Content Queue
            </a>
            <a
              href="/admin/posted"
              className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm"
            >
              Posted Content
            </a>
            <a
              href="/admin/schedule"
              className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm"
            >
              Schedule
            </a>
            <a
              href="/admin/settings"
              className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm"
            >
              Settings
            </a>
          </div>
        </div>
      </nav>
    </header>
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