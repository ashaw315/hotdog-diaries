#!/usr/bin/env tsx

/**
 * Script to automatically apply deprecation middleware to legacy endpoints
 * This script identifies legacy endpoints and updates them with deprecation warnings
 */

import { promises as fs } from 'fs'
import path from 'path'
import { DEPRECATED_ENDPOINTS } from '../lib/api-deprecation'

const ADMIN_API_DIR = path.join(process.cwd(), 'app/api/admin')

// Endpoints that should NOT be modified (already consolidated)
const SKIP_ENDPOINTS = new Set([
  '/api/admin/auth',
  '/api/admin/content',
  '/api/admin/platforms',
  '/api/admin/dashboard', 
  '/api/admin/analytics',
  '/api/admin/queue',
  '/api/admin/schedule',
  '/api/admin/health',
  '/api/admin/metrics',
  '/api/admin/maintenance',
  '/api/admin/debug',
  '/api/admin/filters'
])

interface RouteInfo {
  filePath: string
  endpoint: string
  hasDeprecation: boolean
  needsUpdate: boolean
}

async function findAllRouteFiles(): Promise<RouteInfo[]> {
  const routes: RouteInfo[] = []
  
  async function scanDirectory(dir: string, basePath = ''): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      const currentPath = path.join(basePath, entry.name)
      
      if (entry.isDirectory()) {
        await scanDirectory(fullPath, currentPath)
      } else if (entry.name === 'route.ts') {
        const endpoint = `/api/admin${basePath.replace(/\\/g, '/')}`
        
        // Skip consolidated endpoints
        if (SKIP_ENDPOINTS.has(endpoint)) {
          continue
        }
        
        const content = await fs.readFile(fullPath, 'utf-8')
        const hasDeprecation = content.includes('createDeprecatedHandler') || 
                             content.includes('api-deprecation')
        
        const isDeprecated = Object.keys(DEPRECATED_ENDPOINTS).includes(endpoint)
        
        routes.push({
          filePath: fullPath,
          endpoint,
          hasDeprecation,
          needsUpdate: isDeprecated && !hasDeprecation
        })
      }
    }
  }
  
  await scanDirectory(ADMIN_API_DIR)
  return routes
}

async function updateRouteWithDeprecation(route: RouteInfo): Promise<void> {
  console.log(`📝 Updating ${route.endpoint}...`)
  
  const content = await fs.readFile(route.filePath, 'utf-8')
  
  // Check if it's a platform scan endpoint
  const platformMatch = route.endpoint.match(/\/api\/admin\/(\w+)\/scan$/)
  const isImmediateScanEndpoint = route.endpoint.match(/\/api\/admin\/scan-(\w+)-now$/)
  
  let platform: string | null = null
  if (platformMatch) {
    platform = platformMatch[1]
  } else if (isImmediateScanEndpoint) {
    platform = isImmediateScanEndpoint[1]
  } else if (route.endpoint === '/api/admin/social/scan-all') {
    platform = 'all'
  } else if (route.endpoint === '/api/admin/scan-all') {
    platform = 'all'
  }
  
  // Add import if not present
  let updatedContent = content
  if (!content.includes('api-deprecation')) {
    const importMatch = content.match(/^(import .+;\n)+/m)
    if (importMatch) {
      const lastImport = importMatch[0]
      const newImport = `import { createDeprecatedHandler${platform ? ', createPlatformScanRedirectHandler' : ''} } from '@/lib/api-deprecation'\n`
      updatedContent = content.replace(lastImport, lastImport + newImport)
    }
  }
  
  // Update export statements
  if (platform && (platformMatch || isImmediateScanEndpoint || route.endpoint.includes('scan-all'))) {
    // Platform scan endpoint - redirect to consolidated handler
    updatedContent = updatePlatformScanEndpoint(updatedContent, route.endpoint, platform)
  } else {
    // Regular endpoint - add deprecation wrapper
    updatedContent = updateRegularEndpoint(updatedContent, route.endpoint)
  }
  
  await fs.writeFile(route.filePath, updatedContent)
  console.log(`✅ Updated ${route.endpoint}`)
}

function updatePlatformScanEndpoint(content: string, endpoint: string, platform: string): string {
  // Replace export statements with deprecated handlers
  let updated = content
  
  // Handle POST export
  if (content.includes('export async function POST')) {
    const postMatch = content.match(/export async function POST\([^)]+\)[\s\S]*?^}/m)
    if (postMatch) {
      // Replace with deprecated handler that redirects
      updated = updated.replace(
        /export async function POST/,
        'async function originalPOSTHandler'
      )
      
      updated += `\n\n// Deprecated handler with redirection to consolidated endpoint
export const POST = createDeprecatedHandler(
  '${endpoint}',
  createPlatformScanRedirectHandler('${platform}')
)\n`
    }
  }
  
  // Handle GET export (if present)
  if (content.includes('export async function GET')) {
    updated = updated.replace(
      /export async function GET/,
      'async function originalGETHandler'
    )
    
    updated += `\nexport const GET = createDeprecatedHandler(
  '${endpoint}',
  originalGETHandler
)\n`
  }
  
  return updated
}

function updateRegularEndpoint(content: string, endpoint: string): string {
  let updated = content
  
  // Update POST handler
  if (content.includes('export async function POST')) {
    updated = updated.replace(
      /export async function POST/,
      'async function originalPOSTHandler'
    )
    
    updated += `\n\n// Deprecated handler
export const POST = createDeprecatedHandler(
  '${endpoint}',
  originalPOSTHandler
)\n`
  }
  
  // Update GET handler
  if (content.includes('export async function GET')) {
    updated = updated.replace(
      /export async function GET/,
      'async function originalGETHandler'
    )
    
    updated += `\nexport const GET = createDeprecatedHandler(
  '${endpoint}',
  originalGETHandler
)\n`
  }
  
  // Update PUT handler
  if (content.includes('export async function PUT')) {
    updated = updated.replace(
      /export async function PUT/,
      'async function originalPUTHandler'
    )
    
    updated += `\nexport const PUT = createDeprecatedHandler(
  '${endpoint}',
  originalPUTHandler
)\n`
  }
  
  // Update DELETE handler
  if (content.includes('export async function DELETE')) {
    updated = updated.replace(
      /export async function DELETE/,
      'async function originalDELETEHandler'
    )
    
    updated += `\nexport const DELETE = createDeprecatedHandler(
  '${endpoint}',
  originalDELETEHandler
)\n`
  }
  
  return updated
}

async function generateDeprecationReport(routes: RouteInfo[]): Promise<void> {
  const deprecatedRoutes = routes.filter(r => Object.keys(DEPRECATED_ENDPOINTS).includes(r.endpoint))
  const needsUpdate = routes.filter(r => r.needsUpdate)
  const alreadyUpdated = routes.filter(r => r.hasDeprecation)
  
  const report = `# Deprecation Status Report
Generated: ${new Date().toISOString()}

## Summary
- **Total Admin Routes:** ${routes.length}
- **Deprecated Endpoints:** ${deprecatedRoutes.length}
- **Already Updated:** ${alreadyUpdated.length}
- **Needs Update:** ${needsUpdate.length}

## Deprecated Endpoints Status

${deprecatedRoutes.map(route => `
### ${route.endpoint}
- **File:** ${route.filePath.replace(process.cwd(), '')}
- **Has Deprecation:** ${route.hasDeprecation ? '✅' : '❌'}
- **Replacement:** ${DEPRECATED_ENDPOINTS[route.endpoint]?.replacementEndpoint || 'Unknown'}
- **Removal Date:** ${DEPRECATED_ENDPOINTS[route.endpoint]?.removalDate || 'Unknown'}
`).join('')}

## Endpoints Needing Update

${needsUpdate.map(route => `- ${route.endpoint} (${route.filePath.replace(process.cwd(), '')})`).join('\n')}

## Already Updated Endpoints

${alreadyUpdated.map(route => `- ${route.endpoint} (${route.filePath.replace(process.cwd(), '')})`).join('\n')}
`

  await fs.writeFile('docs/deprecation-status-report.md', report)
  console.log('📋 Deprecation status report generated: docs/deprecation-status-report.md')
}

async function main(): Promise<void> {
  try {
    console.log('🔍 Scanning for legacy admin API endpoints...')
    
    const routes = await findAllRouteFiles()
    console.log(`📊 Found ${routes.length} admin API routes`)
    
    // Generate initial report
    await generateDeprecationReport(routes)
    
    const needsUpdate = routes.filter(r => r.needsUpdate)
    
    if (needsUpdate.length === 0) {
      console.log('✅ All deprecated endpoints already have deprecation middleware applied!')
      return
    }
    
    console.log(`📝 Updating ${needsUpdate.length} endpoints with deprecation middleware...`)
    
    // Apply deprecation middleware to endpoints that need it
    for (const route of needsUpdate) {
      try {
        await updateRouteWithDeprecation(route)
      } catch (error) {
        console.error(`❌ Failed to update ${route.endpoint}:`, error)
      }
    }
    
    // Generate final report
    const updatedRoutes = await findAllRouteFiles()
    await generateDeprecationReport(updatedRoutes)
    
    console.log('🎉 Deprecation middleware application complete!')
    console.log(`📋 Updated ${needsUpdate.length} endpoints`)
    
  } catch (error) {
    console.error('❌ Error applying deprecation middleware:', error)
    process.exit(1)
  }
}

// Run the script
// ES module check for direct execution
const isMainModule = process.argv[1] && process.argv[1].includes('apply-deprecation-middleware')
if (isMainModule) {
  main()
}

export { main as applyDeprecationMiddleware }