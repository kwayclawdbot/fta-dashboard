import { createClient } from "@/lib/supabase/server";
import { getKaiChatSeed } from "@/lib/kai/chat-seed";
import KaiChatClient from "./KaiChatClient";

/**
 * /kai — Ask Kai, server-first first paint (speed pass).
 *
 * The shell previously hid behind a spinner until auth → profile →
 * register/tier → threads + usage + memory all resolved client-side. Those reads
 * now run on the SERVER (under the member's authed session) and are handed to the
 * client as `initialData`, so the header + empty state + thread sidebar paint on
 * first paint. Streaming chat, thread open/delete, the composer and the
 * memory-clear action all stay client-side. A failed seed passes null and the
 * client runs its original bootstrap. Auth is already enforced by the
 * (dashboard) layout.
 *
 * `?thread=<id>` deep-links a conversation (the Kai FAB panel's "Open full
 * view →" uses it so the full page opens the same thread).
 */
export const dynamic = "force-dynamic";

export default async function AskKaiPage({
  searchParams,
}: {
  searchParams: Promise<{ thread?: string }>;
}) {
  const supabase = await createClient();
  const [initialData, sp] = await Promise.all([
    getKaiChatSeed(supabase).catch(() => null),
    searchParams,
  ]);
  return <KaiChatClient initialData={initialData} autoThreadId={sp?.thread ?? null} />;
}
