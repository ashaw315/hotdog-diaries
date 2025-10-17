'use client'

import { useEffect } from 'react'

/**
 * Client-side CI Runtime Guard Component
 * This runs on the client to ensure polling is disabled in CI mode
 */
export function CIRuntimeGuard() {
  useEffect(() => {
    const isCIMode = process.env.NEXT_PUBLIC_CI === 'true'
    
    if (!isCIMode) {
      return
    }

    console.log('🧪 CI MODE ACTIVE: Disabling all polling and revalidation')

    // 1. Mock admin API endpoints aggressively
    const originalFetch = globalThis.fetch
    globalThis.fetch = async (...args: Parameters<typeof fetch>) => {
      const url = args[0]?.toString?.() ?? ''
      
      // Block all admin API polling endpoints
      if (url.includes('/api/admin/metrics') || url.includes('/api/admin/me')) {
        console.log('🧪 [CI] Blocking admin API call:', url)
        return new Response(
          JSON.stringify({ 
            success: true,
            message: 'CI mode mock response', 
            data: {
              // Mock metrics data
              ...(url.includes('metrics') && {
                totalContent: 100,
                approvedContent: 80,
                postedToday: 6,
                queueHealth: 'good',
                platforms: {}
              }),
              // Mock user data
              ...(url.includes('/me') && {
                id: 1,
                username: 'ci-admin',
                email: 'ci@test.com'
              })
            }
          }),
          { 
            status: 200, 
            headers: { 'Content-Type': 'application/json' } 
          }
        )
      }

      // Allow other requests to proceed normally
      return originalFetch(...args)
    }
    console.log('✅ [CI] Fetch override installed for admin API blocking')

    // 2. Disable long-running intervals and timeouts
    const originalSetInterval = globalThis.setInterval
    const originalSetTimeout = globalThis.setTimeout

    globalThis.setInterval = ((fn: () => void, ms: number, ...rest: unknown[]) => {
      if (ms > 2000) {
        console.log(`🧪 [CI] Blocking setInterval with ${ms}ms interval`)
        return -1 as number // Return fake timer ID
      }
      return originalSetInterval(fn, ms, ...rest)
    }) as typeof setInterval

    globalThis.setTimeout = ((fn: () => void, ms: number, ...rest: unknown[]) => {
      if (ms > 10000) {
        console.log(`🧪 [CI] Blocking setTimeout with ${ms}ms delay`)
        return -1 as number // Return fake timer ID
      }
      return originalSetTimeout(fn, ms, ...rest)
    }) as typeof setTimeout

    console.log('✅ [CI] Timer overrides installed')

    // 3. Add global flag for other components to check
    ;(globalThis as any).__CI_POLLING_DISABLED__ = true

    console.log('🧪 [CI] All polling and revalidation guards installed')

    // 4. Emergency cleanup after test timeout
    setTimeout(() => {
      console.log('🧪 [CI] Emergency cleanup - clearing all intervals')
      // Clear all known intervals
      for (let i = 1; i < 10000; i++) {
        try {
          clearInterval(i)
          clearTimeout(i)
        } catch (e) {
          // Ignore errors
        }
      }
    }, 60000) // After 1 minute

  }, [])

  // Don't render anything
  return null
}

export default CIRuntimeGuard