import { NextRequest, NextResponse } from 'next/server'
import { EdgeAuthUtils } from './lib/auth-edge'

// Define protected routes
const PROTECTED_ROUTES = [
  '/admin'
]

// Define public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/admin/login',
  '/api/admin/login'
]

// Define API routes that need authentication
const PROTECTED_API_ROUTES = [
  '/api/admin/me',
  '/api/admin/logout',
  '/api/content/queue',
  '/api/content/[id]'
]

/**
 * Check if a path matches any of the given patterns
 */
function matchesPath(pathname: string, patterns: string[]): boolean {
  return patterns.some(pattern => {
    // Handle exact matches
    if (pattern === pathname) return true
    
    // Handle dynamic routes (e.g., /api/content/[id])
    if (pattern.includes('[') && pattern.includes(']')) {
      const regexPattern = pattern.replace(/\[.*?\]/g, '[^/]+')
      const regex = new RegExp(`^${regexPattern}$`)
      return regex.test(pathname)
    }
    
    // Handle prefix matches for directories
    if (pattern.endsWith('/') && pathname.startsWith(pattern)) return true
    if (!pattern.endsWith('/') && pathname.startsWith(pattern + '/')) return true
    
    return false
  })
}

/**
 * Check if the route requires authentication
 */
function requiresAuth(pathname: string): boolean {
  // Check if it's a public route
  if (matchesPath(pathname, PUBLIC_ROUTES)) {
    return false
  }
  
  // Check if it's a protected route
  if (matchesPath(pathname, PROTECTED_ROUTES) || matchesPath(pathname, PROTECTED_API_ROUTES)) {
    return true
  }
  
  // Default: no auth required for other routes
  return false
}

/**
 * Check if the route is an API route
 */
function isApiRoute(pathname: string): boolean {
  return pathname.startsWith('/api/')
}

/**
 * Handle authentication for API routes
 */
async function handleApiAuth(request: NextRequest): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl
  
  if (!requiresAuth(pathname)) {
    return null // No auth required
  }
  
  const authResult = await EdgeAuthUtils.verifyRequestAuth(request)
  
  if (!authResult.isValid) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Unauthorized', 
        code: 'AUTH_REQUIRED' 
      },
      { status: 401 }
    )
  }
  
  // Add user info to request headers for downstream use
  const response = NextResponse.next()
  response.headers.set('x-user-id', authResult.payload!.userId.toString())
  response.headers.set('x-username', authResult.payload!.username)
  
  return response
}

/**
 * Handle authentication for page routes
 */
async function handlePageAuth(request: NextRequest): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl
  
  if (!requiresAuth(pathname)) {
    return null // No auth required
  }
  
  const authResult = await EdgeAuthUtils.handleAuthWithRefresh(request)
  
  if (!authResult.isAuthenticated) {
    // If there's a response (e.g., with refreshed tokens), return it
    if (authResult.response) {
      return authResult.response
    }
    
    // Otherwise, redirect to login
    return EdgeAuthUtils.createLoginRedirect(pathname)
  }
  
  // If tokens were refreshed, return the response with new cookies
  if (authResult.response) {
    return authResult.response
  }
  
  // Continue to the protected route
  return NextResponse.next()
}

/**
 * Handle redirect for authenticated users accessing login page
 */
async function handleLoginRedirect(request: NextRequest): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl
  
  if (pathname !== '/admin/login') {
    return null
  }
  
  const authResult = await EdgeAuthUtils.verifyRequestAuth(request)
  
  if (authResult.isValid) {
    // User is already authenticated, redirect to admin dashboard
    const redirectTo = request.nextUrl.searchParams.get('from') || '/admin'
    return EdgeAuthUtils.createAuthRedirect(redirectTo)
  }
  
  return null
}

/**
 * Main middleware function
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl
  
  try {
    // Handle login redirect for authenticated users
    const loginRedirect = await handleLoginRedirect(request)
    if (loginRedirect) return loginRedirect
    
    // Handle API routes
    if (isApiRoute(pathname)) {
      const apiResponse = await handleApiAuth(request)
      if (apiResponse) return apiResponse
    } else {
      // Handle page routes
      const pageResponse = await handlePageAuth(request)
      if (pageResponse) return pageResponse
    }
    
    // Continue to the requested route
    return NextResponse.next()
    
  } catch (error) {
    console.error('Middleware error:', error)
    
    // For API routes, return JSON error
    if (isApiRoute(pathname)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Authentication service unavailable', 
          code: 'AUTH_SERVICE_ERROR' 
        },
        { status: 500 }
      )
    }
    
    // For page routes, redirect to login with error
    const loginUrl = new URL('/admin/login', request.url)
    loginUrl.searchParams.set('error', 'auth_service_error')
    return NextResponse.redirect(loginUrl)
  }
}

/**
 * Middleware configuration
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.svg$).*)',
  ],
}