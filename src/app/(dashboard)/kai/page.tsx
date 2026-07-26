import { createClient } from "@/lib/supabase/server";
import { getClubTier } from "@/lib/tier";
import { getKaiChatSeed } from "@/lib/kai/chat-seed";
import ContextualWall from "@/components/entitlements/ContextualWall";
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

  // Tier guard (belt-and-suspenders with the nav, which never surfaces Ask Kai
  // to the free tier, and the chat API, which gates server-side). A free member
  // reaching /kai directly would otherwise hit a dead shell — instead show the
  // Kai contextual wall so the door is closed with real copy + the /pricing CTA.
  // Auth is already enforced by the (dashboard) layout.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("family_id").eq("id", user.id).maybeSingle()
    : { data: null };
  const tier = await getClubTier(supabase, profile?.family_id);
  if (tier === "free") {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        <ContextualWall feature="kai_chat_full" />
      </div>
    );
  }

  const [initialData, sp] = await Promise.all([
    getKaiChatSeed(supabase).catch(() => null),
    searchParams,
  ]);
  return <KaiChatClient initialData={initialData} autoThreadId={sp?.thread ?? null} />;
}
