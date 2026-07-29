import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  // .trim(): the deployed anon key can carry a trailing newline, which is
  // tolerated by HTTP requests but breaks the Realtime WebSocket (the key goes
  // into the ?apikey= query param as %0A -> "HTTP Authentication failed").
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  // Client components can be evaluated while Next generates static shells.
  // Local builds intentionally have no deployment secrets, and constructing a
  // browser client during that pass must not crash unrelated public pages. The
  // placeholder never ships when the real environment is configured; calls
  // against it simply fail soft in a genuinely misconfigured runtime.
  return createBrowserClient(
    url || "http://127.0.0.1:54321",
    anonKey || "local-build-anon-placeholder"
  );
}
