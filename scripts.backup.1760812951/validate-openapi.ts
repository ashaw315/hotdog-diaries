#!/usr/bin/env tsx

import { readFileSync } from 'fs'
import { join } from 'path'
import SwaggerParser from '@apidevtools/swagger-parser'
import yaml from 'js-yaml'

async function validateOpenAPISpec() {
  try {
    console.log('🔍 Validating OpenAPI specification...')
    
    const specPath = join(process.cwd(), 'docs', 'openapi.yaml')
    const yamlContent = readFileSync(specPath, 'utf-8')
    const spec = yaml.load(yamlContent)
    
    // Validate the specification using swagger-parser
    const api = await SwaggerParser.validate(spec)
    
    console.log('✅ OpenAPI specification is valid!')
    console.log(`📋 API Title: ${api.info.title}`)
    console.log(`📋 API Version: ${api.info.version}`)
    console.log(`📋 OpenAPI Version: ${api.openapi}`)
    console.log(`📋 Paths: ${Object.keys(api.paths).length}`)
    console.log(`📋 Schemas: ${Object.keys(api.components?.schemas || {}).length}`)
    
    return true
  } catch (error) {
    console.error('❌ OpenAPI specification validation failed:')
    console.error(error.message)
    
    if (error.details) {
      console.error('\n📋 Validation details:')
      error.details.forEach((detail: any) => {
        console.error(`  - ${detail.message}`)
      })
    }
    
    return false
  }
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  validateOpenAPISpec()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error('❌ Validation script failed:', error)
      process.exit(1)
    })
}

export { validateOpenAPISpec }