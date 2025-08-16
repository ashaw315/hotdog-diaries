'use client'

import AdminDashboard from '@/components/admin/AdminDashboard'

export default function AdminPage() {
  // Authentication is handled by the AdminLayout wrapper
  // No need for duplicate auth checks here
  
  return <AdminDashboard />
}