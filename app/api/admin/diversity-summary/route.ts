// @ts-nocheck
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const src = new URL(req.url);
  const date = src.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { status: "error", issues: ["Missing or invalid ?date=YYYY-MM-DD"], recommendations: ["Provide ?date=YYYY-MM-DD"] },
      { status: 200 }
    );
  }

  // Build absolute URL from the incoming request origin to avoid env reliance
  const target = new URL("/api/admin/metrics/diversity", src.origin);
  target.searchParams.set("date", date);

  try {
    const res = await fetch(target.toString(), { method: "GET", cache: "no-store" });
    let body: any;
    try {
      body = await res.json();
    } catch {
      body = { status: "error", issues: ["Internal metrics returned non-JSON"], recommendations: [] };
    }
    // Treat only 503 from downstream as 503; otherwise normalize to 200
    return NextResponse.json(body, { status: res.status === 503 ? 503 : 200 });
  } catch (e: any) {
    console.error("[admin/diversity-summary] Proxy error:", e);
    return NextResponse.json(
      { status: "error", issues: ["Proxy failure"], error: String(e?.message ?? e) },
      { status: 503 }
    );
  }
}