// Server-only Supabase client factory with V2→V1 fallback
// Note: No "use server" directive - this is a server utility, not a Server Action

import { createClient } from "@supabase/supabase-js";
import { getEnv } from "./env";

// Prefer V2 if present (path-bust pattern), else fallback to V1
export function supabaseServiceClient() {
  const url = getEnv("SUPABASE_URL");
  const key = getEnv("SUPABASE_SERVICE_ROLE_KEY_V2") || getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("Supabase service client missing SUPABASE_URL or SERVICE_ROLE_KEY (V2/V1).");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}