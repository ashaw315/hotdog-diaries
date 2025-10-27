// Debug endpoint to test AdminService functionality
import { NextRequest } from 'next/server'
import { AdminService } from '@/lib/services/admin'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store, max-age=0',
    },
  })
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const providedToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null
    
    // Only allow if proper auth token is provided (simple security)
    if (!providedToken || providedToken !== 'debug-admin-test-2025') {
      return json({ error: 'Unauthorized - use Authorization: Bearer debug-admin-test-2025' }, 401)
    }

    console.log('[TestAdmin] Starting admin user lookup test...')
    
    // Test getting admin by username
    const adminUser = await AdminService.getAdminByUsername('admin')
    
    if (adminUser) {
      console.log('[TestAdmin] Admin user found successfully:', adminUser.username)
      return json({
        success: true,
        message: 'Admin user found successfully',
        user: {
          id: adminUser.id,
          username: adminUser.username,
          email: adminUser.email,
          is_active: adminUser.is_active,
          created_at: adminUser.created_at
        },
        timestamp: new Date().toISOString()
      })
    } else {
      console.log('[TestAdmin] No admin user found')
      return json({
        success: false,
        message: 'No admin user found - database may need initialization',
        suggestion: 'Try calling /api/setup to initialize the database',
        timestamp: new Date().toISOString()
      })
    }

  } catch (error) {
    console.error('[TestAdmin] Admin lookup test failed:', error)
    return json({
      success: false,
      error: 'Admin lookup test failed',
      message: error.message,
      timestamp: new Date().toISOString()
    }, 500)
  }
}