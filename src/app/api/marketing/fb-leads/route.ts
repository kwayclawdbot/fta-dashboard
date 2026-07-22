import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/server/marketing";

export const dynamic = "force-dynamic";

/**
 * Facebook Lead Ads webhook — receiving end.
 *
 * Full OAuth connect is owner-blocked (needs a Meta app + page access token to
 * fetch the full lead via the Graph API). This endpoint is the durable landing
 * pad the owner points Meta at:
 *
 *   GET  — Meta subscription verification. Echoes hub.challenge when
 *          hub.verify_token === FB_LEADS_VERIFY_TOKEN.
 *   POST — leadgen change notifications. When field_data is present inline
 *          (test payloads / lead_retrieval already resolved) we upsert a lead
 *          with source 'facebook'. When only leadgen_id is present (production,
 *          before a page token is configured) we log it for later retrieval.
 *
 * Owner setup steps are documented in .planning/MARKETING-CRM.md and on the
 * "Connect Facebook" card at /admin/crm/leads.
 */

// ── GET: subscription verification (Meta spec) ──────────────────────────────
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  const expected = process.env.FB_LEADS_VERIFY_TOKEN?.trim();

  if (mode === "subscribe" && expected && token === expected && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  }
  return NextResponse.json({ error: "verification failed" }, { status: 403 });
}

type FbFieldEntry = { name?: string; values?: string[] };

function mapFieldData(fields: FbFieldEntry[]): {
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  full_name?: string;
} {
  const out: Record<string, string> = {};
  for (const f of fields || []) {
    const name = (f.name || "").toLowerCase();
    const val = f.values?.[0];
    if (!val) continue;
    if (name.includes("email")) out.email = val;
    else if (name === "first_name" || name === "firstname") out.first_name = val;
    else if (name === "last_name" || name === "lastname") out.last_name = val;
    else if (name.includes("phone")) out.phone = val;
    else if (name === "full_name" || name === "name") out.full_name = val;
  }
  if (!out.first_name && out.full_name) {
    const parts = out.full_name.split(/\s+/);
    out.first_name = parts[0];
    if (parts.length > 1) out.last_name = parts.slice(1).join(" ");
  }
  return out;
}

// ── POST: leadgen change notifications ──────────────────────────────────────
export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => null);
  if (!payload) return NextResponse.json({ error: "bad payload" }, { status: 400 });

  const db = serviceClient();
  let upserted = 0;
  let pending = 0;

  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  for (const entry of entries) {
    const changes = Array.isArray(entry.changes) ? entry.changes : [];
    for (const change of changes) {
      if (change.field && change.field !== "leadgen") continue;
      const value = change.value || {};
      const inlineFields: FbFieldEntry[] =
        value.field_data || value.raw_fields || [];

      if (inlineFields.length > 0) {
        const mapped = mapFieldData(inlineFields);
        if (mapped.email) {
          const nowIso = new Date().toISOString();
          const { data: existing } = await db
            .from("marketing_leads")
            .select("id")
            .eq("email", mapped.email)
            .eq("source", "facebook")
            .maybeSingle();
          if (existing) {
            await db
              .from("marketing_leads")
              .update({
                first_name: mapped.first_name || undefined,
                last_name: mapped.last_name || undefined,
                phone: mapped.phone || undefined,
                updated_at: nowIso,
              })
              .eq("id", existing.id);
          } else {
            const { data: ins } = await db
              .from("marketing_leads")
              .insert({
                email: mapped.email,
                first_name: mapped.first_name || null,
                last_name: mapped.last_name || null,
                phone: mapped.phone || null,
                source: "facebook",
                consent_source: "facebook_lead_ad",
                custom: {
                  leadgen_id: value.leadgen_id || null,
                  form_id: value.form_id || null,
                  page_id: value.page_id || null,
                  ad_id: value.ad_id || null,
                },
              })
              .select("id")
              .single();
            if (ins) {
              await db.from("marketing_lead_events").insert({
                lead_id: ins.id,
                type: "imported",
                meta: { source: "facebook", leadgen_id: value.leadgen_id || null },
              });
            }
          }
          upserted++;
        }
      } else if (value.leadgen_id) {
        // Only an id — full retrieval needs a page access token (owner-blocked).
        // Record a stub so nothing is lost; owner can backfill after connecting.
        pending++;
        console.log("[fb-leads] leadgen_id received, awaiting page token:", value.leadgen_id);
      }
    }
  }

  // Always 200 so Meta doesn't disable the subscription on non-2xx.
  return NextResponse.json({ ok: true, upserted, pending });
}
