import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/server/marketing";
import { verifyDripUnsubToken } from "@/lib/server/drips";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public one-click unsubscribe for the welcome drip. The email footer +
 * List-Unsubscribe header carry a signed HMAC token (?token=). Verifying the
 * token yields the user id; we suppress every remaining (pending) step and
 * record a drip_optouts row so the user is never re-enrolled. No auth — the
 * token IS the auth. Also handles POST for RFC 8058 one-click unsubscribe.
 */
async function suppress(userId: string) {
  const db = serviceClient();
  await db
    .from("email_drips")
    .update({ status: "suppressed" })
    .eq("user_id", userId)
    .eq("status", "pending");
  await db
    .from("drip_optouts")
    .upsert({ user_id: userId }, { onConflict: "user_id" });
}

function page(title: string, msg: string, ok: boolean) {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#FBF7EF;color:#101828;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
.card{max-width:440px;padding:40px;text-align:center;border:1px solid #EAE2D0;border-radius:18px;background:#FFFFFF}
h1{font-size:20px;margin:0 0 12px;color:${ok ? "#B45309" : "#B91C1C"}}
p{color:#5B6472;font-size:14px;line-height:1.6;margin:0}</style></head>
<body><div class="card"><h1>${title}</h1><p>${msg}</p></div></body></html>`,
    { status: ok ? 200 : 400, headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const userId = verifyDripUnsubToken(token);
  if (!userId) {
    return page("Invalid link", "This unsubscribe link is invalid or has expired.", false);
  }
  await suppress(userId);
  return page(
    "You're unsubscribed",
    "You won't receive any more welcome emails from the Cheat Code Club. You can close this window.",
    true
  );
}

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const userId = verifyDripUnsubToken(token);
  if (!userId) return NextResponse.json({ ok: false }, { status: 400 });
  await suppress(userId);
  return NextResponse.json({ ok: true });
}
