// lib/db.ts
import postgres from "postgres";

const POSTGRES_URL =
  process.env.POSTGRES_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.DATABASE_URL ||
  "";

if (!POSTGRES_URL) {
  throw new Error("Missing POSTGRES_URL/SUPABASE_DB_URL/DATABASE_URL");
}

// small, low-latency pool for API routes
export const sql = postgres(POSTGRES_URL, {
  max: 1,
  idle_timeout: 5,
  connect_timeout: 5_000,
  prepare: true,
});