// @ts-nocheck
import { NextResponse } from "next/server";
import { supabaseService } from "@/app/lib/server/supabase";

export async function GET(req: Request) {
  const ts = new Date().toISOString();
  const url = new URL(req.url);
  const date = url.searchParams.get("date");

  const base = { status: "ok" as const, date, issues: [] as string[], recommendations: [] as string[], metadata: { check_timestamp: ts } };

  try {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { ...base, status: "error", issues: ["Missing or invalid ?date=YYYY-MM-DD"], recommendations: ["Provide ?date=YYYY-MM-DD"] },
        { status: 200 }
      );
    }

    const supabase = supabaseService();
    const start = `${date}T00:00:00.000Z`;
    const end   = `${date}T23:59:59.999Z`;

    // Replace columns with your schema
    const { data, error } = await supabase
      .from("scheduled_posts")
      .select("id, platform, author, category, scheduled_at")
      .gte("scheduled_at", start)
      .lte("scheduled_at", end);

    if (error) {
      return NextResponse.json({ ...base, status: "error", issues: [`Diversity query failed: ${error.message}`] }, { status: 200 });
    }

    const items = data ?? [];
    if (items.length === 0) {
      return NextResponse.json(
        {
          ...base,
          status: "error",
          issues: ["No scheduled posts for requested date"],
          recommendations: ["Run scheduler refill for that date"],
          metrics: { platforms: {}, authors: {}, categories: {}, count: 0 }
        },
        { status: 200 }
      );
    }

    const platforms: Record<string, number> = {};
    const authors: Record<string, number> = {};
    const categories: Record<string, number> = {};
    for (const r of items) {
      platforms[r.platform ?? "unknown"] = (platforms[r.platform ?? "unknown"] ?? 0) + 1;
      authors[r.author ?? "unknown"] = (authors[r.author ?? "unknown"] ?? 0) + 1;
      categories[r.category ?? "unknown"] = (categories[r.category ?? "unknown"] ?? 0) + 1;
    }

    return NextResponse.json({ ...base, metrics: { platforms, authors, categories, count: items.length } }, { status: 200 });
  } catch (fatal: any) {
    console.error("[admin/metrics/diversity] Fatal:", fatal);
    return NextResponse.json(
      { ...base, status: "error", issues: ["Unhandled exception"], error: String(fatal?.message ?? fatal) },
      { status: 503 }
    );
  }
}