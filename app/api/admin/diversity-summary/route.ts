// @ts-nocheck
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  if (!date) {
    return NextResponse.json(
      { status: "error", issues: ["Missing ?date=YYYY-MM-DD"], recommendations: ["Provide date param"] },
      { status: 200 }
    );
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const internal = await fetch(`${baseUrl}/api/admin/metrics/diversity?date=${date}`, {
      method: "GET",
      cache: "no-store",
    });

    // Parse if possible; if not, send a controlled error shape
    let json: any = {};
    try {
      json = await internal.json();
    } catch (_) {
      json = { status: "error", issues: ["Internal metrics returned non-JSON"], recommendations: [] };
    }

    const status = internal.status === 503 ? 503 : 200;
    return NextResponse.json(json, { status });
  } catch (e: any) {
    console.error("[admin/diversity-summary] Proxy error:", e);
    return NextResponse.json({ status: "error", issues: ["Proxy failure"], error: String(e?.message ?? e) }, { status: 503 });
  }
}