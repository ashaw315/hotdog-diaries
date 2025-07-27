'use client'

import { AuthProvider } from '@/contexts/AuthContext'

interface LoginLayoutProps {
  children: React.ReactNode
}

export default function LoginLayout({ children }: LoginLayoutProps) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  )
}