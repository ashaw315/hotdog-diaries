// @ts-nocheck adjust as needed
import { NextResponse } from "next/server";
import { supabaseServiceClient } from "@/app/lib/server/supabase";

export async function GET(req: Request) {
  const startedAt = new Date().toISOString();
  const url = new URL(req.url);
  const date = url.searchParams.get("date");

  const base = {
    status: "ok" as const,
    issues: [] as string[],
    recommendations: [] as string[],
    date,
    metadata: { check_timestamp: startedAt }
  };

  try {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        {
          ...base,
          status: "error",
          issues: ["Missing or invalid ?date=YYYY-MM-DD"],
          recommendations: ["Provide ?date=YYYY-MM-DD"],
        },
        { status: 200 }
      );
    }

    const supabase = supabaseServiceClient();

    // Query scheduled posts for the specified date
    const { data, error } = await supabase
      .from("scheduled_posts")
      .select("id, platform, content_type, scheduled_post_time")
      .gte("scheduled_post_time", `${date}T00:00:00.000Z`)
      .lte("scheduled_post_time", `${date}T23:59:59.999Z`);

    if (error) {
      return NextResponse.json(
        { ...base, status: "error", issues: [`Diversity metrics query failed: ${error.message}`] },
        { status: 200 }
      );
    }

    const items = data ?? [];
    if (items.length === 0) {
      return NextResponse.json(
        {
          ...base,
          status: "error",
          issues: ["No scheduled posts for the requested date"],
          recommendations: ["Trigger scheduler refill for the target date"],
          metrics: { platforms: {}, content_types: {}, total_posts: 0 }
        },
        { status: 200 }
      );
    }

    // Simple aggregation for diversity metrics
    const platforms: Record<string, number> = {};
    const content_types: Record<string, number> = {};

    for (const p of items) {
      const platform = p.platform ?? "unknown";
      const content_type = p.content_type ?? "text";
      
      platforms[platform] = (platforms[platform] ?? 0) + 1;
      content_types[content_type] = (content_types[content_type] ?? 0) + 1;
    }

    return NextResponse.json(
      { 
        ...base, 
        metrics: { platforms, content_types, total_posts: items.length },
        count: items.length 
      },
      { status: 200 }
    );
  } catch (fatal: any) {
    return NextResponse.json(
      {
        ...base,
        status: "error",
        issues: ["Unhandled exception in diversity metrics route"],
        error: String(fatal?.message ?? fatal),
      },
      { status: 503 }
    );
  }
}