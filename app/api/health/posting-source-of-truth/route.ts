// @ts-nocheck
import { NextResponse } from "next/server";
import { ffSourceOfTruth, coreEnvState } from "@/app/lib/server/env";
import { supabaseService } from "@/app/lib/server/supabase";

export async function GET() {
  const startedAt = new Date().toISOString();
  const out = {
    status: "ok" as const,
    feature_flag_active: ffSourceOfTruth(),
    scheduled_posts_count: 0,
    total_recent_posts: 0,
    orphan_posts: 0,
    orphan_percentage: 0,
    posting_compliance_score: 100,
    linked_posts: 0,
    issues: [] as string[],
    recommendations: [] as string[],
    metadata: { check_timestamp: startedAt, database_type: "supabase" },
  };

  try {
    const envState = coreEnvState();
    if (!envState.ok) {
      out.status = "error";
      out.issues.push(`Missing env vars: ${envState.missing.join(", ")}`);
      out.recommendations.push("Set required env vars in Vercel and redeploy.");
    }

    if (!out.feature_flag_active) {
      out.status = "error";
      out.issues.push("ENFORCE_SCHEDULE_SOURCE_OF_TRUTH feature flag is not active");
      out.recommendations.push("Set ENFORCE_SCHEDULE_SOURCE_OF_TRUTH=true to enforce scheduled_posts as source of truth");
    }

    try {
      const supabase = supabaseService();

      // Count scheduled posts (example: all future; adjust window as needed)
      const { count: schedCount, error: schedErr } = await supabase
        .from("scheduled_posts")
        .select("*", { count: "exact", head: true });
      if (schedErr) {
        out.status = "error";
        out.issues.push(`scheduled_posts count failed: ${schedErr.message}`);
      } else {
        out.scheduled_posts_count = schedCount ?? 0;
      }

      // Recent posted_content (last 7 days), detect orphans
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: posts, error: postsErr } = await supabase
        .from("posted_content")
        .select("id, scheduled_post_id")
        .gte("created_at", since);
      if (postsErr) {
        out.status = "error";
        out.issues.push(`posted_content query failed: ${postsErr.message}`);
      } else {
        const total = posts?.length ?? 0;
        const orphans = (posts ?? []).filter((p) => !p.scheduled_post_id).length;
        out.total_recent_posts = total;
        out.orphan_posts = orphans;
        out.orphan_percentage = total > 0 ? Math.round((orphans / total) * 100) : 0;
        out.posting_compliance_score = total > 0 ? Math.max(0, 100 - out.orphan_percentage) : 0;
        out.linked_posts = total - orphans;

        if (orphans > 0) {
          out.status = "error";
          out.issues.push(`${orphans} orphan posts found (${out.orphan_percentage}% of recent posts)`);
          out.recommendations.push("Run backfill: npx tsx scripts/ops/backfill-post-links.ts --date YYYY-MM-DD --write");
        }
      }
    } catch (dbInitErr: any) {
      console.error("[health/posting-source-of-truth] DB init error:", dbInitErr);
      return NextResponse.json(
        { ...out, status: "error", issues: [...out.issues, "DB init failure"], error: String(dbInitErr?.message ?? dbInitErr) },
        { status: 503 }
      );
    }

    return NextResponse.json(out, { status: 200 });
  } catch (fatal: any) {
    console.error("[health/posting-source-of-truth] Fatal:", fatal);
    return NextResponse.json(
      { status: "error", issues: ["Unhandled exception"], error: String(fatal?.message ?? fatal), metadata: { check_timestamp: startedAt } },
      { status: 503 }
    );
  }
}