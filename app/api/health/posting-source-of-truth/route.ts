// app/api/health/posting-source-of-truth/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { probeScheduledPostId } from "@/lib/probeSchema";
import { db } from "@/lib/db";
import { supabase } from "@/lib/db";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store, max-age=0",
    },
  });
}

export async function GET(_req: NextRequest) {
  const probe = await probeScheduledPostId();
  const schema_drift = !(probe.query_successful && probe.column_found);

  // Count scheduled posts and recent posted content using direct SQL
  let scheduled_posts_count = 0;
  let total_recent_posts = 0;
  let orphan_posts = 0;
  let linked_posts = 0;

  try {
    // Count scheduled posts using Supabase client directly
    try {
      const { count: schedCount, error: schedError } = await supabase
        .from('scheduled_posts')
        .select('*', { count: 'exact', head: true });
      
      if (schedError) {
        console.log("[health] scheduled_posts table not accessible:", schedError.message);
        scheduled_posts_count = 0;
      } else {
        scheduled_posts_count = schedCount || 0;
      }
    } catch (schedErr) {
      console.log("[health] scheduled_posts table not found, using 0");
      scheduled_posts_count = 0;
    }

    // Count recent posted content (last 7 days) using Supabase client
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    if (probe.column_found) {
      // Normal operation - column exists, can check for orphans
      try {
        const { data: recentPosts, error: recentError } = await supabase
          .from('posted_content')
          .select('scheduled_post_id')
          .gte('created_at', since);
        
        if (recentError) {
          console.error("[health] Posted content query failed:", recentError.message);
          // Fallback to 0 counts
          total_recent_posts = 0;
          orphan_posts = 0;
          linked_posts = 0;
        } else {
          total_recent_posts = recentPosts?.length || 0;
          orphan_posts = recentPosts?.filter(post => !post.scheduled_post_id).length || 0;
          linked_posts = total_recent_posts - orphan_posts;
        }
      } catch (recentErr) {
        console.error("[health] Recent posts query failed:", recentErr);
        total_recent_posts = 0;
        orphan_posts = 0;
        linked_posts = 0;
      }
    } else {
      // Schema drift - all posts are considered orphans
      try {
        const { count: totalCount, error: totalError } = await supabase
          .from('posted_content')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', since);
        
        if (totalError) {
          console.error("[health] Total posts query failed:", totalError.message);
          total_recent_posts = 0;
        } else {
          total_recent_posts = totalCount || 0;
        }
        
        orphan_posts = total_recent_posts; // All are orphans without the column
        linked_posts = 0;
      } catch (totalErr) {
        console.error("[health] Total posts query failed:", totalErr);
        total_recent_posts = 0;
        orphan_posts = 0;
        linked_posts = 0;
      }
    }
  } catch (countErr: any) {
    console.error("[health] Count queries failed:", countErr);
  }

  const orphan_percentage = total_recent_posts > 0 ? Math.round((orphan_posts / total_recent_posts) * 100) : 0;
  const posting_compliance_score = total_recent_posts > 0 ? Math.max(0, 100 - orphan_percentage) : (schema_drift ? 0 : 100);

  const payload = {
    status: schema_drift ? "error" : "ok",
    feature_flag_active: true,
    scheduled_posts_count,
    total_recent_posts,
    orphan_posts,
    orphan_percentage,
    posting_compliance_score,
    linked_posts,
    issues: schema_drift
      ? [
          probe.error
            ? `Schema probe failed: ${probe.error}`
            : "Schema drift detected: posted_content.scheduled_post_id missing",
        ]
      : [],
    recommendations: schema_drift
      ? [
          "Ensure scheduled_post_id column exists on posted_content",
          "Run backfill dry-run: npx tsx scripts/ops/backfill-post-links.ts",
          "Apply backfill: npx tsx scripts/ops/backfill-post-links.ts --write",
          "Set ENFORCE_SCHEDULE_SOURCE_OF_TRUTH=true and redeploy",
        ]
      : [],
    metadata: {
      check_timestamp: new Date().toISOString(),
      database_type: "supabase",
      connection_identity: probe.connection_identity,
      schema_probe_result: {
        query_successful: probe.query_successful,
        column_found: probe.column_found,
        error: probe.error,
      },
      schema_drift,
      posted_content_columns: probe.posted_content_columns,
    },
  };

  return json(payload, 200);
}