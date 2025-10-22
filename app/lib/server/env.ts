"use server";

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export function getEnv(name: string, fallback?: string): string | undefined {
  const v = process.env[name];
  return (v ?? fallback);
}

export function featureFlagSourceOfTruth(): boolean {
  return getEnv("ENFORCE_SCHEDULE_SOURCE_OF_TRUTH") === "true";
}

export function hasAllCoreEnv(): { ok: boolean; missing: string[] } {
  const required = [
    "SUPABASE_URL",
    // Prefer V2 if you use it, otherwise standard key:
    process.env.SUPABASE_SERVICE_ROLE_KEY_V2 ? "SUPABASE_SERVICE_ROLE_KEY_V2" : "SUPABASE_SERVICE_ROLE_KEY",
    "JWT_SECRET"
  ];
  const missing = required.filter((key) => !process.env[key]);
  return { ok: missing.length === 0, missing };
}