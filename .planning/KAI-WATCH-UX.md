# KAI WATCH UX — alerts as live AI market companion (owner-ratified 2026-07-26)

**Problem:** backend ~9/10 (broadcast + personalized rules + NL parse + instant/digest + caps + quiet hours + track record + strategy profiles — all deployed), emotional UX ~7/10. Current hub (Feed/Track record/My Rules/Strategy) reads as an alert-management dashboard. Old CCAI's power was the feeling "Kai is watching the market for me." This redesign preserves the new intelligence while restoring the companion.
**Mental model:** Tell Kai what you care about. He watches it. Primary screen answers "What is Kai watching for me right now?" — never "what rules have I created?"
**Positioning/migration story:** "Kai is moving into the Club — and getting a lot smarter." NEVER "CCAI is being merged."
**Supersedes** the D2-Alerts spec in APP-DESIGN-UX-AUDIT.md. This is a PAID flagship surface — coordinate with MONETIZATION-GATES.md (Kai Watch paid; Kai Daily included in Club; contextual paywall copy already canonical there).

## THE THREE ALERT TYPES (maps 1:1 onto live plumbing — reframe, not rebuild)
1. **Kai Daily** — curated broad opportunities (= Railway briefing bridge + morning scanner, ~3/day when justified). The old-CCAI habit, preserved. Included with Club.
2. **My Kai Watch** — personalized monitoring (= NL-parsed alert_rules + strategy plays). "Watch COST earnings" / "tell me if NVDA goes under 150" / "let me know if people turn bearish on TSLA." The upgrade over old CCAI.
3. **Kai Updates (NEW layer)** — progress/state communication, not triggers: still watching · getting closer · conditions improving · setup cooled/invalidated · checked-nothing-matters. THE trust feature: silence becomes intentional, Kai feels intelligent rather than binary.

## KAI UPDATES — deterministic state machine (credits-proof)
- Watch states: watching → building → near-trigger → triggered | cooled | invalidated (+ scheduled-event states e.g. earnings-wait). Crons already evaluate every cycle — emit STATE TRANSITIONS we currently discard.
- Rendering: templated copy first (zero-LLM, per intelligence-layer principle); Kai LLM polish optional when credits live.
- **Cadence discipline (binding):** state-change-only updates, max ~2/day per watch, quiet hours respected (existing plumbing), digest-mode collapses. "Still watching" spam breaks trust same as silence.
- **Honesty rule:** show REAL last-checked time from cron cadence; never fake immediacy ("2 min ago" only if true). War-room header ("● KAI IS LIVE · 8 watches active" + status board) requires scheduling the staged intraday evaluator during market hours so it's literally true — do that as part of this lane (Railway service exists, unscheduled).

## MAIN SCREEN — "Kai Watch"
Header: "Kai is watching N things for you · Market open · Monitoring live" (war-room energy per vibrancy register). Active watches as living status cards: ticker, what Kai is watching FOR (plain language), monitored dimensions, current state line ("Everything looks normal" / "⚡ Something changed → See what Kai found" / "Waiting for earnings — Kai will notify if…"), honest last-checked. Sections: Kai Daily · My Kai Watch · Live Watches (currently developing) · History (searchable by ticker) · Track Record.

## LANGUAGE (binding — kill engineering vocabulary)
- "My Rules" → **"What Kai Is Watching"**; button = **"+ Tell Kai what to watch"**; NL is the PRIMARY entry (existing haiku parse). Confirm-back pattern: user types intent → Kai replies "Got it. I'll watch: ✓ major NVDA news ✓ bearish sentiment shift ✓ unusual downside move → Start Watching" (creates rules under the hood; user never sees "rules").
- Presets = intentions: Price Level · Momentum Shift · Unusual Activity · Club Sentiment ("tell me if the Club changes its mind") · Big News. Advanced tucks RSI/EMA/52-week behind.

## NOTIFICATIONS + DETAIL
- Push copy = story not machinery: "🔥 NVDA is heating up — volume 2.6× normal, Club sentiment just turned bullish. Kai is watching $150." Never "rule triggered."
- Tap → purpose-built detail: **Why Kai alerted you** (the changed conditions w/ numbers — sourced from snapshot provenance /api/club/intel) → **Kai's read** (LLM-optional synthesis) → chart → **The Club** (theses/watchers/top debate for the ticker) → actions: Keep watching · Mute today · Edit Kai Watch.

## "WATCH THIS SETUP" (new feature, ratified)
Every Kai Daily broadcast gets [Watch this setup] + [Research TICKER]. Opt-in subscribes to that setup's LIFECYCLE: still waiting → volume confirmed → breakout triggered → setup invalidated. Recreates old follow-through; only opt-ins get the thread. A setup = an object with a lifecycle + archived outcome (Social Objects pattern) feeding track record automatically.

## TRACK RECORD (honest split, in-app only per standing rule)
- **Graded setups** (defined levels — Kai Daily/broadcast + triggered strategy plays): keep peak-is-the-win grading, W/L legitimate.
- **Observational alerts** (sentiment shift, activity, news): NEVER W/L — show "What happened after: +1h · +1d · +5d."
- Header: "Kai Track Record · Last 30 days · Signals issued: N."

## C5 MIGRATION FLOW (Twilio-gated; owner go decision required — this section is the C5 product spec)
- First login for CCAI members: "Kai got an upgrade. You still get the market alerts you're used to. Now Kai can also monitor the stocks, setups and conditions that matter specifically to you."
- 3 steps: (1) Keep Kai Daily ✓ enabled · (2) Import your stocks (tickers → watchlist + suggested watches) · (3) Tell Kai what matters (NL examples) → "Kai is watching."
- **SMS preserved at migration (non-negotiable for habit):** channel choice = ✓ Push ✓ SMS □ Daily digest email; encourage push over time, never force-switch day one. HARD GATE: dead Twilio token (owner blocker #2) blocks migration launch; in-app UX does NOT wait for it.
- Pitch = "You still get Kai's best alerts. Now Kai can also watch YOUR stocks." Never "set everything yourself now."

## BUILD SLOTS
- **Lane A (backend, can run early — credits-proof):** watch-state machine + state-transition events + cadence caps + intraday evaluator scheduling + setup-lifecycle objects.
- **Lane B (UX, after monetization gates):** Kai Watch screen rebuild + language sweep + notification templates + detail screen + Watch-this-setup UI + track-record split. Gates land on this surface (Kai Watch paid; countdown ribbon during challenge pass).
- **Lane C (C5 migration):** built behind flag; launches on Twilio restore + owner go.
Register: Club adult = advice-tolerant (per SOCIAL-OBJECTS register policy); kid/family walls unchanged.
