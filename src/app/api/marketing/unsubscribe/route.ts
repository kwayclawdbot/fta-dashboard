import { NextRequest, NextResponse } from "next/server";
import { serviceClient, verifyUnsubToken } from "@/lib/server/marketing";

export const dynamic = "force-dynamic";

/**
 * Public one-click unsubscribe. The email footer links here with a signed HMAC
 * token (?token=). Verifying the token yields the lead id; we flip the lead to
 * stage 'unsubscribed' and log an event. No auth — the token IS the auth.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const leadId = verifyUnsubToken(token);

  const page = (title: string, msg: string, ok: boolean) =>
    new NextResponse(
      `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#0a0a0f;color:#e4e4e7;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
.card{max-width:440px;padding:40px;text-align:center;border:1px solid #27272a;border-radius:16px;background:#18181b}
h1{font-size:20px;margin:0 0 12px;color:${ok ? "#34d399" : "#f87171"}}
p{color:#a1a1aa;font-size:14px;line-height:1.6;margin:0}</style></head>
<body><div class="card"><h1>${title}</h1><p>${msg}</p></div></body></html>`,
      { status: ok ? 200 : 400, headers: { "content-type": "text/html; charset=utf-8" } }
    );

  if (!leadId) {
    return page("Invalid link", "This unsubscribe link is invalid or has expired.", false);
  }

  const db = serviceClient();
  const { data: lead } = await db
    .from("marketing_leads")
    .select("id, email, stage")
    .eq("id", leadId)
    .maybeSingle();

  if (!lead) {
    return page("Not found", "We couldn't find this contact.", false);
  }

  if (lead.stage !== "unsubscribed") {
    await db
      .from("marketing_leads")
      .update({ stage: "unsubscribed", last_activity_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", leadId);
    await db.from("marketing_lead_events").insert({
      lead_id: leadId,
      type: "stage_changed",
      meta: { from: lead.stage, to: "unsubscribed", via: "unsubscribe_link" },
    });
  }

  return page(
    "You're unsubscribed",
    "You won't receive any more marketing emails from the Family Investing Club. You can close this window.",
    true
  );
}
