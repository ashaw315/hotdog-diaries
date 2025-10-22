// @ts-nocheck adjust as needed
import { NextResponse } from "next/server";
import { supabaseServiceClient } from "@/app/lib/server/supabase";

export async function GET(req: Request) {
  const startedAt = new Date().toISOString();
  const url = new URL(req.url);
  const date = url.searchParams.get("date") || new Date().toISOString().split('T')[0];

  const base = {
    status: "ok" as const,
    issues: [] as string[],
    recommendations: [] as string[],
    date,
    metadata: { check_timestamp: startedAt }
  };

  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        {
          ...base,
          status: "error",
          issues: ["Invalid date format"],
          recommendations: ["Use YYYY-MM-DD format"],
        },
        { status: 200 }
      );
    }

    const supabase = supabaseServiceClient();

    // Query scheduled posts for diversity summary
    const { data, error } = await supabase
      .from("scheduled_posts")
      .select("id, platform, content_type, scheduled_post_time, scheduled_slot_index")
      .gte("scheduled_post_time", `${date}T00:00:00.000Z`)
      .lte("scheduled_post_time", `${date}T23:59:59.999Z`)
      .order("scheduled_slot_index", { ascending: true });

    if (error) {
      return NextResponse.json(
        { ...base, status: "error", issues: [`Query failed: ${error.message}`] },
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
          recommendations: ["Check scheduler and trigger refill if needed"],
          summary: { total_slots: 0, filled_slots: 0, platforms: {}, content_types: {} }
        },
        { status: 200 }
      );
    }

    // Calculate diversity summary
    const platforms: Record<string, number> = {};
    const content_types: Record<string, number> = {};
    const slots = Array(6).fill(null);

    for (const item of items) {
      const platform = item.platform ?? "unknown";
      const content_type = item.content_type ?? "text";
      const slot_index = item.scheduled_slot_index;
      
      platforms[platform] = (platforms[platform] ?? 0) + 1;
      content_types[content_type] = (content_types[content_type] ?? 0) + 1;
      
      if (slot_index >= 0 && slot_index < 6) {
        slots[slot_index] = { platform, content_type };
      }
    }

    const filled_slots = slots.filter(s => s !== null).length;
    const diversity_score = calculateDiversityScore(platforms, content_types, filled_slots);

    return NextResponse.json(
      { 
        ...base, 
        summary: {
          total_slots: 6,
          filled_slots,
          platforms,
          content_types,
          diversity_score,
          slots
        }
      },
      { status: 200 }
    );
  } catch (fatal: any) {
    return NextResponse.json(
      {
        ...base,
        status: "error",
        issues: ["Unhandled exception in diversity summary route"],
        error: String(fatal?.message ?? fatal),
      },
      { status: 503 }
    );
  }
}

function calculateDiversityScore(platforms: Record<string, number>, content_types: Record<string, number>, total_posts: number): number {
  if (total_posts === 0) return 0;
  
  // Simple diversity score based on platform distribution
  const platform_count = Object.keys(platforms).length;
  const content_type_count = Object.keys(content_types).length;
  
  // Score based on number of unique platforms and content types
  const platform_score = Math.min(platform_count * 20, 80); // Max 80 for 4+ platforms
  const content_score = Math.min(content_type_count * 10, 20); // Max 20 for 2+ content types
  
  return Math.round(platform_score + content_score);
}