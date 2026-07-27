"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { AtSign, Paperclip, Send, X, Film } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";
import { PROFANITY_MESSAGE } from "@/lib/profanity";
import {
  CHAT_IMAGE_MIMES, CHAT_VIDEO_MIMES, CHAT_MAX_IMAGE_BYTES, CHAT_MAX_VIDEO_BYTES,
  type ChatMe, type SendResult,
} from "@/lib/useChatRoom";

/**
 * Shared chat composer — textarea + @mention autocomplete + one image/video
 * attachment + send. Extracted from LiveRooms so the Club Chat drawer and the
 * FTA Traders page share one composer. `tone` swaps the chrome: "paper" for the
 * light drawer, "dark" for the FTA channel surface (true-dark night-* tokens,
 * constant in both themes).
 */

interface PendingAttachment {
  file: File;
  kind: "image" | "video";
  previewUrl: string;
}

export default function ChatComposer({
  me,
  onSend,
  posting,
  uploading,
  tone = "paper",
  placeholder,
}: {
  me: ChatMe | null;
  onSend: (body: string, file: File | null) => Promise<SendResult>;
  posting: boolean;
  uploading: boolean;
  tone?: "paper" | "dark";
  placeholder?: string;
}) {
  const supabase = createClient();
  const dark = tone === "dark";
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<PendingAttachment | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // ── @mention autocomplete (same stripped-name rule as migration 028) ──
  const [mention, setMention] = useState<{ start: number; end: number; query: string } | null>(null);
  const [mentionIdx, setMentionIdx] = useState(0);
  const [roster, setRoster] = useState<{ id: string; name: string; stripped: string; avatar_url: string | null }[]>([]);
  const rosterLoaded = useRef(false);
  const loadRoster = useCallback(async () => {
    if (rosterLoaded.current) return;
    rosterLoaded.current = true;
    const { data } = await supabase.from("profiles").select("id, display_name, avatar_url").limit(300);
    setRoster(
      (data ?? [])
        .filter((p) => p.display_name)
        .map((p) => ({
          id: p.id as string,
          name: p.display_name as string,
          stripped: (p.display_name as string).replace(/\s+/g, ""),
          avatar_url: (p.avatar_url as string) ?? null,
        }))
        .filter((p) => p.stripped.length > 0)
    );
  }, [supabase]);
  const mentionCandidates = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    const people = roster
      .filter((p) => p.id !== me?.id)
      .filter((p) => p.stripped.toLowerCase().startsWith(q) || p.name.toLowerCase().startsWith(q))
      .slice(0, 5);
    if (me?.role === "admin" && "everyone".startsWith(q)) {
      return [
        { id: "__everyone__", name: "Everyone", stripped: "everyone", avatar_url: null },
        ...people,
      ];
    }
    return people;
  }, [mention, roster, me?.id, me?.role]);
  function detectMention(value: string, caret: number) {
    const m = value.slice(0, caret).match(/(^|\s)@([A-Za-z0-9_.'-]*)$/);
    if (m) {
      loadRoster();
      setMention({ start: caret - m[2].length - 1, end: caret, query: m[2] });
      setMentionIdx(0);
    } else setMention(null);
  }
  function insertMention(c: { stripped: string }) {
    if (!mention) return;
    const before = text.slice(0, mention.start);
    const after = text.slice(mention.end);
    const inserted = `@${c.stripped} `;
    setText(before + inserted + after);
    setMention(null);
    const caret = before.length + inserted.length;
    requestAnimationFrame(() => {
      taRef.current?.focus();
      taRef.current?.setSelectionRange(caret, caret);
    });
  }

  function handleFile(file: File | null) {
    if (!file) return;
    setError(null);
    const isImage = CHAT_IMAGE_MIMES.includes(file.type);
    const isVideo = CHAT_VIDEO_MIMES.includes(file.type);
    if (!isImage && !isVideo) return setError("Try a photo or video (JPG, PNG, MP4, MOV…).");
    if (isImage && file.size > CHAT_MAX_IMAGE_BYTES) return setError("Photos can be up to 10 MB.");
    if (isVideo && file.size > CHAT_MAX_VIDEO_BYTES) return setError("Videos can be up to 50 MB.");
    if (attachment) URL.revokeObjectURL(attachment.previewUrl);
    setAttachment({ file, kind: isImage ? "image" : "video", previewUrl: URL.createObjectURL(file) });
  }
  function clearAttachment() {
    if (attachment) URL.revokeObjectURL(attachment.previewUrl);
    setAttachment(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function submit() {
    if ((!text.trim() && !attachment) || !me || posting) return;
    const res = await onSend(text, attachment?.file ?? null);
    if (res.ok) {
      setText("");
      clearAttachment();
      setError(null);
    } else if (res.error === "profanity") {
      setError(PROFANITY_MESSAGE);
    } else if (res.error === "upload") {
      setError("Upload didn't go through. Try again.");
    } else if (res.error === "send") {
      setError("Message didn't send. Try again.");
    }
  }

  const surface = dark
    ? "border-t border-night-700/70 p-2.5 bg-night-900"
    : "border-t border-sand p-2.5";
  const attachBtn = dark
    ? "border-night-700 text-night-300 hover:text-gold-400"
    : "border-sand text-soft hover:text-gold-700";
  const taClass = dark
    ? "flex-1 resize-none bg-night-950 border border-night-700 rounded-lg px-2.5 py-1.5 text-xs text-night-50 placeholder:text-night-300 focus:outline-none focus:border-gold-500 max-h-24"
    : "flex-1 resize-none bg-paper border border-sand rounded-lg px-2.5 py-1.5 text-xs text-ink placeholder:text-soft focus:outline-none focus:border-gold-400 max-h-24";

  return (
    <div className={surface}>
      {error && <p className="text-[11px] text-red-500 mb-1.5">{error}</p>}
      {attachment && (
        <div className={`mb-1.5 inline-flex items-center gap-2 rounded-lg p-1.5 pr-2 border ${dark ? "bg-night-950 border-night-700" : "bg-paper border-sand"}`}>
          {attachment.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={attachment.previewUrl} alt="preview" className="w-8 h-8 rounded object-cover" />
          ) : (
            <div className="w-8 h-8 rounded bg-night-950 flex items-center justify-center"><Film className="w-4 h-4 text-night-50" /></div>
          )}
          <span className={`text-[11px] max-w-[120px] truncate ${dark ? "text-night-300" : "text-soft"}`}>{uploading ? "Uploading…" : attachment.file.name}</span>
          <button onClick={clearAttachment} aria-label="Remove"><X className={`w-3.5 h-3.5 ${dark ? "text-night-300" : "text-soft"}`} /></button>
        </div>
      )}
      <div className="relative flex items-end gap-1.5">
        <input ref={fileRef} type="file" accept={[...CHAT_IMAGE_MIMES, ...CHAT_VIDEO_MIMES].join(",")} className="hidden" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
        <button onClick={() => fileRef.current?.click()} disabled={posting} aria-label="Attach" className={`w-8 h-8 shrink-0 rounded-lg border flex items-center justify-center disabled:opacity-40 ${attachBtn}`}>
          <Paperclip className="w-4 h-4" />
        </button>
        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            detectMention(e.target.value, e.target.selectionStart ?? e.target.value.length);
          }}
          onKeyDown={(e) => {
            if (mention && mentionCandidates.length) {
              if (e.key === "ArrowDown") { e.preventDefault(); setMentionIdx((i) => (i + 1) % mentionCandidates.length); return; }
              if (e.key === "ArrowUp") { e.preventDefault(); setMentionIdx((i) => (i - 1 + mentionCandidates.length) % mentionCandidates.length); return; }
              if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); insertMention(mentionCandidates[mentionIdx]); return; }
              if (e.key === "Escape") { setMention(null); return; }
            }
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
          }}
          onBlur={() => setTimeout(() => setMention(null), 150)}
          rows={1}
          placeholder={placeholder ?? (me?.role === "child" ? "Say something…" : "Message the room…")}
          className={taClass}
        />
        <button onClick={submit} disabled={(!text.trim() && !attachment) || posting || !me} aria-label="Send" className="cta-button w-8 h-8 shrink-0 rounded-lg flex items-center justify-center disabled:opacity-40">
          <Send className="w-3.5 h-3.5" />
        </button>
        {mention && mentionCandidates.length > 0 && (
          <div className={`absolute bottom-full left-9 mb-1 w-56 rounded-lg shadow-lg overflow-hidden z-20 border ${dark ? "bg-night-900 border-night-700" : "bg-card border-sand"}`}>
            <p className={`flex items-center gap-1 px-2.5 pt-1.5 pb-1 text-[10px] font-display font-semibold uppercase tracking-wider ${dark ? "text-night-300" : "text-soft"}`}>
              <AtSign className="w-3 h-3" /> Mention
            </p>
            {mentionCandidates.map((c, i) => (
              <button
                key={c.id}
                onMouseDown={(e) => { e.preventDefault(); insertMention(c); }}
                onMouseEnter={() => setMentionIdx(i)}
                className={`flex items-center gap-2 w-full px-2.5 py-1.5 text-left ${
                  i === mentionIdx ? (dark ? "bg-night-800" : "bg-paper") : (dark ? "bg-night-900" : "bg-card")
                }`}
              >
                <Avatar name={c.name} avatarUrl={c.avatar_url} size="xs" />
                <span className={`text-xs truncate ${dark ? "text-night-50" : "text-ink"}`}>{c.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
