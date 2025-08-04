'use client'

import { useState, useEffect } from 'react'
import AdminLayout from '@/components/admin/AdminLayout'
import AdminDashboard from '@/components/admin/AdminDashboard'

export default function AdminPage() {
  const [debugInfo, setDebugInfo] = useState<string>('Loading...')

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/admin/me', {
          credentials: 'include'
        })
        
        if (response.ok) {
          const data = await response.json()
          setDebugInfo(`Authenticated as: ${data.data?.username || 'Unknown'}`)
        } else {
          setDebugInfo(`Not authenticated: ${response.status} - ${response.statusText}`)
        }
      } catch (error) {
        setDebugInfo(`Auth check failed: ${error.message}`)
      }
    }

    checkAuth()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Debug info */}
      <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4 m-4">
        <strong className="font-bold">Debug Info: </strong>
        <span className="block sm:inline">{debugInfo}</span>
      </div>

      <AdminLayout>
        <AdminDashboard />
      </AdminLayout>
    </div>
  )
}