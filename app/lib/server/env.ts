// Server-side environment utilities
// These run on the server and are used by API routes

export function envOptional(k: string) {
  return process.env[k];
}

export function envRequired(k: string) {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env: ${k}`);
  return v;
}

export function ffSourceOfTruth(): boolean {
  return process.env.ENFORCE_SCHEDULE_SOURCE_OF_TRUTH === "true";
}

export function coreEnvState(): { ok: boolean; missing: string[] } {
  const required = [
    "SUPABASE_URL",
    process.env.SUPABASE_SERVICE_ROLE_KEY_V2 ? "SUPABASE_SERVICE_ROLE_KEY_V2" : "SUPABASE_SERVICE_ROLE_KEY",
    "JWT_SECRET",
  ];
  const missing = required.filter((k) => !process.env[k]);
  return { ok: missing.length === 0, missing };
}