# SEO Architecture — cheatcode.com UGC/content strategy

Owner-ratified 2026-07-25. Goal: the apex domain cheatcode.com accumulates ALL search authority from app-generated content; the app subdomain gets none of the public-content burden.

## Domain split (FINAL)
- **cheatcode.com** (apex, Vercel project cheatcode-club): marketing pages + PUBLIC read-only content surfaces served via rewrites/proxy to the app's public SSR routes:
  - `/stocks/<ticker>` — programmatic research pages (11,455 tickers: A–F grades, gauge, community sentiment). BIGGEST volume play.
  - `/news/<slug>` — newsroom articles (already self-generating daily).
  - `/community/<space>/<thread>` — public discussion threads (see gating below).
- **app.cheatcode.com** — the logged-in product ONLY. noindex, nofollow on app shell; robots disallow authed routes; separate cookie scope.
- Implementation: vercel.json rewrites in the marketing project map the apex paths to the app's public SSR endpoints. Canonicals ALWAYS point to the apex URL. Segmented sitemaps (stocks / news / community) submitted from the apex. `DiscussionForumPosting` + `QAPage` schema on threads; `Article` on news; structured data w/ education-not-advice disclosure blocks.

## Owner requirements (2026-07-25, binding)
1. **SECURITY/PRIVACY — no backend exposure on public pages.** Public SSR pages must be data-minimal: server-render only the public fields (no service keys, no over-fetched JSON blobs in __NEXT_DATA__/RSC payloads containing emails, user ids, private flags; no admin/API tokens; no internal URLs). Public endpoints get their own read-only query paths (dedicated RPCs/views selecting ONLY public columns), never reuse authed fetchers. Pen-check pass required before Phase 2 ships: view-source + payload inspection + API probing on every public route class.
2. **SCROLL-GATE on public chatrooms:** threads publicly readable, but at ~50% page scroll a free-account prompt overlays/interrupts (Quora-style soft gate; content still crawlable by bots — serve full content in HTML, gate is client-side overlay so Google sees everything, humans convert). Interaction (post/reply/react) always requires account.
3. **KIDS' CONTENT NEVER PUBLIC:** kids' posts exist ONLY in family rooms; family rooms + Family Mode surfaces + VIP room are hard-private (server-side exclusion from public queries, not client filtering). Public exposure is per-space opt-in; default private. General club discussion spaces = the public candidates.

## Quality/compliance guardrails (YMYL)
- Finance = highest Google scrutiny: education-not-advice framing on every public page; moderation gate BEFORE a thread is indexable (quality threshold: min length/substance, no bare hype); thin threads noindexed; author display names only (no emails/real-name leakage).
- No income/returns/win-rate language on any public-facing template chrome.

## Phasing (post-Monday-launch)
- **Phase 0 (with DNS cutover):** apex → marketing project; app stays subdomain; canonicals swap; Stripe cancel_url TODOs; robots/noindex on app shell.
- **Phase 1:** public /stocks + /news under apex w/ meta, schema, sitemaps. Controlled quality, fastest win.
- **Phase 2:** public community threads: per-space public flag, moderation-before-index, scroll-gate, security pen-check pass.
- KPI: indexed pages, impressions by section (Search Console), signup conversions attributed to scroll-gate + thread CTAs (src=seo-thread etc.).
