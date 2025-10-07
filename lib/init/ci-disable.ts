/**
 * CI Runtime Guard - Force disable all frontend polling and revalidation
 * This runs immediately when imported to prevent any polling from starting
 */

// Ensure this only runs in the browser and CI mode is actually enabled
const isClient = typeof window !== 'undefined';
const isCIMode = process.env.NEXT_PUBLIC_CI === 'true';

console.log('CI Disable Check:', { isClient, isCIMode, env: process.env.NEXT_PUBLIC_CI });

if (isClient && isCIMode) {
  console.log('🧪 CI MODE ACTIVE: Disabling all polling and SWR revalidation');

  // 1. Override SWR globally to disable all revalidation
  try {
    // Check if SWR is available and override its default config
    const swr = require('swr');
    if (swr && swr.SWRConfig) {
      const originalSWRConfig = swr.SWRConfig;
      swr.SWRConfig = function CIWrappedSWRConfig(props: any) {
        console.log('🧪 [CI] Wrapping SWR with CI-safe config');
        return originalSWRConfig({
          ...props,
          value: {
            ...props.value,
            refreshInterval: 0,
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
            revalidateOnMount: false,
            revalidateIfStale: false,
            dedupingInterval: Infinity,
            errorRetryCount: 0,
            errorRetryInterval: Infinity,
            loadingTimeout: 1000,
            onLoadingSlow: () => console.log('🧪 [CI] SWR loading slow (expected in CI)'),
          },
        });
      };
      console.log('✅ [CI] SWR configuration overridden');
    }
  } catch (error) {
    console.warn('⚠️ [CI] Could not override SWR config:', error.message);
  }

  // 2. Mock admin API endpoints to prevent real requests
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (...args: Parameters<typeof fetch>) => {
    const url = args[0]?.toString?.() ?? '';
    
    // Block admin API polling endpoints
    if (url.includes('/api/admin/metrics') || url.includes('/api/admin/me')) {
      console.log('🧪 [CI] Blocking admin API call:', url);
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
      );
    }

    // Allow other requests to proceed normally
    return originalFetch(...args);
  };
  console.log('✅ [CI] Fetch override installed for admin API blocking');

  // 3. Disable long-running intervals and timeouts
  const originalSetInterval = globalThis.setInterval;
  const originalSetTimeout = globalThis.setTimeout;

  globalThis.setInterval = ((fn: Function, ms: number, ...rest: any[]) => {
    if (ms > 2000) {
      console.log(`🧪 [CI] Blocking setInterval with ${ms}ms interval`);
      return -1 as any; // Return fake timer ID
    }
    return originalSetInterval(fn, ms, ...rest);
  }) as typeof setInterval;

  globalThis.setTimeout = ((fn: Function, ms: number, ...rest: any[]) => {
    if (ms > 10000) {
      console.log(`🧪 [CI] Blocking setTimeout with ${ms}ms delay`);
      return -1 as any; // Return fake timer ID
    }
    return originalSetTimeout(fn, ms, ...rest);
  }) as typeof setTimeout;

  console.log('✅ [CI] Timer overrides installed');

  // 4. Override common polling patterns
  try {
    // Disable React Query if present
    if (typeof window !== 'undefined' && (window as any).ReactQuery) {
      (window as any).ReactQuery.defaultOptions = {
        queries: {
          refetchOnWindowFocus: false,
          refetchOnMount: false,
          refetchOnReconnect: false,
          retry: false,
          staleTime: Infinity,
          cacheTime: Infinity,
        },
      };
      console.log('✅ [CI] React Query disabled');
    }
  } catch (error) {
    // Ignore if React Query not available
  }

  // 5. Intercept and block common admin hooks
  const blockAdminHooks = () => {
    try {
      // Override useEffect to block polling useEffects
      const React = require('react');
      if (React && React.useEffect) {
        const originalUseEffect = React.useEffect;
        React.useEffect = (effect: Function, deps?: any[]) => {
          // Block effects with timer dependencies that suggest polling
          if (deps && deps.some && deps.some((dep: any) => 
            typeof dep === 'number' && dep > 5000 // 5+ second intervals
          )) {
            console.log('🧪 [CI] Blocking polling useEffect');
            return;
          }
          return originalUseEffect(effect, deps);
        };
        console.log('✅ [CI] useEffect override installed');
      }
    } catch (error) {
      console.warn('⚠️ [CI] Could not override useEffect:', error.message);
    }
  };

  // Run hook blocking after a brief delay to ensure React is loaded
  setTimeout(blockAdminHooks, 100);

  // 6. Add global flag for other components to check
  (globalThis as any).__CI_POLLING_DISABLED__ = true;

  console.log('🧪 [CI] All polling and revalidation guards installed');

  // 7. Emergency cleanup after test timeout
  setTimeout(() => {
    if (process.env.NODE_ENV === 'test') {
      console.log('🧪 [CI] Emergency cleanup - clearing all intervals');
      // Clear all known intervals
      for (let i = 1; i < 10000; i++) {
        try {
          clearInterval(i);
          clearTimeout(i);
        } catch (e) {
          // Ignore errors
        }
      }
    }
  }, 60000); // After 1 minute
}

export {};