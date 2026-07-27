"use client";

/**
 * /news/[slug] — the article (canvas rebuild B).
 *
 * REGISTER: a read, not a dashboard. One column at a real reading measure
 * (~65ch), a display headline, a dek, a ruled dateline strip, then the body.
 * Nothing on this page is boxed: the only structures are the measure and the
 * hairlines that separate the article from its apparatus.
 *
 * COLOUR LAW: the tickers ledger is the only place price appears, in
 * `text-price-up` / `text-price-down` (never a dark: variant — those tokens
 * already carry both themes). Sentiment stays inside SocialBar, the shared
 * community control. Brand orange marks only the way back and the links.
 *
 * COMPLIANCE: NEWS_DISCLAIMER and the "Written by … from public market data"
 * line are rendered verbatim, and the kid branch that suppresses the model
 * credit is preserved exactly as it was.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getClubTier, type FamilyTier } from "@/lib/tier";
import {
  fetchQuotes,
  formatPrice,
  formatChangePct,
  changeTone,
  type MarketQuote,
} from "@/lib/market/client";
import { fetchSocial, type TickerSocial } from "@/lib/research/social";
import { fetchNewsArticle } from "@/lib/news/client";
import { NEWS_DISCLAIMER, timeAgo, type NewsArticle } from "@/lib/news/types";
import NewsBlocks from "@/components/news/NewsBlocks";
import { AiTag, Dateline } from "@/components/news/NewsCard";
import CompanyLogo from "@/components/fic/CompanyLogo";
import SocialBar from "@/components/research/SocialBar";

export default function NewsArticlePage() {
  const supabase = createClient();
  const params = useParams<{ slug: string }>();
  const slug = (params?.slug || "").toString();

  const [loading, setLoading] = useState(true);
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [ageGroup, setAgeGroup] = useState<string | null>(null);
  const [tier, setTier] = useState<FamilyTier>("fic");
  const [quotes, setQuotes] = useState<Record<string, MarketQuote>>({});
  const [social, setSocial] = useState<Record<string, TickerSocial>>({});

  const load = useCallback(async () => {
    const art = await fetchNewsArticle(supabase, slug);
    setArticle(art);
    setLoading(false);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("family_id, age_group")
        .eq("id", user.id)
        .maybeSingle();
      setAgeGroup(profile?.age_group ?? null);
      setTier(await getClubTier(supabase, profile?.family_id));
    }

    const tickers = art?.tickers ?? [];
    if (tickers.length > 0) {
      fetchQuotes(tickers).then(setQuotes);
      Promise.all(tickers.map((t) => fetchSocial(supabase, t))).then((snaps) => {
        const map: Record<string, TickerSocial> = {};
        snaps.forEach((s, i) => (map[tickers[i]] = s));
        setSocial(map);
      });
    }
  }, [supabase, slug]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const isKid = ageGroup === "kids";
  const canVote = tier !== "free";

  if (loading) return <ArticleSkeleton />;

  if (!article) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 sm:px-6">
        <div className="border-l-2 border-sand py-1 pl-4">
          <h1 className="font-display text-display-3 font-extrabold text-ink">
            Story not found
          </h1>
          <p className="mt-1.5 max-w-[46ch] text-[15px] leading-relaxed text-soft">
            This article may have been removed.
          </p>
          <Link
            href="/news"
            className="mt-4 inline-flex items-center gap-1.5 font-display text-[14px] font-bold text-gold-700 transition-colors hover:text-gold-600"
          >
            <ArrowLeft className="h-4 w-4" /> Back to the newsroom
          </Link>
        </div>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-2xl px-4 pb-24 sm:px-6">
      <Link
        href="/news"
        className="inline-flex items-center gap-1.5 text-eyebrow font-display font-bold uppercase text-soft transition-colors hover:text-gold-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Newsroom
      </Link>

      {/* ── HEADLINE ──────────────────────────────────────────────────────── */}
      <header className="mt-6">
        <Dateline kind={article.kind} at={article.generated_at} />
        <h1 className="mt-3 max-w-[20ch] font-display text-display-2 font-extrabold leading-[1.02] text-ink sm:text-display-1 sm:leading-[0.98]">
          {article.title}
        </h1>
        {article.dek && (
          <p className="mt-4 max-w-[54ch] text-[17px] leading-relaxed text-soft">
            {article.dek}
          </p>
        )}
      </header>

      {/* ── DATELINE STRIP ────────────────────────────────────────────────── */}
      {/* Provenance sits between the headline and the body the way a byline
          does — ruled top and bottom, mono, quiet. */}
      <div className="f0-rule-top mt-7">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
          <AiTag />
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-soft opacity-70">
            {timeAgo(article.generated_at)}
          </span>
        </div>
      </div>
      <div className="f0-rule-top" />

      {/* ── BODY ──────────────────────────────────────────────────────────── */}
      <div className="mt-7">
        <NewsBlocks blocks={article.sections?.blocks ?? []} />
      </div>

      {/* ── TICKERS IN THIS STORY ─────────────────────────────────────────── */}
      {article.tickers.length > 0 && (
        <section className="mt-12">
          <h2 className="f0-section-rule text-eyebrow font-display font-bold uppercase text-soft">
            <span className="shrink-0 whitespace-nowrap">Tickers in this story</span>
          </h2>
          <div className="f0-ledger mt-1">
            {article.tickers.map((t) => {
              const q = quotes[t];
              const tone = changeTone(q?.changePercent);
              return (
                <div key={t} className="f0-ledger-row flex-wrap justify-between">
                  <Link href={`/research/${t}`} className="flex min-w-0 items-center gap-3">
                    <CompanyLogo symbol={t} size={28} rounded="rounded-lg" />
                    <span className="font-mono text-[14px] font-bold text-ink">
                      <span className="opacity-50">$</span>
                      {t}
                    </span>
                    {q?.price != null && (
                      <span className="font-mono text-[14px] font-semibold tabular-nums text-ink">
                        {formatPrice(q.price)}
                      </span>
                    )}
                    {q?.changePercent != null && (
                      <span
                        className={`font-mono text-[13px] font-semibold tabular-nums ${
                          tone === "up"
                            ? "text-price-up"
                            : tone === "down"
                              ? "text-price-down"
                              : "text-soft"
                        }`}
                      >
                        {formatChangePct(q.changePercent)}
                      </span>
                    )}
                  </Link>
                  <SocialBar
                    supabase={supabase}
                    ticker={t}
                    variant="card"
                    initial={social[t]}
                    userId={userId}
                    ageGroup={ageGroup}
                    canVote={canVote && !!userId}
                    threadHref={`/research/${t}?tab=community`}
                  />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── COMPLIANCE ────────────────────────────────────────────────────── */}
      {/* Regulated copy — NEWS_DISCLAIMER is rendered verbatim, never reworded. */}
      <footer className="f0-rule-top mt-12 pt-4">
        <p className="max-w-[65ch] text-[11px] leading-relaxed text-soft">
          {NEWS_DISCLAIMER}
        </p>
        {!isKid && (
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-soft opacity-60">
            Written by {article.model || "AI"} from public market data.
          </p>
        )}
      </footer>
    </article>
  );
}

function ArticleSkeleton() {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 sm:px-6">
      <div className="h-2.5 w-20 animate-pulse rounded bg-sand" />
      <div className="mt-6 space-y-3">
        <div className="h-2.5 w-28 animate-pulse rounded bg-sand" />
        <div className="h-9 w-4/5 animate-pulse rounded bg-sand" />
        <div className="h-5 w-full max-w-[46ch] animate-pulse rounded bg-sand/70" />
      </div>
      <div className="f0-rule-top mt-7" />
      <div className="mt-7 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-4 w-full max-w-[65ch] animate-pulse rounded bg-sand/60" />
        ))}
      </div>
    </div>
  );
}
