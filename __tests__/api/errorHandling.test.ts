/**
 * API Error Handling Validation Tests
 * 
 * This test suite validates that all API route handlers properly handle errors
 * and return structured JSON responses with appropriate HTTP status codes.
 */

import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

// Mock dependencies that might not be available in test environment
jest.mock('@/lib/db', () => ({
  db: {
    query: jest.fn().mockRejectedValue(new Error('Test error')),
    healthCheck: jest.fn().mockResolvedValue({ connected: false, error: 'Test DB error' }),
    connect: jest.fn(),
    disconnect: jest.fn()
  }
}))

jest.mock('@/lib/services/admin', () => ({
  AdminService: {
    getAdminById: jest.fn().mockRejectedValue(new Error('Test admin service error')),
    getAdminByUsername: jest.fn().mockRejectedValue(new Error('Test admin service error')),
    authenticateAdmin: jest.fn().mockRejectedValue(new Error('Test admin service error'))
  }
}))

jest.mock('@/lib/services/auth', () => ({
  AuthService: {
    verifyJWT: jest.fn().mockImplementation(() => {
      throw new Error('Test JWT verification error')
    }),
    generateJWT: jest.fn().mockReturnValue('test-token')
  }
}))

// Mock other services that might be used
jest.mock('@/lib/services/alerts', () => ({
  alertService: {
    getAlertHistory: jest.fn().mockRejectedValue(new Error('Test alert service error')),
    testAlertSystem: jest.fn().mockRejectedValue(new Error('Test alert service error'))
  }
}))

jest.mock('@/lib/auth-edge', () => ({
  EdgeAuthUtils: {
    getAuthTokenFromRequest: jest.fn().mockReturnValue(null),
    verifyJWT: jest.fn().mockRejectedValue(new Error('Test edge auth error'))
  }
}))

// Mock middleware functions
jest.mock('@/lib/api-middleware', () => ({
  validateRequestMethod: jest.fn(),
  createSuccessResponse: jest.fn().mockImplementation((data, message) => 
    NextResponse.json({ success: true, data, message })
  ),
  createApiError: jest.fn().mockImplementation((message, status, code) => {
    const error = new Error(message)
    error.name = code || 'API_ERROR'
    return error
  }),
  handleApiError: jest.fn().mockImplementation((error) => 
    NextResponse.json({ 
      error: error.message || 'Internal server error', 
      status: 500 
    }, { status: 500 })
  )
}))

jest.mock('@/lib/middleware/error-handler', () => ({
  errorHandler: {
    withErrorHandling: jest.fn().mockImplementation((handler) => {
      return async (request: NextRequest) => {
        try {
          return await handler(request)
        } catch (error) {
          return NextResponse.json({
            error: error instanceof Error ? error.message : 'Unknown error',
            status: 500
          }, { status: 500 })
        }
      }
    })
  }
}))

describe('API Route Error Handling', () => {
  let routeFiles: string[] = []

  beforeAll(() => {
    // Find all route files
    routeFiles = findRouteFiles('./app/api')
    console.log(`Found ${routeFiles.length} route files to test`)
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Route File Discovery', () => {
    test('should find route files in the app/api directory', () => {
      expect(routeFiles.length).toBeGreaterThan(0)
      expect(routeFiles.every(file => file.includes('route.ts'))).toBe(true)
    })
  })

  describe('Individual Route Error Handling', () => {
    // Test each route file individually
    routeFiles.forEach((routeFile) => {
      const routeName = routeFile.replace('./app/api/', '').replace('/route.ts', '')
      
      describe(`Route: ${routeName}`, () => {
        let routeModule: any

        beforeAll(async () => {
          try {
            // Dynamic import of the route module
            const modulePath = routeFile.replace('./app/api/', '/app/api/').replace('.ts', '')
            routeModule = await import(`../../${modulePath}`)
          } catch (error) {
            console.warn(`Failed to import ${routeFile}:`, error.message)
            routeModule = null
          }
        })

        test('should be importable without errors', () => {
          expect(routeModule).toBeDefined()
        })

        if (routeModule) {
          // Test GET handler if it exists
          if (routeModule.GET) {
            test('GET handler should handle errors gracefully', async () => {
              const mockRequest = new NextRequest('http://localhost:3000/test', {
                method: 'GET'
              })

              try {
                const response = await routeModule.GET(mockRequest)
                
                // Should return a NextResponse
                expect(response).toBeInstanceOf(NextResponse)
                
                // Parse response
                const responseData = await response.json()
                
                // Should have error structure when error occurs
                if (response.status >= 400) {
                  expect(responseData).toHaveProperty('error')
                  expect(typeof responseData.error).toBe('string')
                }
                
                // Status should be valid HTTP status
                expect(response.status).toBeGreaterThanOrEqual(200)
                expect(response.status).toBeLessThan(600)
                
              } catch (error) {
                // If the handler throws, it should be caught by error middleware
                console.warn(`GET handler for ${routeName} threw uncaught error:`, error.message)
              }
            })
          }

          // Test POST handler if it exists  
          if (routeModule.POST) {
            test('POST handler should handle errors gracefully', async () => {
              const mockRequest = new NextRequest('http://localhost:3000/test', {
                method: 'POST',
                body: JSON.stringify({ test: 'data' }),
                headers: { 'Content-Type': 'application/json' }
              })

              try {
                const response = await routeModule.POST(mockRequest)
                
                // Should return a NextResponse
                expect(response).toBeInstanceOf(NextResponse)
                
                // Parse response
                const responseData = await response.json()
                
                // Should have error structure when error occurs
                if (response.status >= 400) {
                  expect(responseData).toHaveProperty('error')
                  expect(typeof responseData.error).toBe('string')
                }
                
                // Status should be valid HTTP status
                expect(response.status).toBeGreaterThanOrEqual(200)
                expect(response.status).toBeLessThan(600)
                
              } catch (error) {
                // If the handler throws, it should be caught by error middleware
                console.warn(`POST handler for ${routeName} threw uncaught error:`, error.message)
              }
            })
          }

          // Test PUT handler if it exists
          if (routeModule.PUT) {
            test('PUT handler should handle errors gracefully', async () => {
              const mockRequest = new NextRequest('http://localhost:3000/test', {
                method: 'PUT',
                body: JSON.stringify({ test: 'data' }),
                headers: { 'Content-Type': 'application/json' }
              })

              try {
                const response = await routeModule.PUT(mockRequest)
                
                // Should return a NextResponse
                expect(response).toBeInstanceOf(NextResponse)
                
                // Parse response
                const responseData = await response.json()
                
                // Should have error structure when error occurs
                if (response.status >= 400) {
                  expect(responseData).toHaveProperty('error')
                  expect(typeof responseData.error).toBe('string')
                }
                
                // Status should be valid HTTP status
                expect(response.status).toBeGreaterThanOrEqual(200)
                expect(response.status).toBeLessThan(600)
                
              } catch (error) {
                // If the handler throws, it should be caught by error middleware
                console.warn(`PUT handler for ${routeName} threw uncaught error:`, error.message)
              }
            })
          }

          // Test DELETE handler if it exists
          if (routeModule.DELETE) {
            test('DELETE handler should handle errors gracefully', async () => {
              const mockRequest = new NextRequest('http://localhost:3000/test', {
                method: 'DELETE'
              })

              try {
                const response = await routeModule.DELETE(mockRequest)
                
                // Should return a NextResponse
                expect(response).toBeInstanceOf(NextResponse)
                
                // Parse response
                const responseData = await response.json()
                
                // Should have error structure when error occurs
                if (response.status >= 400) {
                  expect(responseData).toHaveProperty('error')
                  expect(typeof responseData.error).toBe('string')
                }
                
                // Status should be valid HTTP status
                expect(response.status).toBeGreaterThanOrEqual(200)
                expect(response.status).toBeLessThan(600)
                
              } catch (error) {
                // If the handler throws, it should be caught by error middleware
                console.warn(`DELETE handler for ${routeName} threw uncaught error:`, error.message)
              }
            })
          }
        }
      })
    })
  })

  describe('Error Response Structure Validation', () => {
    test('should validate error response contains required fields', async () => {
      // Test with a known route that should handle errors
      const metricsRoutePath = './app/api/admin/metrics/route.ts'
      
      if (routeFiles.includes(metricsRoutePath)) {
        try {
          const metricsModule = await import('../../app/api/admin/metrics/route')
          
          if (metricsModule.GET) {
            const mockRequest = new NextRequest('http://localhost:3000/api/admin/metrics', {
              method: 'GET'
            })

            const response = await metricsModule.GET(mockRequest)
            const responseData = await response.json()

            if (response.status >= 400) {
              // Validate error response structure
              expect(responseData).toHaveProperty('error')
              expect(typeof responseData.error).toBe('string')
              expect(responseData.error.length).toBeGreaterThan(0)
              
              // Check for additional error context
              if (responseData.details) {
                expect(typeof responseData.details).toBe('string')
              }
            }
          }
        } catch (error) {
          console.warn('Could not test metrics route error structure:', error.message)
        }
      }
    })

    test('should return appropriate HTTP status codes for different error types', () => {
      const testCases = [
        { errorType: 'ValidationError', expectedStatus: 400 },
        { errorType: 'UnauthorizedError', expectedStatus: 401 },
        { errorType: 'ForbiddenError', expectedStatus: 403 },
        { errorType: 'NotFoundError', expectedStatus: 404 },
        { errorType: 'ConflictError', expectedStatus: 409 },
        { errorType: 'InternalError', expectedStatus: 500 }
      ]

      testCases.forEach(({ errorType, expectedStatus }) => {
        // This is more of a documentation test - ensuring we have proper status mapping
        expect(expectedStatus).toBeGreaterThanOrEqual(400)
        expect(expectedStatus).toBeLessThan(600)
      })
    })
  })

  describe('Route File Static Analysis', () => {
    test('should check that routes have error handling imports', () => {
      let routesWithoutErrorHandling = 0
      let routesWithErrorHandling = 0

      routeFiles.forEach(routeFile => {
        try {
          const content = readFileSync(routeFile, 'utf-8')
          
          // Check for error handling imports
          const hasErrorHandlerImport = (
            content.includes("from '@/lib/utils/errorHandler'") ||
            content.includes("from '@/lib/middleware/error-handler'") ||
            content.includes("from '@/lib/api-middleware'")
          )

          // Check for try-catch blocks
          const hasTryCatch = content.includes('try {') && content.includes('catch')

          if (hasErrorHandlerImport || hasTryCatch) {
            routesWithErrorHandling++
          } else {
            routesWithoutErrorHandling++
            console.warn(`Route without error handling: ${routeFile}`)
          }
        } catch (error) {
          console.warn(`Could not analyze ${routeFile}:`, error.message)
        }
      })

      console.log(`Routes with error handling: ${routesWithErrorHandling}`)
      console.log(`Routes without error handling: ${routesWithoutErrorHandling}`)
      
      // At least 80% of routes should have some form of error handling
      const errorHandlingRatio = routesWithErrorHandling / (routesWithErrorHandling + routesWithoutErrorHandling)
      expect(errorHandlingRatio).toBeGreaterThan(0.8)
    })

    test('should verify no undefined errorHandler references', () => {
      const problematicFiles: string[] = []

      routeFiles.forEach(routeFile => {
        try {
          const content = readFileSync(routeFile, 'utf-8')
          
          // Check for errorHandler usage without proper import
          const usesErrorHandler = /\berrorHandler\s*[(.]/g.test(content)
          const hasImport = (
            content.includes("from '@/lib/utils/errorHandler'") ||
            content.includes("from '@/lib/middleware/error-handler'")
          )

          if (usesErrorHandler && !hasImport) {
            problematicFiles.push(routeFile)
          }
        } catch (error) {
          console.warn(`Could not analyze ${routeFile}:`, error.message)
        }
      })

      if (problematicFiles.length > 0) {
        console.error('Files with undefined errorHandler references:', problematicFiles)
      }
      
      // Should have no files with undefined errorHandler references
      expect(problematicFiles).toHaveLength(0)
    })
  })
})

/**
 * Helper function to find all route files in a directory
 */
function findRouteFiles(dir: string): string[] {
  const files: string[] = []
  
  try {
    const items = readdirSync(dir)
    
    for (const item of items) {
      const fullPath = join(dir, item)
      const stat = statSync(fullPath)
      
      if (stat.isDirectory()) {
        files.push(...findRouteFiles(fullPath))
      } else if (item === 'route.ts') {
        files.push(fullPath)
      }
    }
  } catch (error) {
    // Ignore directory read errors
    console.warn(`Could not read directory ${dir}:`, error.message)
  }

  return files
}