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
 */
export const dynamic = "force-dynamic";

export default async function AskKaiPage() {
  const supabase = await createClient();
  const initialData = await getKaiChatSeed(supabase).catch(() => null);
  return <KaiChatClient initialData={initialData} />;
}
