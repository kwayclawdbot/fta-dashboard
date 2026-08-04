"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";
import { beltForXp } from "@/lib/belts";
import type { CircleMessage, FamilyMember } from "@/lib/family/queries";
import { FoundingState, FamilyCard, Chip } from "@/components/family/canvas";
import { GUARDRAIL_CIRCLE_BLOCKED } from "@/lib/family/guardrails";

/**
 * F4 · FAMILY CIRCLE — the private household thread, drawn as the board draws
 * it: a day divider, ringed avatars beside each message, the author's name in
 * their belt colour, an AUTO card for the events the system posts, and the
 * composer as a rounded bar with a round accent send button.
 *
 * `seed` arrives from the server, so the thread is never empty-then-populated:
 * loading is over before this component exists, and the founding state below is
 * the real answer for a household that has not spoken yet — not a skeleton
 * mistaken for one.
 *
 * A refresh runs on an interval rather than a realtime subscription. That is a
 * deliberate choice, not a shortcut: Supabase Realtime cannot authorize a
 * SELECT policy that subqueries another table (migrations 018/019 scars), and a
 * per-family predicate is exactly such a policy. Polling a private thread of
 * three people is cheap; risking the community room's realtime authorization is
 * not.
 *
 * NOT DRAWN HERE, because nothing writes them: the 🔥/👏 reaction chips (no
 * reaction store on family_circle_messages), the "Jaylen is typing…" line (no
 * presence channel), and the Kai mini-lesson offer (no lesson-suggestion
 * store). Each would be a control or a claim with nothing behind it.
 *
 * The Circle stays open under the "chat: Family Circle only" guardrail — that
 * is the entire point of the guardrail. Downtime and the daily limit still
 * apply, and they are enforced by the database, so a refused send says so
 * plainly instead of failing silently.
 */
export default function CircleThread({
  familyId,
  viewerId,
  members,
  seed,
}: {
  familyId: string;
  viewerId: string;
  members: FamilyMember[];
  seed: CircleMessage[];
}) {
  const [messages, setMessages] = useState<CircleMessage[]>(seed);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const byId = new Map(members.map((m) => [m.id, m]));

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const refresh = async () => {
      if (document.visibilityState === "hidden") return;
      const { data } = await supabase
        .from("family_circle_messages")
        .select("id, author_id, kind, body, created_at")
        .eq("family_id", familyId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (cancelled || !data) return;
      setMessages((data as CircleMessage[]).slice().reverse());
    };

    const id = window.setInterval(refresh, 12_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [familyId]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;

    setSending(true);
    setError(null);
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("family_circle_messages")
      .insert({ family_id: familyId, author_id: viewerId, kind: "message", body })
      .select("id, author_id, kind, body, created_at")
      .single();

    setSending(false);
    if (err || !data) {
      setError(GUARDRAIL_CIRCLE_BLOCKED);
      return;
    }
    setDraft("");
    setMessages((prev) => [...prev, data as CircleMessage]);
    requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" }));
  }

  return (
    <div>
      {messages.length === 0 ? (
        <FoundingState
          title="Nobody has said anything yet"
          body="This thread belongs to your household and nobody else — it never expires and no stranger can ever read it. Somebody go first: what did you notice about a company this week?"
        />
      ) : (
        <div className="flex flex-col gap-4">
          {messages.map((m, i) => {
            const author = m.author_id ? byId.get(m.author_id) : null;
            const mine = m.author_id === viewerId;
            const day = new Date(m.created_at).toDateString();
            const prevDay =
              i > 0 ? new Date(messages[i - 1].created_at).toDateString() : null;

            const divider =
              day !== prevDay ? (
                <div key={`d-${m.id}`} className="my-1 text-center">
                  <Chip tone="muted">{dayLabel(m.created_at)}</Chip>
                </div>
              ) : null;

            // Anything the system wrote is an event, not a message — the board
            // gives those their own warm card with an AUTO mark.
            if (m.kind !== "message") {
              return (
                <div key={m.id}>
                  {divider}
                  <FamilyCard tone="warm" className="flex items-center gap-3 p-3">
                    <span className="shrink-0 text-[15px]" aria-hidden>
                      🎉
                    </span>
                    <p className="min-w-0 flex-1 text-[12px] leading-snug text-soft">{m.body}</p>
                    <Chip tone="muted">Auto</Chip>
                  </FamilyCard>
                </div>
              );
            }

            const belt = author ? beltForXp(author.xp) : null;
            return (
              <div key={m.id}>
                {divider}
                <div className="flex gap-3">
                  <span
                    className="grid h-fit shrink-0 place-items-center rounded-full p-[2px]"
                    style={{ background: belt?.belt.hex ?? "var(--sand)" }}
                  >
                    <span className="grid place-items-center rounded-full bg-paper p-[1px]">
                      <Avatar
                        name={author?.display_name ?? null}
                        avatarUrl={author?.avatar_url ?? null}
                        role={author?.role ?? null}
                        size="sm"
                      />
                    </span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span
                        className="text-[12.5px] font-display font-bold"
                        style={{ color: belt ? belt.belt.hex : undefined }}
                      >
                        {mine ? "You" : author?.display_name || "Member"}
                      </span>
                      <span className="font-mono text-[9.5px] tabular-nums text-soft">
                        {new Date(m.created_at).toLocaleTimeString(undefined, {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">
                      {m.body}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
      )}

      {error && (
        <p
          className="mt-4 rounded-xl border border-sand bg-card p-3 text-[13px] leading-relaxed text-ink shadow-soft"
          role="alert"
        >
          {error}
        </p>
      )}

      {/* ── Composer ─────────────────────────────────────────────────────*/}
      <form onSubmit={send} className="mt-5 border-t border-sand pt-4">
        <div className="flex items-end gap-2.5">
          <label htmlFor="circle-draft" className="sr-only">
            Message the family
          </label>
          <textarea
            id="circle-draft"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={1}
            maxLength={2000}
            placeholder="Message the family"
            className="f0-focus min-w-0 flex-1 resize-none rounded-2xl border border-sand bg-card px-4 py-2.5 text-[13.5px] leading-relaxed text-ink shadow-soft placeholder:text-soft"
          />
          <button
            type="submit"
            disabled={!draft.trim() || sending}
            aria-label="Send"
            className="f0-focus f0-press grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent font-display text-[14px] font-extrabold text-night-950 disabled:opacity-45"
          >
            {sending ? "…" : "➤"}
          </button>
        </div>
      </form>
    </div>
  );
}

/** "Today" / "Yesterday" / a short date — computed from a message timestamp,
 *  never from a bare Date.now() inside the render path of a server component. */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const diff = Math.round(
    (new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 864e5
  );
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
