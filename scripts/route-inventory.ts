#!/usr/bin/env tsx

import { promises as fs } from 'fs'
import { join, relative, dirname } from 'path'
import { glob } from 'glob'

interface RouteInfo {
  path: string
  methods: string[]
  requiresAuth: boolean
  file: string
  isAdminRoute: boolean
  isPublicRoute: boolean
}

interface InventoryResult {
  timestamp: string
  totalRoutes: number
  adminRoutes: number
  publicRoutes: number
  authRequiredRoutes: number
  routes: RouteInfo[]
}

async function readFileContent(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf-8')
  } catch (error) {
    console.warn(`Warning: Could not read file ${filePath}:`, error)
    return ''
  }
}

function extractHttpMethods(content: string): string[] {
  const methods: string[] = []
  const httpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
  
  for (const method of httpMethods) {
    // Look for export async function GET/POST/etc or export function GET/POST/etc
    const methodRegex = new RegExp(`export\\s+(async\\s+)?function\\s+${method}\\s*\\(`, 'i')
    if (methodRegex.test(content)) {
      methods.push(method)
    }
  }
  
  return methods
}

function checkRequiresAuth(content: string, routePath: string): boolean {
  // Check for common authentication patterns
  const authPatterns = [
    /EdgeAuthUtils\.verifyJWT/,
    /verifyJWT/,
    /Authorization.*Bearer/,
    /x-admin-token/,
    /authHeader/,
    /AUTH_TOKEN/,
    /authenticate/i,
    /requiresAuth/i,
    /checkAuth/i,
    /validateToken/i,
    /getAuthenticatedUser/i
  ]
  
  // Admin routes typically require auth
  if (routePath.includes('/admin/')) {
    return true
  }
  
  // Check for authentication patterns in code
  return authPatterns.some(pattern => pattern.test(content))
}

function routeFileToApiPath(filePath: string): string {
  // Convert file path to API route path
  // Example: app/api/admin/health/route.ts -> /admin/health
  //          app/api/admin/schedule/[id]/route.ts -> /admin/schedule/[id]
  
  const relativePath = relative(join(process.cwd(), 'app/api'), filePath)
  const pathParts = relativePath.split('/')
  
  // Remove the 'route.ts' filename
  pathParts.pop()
  
  // Convert to API path
  const apiPath = '/' + pathParts.join('/')
  
  return apiPath === '/' ? '/' : apiPath
}

async function scanRoutes(): Promise<RouteInfo[]> {
  const routes: RouteInfo[] = []
  const cwd = process.cwd()
  
  // Find all route.ts files in app/api
  const routeFiles = await glob('app/api/**/route.ts', { cwd })
  
  console.log(`Found ${routeFiles.length} route files`)
  
  for (const file of routeFiles) {
    const fullPath = join(cwd, file)
    const content = await readFileContent(fullPath)
    
    if (!content) {
      console.warn(`Skipping empty file: ${file}`)
      continue
    }
    
    const apiPath = routeFileToApiPath(fullPath)
    const methods = extractHttpMethods(content)
    const requiresAuth = checkRequiresAuth(content, apiPath)
    const isAdminRoute = apiPath.includes('/admin/')
    const isPublicRoute = !isAdminRoute && !requiresAuth
    
    if (methods.length === 0) {
      console.warn(`No HTTP methods found in ${file}`)
      continue
    }
    
    routes.push({
      path: apiPath,
      methods,
      requiresAuth,
      file: relative(cwd, fullPath),
      isAdminRoute,
      isPublicRoute
    })
    
    console.log(`📍 ${apiPath} [${methods.join(', ')}] ${requiresAuth ? '🔒' : '🌐'} ${isAdminRoute ? '👑' : ''}`)
  }
  
  return routes.sort((a, b) => a.path.localeCompare(b.path))
}

async function generateInventory(): Promise<InventoryResult> {
  console.log('🔍 Scanning API routes...')
  
  const routes = await scanRoutes()
  
  const result: InventoryResult = {
    timestamp: new Date().toISOString(),
    totalRoutes: routes.length,
    adminRoutes: routes.filter(r => r.isAdminRoute).length,
    publicRoutes: routes.filter(r => r.isPublicRoute).length,
    authRequiredRoutes: routes.filter(r => r.requiresAuth).length,
    routes
  }
  
  return result
}

async function writeInventory(inventory: InventoryResult): Promise<void> {
  const outputPath = join(process.cwd(), 'docs', 'api-inventory.json')
  
  // Ensure docs directory exists
  await fs.mkdir(dirname(outputPath), { recursive: true })
  
  // Write pretty-printed JSON
  await fs.writeFile(outputPath, JSON.stringify(inventory, null, 2), 'utf-8')
  
  console.log(`\n📄 API inventory written to: ${relative(process.cwd(), outputPath)}`)
}

function printSummary(inventory: InventoryResult): void {
  console.log('\n📊 API Route Inventory Summary')
  console.log('================================')
  console.log(`📅 Generated: ${new Date(inventory.timestamp).toLocaleString()}`)
  console.log(`📍 Total routes: ${inventory.totalRoutes}`)
  console.log(`👑 Admin routes: ${inventory.adminRoutes}`)
  console.log(`🌐 Public routes: ${inventory.publicRoutes}`)
  console.log(`🔒 Auth required: ${inventory.authRequiredRoutes}`)
  
  console.log('\n📋 Routes by category:')
  
  // Group by path prefix
  const groups: Record<string, RouteInfo[]> = {}
  inventory.routes.forEach(route => {
    const prefix = route.path.split('/')[1] || 'root'
    if (!groups[prefix]) groups[prefix] = []
    groups[prefix].push(route)
  })
  
  Object.entries(groups).forEach(([prefix, routes]) => {
    console.log(`\n  /${prefix}:`)
    routes.forEach(route => {
      const authIcon = route.requiresAuth ? '🔒' : '🌐'
      const adminIcon = route.isAdminRoute ? '👑' : ''
      console.log(`    ${authIcon}${adminIcon} ${route.path} [${route.methods.join(', ')}]`)
    })
  })
}

async function main(): Promise<void> {
  try {
    console.log('🚀 Starting API route inventory...\n')
    
    const inventory = await generateInventory()
    await writeInventory(inventory)
    printSummary(inventory)
    
    console.log('\n✅ Route inventory completed successfully!')
    
  } catch (error) {
    console.error('❌ Failed to generate route inventory:', error)
    process.exit(1)
  }
}

// Run if called directly
// ES module check for direct execution
const isMainModule = process.argv[1] && process.argv[1].includes('route-inventory')
if (isMainModule) {
  main()
}

export { generateInventory, writeInventory, type RouteInfo, type InventoryResult }