/**
 * Utility for making authenticated API requests
 */

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  // Get token from localStorage
  const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null
  
  // Prepare headers
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers
  }
  
  // Add Authorization header if token exists
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  // Make the request with auth headers
  return fetch(url, {
    ...options,
    headers
  })
}