import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Lock, ShieldOff } from "lucide-react";
import PublicLivingCard from "@/components/ownership/PublicLivingCard";
import ScanVerification from "@/components/ownership/ScanVerification";
import { formatMoney, formatPct } from "@/components/ownership/format";
import { formFactorMeta, type ScanState } from "@/components/ownership/scan";
import { demoScan } from "@/components/ownership/demo";
import { resolveScan } from "../scan-data";
import { artFor } from "@/components/ownership/art";

export const dynamic = "force-dynamic";

/* Dark-premium palette — the scan page is a physical object's face; it commits
   to a single dark look regardless of the viewer's app theme, tuned for high
   contrast in sunlight. */
const BG = "#060708";
const INK = "#F4F1EA";
const SUB = "rgba(244,241,234,0.62)";
const FAINT = "rgba(244,241,234,0.40)";
const HAIRLINE = "rgba(244,241,234,0.12)";
const GREEN = "#22C55E";
const RED = "#F1707B";

function isDemoSerial(serial: string): boolean {
  return serial.startsWith("demo-");
}

/** Per-request memoized resolve so generateMetadata + the page share one read. */
const getScan = cache(
  async (serial: string, picc: string, cmac: string, demo: boolean): Promise<ScanState> => {
    if (demo || isDemoSerial(serial)) return demoScan(serial);
    return resolveScan(serial, { picc: picc || undefined, cmac: cmac || undefined });
  }
);

type SP = { picc?: string; cmac?: string; demo?: string };

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ serial: string }>;
  searchParams: Promise<SP>;
}): Promise<Metadata> {
  const { serial } = await params;
  const sp = await searchParams;
  const scan = await getScan(serial, sp.picc ?? "", sp.cmac ?? "", sp.demo === "1");

  if (scan.status !== "ok" || (!scan.card && !scan.claimable)) {
    return { title: "Cheat Code Ownership Card", robots: { index: false } };
  }
  if (!scan.card) {
    return {
      title: "Unclaimed · Cheat Code Ownership Card",
      description: "A Cheat Code artifact waiting to be activated.",
      robots: { index: false },
    };
  }
  const c = scan.card;
  const asset = c.assetName || c.assetSymbol;
  const growth =
    c.gainPctSinceIssue != null ? ` · ${formatPct(c.gainPctSinceIssue)} since issue` : "";
  const title = `${c.assetSymbol} · ${asset} — Cheat Code Ownership Card`;
  const description = `A verifiable Cheat Code Ownership Card for ${asset}${growth}. Owned since ${c.ownedSinceYear}. Serial ${c.serial}.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary_large_image", title, description },
    robots: { index: false },
  };
}

export default async function ScanPage({
  params,
  searchParams,
}: {
  params: Promise<{ serial: string }>;
  searchParams: Promise<SP>;
}) {
  const { serial } = await params;
  const sp = await searchParams;
  const demo = sp.demo === "1" || isDemoSerial(serial);
  const scan = await getScan(serial, sp.picc ?? "", sp.cmac ?? "", sp.demo === "1");
  const demoQ = demo ? "?demo=1" : "";

  return (
    <main
      className="relative min-h-[100dvh] w-full overflow-hidden"
      style={{ background: BG, color: INK }}
    >
      <AmbientGlow symbol={scan.card?.assetSymbol ?? "BTC"} />

      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pb-10 pt-6 sm:pt-9">
        {/* Brand line */}
        <div className="flex items-center justify-center gap-2">
          <span
            className="inline-block h-4 w-4 rounded-[5px]"
            style={{
              background: "linear-gradient(135deg,#FFF3C4,#E6B84D 55%,#9c7a2a)",
            }}
          />
          <span
            className="font-mono text-[11px] uppercase tracking-[0.32em]"
            style={{ color: SUB }}
          >
            Cheat Code
          </span>
        </div>

        {scan.status !== "ok" ? (
          <NotFoundState serial={scan.serial} />
        ) : scan.card ? (
          <BoundView scan={scan} demoQ={demoQ} />
        ) : (
          <UnclaimedView scan={scan} serial={serial} demoQ={demoQ} />
        )}

        <Footer serial={scan.card?.serial ?? scan.serial} demoQ={demoQ} />
      </div>
    </main>
  );
}

/* ── Bound (a real, activated card) ─────────────────────────────────── */

function BoundView({ scan, demoQ }: { scan: ScanState; demoQ: string }) {
  const c = scan.card!;
  const assetType = scan.assetType ?? "stock";
  const isCrypto = assetType === "crypto";
  const distressed = c.status === "seal_broken" || c.status === "retired";
  const up = (c.gainPctSinceIssue ?? 0) >= 0;

  return (
    <>
      <div className="mt-7 flex justify-center">
        <ScanVerification tapVerified={scan.tapVerified} />
      </div>

      <div className="mt-6 flex justify-center">
        <PublicLivingCard
          card={c}
          assetType={assetType}
          size="hero"
          tapVerified={scan.tapVerified}
        />
      </div>

      {/* Value block — big + sunlight-legible, restates the face honestly. */}
      <div
        className="mt-7 rounded-2xl px-5 py-4"
        style={{ background: "rgba(244,241,234,0.035)", border: `1px solid ${HAIRLINE}` }}
      >
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: FAINT }}>
              {distressed ? "Value" : "Current value"}
            </div>
            <div className="mt-1 font-mono text-3xl font-bold tabular-nums" style={{ color: INK }}>
              {c.currentValue != null ? formatMoney(c.currentValue) : "—"}
            </div>
          </div>
          {c.gainPctSinceIssue != null && (
            <div
              className="rounded-lg px-2.5 py-1.5 text-right font-mono text-sm font-bold tabular-nums"
              style={{
                color: distressed ? FAINT : up ? GREEN : RED,
                background: distressed
                  ? "rgba(244,241,234,0.05)"
                  : up
                    ? "rgba(34,197,94,0.10)"
                    : "rgba(241,112,123,0.10)",
              }}
            >
              {formatPct(c.gainPctSinceIssue)}
              <div className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.14em]" style={{ color: FAINT }}>
                since issue
              </div>
            </div>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2 border-t pt-3" style={{ borderColor: HAIRLINE }}>
          {isCrypto ? (
            <>
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: GREEN, boxShadow: `0 0 8px ${GREEN}` }}
              />
              <span className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: SUB }}>
                Live · the market never closes
              </span>
            </>
          ) : (
            <span className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: FAINT }}>
              Value at last market close
            </span>
          )}
        </div>
      </div>

      {distressed && <HonestStatusLine status={c.status} />}
    </>
  );
}

function HonestStatusLine({ status }: { status: string }) {
  const retired = status === "retired";
  return (
    <div
      className="mt-4 flex items-start gap-3 rounded-2xl px-4 py-3"
      style={{ background: "rgba(241,178,74,0.06)", border: "1px solid rgba(241,178,74,0.25)" }}
    >
      <ShieldOff className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#E6B84D" }} />
      <p className="text-[13px] leading-snug" style={{ color: SUB }}>
        {retired ? (
          <>This card has been <span style={{ color: INK }}>retired</span>. It lives on as a collectible record of what was once held.</>
        ) : (
          <>The seal on this card has been <span style={{ color: INK }}>broken</span> — the underlying position was sold. The card keeps its full history, honestly marked.</>
        )}
      </p>
    </div>
  );
}

/* ── Unclaimed (chip ships unbound; first tap claims) ───────────────── */

function UnclaimedView({
  scan,
  serial,
  demoQ,
}: {
  scan: ScanState;
  serial: string;
  demoQ: string;
}) {
  const ff = formFactorMeta(scan.chip?.formFactor);
  return (
    <>
      <div className="mt-7 flex justify-center">
        <ScanVerification tapVerified={scan.tapVerified} />
      </div>

      <div className="mt-6 flex justify-center">
        <GhostCard label={ff.label} />
      </div>

      <div className="mt-7 text-center">
        <h1 className="font-display text-2xl font-extrabold" style={{ color: INK }}>
          This {ff.noun} hasn&apos;t been activated
        </h1>
        <p className="mx-auto mt-2 max-w-xs text-[14px] leading-relaxed" style={{ color: SUB }}>
          It&apos;s genuine and unclaimed. Activate it to bind this {ff.noun} to a
          living Ownership Card — a one-time, permanent marriage of the artifact
          and its digital title.
        </p>
      </div>

      <Link
        href={`/c/${encodeURIComponent(serial)}/claim${demoQ}`}
        className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-center font-semibold"
        style={{
          background: "linear-gradient(135deg,#FFF3C4,#E6B84D 55%,#c8991f)",
          color: "#231a08",
          boxShadow: "0 10px 34px -12px rgba(230,184,77,0.6)",
        }}
      >
        <Lock className="h-4 w-4" />
        Activate this {ff.noun}
      </Link>
    </>
  );
}

function GhostCard({ label }: { label: string }) {
  return (
    <div style={{ maxWidth: "min(76vw, 300px)", width: "100%", perspective: "1100px" }}>
      <div
        className="relative flex flex-col items-center justify-center rounded-[18px] p-6"
        style={{
          aspectRatio: "5 / 7",
          background: "rgba(244,241,234,0.03)",
          border: "1.5px dashed rgba(244,241,234,0.2)",
        }}
      >
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: "rgba(230,184,77,0.1)", border: "1px solid rgba(230,184,77,0.4)" }}
        >
          <Lock className="h-6 w-6" style={{ color: "#E6B84D" }} />
        </div>
        <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.24em]" style={{ color: FAINT }}>
          Unclaimed {label}
        </div>
        <div className="mt-1 font-display text-lg font-bold" style={{ color: SUB }}>
          Awaiting first tap
        </div>
      </div>
    </div>
  );
}

/* ── Not found ──────────────────────────────────────────────────────── */

function NotFoundState({ serial }: { serial: string }) {
  return (
    <div className="mt-16 flex flex-1 flex-col items-center text-center">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ background: "rgba(244,241,234,0.05)", border: `1px solid ${HAIRLINE}` }}
      >
        <ShieldOff className="h-6 w-6" style={{ color: FAINT }} />
      </div>
      <h1 className="mt-5 font-display text-2xl font-extrabold" style={{ color: INK }}>
        Not in the registry
      </h1>
      <p className="mx-auto mt-2 max-w-xs text-[14px] leading-relaxed" style={{ color: SUB }}>
        We couldn&apos;t find a Cheat Code Ownership Card for{" "}
        <span className="font-mono" style={{ color: INK }}>
          {serial}
        </span>
        . Double-check the link, or tap the artifact again.
      </p>
      <Link
        href="/c/about"
        className="mt-6 inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium"
        style={{ border: `1px solid ${HAIRLINE}`, color: INK }}
      >
        What is a Cheat Code card?
      </Link>
    </div>
  );
}

/* ── Footer ─────────────────────────────────────────────────────────── */

function Footer({ serial, demoQ }: { serial: string; demoQ: string }) {
  return (
    <footer className="mt-auto pt-9">
      <div className="border-t pt-5" style={{ borderColor: HAIRLINE }}>
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: FAINT }}>
            Cheat Code Ownership Card · <span style={{ color: SUB }}>{serial}</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/c/about"
              className="text-[12px] font-medium underline decoration-dotted underline-offset-4"
              style={{ color: SUB }}
            >
              What is this?
            </Link>
            <span style={{ color: HAIRLINE }}>·</span>
            <Link
              href={`/collection${demoQ}`}
              className="inline-flex items-center gap-1 text-[12px] font-semibold"
              style={{ color: "#E6B84D" }}
            >
              Own one
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ── Ambient background glow, tinted by the asset ───────────────────── */

function AmbientGlow({ symbol }: { symbol: string }) {
  const art = artFor(symbol);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div
        className="absolute left-1/2 top-0 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/3 rounded-full"
        style={{ background: art.accent, opacity: 0.14, filter: "blur(90px)" }}
      />
      <div
        className="absolute bottom-0 left-0 h-[300px] w-[300px] translate-y-1/3 rounded-full"
        style={{ background: art.accent2, opacity: 0.1, filter: "blur(90px)" }}
      />
    </div>
  );
}
