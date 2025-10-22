// @ts-nocheck adjust as needed for your project
import { NextResponse } from "next/server";
import { featureFlagSourceOfTruth, hasAllCoreEnv } from "@/app/lib/server/env";
import { supabaseServiceClient } from "@/app/lib/server/supabase";

export async function GET() {
  const startedAt = new Date().toISOString();

  // Default response shape your UI expects
  const base = {
    status: "ok" as const,
    metadata: { check_timestamp: startedAt, database_type: "supabase" },
    issues: [] as string[],
    recommendations: [] as string[],
    feature_flag_active: featureFlagSourceOfTruth(),
    scheduled_posts_count: 0,
    total_recent_posts: 0,
    orphan_posts: 0,
    orphan_percentage: 0,
    posting_compliance_score: 100,
    linked_posts: 0,
  };

  try {
    // Validate env presence (do NOT throw fatal 500; report as issue)
    const envState = hasAllCoreEnv();
    if (!envState.ok) {
      base.status = "error";
      base.issues.push(`Missing env vars: ${envState.missing.join(", ")}`);
      base.recommendations.push("Set required env vars in Vercel and redeploy.");
    }

    if (!base.feature_flag_active) {
      base.status = "error";
      base.issues.push("ENFORCE_SCHEDULE_SOURCE_OF_TRUTH feature flag is not active");
      base.recommendations.push("Set ENFORCE_SCHEDULE_SOURCE_OF_TRUTH=true to enforce scheduled_posts as single source of truth");
    }

    // Attempt DB queries gracefully
    try {
      const supabase = supabaseServiceClient();

      // EXAMPLE QUERIES — replace with your exact tables/filters
      // Count scheduled posts in next 48h
      const { data: scheduled, error: schErr } = await supabase
        .from("scheduled_posts")
        .select("id", { count: "exact", head: true });
      if (schErr) {
        base.status = "error";
        base.issues.push(`scheduled_posts query failed: ${schErr.message}`);
      } else {
        // @ts-ignore: count available on head request
        base.scheduled_posts_count = scheduled?.length ?? (scheduled as any)?.count ?? 0;
      }

      // Detect orphans (recent posts not linked to schedule)
      // Replace with your real orphan detection; below is illustrative
      const { data: recentPosts, error: postErr } = await supabase
        .from("posted_content")
        .select("id, scheduled_post_id")
        .gte("created_at", new Date(Date.now() - 7 * 86400e3).toISOString()); // last 7d
      if (postErr) {
        base.status = "error";
        base.issues.push(`posted_content query failed: ${postErr.message}`);
      } else {
        const total = recentPosts?.length ?? 0;
        const orphans = (recentPosts ?? []).filter(p => !p.scheduled_post_id).length;
        base.total_recent_posts = total;
        base.orphan_posts = orphans;
        base.orphan_percentage = total > 0 ? Math.round((orphans / total) * 100) : 0;
        base.posting_compliance_score = total > 0 ? Math.max(0, 100 - base.orphan_percentage) : 0;
        base.linked_posts = total - orphans;

        if (orphans > 0) {
          base.status = "error";
          base.issues.push(`${orphans} orphan posts found (${base.orphan_percentage}% of recent posts)`);
          base.recommendations.push("Run backfill job: npx tsx scripts/ops/backfill-post-links.ts --date YYYY-MM-DD --write");
        }
      }
    } catch (dbFatal: any) {
      // Only unexpected DB init errors should mark as 503
      return NextResponse.json(
        {
          ...base,
          status: "error",
          issues: [...base.issues, "Unhandled DB init failure"],
          error: String(dbFatal?.message ?? dbFatal),
        },
        { status: 503 }
      );
    }

    // Always 200 for expected problem states; UI can render details
    return NextResponse.json(base, { status: 200 });
  } catch (fatal: any) {
    // Last-resort safety net
    return NextResponse.json(
      {
        status: "error",
        issues: ["Unhandled exception in posting-source-of-truth health route"],
        error: String(fatal?.message ?? fatal),
        metadata: { check_timestamp: startedAt },
      },
      { status: 503 }
    );
  }
}