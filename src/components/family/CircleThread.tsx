"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";
import type { CircleMessage, FamilyMember } from "@/lib/family/queries";
import { FoundingState } from "@/components/family/canvas";

/**
 * F4 · FAMILY CIRCLE — the private household thread.
 *
 * `seed` arrives from the server, so the thread is never empty-then-populated:
 * loading is over before this component exists, and the founding state below is
 * the real answer for a household that has not spoken yet — not a skeleton
 * mistaken for one (adoption plan §0.4/§0.5).
 *
 * A refresh runs on an interval rather than a realtime subscription. That is a
 * deliberate choice, not a shortcut: Supabase Realtime cannot authorize a
 * SELECT policy that subqueries another table (migrations 018/019 scars), and a
 * per-family predicate is exactly such a policy. Polling a private thread of
 * three people is cheap; risking the community room's realtime authorization is
 * not.
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
      setError(
        "That message did not send. If a guardrail is active right now — downtime, or the daily limit — the Circle reopens when it lifts."
      );
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
        <div className="f0-ledger">
          {messages.map((m) => {
            const author = m.author_id ? byId.get(m.author_id) : null;
            const mine = m.author_id === viewerId;
            return (
              <div key={m.id} className="f0-ledger-row">
                <Avatar
                  name={author?.display_name ?? null}
                  avatarUrl={author?.avatar_url ?? null}
                  role={author?.role ?? null}
                  xp={author?.xp}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-soft">
                    <span className="font-display font-bold text-ink">
                      {mine ? "You" : author?.display_name || "Member"}
                    </span>{" "}
                    ·{" "}
                    {new Date(m.created_at).toLocaleTimeString(undefined, {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-ink">
                    {m.body}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
      )}

      {error && (
        <p className="f0-rule-left mt-5 py-1 pl-4 text-[14px] leading-relaxed text-ink" role="alert">
          {error}
        </p>
      )}

      <form onSubmit={send} className="mt-6 flex items-end gap-3">
        <label htmlFor="circle-draft" className="sr-only">
          Message the family
        </label>
        <textarea
          id="circle-draft"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder="Message the family"
          className="f0-focus min-w-0 flex-1 resize-none rounded-lg border border-sand bg-transparent px-3 py-2.5 text-[15px] leading-relaxed text-ink placeholder:text-soft"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          className="f0-focus f0-press shrink-0 rounded-lg bg-accent px-4 py-2.5 font-display text-[14px] font-extrabold uppercase tracking-[0.06em] text-night-950 disabled:opacity-45"
        >
          {sending ? "Sending" : "Send"}
        </button>
      </form>
    </div>
  );
}
