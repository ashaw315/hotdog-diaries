import { describe, it, expect } from '@jest/globals'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import yaml from 'js-yaml'
import SwaggerParser from '@apidevtools/swagger-parser'

describe('OpenAPI Integration Tests', () => {
  let openApiSpec: any

  beforeAll(() => {
    const specPath = join(process.cwd(), 'docs', 'openapi.yaml')
    if (existsSync(specPath)) {
      const specContent = readFileSync(specPath, 'utf-8')
      openApiSpec = yaml.load(specContent)
    }
  })

  describe('Complete Implementation Validation', () => {
    it('should have a valid OpenAPI 3.1.0 specification file', () => {
      expect(openApiSpec).toBeDefined()
      expect(openApiSpec.openapi).toBe('3.1.0')
      expect(openApiSpec.info.title).toBe('Hotdog Diaries API')
    })

    it('should document all 6 critical endpoints', () => {
      const criticalEndpoints = [
        '/admin/schedule/forecast',
        '/admin/schedule/forecast/refill',
        '/admin/schedule/forecast/reconcile',
        '/admin/health/deep',
        '/admin/health/auth-token',
        '/system/metrics'
      ]

      criticalEndpoints.forEach(endpoint => {
        expect(openApiSpec.paths[endpoint]).toBeDefined()
      })
    })

    it('should have admin authentication security schemes', () => {
      expect(openApiSpec.components.securitySchemes.AdminToken).toBeDefined()
      expect(openApiSpec.components.securitySchemes.AdminToken.type).toBe('http')
      expect(openApiSpec.components.securitySchemes.AdminToken.scheme).toBe('bearer')
    })

    it('should have all required schemas defined', () => {
      const requiredSchemas = [
        'ErrorEnvelope',
        'SuccessEnvelope', 
        'ScheduledSlot',
        'ForecastResponse',
        'RefillRequest',
        'RefillResponse',
        'ReconcileRequest',
        'SystemMetrics'
      ]

      requiredSchemas.forEach(schema => {
        expect(openApiSpec.components.schemas[schema]).toBeDefined()
      })
    })

    it('should pass comprehensive swagger-parser validation', async () => {
      await expect(SwaggerParser.validate(openApiSpec)).resolves.toBeDefined()
    })
  })

  describe('API Inventory Integration', () => {
    it('should have API inventory file generated', () => {
      const inventoryPath = join(process.cwd(), 'docs', 'api-inventory.json')
      expect(existsSync(inventoryPath)).toBe(true)
    })

    it('should have valid ignore list configuration', () => {
      const ignorePath = join(process.cwd(), 'docs', 'openapi.ignore.json')
      if (existsSync(ignorePath)) {
        const ignoreContent = readFileSync(ignorePath, 'utf-8')
        const ignoreList = JSON.parse(ignoreContent)
        
        expect(ignoreList.ignoredRoutes).toBeInstanceOf(Array)
        expect(ignoreList.ignorePatterns).toBeInstanceOf(Array)
      }
    })

    it('should have developer documentation file', () => {
      const docsPath = join(process.cwd(), 'docs', 'api.md')
      expect(existsSync(docsPath)).toBe(true)
      
      const docsContent = readFileSync(docsPath, 'utf-8')
      expect(docsContent).toContain('# Hotdog Diaries API Documentation')
      expect(docsContent).toContain('curl')
      expect(docsContent).toContain('/admin/schedule/forecast')
    })
  })

  describe('Documentation Quality', () => {
    it('should have comprehensive endpoint documentation', () => {
      Object.entries(openApiSpec.paths).forEach(([path, methods]: [string, any]) => {
        Object.entries(methods).forEach(([method, operation]: [string, any]) => {
          if (method !== 'parameters') {
            expect(operation.summary).toBeDefined()
            expect(operation.description).toBeDefined()
            expect(operation.operationId).toBeDefined()
          }
        })
      })
    })

    it('should have proper error response schemas', () => {
      const errorResponses = ['UnauthorizedError', 'ForbiddenError', 'ValidationError', 'InternalServerError']
      
      errorResponses.forEach(responseName => {
        expect(openApiSpec.components.responses[responseName]).toBeDefined()
        const response = openApiSpec.components.responses[responseName]
        expect(response.content['application/json']).toBeDefined()
        
        const schema = response.content['application/json'].schema
        if (schema['$ref']) {
          expect(schema['$ref']).toBe('#/components/schemas/ErrorEnvelope')
        } else {
          // Direct schema reference is also acceptable
          expect(schema).toBeDefined()
        }
      })
    })

    it('should have proper licensing and contact information', () => {
      expect(openApiSpec.info.license).toBeDefined()
      expect(openApiSpec.info.license.name).toBe('MIT')
      expect(openApiSpec.info.license.identifier).toBe('MIT')
      expect(openApiSpec.info.contact).toBeDefined()
    })
  })
})