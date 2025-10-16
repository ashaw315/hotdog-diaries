import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'
import { EdgeAuthUtils } from '@/lib/auth-edge'

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const authHeader = request.headers.get('authorization') || request.headers.get('x-admin-token')
    
    if (!authHeader) {
      return NextResponse.json(
        {
          ok: false,
          code: 'UNAUTHORIZED',
          message: 'Admin authentication required',
          rid: `req_${Date.now()}_${Math.random().toString(36).substring(2)}`
        },
        { status: 401 }
      )
    }

    // Extract token from header
    let token = authHeader
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7)
    }

    // Validate admin token
    try {
      const decoded = await EdgeAuthUtils.verifyJWT(token)
      if (!decoded || !decoded.userId) {
        throw new Error('Invalid token')
      }
    } catch (error) {
      return NextResponse.json(
        {
          ok: false,
          code: 'UNAUTHORIZED',
          message: 'Invalid admin token',
          rid: `req_${Date.now()}_${Math.random().toString(36).substring(2)}`
        },
        { status: 401 }
      )
    }

    // Read OpenAPI spec file
    let openApiContent: string
    try {
      const openApiPath = join(process.cwd(), 'docs', 'openapi.yaml')
      openApiContent = readFileSync(openApiPath, 'utf-8')
    } catch (error) {
      console.error('Error reading OpenAPI spec:', error)
      return NextResponse.json(
        {
          ok: false,
          code: 'SPEC_NOT_FOUND',
          message: 'OpenAPI specification file not found',
          rid: `req_${Date.now()}_${Math.random().toString(36).substring(2)}`
        },
        { status: 500 }
      )
    }

    // Return the OpenAPI spec with proper YAML content type
    return new NextResponse(openApiContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/yaml',
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error('Error serving OpenAPI spec:', error)
    return NextResponse.json(
      {
        ok: false,
        code: 'INTERNAL_ERROR',
        message: 'Failed to serve OpenAPI specification',
        rid: `req_${Date.now()}_${Math.random().toString(36).substring(2)}`
      },
      { status: 500 }
    )
  }
}

// OPTIONS for CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-token',
    },
  })
}