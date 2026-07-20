import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client — server-side only (API routes). Bypasses RLS.
 * .trim(): deployed keys can carry trailing newlines (same scar as client.ts).
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
