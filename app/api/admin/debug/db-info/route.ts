// @ts-nocheck
import { NextResponse } from "next/server";
import { supabaseService } from "@/app/lib/server/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = new Date().toISOString();
  
  try {
    const supabase = supabaseService();
    
    const dbInfo = {
      timestamp: startedAt,
      connection_test: null as any,
      posted_content_schema: null as any,
      scheduled_posts_schema: null as any,
      sample_data: {
        posted_content_count: 0,
        scheduled_posts_count: 0,
        recent_posted_content: [] as any[],
        recent_scheduled_posts: [] as any[]
      },
      environment: {
        node_env: process.env.NODE_ENV,
        vercel: !!process.env.VERCEL,
        has_postgres_url: !!process.env.POSTGRES_URL,
        has_database_url: !!process.env.DATABASE_URL,
        has_supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL || !!process.env.SUPABASE_URL
      }
    };

    // Connection test
    try {
      const { data: connTest, error: connErr } = await supabase
        .from('information_schema.schemata')
        .select('schema_name')
        .eq('schema_name', 'public')
        .limit(1);
      
      dbInfo.connection_test = {
        successful: !connErr,
        error: connErr?.message || null,
        schema_accessible: !!connTest
      };
    } catch (connTestErr: any) {
      dbInfo.connection_test = {
        successful: false,
        error: connTestErr.message,
        schema_accessible: false
      };
    }

    // posted_content table schema
    try {
      const { data: pcSchema, error: pcErr } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable, column_default')
        .eq('table_schema', 'public')
        .eq('table_name', 'posted_content')
        .order('ordinal_position');
      
      dbInfo.posted_content_schema = {
        query_successful: !pcErr,
        columns: pcSchema || [],
        error: pcErr?.message || null,
        has_scheduled_post_id: pcSchema?.some(col => col.column_name === 'scheduled_post_id') || false
      };
    } catch (pcSchemaErr: any) {
      dbInfo.posted_content_schema = {
        query_successful: false,
        columns: [],
        error: pcSchemaErr.message,
        has_scheduled_post_id: false
      };
    }

    // scheduled_posts table schema
    try {
      const { data: spSchema, error: spErr } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable, column_default')
        .eq('table_schema', 'public')
        .eq('table_name', 'scheduled_posts')
        .order('ordinal_position');
      
      dbInfo.scheduled_posts_schema = {
        query_successful: !spErr,
        columns: spSchema || [],
        error: spErr?.message || null
      };
    } catch (spSchemaErr: any) {
      dbInfo.scheduled_posts_schema = {
        query_successful: false,
        columns: [],
        error: spSchemaErr.message
      };
    }

    // Sample data counts
    try {
      const { count: pcCount } = await supabase
        .from('posted_content')
        .select('*', { count: 'exact', head: true });
      dbInfo.sample_data.posted_content_count = pcCount || 0;
    } catch {}

    try {
      const { count: spCount } = await supabase
        .from('scheduled_posts')
        .select('*', { count: 'exact', head: true });
      dbInfo.sample_data.scheduled_posts_count = spCount || 0;
    } catch {}

    // Recent posted_content sample
    try {
      const { data: recentPC } = await supabase
        .from('posted_content')
        .select('id, content_queue_id, scheduled_post_id, posted_at, created_at')
        .order('created_at', { ascending: false })
        .limit(3);
      dbInfo.sample_data.recent_posted_content = recentPC || [];
    } catch {}

    // Recent scheduled_posts sample
    try {
      const { data: recentSP } = await supabase
        .from('scheduled_posts')
        .select('id, content_id, platform, scheduled_post_time, scheduled_slot_index, created_at')
        .order('created_at', { ascending: false })
        .limit(3);
      dbInfo.sample_data.recent_scheduled_posts = recentSP || [];
    } catch {}

    return NextResponse.json(dbInfo, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (fatal: any) {
    console.error('[admin/debug/db-info] Fatal error:', fatal);
    return NextResponse.json(
      {
        timestamp: startedAt,
        error: 'Fatal error during database info collection',
        message: fatal.message,
        environment: {
          node_env: process.env.NODE_ENV,
          vercel: !!process.env.VERCEL
        }
      },
      { status: 500 }
    );
  }
}