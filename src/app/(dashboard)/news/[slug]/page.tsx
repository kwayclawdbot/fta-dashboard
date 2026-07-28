"use client";

/**
 * /news/[slug] — the article, in the mockup's card language.
 *
 * REGISTER: a read, so the prose keeps its ~65ch measure and is NOT put in a
 * card — a card around body copy is a box around a paragraph. What IS carded is
 * the apparatus the boards card: the provenance strip, each ticker in the
 * story, and the compliance footer. Same objects as board 02/15: white fill,
 * 1px sand hairline, 12–18px radius.
 *
 * COLOUR LAW: the tickers row is the only place price appears, in
 * `text-price-up` / `text-price-down` (never a dark: variant — those tokens
 * already carry both themes). Sentiment stays inside SocialBar, the shared
 * community control. Brand orange marks only the way back and the links.
 *
 * COMPLIANCE: NEWS_DISCLAIMER and the "Written by … from public market data"
 * line are rendered verbatim, and the kid branch that suppresses the model
 * credit is preserved exactly as it was.
 *
 * PURITY: the timestamp comes from the hour-bucketed external store
 * (components/discover/clock.ts) — nothing here reads a clock during render.
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
import { NEWS_DISCLAIMER, type NewsArticle } from "@/lib/news/types";
import NewsBlocks from "@/components/news/NewsBlocks";
import { AiTag, Dateline } from "@/components/news/NewsCard";
import CompanyLogo from "@/components/fic/CompanyLogo";
import SocialBar from "@/components/research/SocialBar";
import { Bone, BoardCard, SectionMark } from "@/components/discover/board";
import { timeAgoAt, useNowHour } from "@/components/discover/clock";

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
  const now = useNowHour();

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
        <BoardCard radius={18} className="px-[15px] py-[14px]">
          <h1 className="font-display text-[21px] font-extrabold tracking-[-0.02em] text-ink">
            Story not found
          </h1>
          <p className="mt-1.5 max-w-[46ch] text-[13px] leading-relaxed text-soft">
            This article may have been removed.
          </p>
          <Link
            href="/news"
            className="f0-focus mt-3 inline-flex items-center gap-1.5 rounded font-display text-[13px] font-bold text-gold-700 transition-colors hover:text-gold-600"
          >
            <ArrowLeft className="h-4 w-4" /> Back to the newsroom
          </Link>
        </BoardCard>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-2xl px-4 pb-24 sm:px-6">
      <Link
        href="/news"
        className="f0-focus inline-flex items-center gap-1.5 rounded font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-gold-700 transition-colors hover:text-gold-600"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Newsroom
      </Link>

      {/* ── HEADLINE ──────────────────────────────────────────────────────── */}
      <header className="mt-5">
        <Dateline kind={article.kind} at={article.generated_at} />
        <h1 className="mt-2.5 max-w-[22ch] font-display text-[28px] font-extrabold leading-[1.06] tracking-[-0.025em] text-ink sm:text-[36px]">
          {article.title}
        </h1>
        {article.dek && (
          <p className="mt-3 max-w-[54ch] text-[15px] leading-relaxed text-soft">
            {article.dek}
          </p>
        )}
      </header>

      {/* ── PROVENANCE ────────────────────────────────────────────────────── */}
      {/* Who wrote it and when, between the headline and the body the way a
          byline sits — carded, because the boards card their apparatus. */}
      <BoardCard
        radius={12}
        className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 px-[13px] py-2.5"
      >
        <AiTag />
        {timeAgoAt(article.generated_at, now) && (
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-soft">
            {timeAgoAt(article.generated_at, now)}
          </span>
        )}
      </BoardCard>

      {/* ── BODY ──────────────────────────────────────────────────────────── */}
      <div className="mt-7">
        <NewsBlocks blocks={article.sections?.blocks ?? []} />
      </div>

      {/* ── TICKERS IN THIS STORY ─────────────────────────────────────────── */}
      {article.tickers.length > 0 && (
        <section className="mt-10">
          <SectionMark label="Tickers in this story" />
          <div className="mt-2.5 flex flex-col gap-[7px]">
            {article.tickers.map((t) => {
              const q = quotes[t];
              const tone = changeTone(q?.changePercent);
              return (
                <BoardCard
                  key={t}
                  radius={12}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-[11px] py-[9px]"
                >
                  <Link
                    href={`/research/${t}`}
                    className="f0-focus flex min-w-0 items-center gap-2.5 rounded"
                  >
                    <CompanyLogo symbol={t} size={26} rounded="rounded-[8px]" />
                    <span className="font-mono text-[12px] font-semibold text-ink">
                      <span className="text-soft">$</span>
                      {t}
                    </span>
                    {q?.price != null && (
                      <span className="font-mono text-[11px] tabular-nums text-ink">
                        {formatPrice(q.price)}
                      </span>
                    )}
                    {q?.changePercent != null && (
                      <span
                        className={`font-mono text-[10.5px] font-semibold tabular-nums ${
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
                </BoardCard>
              );
            })}
          </div>
        </section>
      )}

      {/* ── COMPLIANCE ────────────────────────────────────────────────────── */}
      {/* Regulated copy — NEWS_DISCLAIMER is rendered verbatim, never reworded. */}
      <BoardCard as="footer" radius={12} className="mt-10 px-[13px] py-3">
        <p className="max-w-[65ch] text-[11px] leading-relaxed text-soft">
          {NEWS_DISCLAIMER}
        </p>
        {!isKid && (
          <p className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.1em] text-soft opacity-70">
            Written by {article.model || "AI"} from public market data.
          </p>
        )}
      </BoardCard>
    </article>
  );
}

function ArticleSkeleton() {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 sm:px-6" aria-busy="true">
      <Bone w={84} h={9} />
      <div className="mt-5 space-y-3">
        <Bone w={110} h={8} />
        <Bone w="80%" h={26} />
        <Bone w="100%" h={12} />
      </div>
      <BoardCard radius={12} className="mt-5 px-[13px] py-2.5">
        <Bone w={180} h={9} />
      </BoardCard>
      <div className="mt-7 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Bone key={i} w="100%" h={11} />
        ))}
      </div>
      <span className="sr-only">Loading the story</span>
    </div>
  );
}
