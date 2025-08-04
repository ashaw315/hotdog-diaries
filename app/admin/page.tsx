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
    <div className="container content-area">
      <div className="alert alert-info">
        <strong>Debug Info: </strong>
        {debugInfo}
      </div>

      <AdminLayout>
        <AdminDashboard />
      </AdminLayout>
    </div>
  )
}