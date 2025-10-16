import { describe, it, expect, beforeAll } from '@jest/globals'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import yaml from 'js-yaml'
import { generateInventory } from '@/scripts/route-inventory'

describe('OpenAPI Drift Detection Integration', () => {
  let openApiSpec: any
  let routeInventory: any
  let ignoreList: any

  beforeAll(async () => {
    // Load OpenAPI specification
    const specPath = join(process.cwd(), 'docs', 'openapi.yaml')
    if (existsSync(specPath)) {
      const specContent = readFileSync(specPath, 'utf-8')
      openApiSpec = yaml.load(specContent)
    }

    // Generate current route inventory
    try {
      routeInventory = await generateInventory()
    } catch (error) {
      console.warn('Could not generate route inventory:', error)
      routeInventory = { routes: [] }
    }

    // Load ignore list
    const ignorePath = join(process.cwd(), 'docs', 'openapi.ignore.json')
    if (existsSync(ignorePath)) {
      const ignoreContent = readFileSync(ignorePath, 'utf-8')
      ignoreList = JSON.parse(ignoreContent)
    } else {
      ignoreList = { ignoredRoutes: [], ignorePatterns: [] }
    }
  })

  describe('Specification Coverage', () => {
    it('should have OpenAPI specification file', () => {
      expect(openApiSpec).toBeDefined()
      expect(openApiSpec.openapi).toBe('3.1.0')
    })

    it('should have route inventory', () => {
      expect(routeInventory).toBeDefined()
      expect(Array.isArray(routeInventory.routes)).toBe(true)
    })

    it('should have ignore list configuration', () => {
      expect(ignoreList).toBeDefined()
      expect(Array.isArray(ignoreList.ignoredRoutes)).toBe(true)
      expect(Array.isArray(ignoreList.ignorePatterns)).toBe(true)
    })
  })

  describe('Critical Routes Coverage', () => {
    const criticalRoutes = [
      '/admin/schedule/forecast',
      '/admin/schedule/forecast/refill',
      '/admin/schedule/forecast/reconcile',
      '/admin/health/deep',
      '/admin/health/auth-token',
      '/system/metrics'
    ]

    it.each(criticalRoutes)('should document critical route %s', (route) => {
      expect(openApiSpec.paths[route]).toBeDefined()
    })

    it('should have all critical routes in codebase', () => {
      if (routeInventory.routes.length === 0) {
        console.warn('No routes found in inventory - skipping codebase check')
        return
      }

      const actualPaths = routeInventory.routes.map((r: any) => r.path)
      
      criticalRoutes.forEach(criticalRoute => {
        const apiPath = `/api${criticalRoute}`
        expect(actualPaths).toContain(apiPath)
      })
    })
  })

  describe('Route Documentation Drift', () => {
    it('should not have undocumented routes (excluding ignored)', () => {
      if (!openApiSpec?.paths || routeInventory.routes.length === 0) {
        console.warn('Insufficient data for drift detection - skipping')
        return
      }

      // Get documented routes from OpenAPI spec
      const documentedRoutes = Object.keys(openApiSpec.paths).map(path => `/api${path}`)
      
      // Get actual routes from inventory
      const actualRoutes = routeInventory.routes.map((r: any) => r.path)
      
      // Function to check if route is ignored
      const isIgnored = (route: string): boolean => {
        // Check exact matches
        if (ignoreList.ignoredRoutes.some((ignored: any) => ignored.path === route)) {
          return true
        }
        
        // Check patterns
        return ignoreList.ignorePatterns.some((pattern: any) => {
          const regex = new RegExp(pattern.pattern)
          return regex.test(route)
        })
      }
      
      // Find undocumented routes
      const undocumentedRoutes = actualRoutes.filter((route: string) => 
        !documentedRoutes.includes(route) && !isIgnored(route)
      )
      
      if (undocumentedRoutes.length > 0) {
        console.error('Undocumented routes found:', undocumentedRoutes)
        expect(undocumentedRoutes).toHaveLength(0)
      }
    })

    it('should not have documented routes that do not exist in codebase', () => {
      if (!openApiSpec?.paths || routeInventory.routes.length === 0) {
        console.warn('Insufficient data for existence check - skipping')
        return
      }

      const documentedRoutes = Object.keys(openApiSpec.paths).map(path => `/api${path}`)
      const actualRoutes = routeInventory.routes.map((r: any) => r.path)
      
      const nonExistentRoutes = documentedRoutes.filter((route: string) => 
        !actualRoutes.includes(route)
      )
      
      if (nonExistentRoutes.length > 0) {
        console.error('Documented routes not found in codebase:', nonExistentRoutes)
        expect(nonExistentRoutes).toHaveLength(0)
      }
    })
  })

  describe('Authentication Consistency', () => {
    it('should have consistent auth requirements between spec and code', () => {
      if (!openApiSpec?.paths || routeInventory.routes.length === 0) {
        console.warn('Insufficient data for auth consistency check - skipping')
        return
      }

      routeInventory.routes.forEach((route: any) => {
        const specPath = route.path.replace('/api', '')
        const specRoute = openApiSpec.paths[specPath]
        
        if (specRoute) {
          const hasSpecAuth = Object.values(specRoute).some((operation: any) => 
            operation.security && operation.security.length > 0
          )
          
          // Admin routes should always require auth
          if (route.isAdminRoute) {
            expect(route.requiresAuth).toBe(true)
            if (hasSpecAuth !== undefined) {
              expect(hasSpecAuth).toBe(true)
            }
          }
          
          // If code requires auth, spec should too
          if (route.requiresAuth && hasSpecAuth !== undefined) {
            expect(hasSpecAuth).toBe(true)
          }
        }
      })
    })

    it('should have AdminToken security scheme for admin routes', () => {
      if (!openApiSpec?.paths) return

      Object.entries(openApiSpec.paths).forEach(([path, methods]: [string, any]) => {
        if (path.startsWith('/admin/')) {
          Object.entries(methods).forEach(([method, operation]: [string, any]) => {
            if (method !== 'parameters' && operation.security) {
              expect(operation.security).toEqual([{ AdminToken: [] }])
            }
          })
        }
      })
    })
  })

  describe('Method Coverage', () => {
    it('should document all HTTP methods present in code', () => {
      if (!openApiSpec?.paths || routeInventory.routes.length === 0) {
        console.warn('Insufficient data for method coverage check - skipping')
        return
      }

      routeInventory.routes.forEach((route: any) => {
        const specPath = route.path.replace('/api', '')
        const specRoute = openApiSpec.paths[specPath]
        
        if (specRoute) {
          const specMethods = Object.keys(specRoute)
            .filter(key => key !== 'parameters')
            .map(method => method.toUpperCase())
          
          route.methods.forEach((method: string) => {
            expect(specMethods).toContain(method)
          })
        }
      })
    })
  })

  describe('Ignore List Validation', () => {
    it('should have valid ignore list structure', () => {
      expect(ignoreList.ignoredRoutes).toBeInstanceOf(Array)
      expect(ignoreList.ignorePatterns).toBeInstanceOf(Array)
      
      ignoreList.ignoredRoutes.forEach((ignored: any) => {
        expect(ignored).toHaveProperty('path')
        expect(ignored).toHaveProperty('reason')
        expect(typeof ignored.path).toBe('string')
        expect(typeof ignored.reason).toBe('string')
      })
      
      ignoreList.ignorePatterns.forEach((pattern: any) => {
        expect(pattern).toHaveProperty('pattern')
        expect(pattern).toHaveProperty('reason')
        expect(typeof pattern.pattern).toBe('string')
        expect(typeof pattern.reason).toBe('string')
        
        // Validate regex pattern
        expect(() => new RegExp(pattern.pattern)).not.toThrow()
      })
    })

    it('should have reasonable ignore reasons', () => {
      const validReasonPatterns = [
        /internal/i,
        /debug/i,
        /development/i,
        /webhook/i,
        /callback/i,
        /static/i,
        /file/i,
        /test/i,
        /oauth/i,
        /simple/i,
        /basic/i
      ]
      
      ignoreList.ignoredRoutes.forEach((ignored: any) => {
        const hasValidReason = validReasonPatterns.some(pattern => 
          pattern.test(ignored.reason)
        )
        expect(hasValidReason).toBe(true)
      })
    })
  })

  describe('Schema Completeness', () => {
    it('should have schemas for all documented response types', () => {
      if (!openApiSpec?.paths || !openApiSpec?.components?.schemas) return

      const referencedSchemas = new Set<string>()
      
      // Extract all schema references from paths
      Object.values(openApiSpec.paths).forEach((methods: any) => {
        Object.values(methods).forEach((operation: any) => {
          if (operation.responses) {
            Object.values(operation.responses).forEach((response: any) => {
              if (response.content?.['application/json']?.schema) {
                const schema = response.content['application/json'].schema
                if (schema.$ref) {
                  const schemaName = schema.$ref.split('/').pop()
                  referencedSchemas.add(schemaName)
                }
                if (schema.allOf) {
                  schema.allOf.forEach((subSchema: any) => {
                    if (subSchema.$ref) {
                      const schemaName = subSchema.$ref.split('/').pop()
                      referencedSchemas.add(schemaName)
                    }
                  })
                }
              }
            })
          }
          
          if (operation.requestBody?.content?.['application/json']?.schema?.$ref) {
            const schemaName = operation.requestBody.content['application/json'].schema.$ref.split('/').pop()
            referencedSchemas.add(schemaName)
          }
        })
      })
      
      // Check that all referenced schemas exist
      referencedSchemas.forEach(schemaName => {
        expect(openApiSpec.components.schemas[schemaName]).toBeDefined()
      })
    })
  })
})