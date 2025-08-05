'use client'

import AdminDashboard from '@/components/admin/AdminDashboard'

export default function AdminPage() {
  // Authentication is handled by the AdminLayout wrapper
  // No need for duplicate auth checks here
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <AdminDashboard />
    </div>
  )
}