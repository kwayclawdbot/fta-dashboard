import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  // .trim(): the deployed anon key can carry a trailing newline, which is
  // tolerated by HTTP requests but breaks the Realtime WebSocket (the key goes
  // into the ?apikey= query param as %0A -> "HTTP Authentication failed").
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim()
  );
}
