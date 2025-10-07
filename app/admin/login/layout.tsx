'use client'

import { AuthProvider } from '@/components/providers/AuthProvider'

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