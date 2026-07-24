-- ============================================================================
-- 131 — LANE R4: KAI WATCH — the natural-language layer over the C6 alert
--       engine. Two new alert_rules KINDS so Kai can honour a wider set of
--       plain-language asks without ever over-promising (owner decision 7:
--       Kai promises SIGNALS + interpretation, never thesis-omniscience):
--
--   sentiment_velocity — the club's net community sentiment for a ticker
--       (ticker_like_counts.net) swings by a threshold over a rolling window.
--       This is the honest, computable proxy for "tell me if the vibe turns
--       bullish/bearish" — it watches the CLUB's stance moving, never claims to
--       read the market's mind. Baseline net is stored in state.base_net and
--       compared nightly; cheap (one indexed read of an already-computed count).
--
--   news_event — a fresh ticker-tagged newsroom event (news_articles, kind
--       'ticker_event') lands for the ticker, optionally paired with a notable
--       daily move. This is the honest proxy Kai offers for "thesis-changing
--       news": a heads-up that SOMETHING material published + the stock moved,
--       framed as "worth a look", never "your thesis broke".
--
-- Both fire through the SAME education-first delivery path (fire_rule_event →
-- instant push vs held-for-digest, cap-aware) as every other rule. The 20-active
-- cap trigger and own-row RLS from 125 already cover these kinds unchanged — the
-- only schema change is widening the kind CHECK constraint.
-- ============================================================================

alter table alert_rules drop constraint if exists alert_rules_kind_check;
alter table alert_rules add constraint alert_rules_kind_check
  check (kind in (
    'price_cross', 'pct_move', 'vol_surge',
    'rsi_cross', 'ema_cross', 'w52_break', 'preset_match',
    'sentiment_velocity', 'news_event'
  ));

-- sentiment_velocity reads ticker_like_counts by ticker; the primary key already
-- indexes that. news_event reads news_articles by ticker/kind/time — the 117
-- indexes cover it. No new indexes required.
