"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getFamilyTier, type FamilyTier } from "@/lib/tier";
import { fetchQuotes, type MarketQuote } from "@/lib/market/client";
import { fetchSocial, type TickerSocial } from "@/lib/research/social";
import { fetchNewsArticle } from "@/lib/news/client";
import { NEWS_DISCLAIMER, timeAgo, type NewsArticle } from "@/lib/news/types";
import NewsBlocks from "@/components/news/NewsBlocks";
import { KindChip, AiTag } from "@/components/news/NewsCard";
import CompanyLogo from "@/components/fic/CompanyLogo";
import LivePrice from "@/components/fic/LivePrice";
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
      setTier(await getFamilyTier(supabase, profile?.family_id));
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
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-gold-400/60" />
        <h1 className="font-display text-xl font-bold text-ink">Story not found</h1>
        <p className="mt-1 text-sm text-soft">This article may have been removed.</p>
        <Link
          href="/news"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-gold-700 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to the newsroom
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 pb-24 sm:px-6">
      <Link
        href="/news"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-soft hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Newsroom
      </Link>

      {/* Header */}
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <KindChip kind={article.kind} />
          <span className="text-[11px] text-soft">{timeAgo(article.generated_at)}</span>
        </div>
        <h1 className="font-display text-2xl font-bold leading-tight text-ink sm:text-3xl">
          {article.title}
        </h1>
        {article.dek && <p className="text-base leading-relaxed text-soft">{article.dek}</p>}
        <AiTag />
      </header>

      {/* Body */}
      <NewsBlocks blocks={article.sections?.blocks ?? []} />

      {/* Tickers in this story — live quotes + social bar */}
      {article.tickers.length > 0 && (
        <section className="rounded-2xl border border-sand bg-paper/60 p-4">
          <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-wider text-soft">
            Tickers in this story
          </h2>
          <div className="space-y-2.5">
            {article.tickers.map((t) => (
              <div
                key={t}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sand bg-card px-3 py-2.5"
              >
                <Link href={`/research/${t}`} className="flex items-center gap-2.5">
                  <CompanyLogo symbol={t} size={28} rounded="rounded-lg" />
                  <span className="font-mono text-sm font-bold text-ink">{t}</span>
                  <LivePrice quote={quotes[t]} size="sm" />
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
            ))}
          </div>
        </section>
      )}

      {/* Compliance footer */}
      <footer className="rounded-2xl border border-sand bg-paper/40 p-4">
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-soft" />
          <p className="text-[11px] leading-relaxed text-soft">{NEWS_DISCLAIMER}</p>
        </div>
        {!isKid && (
          <p className="mt-2 pl-6 text-[10px] text-soft/70">
            Written by {article.model || "AI"} from public market data.
          </p>
        )}
      </footer>
    </div>
  );
}

function ArticleSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 pb-24 sm:px-6">
      <div className="h-4 w-24 animate-pulse rounded bg-sand" />
      <div className="space-y-2">
        <div className="h-4 w-20 animate-pulse rounded-full bg-sand" />
        <div className="h-8 w-4/5 animate-pulse rounded bg-sand" />
        <div className="h-5 w-full animate-pulse rounded bg-sand/70" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-4 w-full animate-pulse rounded bg-sand/60" />
        ))}
      </div>
    </div>
  );
}
