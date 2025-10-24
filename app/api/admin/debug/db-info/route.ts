export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { probeScheduledPostId } from "@/lib/probeSchema";
import { sql } from "@/lib/db";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store, max-age=0",
    },
  });
}

// Admin auth check helper
async function validateAdminAuth(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const xAdminToken = request.headers.get('x-admin-token');
    
    let providedToken: string | null = null;
    
    if (authHeader?.startsWith('Bearer ')) {
      providedToken = authHeader.substring(7);
    } else if (xAdminToken) {
      providedToken = xAdminToken;
    }
    
    if (!providedToken) {
      return { authorized: false, error: 'AUTH_TOKEN_MISSING', message: 'No authentication token provided. Use Authorization: Bearer <token> or x-admin-token header' };
    }
    
    const { AuthService } = await import('@/lib/services/auth');
    const decoded = AuthService.verifyJWT(providedToken);
    
    if (!decoded || !decoded.username || decoded.username !== 'admin') {
      return { authorized: false, error: 'AUTH_TOKEN_INVALID_USER', message: 'Token is not for admin user' };
    }
    
    return { authorized: true, user: decoded.username };
  } catch (jwtError) {
    return { authorized: false, error: 'AUTH_TOKEN_INVALID', message: 'Invalid or expired JWT token' };
  }
}

export async function GET(request: NextRequest) {
  const startedAt = new Date().toISOString();
  
  try {
    // Admin auth check
    const authResult = await validateAdminAuth(request);
    if (!authResult.authorized) {
      return json({
        status: 'unauthorized',
        error: authResult.error,
        message: authResult.message,
        timestamp: startedAt
      }, 401);
    }
    
    // Use shared probe
    const probe = await probeScheduledPostId();
    const schema_drift = !(probe.query_successful && probe.column_found);
    
    // Get counts using direct SQL
    let posted_content_count = 0;
    let scheduled_posts_count = 0;
    let recent_posted_content: any[] = [];
    let recent_scheduled_posts: any[] = [];
    
    try {
      // Count posted content
      const [{ count: pcCount }] = await sql`
        SELECT COUNT(*)::int as count FROM posted_content
      ` as { count: number }[];
      posted_content_count = pcCount;
      
      // Count scheduled posts
      const [{ count: spCount }] = await sql`
        SELECT COUNT(*)::int as count FROM scheduled_posts
      ` as { count: number }[];
      scheduled_posts_count = spCount;
      
      // Recent posted content
      if (probe.column_found) {
        recent_posted_content = await sql`
          SELECT id, content_queue_id, scheduled_post_id, posted_at, created_at
          FROM posted_content
          ORDER BY created_at DESC
          LIMIT 3
        `;
      } else {
        recent_posted_content = await sql`
          SELECT id, content_queue_id, posted_at, created_at
          FROM posted_content
          ORDER BY created_at DESC
          LIMIT 3
        `;
      }
      
      // Recent scheduled posts
      recent_scheduled_posts = await sql`
        SELECT id, content_id, platform, scheduled_post_time, scheduled_slot_index, created_at
        FROM scheduled_posts
        ORDER BY created_at DESC
        LIMIT 3
      `;
      
    } catch (queryErr: any) {
      console.error('[admin/debug/db-info] Query error:', queryErr);
    }
    
    const dbInfo = {
      timestamp: startedAt,
      connection_test: {
        successful: probe.query_successful,
        error: probe.error,
        schema_accessible: probe.query_successful
      },
      posted_content_columns: probe.posted_content_columns ?? [],
      posted_content_schema: {
        query_successful: probe.query_successful,
        columns: probe.posted_content_columns?.map(name => ({ column_name: name })) || [],
        error: probe.error,
        has_scheduled_post_id: probe.column_found
      },
      scheduled_posts_schema: {
        query_successful: probe.query_successful,
        columns: [], // We could add another probe for this if needed
        error: probe.error
      },
      sample_data: {
        posted_content_count,
        scheduled_posts_count,
        recent_posted_content,
        recent_scheduled_posts
      },
      environment: {
        node_env: process.env.NODE_ENV,
        vercel: !!process.env.VERCEL,
        has_postgres_url: !!process.env.POSTGRES_URL,
        has_database_url: !!process.env.DATABASE_URL,
        has_supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL || !!process.env.SUPABASE_URL
      },
      metadata: {
        schema_drift,
        connection_identity: probe.connection_identity,
        schema_probe_result: {
          query_successful: probe.query_successful,
          column_found: probe.column_found,
          error: probe.error,
        },
      },
    };

    return json(dbInfo, 200);

  } catch (fatal: any) {
    console.error('[admin/debug/db-info] Fatal error:', fatal);
    return json({
      status: 'error',
      timestamp: startedAt,
      error: 'Fatal error during database info collection',
      message: fatal.message,
      environment: {
        node_env: process.env.NODE_ENV,
        vercel: !!process.env.VERCEL
      }
    }, 500);
  }
}