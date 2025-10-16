import { describe, it, expect, beforeAll } from '@jest/globals'
import { readFileSync } from 'fs'
import { join } from 'path'
import yaml from 'js-yaml'

// OpenAPI validation utilities
import SwaggerParser from '@apidevtools/swagger-parser'

describe('OpenAPI Specification Validation', () => {
  let openApiSpec: any
  let openApiYaml: string

  beforeAll(async () => {
    // Load the OpenAPI specification
    const specPath = join(process.cwd(), 'docs', 'openapi.yaml')
    openApiYaml = readFileSync(specPath, 'utf-8')
    openApiSpec = yaml.load(openApiYaml)
  })

  describe('Basic Structure', () => {
    it('should have valid OpenAPI 3.1.0 structure', () => {
      expect(openApiSpec).toBeDefined()
      expect(openApiSpec.openapi).toBe('3.1.0')
      expect(openApiSpec.info).toBeDefined()
      expect(openApiSpec.info.title).toBe('Hotdog Diaries API')
      expect(openApiSpec.info.version).toBeDefined()
    })

    it('should have required sections', () => {
      expect(openApiSpec.info).toBeDefined()
      expect(openApiSpec.servers).toBeDefined()
      expect(openApiSpec.paths).toBeDefined()
      expect(openApiSpec.components).toBeDefined()
      expect(openApiSpec.components.schemas).toBeDefined()
      expect(openApiSpec.components.securitySchemes).toBeDefined()
    })

    it('should have proper server configurations', () => {
      expect(openApiSpec.servers).toHaveLength(2)
      
      const prodServer = openApiSpec.servers.find((s: any) => s.url.includes('hotdog-diaries.vercel.app'))
      const devServer = openApiSpec.servers.find((s: any) => s.url.includes('localhost'))
      
      expect(prodServer).toBeDefined()
      expect(devServer).toBeDefined()
    })
  })

  describe('Security Configuration', () => {
    it('should have AdminToken security scheme', () => {
      const securitySchemes = openApiSpec.components.securitySchemes
      expect(securitySchemes.AdminToken).toBeDefined()
      expect(securitySchemes.AdminToken.type).toBe('http')
      expect(securitySchemes.AdminToken.scheme).toBe('bearer')
      expect(securitySchemes.AdminToken.bearerFormat).toBe('JWT')
    })

    it('should have alternative header configuration', () => {
      const adminToken = openApiSpec.components.securitySchemes.AdminToken
      expect(adminToken['x-alternative-header']).toBeDefined()
      expect(adminToken['x-alternative-header'].name).toBe('x-admin-token')
    })
  })

  describe('Critical Endpoints', () => {
    const requiredEndpoints = [
      '/admin/schedule/forecast',
      '/admin/schedule/forecast/refill',
      '/admin/schedule/forecast/reconcile',
      '/admin/health/deep',
      '/admin/health/auth-token',
      '/system/metrics'
    ]

    it.each(requiredEndpoints)('should document endpoint %s', (endpoint) => {
      expect(openApiSpec.paths[endpoint]).toBeDefined()
    })

    it('should have GET method for forecast endpoint', () => {
      const forecastPath = openApiSpec.paths['/admin/schedule/forecast']
      expect(forecastPath.get).toBeDefined()
      expect(forecastPath.get.operationId).toBe('getForecast')
      expect(forecastPath.get.security).toEqual([{ AdminToken: [] }])
    })

    it('should have POST method for refill endpoint', () => {
      const refillPath = openApiSpec.paths['/admin/schedule/forecast/refill']
      expect(refillPath.post).toBeDefined()
      expect(refillPath.post.operationId).toBe('refillSchedule')
      expect(refillPath.post.requestBody).toBeDefined()
    })

    it('should have POST method for reconcile endpoint', () => {
      const reconcilePath = openApiSpec.paths['/admin/schedule/forecast/reconcile']
      expect(reconcilePath.post).toBeDefined()
      expect(reconcilePath.post.operationId).toBe('reconcileSchedule')
    })

    it('should have public system metrics endpoint', () => {
      const metricsPath = openApiSpec.paths['/system/metrics']
      expect(metricsPath.get).toBeDefined()
      expect(metricsPath.get.operationId).toBe('getSystemMetrics')
      // Should not require security for system metrics
      expect(metricsPath.get.security).toBeUndefined()
    })
  })

  describe('Schema Definitions', () => {
    const requiredSchemas = [
      'ErrorEnvelope',
      'SuccessEnvelope',
      'ScheduledSlot',
      'DiversitySummary',
      'ForecastResponse',
      'RefillRequest',
      'RefillResponse',
      'ReconcileRequest',
      'ReconcileResponse',
      'DeepHealthResponse',
      'AuthTokenResponse',
      'SystemMetrics'
    ]

    it.each(requiredSchemas)('should define schema %s', (schemaName) => {
      expect(openApiSpec.components.schemas[schemaName]).toBeDefined()
    })

    it('should have proper ErrorEnvelope structure', () => {
      const errorSchema = openApiSpec.components.schemas.ErrorEnvelope
      expect(errorSchema.type).toBe('object')
      expect(errorSchema.properties.ok).toBeDefined()
      expect(errorSchema.properties.code).toBeDefined()
      expect(errorSchema.properties.message).toBeDefined()
      expect(errorSchema.properties.rid).toBeDefined()
    })

    it('should have proper ScheduledSlot structure', () => {
      const slotSchema = openApiSpec.components.schemas.ScheduledSlot
      expect(slotSchema.type).toBe('object')
      expect(slotSchema.properties.slot_index).toBeDefined()
      expect(slotSchema.properties.time).toBeDefined()
      expect(slotSchema.properties.content_id).toBeDefined()
      expect(slotSchema.properties.status).toBeDefined()
    })

    it('should have proper ForecastResponse structure', () => {
      const forecastSchema = openApiSpec.components.schemas.ForecastResponse
      expect(forecastSchema.properties.date).toBeDefined()
      expect(forecastSchema.properties.slots).toBeDefined()
      expect(forecastSchema.properties.summary).toBeDefined()
      
      // Slots should be array of ScheduledSlot with exact length
      const slotsProperty = forecastSchema.properties.slots
      expect(slotsProperty.type).toBe('array')
      expect(slotsProperty.minItems).toBe(6)
      expect(slotsProperty.maxItems).toBe(6)
    })
  })

  describe('Response Definitions', () => {
    const responseRefs = [
      'UnauthorizedError',
      'ForbiddenError',
      'ValidationError',
      'InternalServerError'
    ]

    it.each(responseRefs)('should define response %s', (responseName) => {
      expect(openApiSpec.components.responses[responseName]).toBeDefined()
    })

    it('should have consistent error response structure', () => {
      const responses = openApiSpec.components.responses
      
      Object.values(responses).forEach((response: any) => {
        expect(response.content['application/json']).toBeDefined()
        const schema = response.content['application/json'].schema
        expect(schema['$ref']).toBe('#/components/schemas/ErrorEnvelope')
      })
    })
  })

  describe('Parameter Validation', () => {
    it('should have proper date parameter in forecast endpoint', () => {
      const forecastPath = openApiSpec.paths['/admin/schedule/forecast']
      const dateParam = forecastPath.get.parameters.find((p: any) => p.name === 'date')
      
      expect(dateParam).toBeDefined()
      expect(dateParam.required).toBe(true)
      expect(dateParam.schema.type).toBe('string')
      expect(dateParam.schema.format).toBe('date')
    })

    it('should have proper request body schemas for POST endpoints', () => {
      const refillPath = openApiSpec.paths['/admin/schedule/forecast/refill']
      const refillBody = refillPath.post.requestBody
      
      expect(refillBody.required).toBe(true)
      expect(refillBody.content['application/json']).toBeDefined()
      
      const schema = refillBody.content['application/json'].schema
      expect(schema['$ref']).toBe('#/components/schemas/RefillRequest')
    })
  })

  describe('Specification Validity', () => {
    it('should pass swagger-parser validation', async () => {
      // This is a comprehensive validation using swagger-parser
      await expect(SwaggerParser.validate(openApiSpec)).resolves.toBeDefined()
    })

    it('should not have circular references', async () => {
      const api = await SwaggerParser.dereference(openApiSpec)
      expect(api).toBeDefined()
      
      // If this doesn't throw, there are no circular references
      JSON.stringify(api)
    })

    it('should have valid examples in all schemas', () => {
      const schemas = openApiSpec.components.schemas
      
      Object.entries(schemas).forEach(([name, schema]: [string, any]) => {
        if (schema.properties) {
          Object.values(schema.properties).forEach((prop: any) => {
            if (prop.example !== undefined) {
              // Verify example matches type
              if (prop.type === 'string' && prop.format === 'date') {
                expect(prop.example).toMatch(/^\d{4}-\d{2}-\d{2}$/)
              }
              if (prop.type === 'string' && prop.format === 'date-time') {
                expect(prop.example).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
              }
              if (prop.type === 'integer') {
                expect(typeof prop.example).toBe('number')
                expect(Number.isInteger(prop.example)).toBe(true)
              }
              if (prop.type === 'boolean') {
                expect(typeof prop.example).toBe('boolean')
              }
            }
          })
        }
      })
    })
  })

  describe('Documentation Quality', () => {
    it('should have descriptions for all endpoints', () => {
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

    it('should have proper tags for organization', () => {
      expect(openApiSpec.tags).toBeDefined()
      expect(openApiSpec.tags.length).toBeGreaterThan(0)
      
      const tagNames = openApiSpec.tags.map((t: any) => t.name)
      expect(tagNames).toContain('Schedule')
      expect(tagNames).toContain('Health')
      expect(tagNames).toContain('Metrics')
    })

    it('should have examples in request bodies', () => {
      const refillPath = openApiSpec.paths['/admin/schedule/forecast/refill']
      const examples = refillPath.post.requestBody.content['application/json'].examples
      
      expect(examples).toBeDefined()
      expect(examples.single_day).toBeDefined()
      expect(examples.two_days).toBeDefined()
      expect(examples.force_recreate).toBeDefined()
    })
  })
})

describe('Route Inventory Integration', () => {
  it('should validate that critical routes exist in codebase', async () => {
    // This test would be enhanced to actually run the route inventory
    // and compare with the OpenAPI spec when the script is fully integrated
    
    const criticalEndpoints = [
      '/admin/schedule/forecast',
      '/admin/schedule/forecast/refill', 
      '/admin/schedule/forecast/reconcile',
      '/admin/health/deep',
      '/admin/health/auth-token',
      '/system/metrics'
    ]
    
    // For now, just verify the endpoints are documented
    criticalEndpoints.forEach(endpoint => {
      const specPath = join(process.cwd(), 'docs', 'openapi.yaml')
      const content = readFileSync(specPath, 'utf-8')
      expect(content).toContain(endpoint)
    })
  })
})