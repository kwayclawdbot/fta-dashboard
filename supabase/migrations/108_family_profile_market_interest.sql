-- 108 — family_profiles.market_interest (Lane 8A)
--
-- WHY: the onboarding questionnaire (migration 075) already captures household
-- size + kid age bands, investing experience, goals, and how they found us. The
-- one thing it never asked is WHICH SIDE of the market a family cares about —
-- long-term investing, active trading, both, or "not sure yet". That answer
-- shapes both the dashboard "recommended next" card and — new in Lane 8B — the
-- depth and examples Kai uses when talking to the family.
--
-- Household size/ages are ALREADY captured (household jsonb: adults, kids,
-- kid_age_ranges), so no new column is needed there. This migration adds only
-- the single genuinely-missing field. It is additive and nullable so every
-- existing family_profiles row stays valid and partial onboarding never breaks.
--
-- RLS: unchanged. The own-row + admin policies from 075 already cover the table;
-- adding a column needs no new policy.

alter table family_profiles
  add column if not exists market_interest text
    check (market_interest in ('investing', 'trading', 'both', 'unsure'));

comment on column family_profiles.market_interest is
  'Trading-vs-investing interest (Lane 8A): investing | trading | both | unsure. '
  'Feeds deriveRecommendations + Kai system-prompt personalization (Lane 8B).';
