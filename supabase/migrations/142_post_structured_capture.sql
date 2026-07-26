-- 142 — Kai Intelligence Layer PHASE 1: structured-at-capture on posts.
--
-- KAI-INTELLIGENCE-LAYER §2b — "structured-at-capture FIRST (cheaper + more
-- accurate than inference): never infer what we can ask." R5 already captures
-- ticker_tags + bull/bear stance (migration 132). This adds two OPTIONAL fields
-- to the community compose flow so a member can, in one tap, say WHEN they mean
-- (time horizon) and WHAT KIND of post it is (content type). Both feed the Phase 2
-- classification + the intel score pipeline later; both are null-tolerant so
-- nothing downstream hard-depends on them.
--
-- CHECK constraints keep the vocabulary closed (the classifier + aggregates rely
-- on a known enum). Nullable, no default — an untagged post is simply unclassified.

alter table feed_posts
  add column if not exists time_horizon text
    check (time_horizon is null or time_horizon in ('near', '1yr', '3-5yr')),
  add column if not exists content_type text
    check (content_type is null or content_type in ('thesis', 'question', 'news_reaction'));

comment on column feed_posts.time_horizon is
  'Optional member-declared horizon for a ticker post: near | 1yr | 3-5yr (KAI §2b).';
comment on column feed_posts.content_type is
  'Optional member-declared post kind: thesis | question | news_reaction (KAI §2b).';
