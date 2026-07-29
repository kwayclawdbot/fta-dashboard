# THE CINEMATIC LAYER — merging the mobile-v2 mocks into the converged framework (owner-ratified 2026-07-26)

**Purpose:** adopt the mobile-v2 mock set's art direction as a LAYER on top of the shipped convergence architecture — not a rebuild. The mocks supply energy, character, and imagery; the framework supplies IA, honesty, and grammar. Where they disagree, the framework wins.

**EXPLICIT EXCLUSIONS (owner-directed):** the mocks' 7-item bottom bar / center ＋ FAB / Kai-as-tab are IGNORED — the shipped 5-slot shell + contextual Kai sheet stand. The CC-sparkle logo is IGNORED — infinity mark stays until the separate brand-mark handoff. The mocks' at-scale numbers (24.7K posts, 1.2K watching, 78% hit rate) are DREAM-STATE SPEC ONLY — scale floors, founding states, and the track-record honesty split govern every real render.

---

## 1. THE KAI MASCOT SYSTEM (the biggest adoption)
Kai gets a face: the chrome-blue robot with headphones. This completes the companion promise the Kai Watch UX shipped — "Kai is watching with me" now has a *someone*.

**Character spec:** one canonical character, produced via the Higgsfield character-consistency track (already ratified in FIC-LEARNING-WORLD for Kai-as-guide — SAME character, one identity everywhere). Three intensity registers:
- **Expressive** (kids/Learning World): bigger poses, warmer expressions, celebration reactions.
- **Standard** (Club surfaces): calm, attentive, watchful poses — the "analyst at their desk" energy.
- **Restrained** (data contexts): small static avatar/badge only — never a big illustration inside dense data UI.

**Usage map (where the mascot appears):**
| Surface | Treatment |
|---|---|
| Splash / PWA launch | Hero pose + "Loading the edge…" (see §5) |
| Onboarding carousel | Story poses per step (see §2) |
| Kai sheet trigger + FAB | Small mascot head replaces/augments the abstract icon — the single highest-frequency touchpoint |
| Kai Watch header | Watchful pose beside "Kai is watching N things for you" |
| Kai Daily banner | Presenting pose + picks copy |
| Alert detail "Kai's read" | Small avatar marking Kai's voice |
| Lesson guide (Learning World) | Expressive variant per the ratified guide-character spec |
| Empty/degraded states | "Kai is temporarily unavailable" gets a resting pose — even failure feels like a companion |

**Rules:** the mascot ACCOMPANIES the Kai-blue token, never replaces it (blue still marks Kai's voice per grammar). Never on non-Kai features. Kid register may use it more; data tables use it least. Asset production = Higgsfield pose/expression library (one-time), exported webp set + a few subtle idle-motion loops (Remotion/Lottie, reduced-motion safe). Produce ~12 canonical poses before any surface work.

## 2. ONBOARDING CAROUSEL (pre-Sept-1 priority)
A 4-step cinematic brand-story carousel after signup — currently nothing like it exists; the challenge cohort should land in it.
1. **"Investing Gets Smarter Together"** — collective network visual (mascot + member constellation), "a living network where people, data, and AI help you see more clearly."
2. **"One Club. Three Ways to Connect."** — Feed / Lounge / Live explainer with real-UI-style vignettes (thesis card, lounge chat, live room). Teaches the S2 Club before they see it.
3. **"Let Kai Watch With You"** — mascot + example NL watch ("Watch NVDA for momentum after earnings") + watch-state chips (Watching/Building/Near Trigger). Sells the flagship paid feature on day one.
4. **"Make Your First Move"** — action step: add a first ticker to the watchlist + (adults/teens) invite a friend; kid variant: start the first lesson. Ends IN the product doing something real (RealWorldAction philosophy).
**Integration:** slots into the existing FirstRun orchestrator (per-path variants already exist — challenge/invite/organic get tailored step-4 copy); skippable; runs BEFORE the app tour; register-aware (kid copy + expressive mascot; family variant welcomes the household). Assets: Higgsfield scene art + real UI captures — never fake UI that doesn't exist.

## 3. CINEMATIC IMAGERY SYSTEM (surfaces feel alive)
Image-led moments replace flat data-only cards at the TOP of key surfaces — the vibrancy rule taken to its end state.
- **Ticker hero art:** per-company cinematic product-context imagery (the NVIDIA-chip-lab treatment) behind/beside the ticker identity header. Pipeline: Higgsfield batch-generates the top ~100 tickers by Club attention (product/industry scenes — NEVER people, NEVER fabricated brand assets beyond the existing logo pipeline), stored in blob storage, served cached; tail tickers get a generated-on-demand queue; **fallback is always the current gradient + logo monogram** (zero missing-image states).
- **Discover feature card:** #1 trending ticker gets the full-bleed cinematic card (dark image, price, Club Score chip, watcher avatars); runners-up get compact image cards.
- **Thesis/research cards:** image-led headers (ticker art or author-attached chart) per the mocks' Best Thinking treatment.
- **Live room cards:** host/room imagery per the live_event card (already shipped; upgrade thumbnail treatment to match).
**Performance guardrails (non-negotiable — do not regress the perf wins):** all hero art lazy-loaded below LCP priority except the single above-fold hero; webp/avif ≤ 120KB per hero w/ LQIP blur-up; imagery never blocks data paint; Lighthouse re-checked after the pass.
**Register:** club = volt-warm grading; family = gold-warm; FTA = dark metallic; kid surfaces use brighter illustration-style variants (Learning World worlds art).

## 4. SURFACE PRESENTATION UPGRADES (skin over shipped machinery — this IS convergence S3's scope, expanded)
- **Ticker page (mock → framework):** add the **Club Score strip** under the identity header (Score · Watching · %Bullish · Posts · Sentiment-shift — every stat scale-aware, floors render founding copy); the **Kai Watch inline card** ("Near Trigger — high unusual volume…") rendering the member's OWN watch state from watch_current_state w/ an honest progress metric — **"confidence" is BANNED as invented; the number shown = measured condition-completion progress** (e.g. "89% to trigger" = price distance to level, exactly what the state machine computes); **What's Happening timeline** = snapshot provenance + club_events rendered as the mock's event list (watchers delta, stance changes, earnings countdown, Kai flags) — this is the Ticker Room living timeline (SOCIAL-OBJECTS S3) wearing the mock's clothes; action row keeps the S2 canonical four (Ask Kai · Watch · Practice · Share).
- **Alerts/Kai Watch screens:** adopt the mock's presentation onto Lane B's shipped structure — **stats header** (Alerts this week · Hit rate [GRADED SETUPS ONLY, labeled "on graded setups"] · Avg move after alert [+1d observational, labeled] · Open watches); **%-to-trigger progress bars** on active watches (same honest progress metric); **condition checklists** per watch (render rule params as ✓ met / ○ unmet — the mock's best idea for comprehension); **Won badges on graded setups only**, observational rows keep "+1h/+1d/+5d" (split already shipped — this styles it); watcher-avatar clusters scale-aware; timeline view of recent transitions (kai_update events already exist). Kai Daily banner w/ mascot.
- **Home:** the S2 dramatic hierarchy stands; adopt the mock's energy details where grammar allows — the graffiti-underline hero accent ("THE CLUB IS ON IT." treatment) as an OPTIONAL headline style for the founding/at-scale greeting, cinematic #1-attention card in Live Pulse (same data, image-led), Club Pulse stat strip (= Collective breakdown restyled). No structural change.

## 5. SPLASH / BOOT MOMENT
Branded launch: infinity mark + "We're Smarter Together." + mascot + subtle collective-ring animation + "Loading the edge…" progress. Applies to PWA launch screen + first-load skeleton. Must paint <100ms and never delay content (it IS the loading state, not an addition to it).

## 6. WHAT STANDS UNCHANGED (the framework's non-negotiables)
5-slot shell, one-slot-per-register, Kai = sheet · infinity mark · scale floors + founding states designed first-class · track-record split + no invented confidence · kid walls + kid content rules (business outcomes, expressive-safe imagery) · GRAMMAR.md pass/fail (cinematic cards = ObjectCards with image treatment — containment justified; type scale holds; one dominant accent) · Feed/Lounge/Live as the only social taxonomy · perf budgets (region-pinned, batched, image-lazy).

## 7. BUILD SEQUENCE (slots into the existing queue)
1. **Mascot asset production** (Higgsfield lane — parallel, non-blocking, start anytime): pose library + idle loops + register variants. Blocks nothing; everything else consumes it.
2. **Onboarding carousel** (pre-Sept-1 hard target; ideally pre-Aug-marketing so screenshots feed ads): FirstRun integration + assets.
3. **S3 presentation pass** (= convergence S3, expanded to this spec): ticker page strip/KaiWatch-card/timeline + Alerts/KaiWatch mock presentation + the shipped-polish items (monogram logo fallback, compose header Kai-blue).
4. **Cinematic imagery pipeline** (post-S3, progressive): ticker hero batch + Discover/thesis card upgrades + Home energy details.
5. **Splash/boot** (small, anytime after mascot assets).
All lanes: isolated worktrees, preview-gate for user-facing design rounds, GRAMMAR.md audit, zero-residue verification.
