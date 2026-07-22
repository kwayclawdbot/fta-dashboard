"use client";

import { useMemo, useState } from "react";
import { Mail, MessageSquare, X, Loader2, AlertTriangle, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { sendContactMessage, type ContactRecord } from "@/lib/contacts";

/**
 * Individual 1:1 email / SMS compose modal, shared by the unified Contacts list
 * (quick actions) and the contact detail page. Sends through
 * /api/marketing/contacts/send, which reuses the campaign Resend/Twilio senders
 * and logs every send. Email supports {{first_name}} merge; SMS shows a
 * 160-char counter and a shared-number opt-out note.
 */

export interface CommsTarget {
  record: ContactRecord;
  contact_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  first_name: string | null;
  /** lead stage — 'unsubscribed' leads are blocked from sends. */
  stage?: string | null;
}

export function ContactCommsModal({
  target,
  channel: initialChannel,
  onClose,
  onSent,
}: {
  target: CommsTarget;
  channel: "email" | "sms";
  onClose: () => void;
  onSent?: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [channel, setChannel] = useState<"email" | "sms">(initialChannel);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    kind: "ok" | "warn" | "error";
    msg: string;
  } | null>(null);

  const unsubscribed = target.stage === "unsubscribed";
  const noEmail = channel === "email" && !target.email;
  const noPhone = channel === "sms" && !target.phone;
  const smsLen = body.length;
  const smsSegments = Math.max(1, Math.ceil(smsLen / 160));

  const canSend =
    !busy && body.trim().length > 0 && !unsubscribed && !noEmail && !noPhone;

  async function send() {
    if (!canSend) return;
    setBusy(true);
    setResult(null);
    try {
      const r = await sendContactMessage(supabase, {
        channel,
        record: target.record,
        contact_id: target.contact_id,
        email: target.email,
        phone: target.phone,
        first_name: target.first_name,
        subject: channel === "email" ? subject : undefined,
        body,
      });
      if (r.ok && r.status === "sent") {
        setResult({ kind: "ok", msg: "Sent." });
        onSent?.();
        setTimeout(onClose, 900);
      } else if (r.unsubscribed) {
        setResult({
          kind: "error",
          msg: "This contact unsubscribed — sends are blocked.",
        });
      } else if (r.domain_blocked) {
        setResult({
          kind: "warn",
          msg: "Recorded, but Resend blocked the send: the sending domain (familyinvestingclub.com) isn't verified yet. It will deliver once DNS is verified in Resend.",
        });
        onSent?.();
      } else {
        setResult({
          kind: "error",
          msg: r.error || "Send failed.",
        });
      }
    } catch (e) {
      setResult({
        kind: "error",
        msg: e instanceof Error ? e.message : "Send failed.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-zinc-100">
              Message {target.name || target.email || "contact"}
            </h3>
            <p className="text-[11px] text-zinc-500 truncate">
              {channel === "email"
                ? target.email || "no email on file"
                : target.phone || "no phone on file"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* channel toggle */}
        <div className="px-5 pt-4">
          <div className="inline-flex rounded-lg border border-zinc-800 p-0.5">
            <ChannelBtn
              active={channel === "email"}
              onClick={() => setChannel("email")}
              icon={<Mail className="w-3.5 h-3.5" />}
              label="Email"
            />
            <ChannelBtn
              active={channel === "sms"}
              onClick={() => setChannel("sms")}
              icon={<MessageSquare className="w-3.5 h-3.5" />}
              label="SMS"
            />
          </div>
        </div>

        {/* body */}
        <div className="px-5 py-4 space-y-3">
          {unsubscribed && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              This lead is <b>unsubscribed</b>. Sending is disabled.
            </div>
          )}

          {channel === "email" && (
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              disabled={unsubscribed}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-400/50 disabled:opacity-50"
            />
          )}

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={
              channel === "email"
                ? "Write your message… use {{first_name}} to personalize."
                : "Text message…"
            }
            rows={channel === "email" ? 6 : 3}
            disabled={unsubscribed}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-400/50 resize-none disabled:opacity-50"
          />

          {channel === "email" ? (
            <p className="text-[11px] text-zinc-600">
              <code className="text-zinc-400">{"{{first_name}}"}</code> is
              replaced per contact.
            </p>
          ) : (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-600">
                Shared number — 1:1 replies are fine. STOP opts the contact out.
              </span>
              <span
                className={smsLen > 160 ? "text-amber-400" : "text-zinc-500"}
              >
                {smsLen} · {smsSegments} seg
              </span>
            </div>
          )}

          {(noEmail || noPhone) && !unsubscribed && (
            <p className="text-[11px] text-amber-400">
              No {channel === "email" ? "email" : "phone"} on file for this
              contact.
            </p>
          )}

          {result && (
            <div
              className={`flex items-start gap-2 rounded-lg p-3 text-xs ${
                result.kind === "ok"
                  ? "border border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
                  : result.kind === "warn"
                    ? "border border-amber-500/30 bg-amber-500/5 text-amber-300"
                    : "border border-red-500/30 bg-red-500/5 text-red-300"
              }`}
            >
              {result.kind === "ok" ? (
                <Check className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span>{result.msg}</span>
            </div>
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="text-sm px-3 py-2 rounded-lg text-zinc-400 hover:text-zinc-200"
          >
            Close
          </button>
          <button
            onClick={send}
            disabled={!canSend}
            className="inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-amber-400 text-zinc-950 font-semibold hover:bg-amber-300 disabled:opacity-40 transition-colors"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : channel === "email" ? (
              <Mail className="w-4 h-4" />
            ) : (
              <MessageSquare className="w-4 h-4" />
            )}
            Send {channel === "email" ? "email" : "SMS"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChannelBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
        active
          ? "bg-amber-400 text-zinc-950"
          : "text-zinc-400 hover:text-zinc-200"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
