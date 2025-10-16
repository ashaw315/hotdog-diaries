import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { promises as fs } from 'fs'
import { join } from 'path'
import { generateInventory, writeInventory, type RouteInfo } from '@/scripts/route-inventory'

// Mock fs and glob
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn()
  }
}))

jest.mock('glob', () => ({
  glob: jest.fn()
}))

const mockFs = fs as jest.Mocked<typeof fs>
const mockGlob = require('glob').glob as jest.MockedFunction<any>

describe('Route Inventory Script', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Route Detection', () => {
    it('should detect HTTP methods in route files', async () => {
      const routeFileContent = `
        export async function GET(request: NextRequest) {
          return NextResponse.json({ message: 'Hello' })
        }
        
        export function POST(request: NextRequest) {
          return NextResponse.json({ message: 'Created' })
        }
      `
      
      mockGlob.mockResolvedValue(['app/api/test/route.ts'])
      mockFs.readFile.mockResolvedValue(routeFileContent as any)
      
      const inventory = await generateInventory()
      
      expect(inventory.routes).toHaveLength(1)
      expect(inventory.routes[0].methods).toEqual(['GET', 'POST'])
    })

    it('should detect authentication requirements', async () => {
      const authRouteContent = `
        import { EdgeAuthUtils } from '@/lib/auth-edge'
        
        export async function GET(request: NextRequest) {
          const token = request.headers.get('Authorization')
          const decoded = await EdgeAuthUtils.verifyJWT(token)
          return NextResponse.json({ user: decoded })
        }
      `
      
      mockGlob.mockResolvedValue(['app/api/admin/test/route.ts'])
      mockFs.readFile.mockResolvedValue(authRouteContent)
      
      const inventory = await generateInventory()
      
      expect(inventory.routes[0].requiresAuth).toBe(true)
      expect(inventory.routes[0].isAdminRoute).toBe(true)
    })

    it('should identify public routes correctly', async () => {
      const publicRouteContent = `
        export async function GET(request: NextRequest) {
          return NextResponse.json({ status: 'ok' })
        }
      `
      
      mockGlob.mockResolvedValue(['app/api/health/route.ts'])
      mockFs.readFile.mockResolvedValue(publicRouteContent)
      
      const inventory = await generateInventory()
      
      expect(inventory.routes[0].requiresAuth).toBe(false)
      expect(inventory.routes[0].isAdminRoute).toBe(false)
      expect(inventory.routes[0].isPublicRoute).toBe(true)
    })

    it('should convert file paths to API paths correctly', async () => {
      const testCases = [
        ['app/api/health/route.ts', '/health'],
        ['app/api/admin/schedule/route.ts', '/admin/schedule'],
        ['app/api/admin/schedule/[id]/route.ts', '/admin/schedule/[id]'],
        ['app/api/system/metrics/route.ts', '/system/metrics']
      ]
      
      for (const [filePath, expectedPath] of testCases) {
        mockGlob.mockResolvedValue([filePath])
        mockFs.readFile.mockResolvedValue('export function GET() {}')
        
        const inventory = await generateInventory()
        
        expect(inventory.routes[0].path).toBe(expectedPath)
      }
    })
  })

  describe('Authentication Detection Patterns', () => {
    const authPatterns = [
      'EdgeAuthUtils.verifyJWT',
      'Authorization: Bearer',
      'x-admin-token',
      'authHeader',
      'AUTH_TOKEN',
      'authenticate()',
      'requiresAuth: true',
      'checkAuth()',
      'validateToken()',
      'getAuthenticatedUser()'
    ]

    it.each(authPatterns)('should detect auth pattern: %s', async (pattern) => {
      const routeContent = `
        export async function GET(request: NextRequest) {
          // ${pattern}
          return NextResponse.json({ message: 'Protected' })
        }
      `
      
      mockGlob.mockResolvedValue(['app/api/test/route.ts'])
      mockFs.readFile.mockResolvedValue(routeContent)
      
      const inventory = await generateInventory()
      
      expect(inventory.routes[0].requiresAuth).toBe(true)
    })

    it('should automatically mark admin routes as requiring auth', async () => {
      const routeContent = `
        export async function GET(request: NextRequest) {
          return NextResponse.json({ message: 'Admin only' })
        }
      `
      
      mockGlob.mockResolvedValue(['app/api/admin/users/route.ts'])
      mockFs.readFile.mockResolvedValue(routeContent)
      
      const inventory = await generateInventory()
      
      expect(inventory.routes[0].requiresAuth).toBe(true)
      expect(inventory.routes[0].isAdminRoute).toBe(true)
    })
  })

  describe('Inventory Generation', () => {
    it('should generate complete inventory with metadata', async () => {
      const routeFiles = [
        'app/api/health/route.ts',
        'app/api/admin/schedule/route.ts',
        'app/api/system/metrics/route.ts'
      ]
      
      const routeContents = [
        'export function GET() { return NextResponse.json({ok: true}) }',
        'export function GET() { /* admin route */ } export function POST() { /* EdgeAuthUtils.verifyJWT */ }',
        'export function GET() { return NextResponse.json({metrics: {}}) }'
      ]
      
      mockGlob.mockResolvedValue(routeFiles)
      mockFs.readFile.mockImplementation(async (path: string) => {
        const index = routeFiles.findIndex(file => path.includes(file))
        return routeContents[index] || ''
      })
      
      const inventory = await generateInventory()
      
      expect(inventory.totalRoutes).toBe(3)
      expect(inventory.adminRoutes).toBe(1)
      expect(inventory.publicRoutes).toBe(2)
      expect(inventory.authRequiredRoutes).toBe(1)
      expect(inventory.timestamp).toBeDefined()
      expect(inventory.routes).toHaveLength(3)
      
      // Verify routes are sorted by path
      const paths = inventory.routes.map(r => r.path)
      expect(paths).toEqual(['/admin/schedule', '/health', '/system/metrics'])
    })

    it('should handle empty or invalid route files', async () => {
      mockGlob.mockResolvedValue(['app/api/empty/route.ts', 'app/api/invalid/route.ts'])
      mockFs.readFile
        .mockResolvedValueOnce('') // empty file
        .mockResolvedValueOnce('const x = 1; // no exports') // no HTTP methods
      
      const inventory = await generateInventory()
      
      expect(inventory.totalRoutes).toBe(0)
      expect(inventory.routes).toHaveLength(0)
    })

    it('should handle file read errors gracefully', async () => {
      mockGlob.mockResolvedValue(['app/api/test/route.ts'])
      mockFs.readFile.mockRejectedValue(new Error('File not found'))
      
      const inventory = await generateInventory()
      
      expect(inventory.totalRoutes).toBe(0)
      expect(inventory.routes).toHaveLength(0)
    })
  })

  describe('Inventory Output', () => {
    it('should write inventory to correct location', async () => {
      const mockInventory = {
        timestamp: new Date().toISOString(),
        totalRoutes: 1,
        adminRoutes: 0,
        publicRoutes: 1,
        authRequiredRoutes: 0,
        routes: [{
          path: '/test',
          methods: ['GET'],
          requiresAuth: false,
          file: 'app/api/test/route.ts',
          isAdminRoute: false,
          isPublicRoute: true
        }]
      }
      
      await writeInventory(mockInventory)
      
      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('docs'),
        { recursive: true }
      )
      
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('docs/api-inventory.json'),
        JSON.stringify(mockInventory, null, 2),
        'utf-8'
      )
    })

    it('should produce valid JSON output', async () => {
      const mockInventory = {
        timestamp: '2023-10-15T12:00:00.000Z',
        totalRoutes: 2,
        adminRoutes: 1,
        publicRoutes: 1,
        authRequiredRoutes: 1,
        routes: [
          {
            path: '/admin/test',
            methods: ['GET', 'POST'],
            requiresAuth: true,
            file: 'app/api/admin/test/route.ts',
            isAdminRoute: true,
            isPublicRoute: false
          },
          {
            path: '/public/test',
            methods: ['GET'],
            requiresAuth: false,
            file: 'app/api/public/test/route.ts',
            isAdminRoute: false,
            isPublicRoute: true
          }
        ]
      }
      
      await writeInventory(mockInventory)
      
      const writtenContent = mockFs.writeFile.mock.calls[0][1] as string
      expect(() => JSON.parse(writtenContent)).not.toThrow()
      
      const parsed = JSON.parse(writtenContent)
      expect(parsed).toEqual(mockInventory)
    })
  })

  describe('Route Classification', () => {
    it('should correctly classify different route types', async () => {
      const testRoutes = [
        {
          content: 'export function GET() {}',
          path: 'app/api/health/route.ts',
          expectedClassification: {
            requiresAuth: false,
            isAdminRoute: false,
            isPublicRoute: true
          }
        },
        {
          content: 'export function GET() { EdgeAuthUtils.verifyJWT() }',
          path: 'app/api/admin/users/route.ts',
          expectedClassification: {
            requiresAuth: true,
            isAdminRoute: true,
            isPublicRoute: false
          }
        },
        {
          content: 'export function POST() { const auth = request.headers.get("Authorization") }',
          path: 'app/api/protected/route.ts',
          expectedClassification: {
            requiresAuth: true,
            isAdminRoute: false,
            isPublicRoute: false
          }
        }
      ]
      
      for (const testRoute of testRoutes) {
        mockGlob.mockResolvedValue([testRoute.path])
        mockFs.readFile.mockResolvedValue(testRoute.content)
        
        const inventory = await generateInventory()
        const route = inventory.routes[0]
        
        expect(route.requiresAuth).toBe(testRoute.expectedClassification.requiresAuth)
        expect(route.isAdminRoute).toBe(testRoute.expectedClassification.isAdminRoute)
        expect(route.isPublicRoute).toBe(testRoute.expectedClassification.isPublicRoute)
      }
    })
  })
})