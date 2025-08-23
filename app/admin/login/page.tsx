import { Suspense } from 'react'
import AdminLoginHtmlStyle from '@/components/admin/AdminLoginHtmlStyle'

function LoginLoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoadingFallback />}>
      <AdminLoginHtmlStyle />
    </Suspense>
  )
}

export const metadata = {
  title: 'Admin Login - Hotdog Diaries',
  description: 'Sign in to access the admin panel'
}