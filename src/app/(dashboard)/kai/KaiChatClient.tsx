"use client";

import KaiChatShared from "@/components/kai/KaiChatShared";
import type { KaiChatSeed } from "@/lib/kai/chat-seed";

/**
 * KaiChatClient — the /kai page's chat. The full implementation now lives in the
 * shared <KaiChatShared> component (rendered here in "page" variant and by the
 * Kai FAB slide-over in "panel" variant). This wrapper only wires the server
 * seed and an optional deep-linked thread (?thread=…, used by the panel's
 * "Open full view →" so the page lands on the same conversation). Page behavior
 * is unchanged.
 */
export default function KaiChatClient({
  initialData = null,
  autoThreadId = null,
}: {
  initialData?: KaiChatSeed | null;
  autoThreadId?: string | null;
}) {
  return (
    <KaiChatShared initialData={initialData} variant="page" autoThreadId={autoThreadId} />
  );
}
