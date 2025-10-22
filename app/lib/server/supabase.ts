// Server-side Supabase client factory
// This runs on the server and creates authenticated Supabase clients

import { createClient } from "@supabase/supabase-js";
import { envOptional } from "./env";

export function supabaseService() {
  const url = envOptional("SUPABASE_URL");
  const key = envOptional("SUPABASE_SERVICE_ROLE_KEY_V2") || envOptional("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase missing SUPABASE_URL or SERVICE_ROLE_KEY (V2/V1).");
  return createClient(url, key, { auth: { persistSession: false } });
}