'use client'

import { useEffect, useState } from 'react'

/**
 * Hook to detect if the component is running on the client-side
 * Useful for preventing hydration mismatches when dealing with browser-only APIs
 * or when you need to ensure consistent server/client rendering
 * 
 * @returns {boolean} true if running on client-side, false on server-side
 */
export function useIsClient(): boolean {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  return isClient
}