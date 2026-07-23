import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/server/membership";
import {
  getCompany,
  getQuote,
  getBars,
  getFinancials,
  normalizeSymbol,
  isConfigured,
} from "@/lib/market/polygon";
import {
  buildReportSystemPrompt,
  REPORT_SCHEMA,
  KAI_MODEL,
  type KaiReportSections,
} from "@/lib/kai/persona";
import { abbreviateMoney } from "@/lib/kai/report";

/**
 * POST /api/admin/kai-report  { ticker }
 *
 * Admin-gated (JWT → profiles.role='admin', mirrors /api/admin/support). Pulls
 * real market data server-side (Polygon, key never leaves the server), grounds
 * a claude-sonnet-5 structured-output call to write the report prose, then
 * stores a NEW VERSION in kai_reports (service role) with the chart data block.
 * The member view renders charts from the stored data — the model only writes
 * text. Publishing appears on /research/[ticker].
 */
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const jwt = auth.replace(/^Bearer\s+/i, "");
  if (!jwt) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = serviceClient();
  const { data: userRes, error: authErr } = await db.auth.getUser(jwt);
  if (authErr || !userRes?.user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: prof } = await db
    .from("profiles")
    .select("role")
    .eq("id", userRes.user.id)
    .single();
  if (prof?.role !== "admin")
    return NextResponse.json({ error: "admin only" }, { status: 403 });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key)
    return NextResponse.json({ error: "Kai is offline (no API key)." }, { status: 503 });
  if (!isConfigured())
    return NextResponse.json({ error: "Market data unavailable." }, { status: 503 });

  const body = await req.json().catch(() => null);
  const ticker = normalizeSymbol(String(body?.ticker || ""));
  if (!ticker)
    return NextResponse.json({ error: "A valid ticker is required." }, { status: 400 });

  // ── Pull grounding data (server-side, key-free to the client) ──────────────
  const [company, quote, bars, financials] = await Promise.all([
    getCompany(ticker),
    getQuote(ticker),
    getBars(ticker, 365),
    getFinancials(ticker, 8),
  ]);

  if (!bars || bars.length < 5)
    return NextResponse.json(
      { error: "Not enough market data for this ticker." },
      { status: 422 }
    );

  const companyName = company?.name || ticker;
  const closes = bars.map((b) => b.c);
  const high = Math.max(...closes);
  const low = Math.min(...closes);
  const first = closes[0];
  const last = closes[closes.length - 1];
  const pct = first ? ((last - first) / first) * 100 : 0;

  const finLines =
    financials && financials.length
      ? financials
          .map(
            (f) =>
              `- ${f.label}: revenue ${abbreviateMoney(f.revenue)}, net income ${abbreviateMoney(f.netIncome)}`
          )
          .join("\n")
      : "(quarterly financials not available for this ticker)";

  const grounding = `COMPANY: ${companyName} (${ticker})
Sector: ${company?.sector || "unknown"}
Market cap: ${company?.marketCapText || "unknown"}
Business description (from filings): ${(company?.description || "not available").slice(0, 1400)}

PRICE (delayed ~15 min, last ~1 year of daily closes):
- Latest price: ${quote?.price != null ? `$${quote.price.toFixed(2)}` : `$${last.toFixed(2)}`}
- 1-year range: low $${low.toFixed(2)} → high $${high.toFixed(2)}
- ~1-year change: ${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%

QUARTERLY FINANCIALS (oldest → newest):
${finLines}

Write the research report for ${companyName}. Base every claim on the data above.`;

  // ── Generate structured report (claude-sonnet-5) ───────────────────────────
  let sections: KaiReportSections;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: KAI_MODEL,
        max_tokens: 4096,
        thinking: { type: "disabled" },
        system: buildReportSystemPrompt(),
        output_config: {
          format: { type: "json_schema", schema: REPORT_SCHEMA },
        },
        messages: [{ role: "user", content: grounding }],
      }),
      signal: AbortSignal.timeout(55_000),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("[KaiReport] anthropic error:", data);
      return NextResponse.json(
        { error: `Kai could not generate the report (${data?.error?.type || res.status}).` },
        { status: 502 }
      );
    }
    const text: string =
      data.content?.find((b: { type: string }) => b.type === "text")?.text || "";
    sections = JSON.parse(text) as KaiReportSections;
  } catch (e) {
    console.error("[KaiReport] generation failed:", e);
    return NextResponse.json(
      { error: "Kai timed out generating the report. Please try again." },
      { status: 504 }
    );
  }

  // ── Store a new version ─────────────────────────────────────────────────────
  const { data: verRow } = await db.rpc("next_kai_report_version", {
    p_ticker: ticker,
  });
  const version = typeof verRow === "number" ? verRow : 1;

  const reportData = {
    bars: bars.map((b) => ({ t: b.t, c: b.c })),
    financials: financials ?? null,
    snapshot: {
      price: quote?.price ?? last,
      marketCapText: company?.marketCapText ?? null,
      sector: company?.sector ?? null,
    },
  };

  const { data: inserted, error: insErr } = await db
    .from("kai_reports")
    .insert({
      ticker,
      company_name: companyName,
      version,
      status: "published",
      model: KAI_MODEL,
      sections,
      data: reportData,
      generated_by: userRes.user.id,
    })
    .select("id, version")
    .single();

  if (insErr) {
    console.error("[KaiReport] insert failed:", insErr);
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    id: inserted?.id,
    version: inserted?.version ?? version,
    ticker,
  });
}
