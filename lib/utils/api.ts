/**
 * Utility functions for making authenticated API calls
 */

export interface APIResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

/**
 * Make an authenticated fetch request to admin endpoints
 * Automatically includes credentials for JWT cookie authentication
 */
export async function authenticatedFetch(
  url: string, 
  options: RequestInit = {}
): Promise<Response> {
  return fetch(url, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
}

/**
 * Make an authenticated GET request and return parsed JSON
 */
export async function apiGet<T = any>(url: string): Promise<APIResponse<T>> {
  try {
    const response = await authenticatedFetch(url)
    
    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`
      }
    }
    
    const data = await response.json()
    return {
      success: true,
      data: data.data || data
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Make an authenticated POST request
 */
export async function apiPost<T = any>(
  url: string, 
  data?: any
): Promise<APIResponse<T>> {
  try {
    const response = await authenticatedFetch(url, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
    
    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`
      }
    }
    
    const result = await response.json()
    return {
      success: true,
      data: result.data || result
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Make an authenticated PUT request
 */
export async function apiPut<T = any>(
  url: string, 
  data?: any
): Promise<APIResponse<T>> {
  try {
    const response = await authenticatedFetch(url, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
    
    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`
      }
    }
    
    const result = await response.json()
    return {
      success: true,
      data: result.data || result
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Make an authenticated DELETE request
 */
export async function apiDelete<T = any>(url: string): Promise<APIResponse<T>> {
  try {
    const response = await authenticatedFetch(url, {
      method: 'DELETE',
    })
    
    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`
      }
    }
    
    const result = await response.json()
    return {
      success: true,
      data: result.data || result
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}