# FIC / FTA Dashboard — Visual & Interaction Enhancement Plan

**Author:** audit + plan pass, 2026-07-20
**Scope:** member-facing FIC club pages. AUDIT + PLAN only — no app code changed here.
**Repo:** `/Users/kwaysclawd/projects/fta-dashboard` (Next 16, Tailwind v4, framer-motion 12, lucide, lightweight-charts, TradingView embeds)
**Live:** https://fta-dashboard-ruddy.vercel.app

> Owner brief (verbatim intent): *"audit the dashboard content, kids missions, fic pages etc for ux improvements and where images, icons, illustrations, graphics, animations etc would be helpful, right now its all just textboxes which is fine as foundation but we need to make it engaging and interactive. dont just add generic images either."*

---

## 0. Headline finding — where the gap actually is

The app is NOT uniformly "just textboxes." Three tiers already exist:

- **Already excellent (north-star, leave alone):** Flashcards (3D collectible flip cards, `Burst` confetti, `StreakFlame`, live candle visuals, reduced-motion aware), Games hub + Candle Battle / Trend-or-Trap (`CandleRenderer`, `ScorePop`, `TugOfWar`, bespoke story art), the Home hero, Courses, and the Simulator. These carry bespoke warm-paper storybook art (`/public/art/*.jpg`) and real interactive components.
- **Proven production capability on hand:** the shipped adult lessons render **animated inline SVG** (donut arcs, count-up bar charts with spline easing + reduced-motion branches) — see `public/lessons/SI/fic-adult-foundations/w1l2/index.html`. Local SVG+CSS teaching art is a *shipped, proven* method, not a hypothetical.
- **The real gap — the newly-built "FIC Club" pages:** **This Week in FIC / Company of the Week, Family Watchlist, Kid Missions, Start Here, Parent Corner, and the FIC block of My Progress.** These are text + `lucide` icon + a gold progress bar, and nothing else. This is exactly what the owner means by "just textboxes." **This plan concentrates effort here.**

The existing story art (`tug-of-war.jpg` = a multi-generational family literally playing tug-of-war over a giant golden candlestick, green team vs red team, coins flying, warm-paper ground) and the new avatar packs prove the brand's illustration language is already established and strong. **The job is not to invent a look — it's to extend the established look into the club pages, and to convert text blocks into interactive teaching visuals.**

### Brand illustration DNA (locked from existing assets — every new asset must match)
Derived from `public/avatars/{kids,teens,adults}/*.png` and `public/art/*.jpg`:
- **Ground:** warm cream/paper `#FBF7EF`, often with a soft rounded arch/halo behind the subject.
- **Recurring gold motif kit:** sun-circle, botanical gold leaf sprig, 4-point sparkle, halftone dot cluster. These recur across every avatar — treat them as a **reusable decorative vocabulary**, not per-image decoration.
- **Palette:** gold `#F59E0B`/`#FBBF24` primary, teal `~#0D6E6E` secondary, ink `#101828`, warm diverse skin tones.
- **Market semantics (locked):** green-team `#16A34A` (up / favorite), red-team `#DC2626` (down / avoid). Straight from the tug-of-war candle metaphor — reuse everywhere for direction.
- **Line quality:** flat vector, confident clean linework, friendly, warm, diverse, multi-generational.
- **Never:** stock photos, glossy 3D renders, clip-art, cool/blue "fintech" gradients, neon. The app is warm paper, not a trading terminal (the only true-dark island is the pro chart pane via `.night-island`).

### Design-system facts the plan builds on (already in the codebase)
- Tokens: `paper / ink / soft / sand / gold-* / chip-amber / chip-sky / chip-green`, `.paper-card`, `.cta-button`, `.night-island`, `shadow-soft/-lift`; fonts Poppins (display) / Inter (body); `tailwind.config.ts` already ships `float/glow/pulse-gold/shake/width-grow` keyframes (mostly unused).
- Motion house-style already in use: framer-motion fade+slide-up 8–12px, stagger 0.04–0.08s, `layout` animations (watchlist columns), `AnimatePresence` modals, `useReducedMotion` (flashcards).
- Reusable primitives already built: `components/games/Burst.tsx` (confetti), `ScorePop.tsx`, `StreakFlame.tsx`, `useGameSound.ts`, `CandleRenderer.tsx`, `BadgeCase.tsx` (pro-title credential shelf), `Avatar.tsx` + avatar packs, `TradingViewMini` / `TradingViewAdvancedChart`.
- XP + levels (`lib/xp.ts`), pro-title badges (`lib/badges.ts`), watchlist ladder (`lib/watchlist.ts`), weekly record (`lib/fic.ts`) all exist and are data-complete.

### Auth/screenshot note
Live signed-in screenshots were **not** captured: no local Playwright (`node_modules` has none; only a global `~/.nvm/.../playwright`), and populating a member view requires a seeded family + `fic_weeks` row + missions before anything renders non-empty. Per the brief's 20-minute cap this was deprioritized in favor of full source reading. Mitigation: the actual rendered art assets (avatar PNGs, story JPGs) **were** viewed directly, so the visual audit is grounded in real pixels, not just markup.

---

## 1. Per-page audit → proposed enhancements (with PURPOSE lines)

Each proposed visual carries a one-line **PURPOSE**. Anything whose only purpose was "looks nicer" was cut.

### 1.1 Dashboard home + "This Week in FIC" subtab — `dashboard/page.tsx`, `components/dashboard/ThisWeekPanel.tsx`

**Renders today**
- Greeting, XP/level chip, cohort flame. Start-Here nudge card (`Compass` + progress bar) persists until orientation done — good pattern.
- Home tab: bespoke story-art hero ("today's one thing"), FTA execution rail, role strips (parent family list uses **initials in a circle, not the new `Avatar`**), quick links.
- This Week tab (`ThisWeekPanel`): class card → **Company of the Week = 5 stacked `icon + LABEL + text` blocks** (`Building2/TrendingUp/HeartHandshake/Users/ShieldAlert`) → discussion question chip → watchlist-assignment card → family assignment → parent prompt / kid challenge. **Entirely text + lucide.** This is the single most-viewed FIC surface and the flattest.
- Empty (no week): `CalendarDays` icon + "being prepared" text.

**Findings**
- Company of the Week is the marquee weekly teaching moment and it reads like a form. The 5 facets have a natural spatial logic (inputs → engine → output + a risk light + a love gauge) that is being thrown away as a vertical text list.
- Parent family strip uses initials; the new illustrated avatars exist but aren't wired in here.
- `heroArt()` reuses `/art/*.jpg` — good, keep.

**Proposed**
- **`<MoneyMachine>` interactive component (flagship).** Replace the 5 text blocks with ONE reusable, data-driven SVG+framer-motion diagram of the company as a machine that turns inputs into profit:
  - **Left — inputs flow in:** revenue sources / "what they sell" as labeled tokens sliding along connector paths into the machine.
  - **Center — the machine:** company brand tile + `cotw_how_they_make_money` as the engine label; a gentle "turn" pulse on view.
  - **Right — output:** gold coins drop out; `cotw_why_investors_watch` annotates the profit stream.
  - **Warning light:** `cotw_what_could_go_wrong` = a red indicator that blinks once (`#DC2626`).
  - **Love gauge:** `cotw_why_customers_love` = a small filling heart-meter (`HeartHandshake` semantics).
  - Full text stays available (accessible expand/"read more") so nothing is lost; the diagram is the primary read, text is the reference.
  - **PURPOSE:** makes the abstract "how a business converts inputs into profit" concrete and *identical every week*, so kids build one durable mental model instead of re-reading five paragraphs. This is the reusable "teach with visuals" component the brief explicitly asks for, and its machine/coin motif is shared with the Money Machine mission emblem (§1.3) for a coherent language.
  - **Method:** local React + inline SVG + framer-motion (proven by lesson SVGs). Coins = SVG circles w/ the gold gradient. Company logo/sparkline = embed the existing `TradingViewMini` symbol widget (already renders real logos + a live sparkline, no market-data key) OR a deterministic monogram brand-chip colored by sector — no external logo fetch, no CSP issue. **No Higgsfield.** v1 works on today's free-text schema by mapping the 5 fields to machine parts; a later admin tweak to author 2–4 discrete "revenue streams" makes the inputs richer.
- **Wire `Avatar` into the parent family strip** (replace initials). PURPOSE: the family sees *faces*, reinforcing the avatar step they just did in onboarding. Trivial.
- **Designed empty state** for "no week yet" (see §2.5). PURPOSE: first-week families shouldn't hit a blank.

### 1.2 Family Watchlist — `watchlist/page.tsx` (+ `lib/watchlist.ts`)

**Renders today**
- Board = 4 status columns (Watching / Studying / Favorite / Avoid) with a colored **dot + count**. Column empties show `meta.blurb` text.
- Cards: name/ticker, status chip, trend text, champion (uses the page-local `Avatar` w/ initials fallback — good), family-words thesis, **`TradingViewMini` sparkline (real, keep)**, research summary chips, per-status action buttons, notes stream (`AnimatePresence` height animation — good), delete.
- Add modal + Big-Book chips; research modal with a **4-segment progress bar** and a lock line ("Fill the 4 required fields to unlock a verdict").
- The status LADDER (Watch → Study → verdict-locked-until-homework) is the core teaching mechanic — but it's expressed **only lexically** (column names + a chip). The "leveling up research" feeling isn't visual.
- Empty board state already exists and is decent (dashed card, `Search` icon, invitation copy, CTA).

**Findings**
- The ladder is a genuinely good pedagogy (no verdict without homework) rendered with the least visual weight on the page. The unlock — the reward for doing the work — is a `disabled` button turning enabled. Anticlimactic.
- Verdict is reversible ("Rethink"), so the ladder is a real state machine worth visualizing.

**Proposed**
- **`<ResearchLadder>` per card:** a compact 3-rung progression **Watch → Study → Verdict**, current rung lit gold, future rungs dimmed, a `Lock` on the Verdict rung until `researchComplete(item)`. Advancing status animates the "climb" (framer `layout` + rung fill). PURPOSE: makes each card's place in the research journey glanceable and makes advancing feel like progress earned, not a dropdown change.
- **Verdict unlock = a moment, not a state flip.** When the research card completes: the card gets a one-time gold shimmer, the `Lock` on the verdict buttons visibly "breaks"/springs open, small XP pop. PURPOSE: the unlock is the payoff for doing homework — reward it so kids *want* to finish the card.
- **Trend as a branded chip, not plain text.** Map the family's chosen `trend` (`Uptrend/Sideways/Downtrend/New & bouncy`) to a small colored arrow glyph (↗ green / → soft / ↘ red / ↕ amber) using the locked market-semantic colors. PURPOSE: reinforces the qualitative read the family made and makes the board scannable by direction. Bespoke 4-glyph SVG set (`<TrendGlyph>`), reused in COTW + Progress.
- **Column headers get a tiny stage glyph** (binoculars / flask / thumbs) — but keep it restrained; `lucide` `FlaskConical` etc. already carry meaning, so this is optional polish, not Phase 1.
- **Upgrade the empty board** with a bespoke "empty research board" illustration (a corkboard w/ one pin + a dotted "add your first company" card outline) — see §2.5. PURPOSE: the empty watchlist is a new family's first club screen; make it an invitation with brand warmth, not a dashed rectangle.

### 1.3 Kid Missions — `missions/page.tsx`

**Renders today**
- 5 mission cards. Each: a **rotating gradient banner** (`ACCENTS[i % 5]`), "Mission N", XP chip, title, kid-voiced prompt, grown-up helper line, action row (evidence textarea → complete). Brand Detective auto-completes from watchlist adds w/ a progress bar. Completion = a `PartyPopper` icon flash for 2.6s.
- **No per-mission identity.** The gradient is decorative and generic — it's literally the same 5 gradients cycled regardless of mission. Missions are: Brand Detective, Snack Stock, Money Machine, Stock vs Product, Family CEO.
- Empty: "No missions yet" text only.

**Findings**
- Missions are the most kid-facing surface and have the *least* character. The gradient banner is the closest thing to "generic decoration" in the app — it conveys nothing about the mission.
- The completion celebration is a single lucide icon — weak given the `Burst` confetti component already exists and is used in flashcards.

**Proposed (highest engagement-per-effort on the whole audit)**
- **5 bespoke mission EMBLEMS in ONE consistent style** (the brief's explicit ask). Circular "mission patch" medallions, warm-paper + gold + ink, each encoding its mission concept:
  1. **Brand Detective** — magnifying glass over shopping-bag/logo tags.
  2. **Snack Stock** — a snack (chips bag) wearing a price tag / tiny candlestick.
  3. **Money Machine** — a little factory/machine with a coin output (**deliberately echoes the COTW `<MoneyMachine>` motif** — shared language).
  4. **Stock vs Product** — split emblem: product box vs a stock/ticker certificate, on a balance/"vs".
  5. **Family CEO** — a desk name-plate / "CEO" title card (**ties to the CEO credential badge** in `BadgeCase`).
  - The emblem becomes each card's hero medallion (replaces the meaningless gradient banner). Complete state = emblem gains a gold ring + subtle sheen ("collected").
  - **PURPOSE:** each mission gets a memorable, collectible identity kids recognize and want to complete the set of; the emblem teaches the mission's concept at a glance and threads into the COTW + credential motifs.
  - **Method:** **Higgsfield** (this is the single best use of the credit budget — few assets, high visibility, "collectible sticker" appeal genuinely benefits from richer illustration than flat SVG, and it visually matches the Higgsfield-made avatar packs). Consistency across 5 gens is the risk — mitigate by generating emblem #1, then using it as a **style/reference image** for #2–5 (Nano Banana reference-based gen) so the set is coherent. Local SVG is the fallback if the owner prefers zero spend / maximum tweakability.
- **Upgrade completion → shared `<Celebrate>`:** reuse `Burst` confetti + the earned emblem stamping in with a spring + "+XP" pop (kid register: + sound via `useGameSound`). PURPOSE: match the reward weight to the "I finished a real-world mission" achievement.
- **Designed empty state** (rolled mission scroll/map "waiting"), §2.5.

### 1.4 Start Here / Orientation — `start-here/page.tsx` (+ `lib/fic.ts`)

**Renders today**
- Header, a top gold **progress bar**, an embedded orientation deck iframe, then 6 linear checklist cards (`Circle`/`CheckCircle2` + title + blurb + CTA), an accounts guide accordion, an education-first footer. Some steps auto-complete from other tables (guarded).

**Findings**
- It's a compliant checklist, but orientation is the make-or-break first-run funnel and it looks like a to-do list. No sense of journey or destination. Completing the 6th step (which flips the persistent home nudge) gets a one-line green text confirmation — no payoff.

**Proposed**
- **`<SetupTrail>` journey header:** a 6-stop path/trail (SVG) replacing the flat progress bar. Each stop is a node that fills gold as its step completes; the connecting path **draws in** (stroke-dashoffset animation, exactly the lesson-SVG technique) as progress advances; the final node is a "home/flag" that celebrates at 6/6. Each node carries a tiny step glyph (play / wave / bank / list / calendar / compass). Keep the existing action cards below — the trail is the motivating hero, the cards are where you act. PURPOSE: turns a compliance checklist into a visible journey with a destination, which is what drives first-run completion.
- **Completion celebration:** at 6/6 → confetti + "Your family is all set" moment; the persistent Start-Here home card transitions to a done state. PURPOSE: reward finishing setup — the highest-value action a new family takes.
- **Method:** local SVG + framer-motion. **No Higgsfield.**

### 1.5 Parent Corner — `parent-corner/page.tsx`

**Renders today**
- Role-gated. Weekly `icon + LABEL + text` sections (rides the `fic_weeks` record) + a prompt callout + 5 evergreen 2-col cards + a community CTA. Text-dense, lucide icons. Register = adults.

**Findings**
- Appropriately substance-first; parents want words, not animation. **Largely fine as-is** — over-decorating here would be wrong.
- One real gap: the parent has no *glanceable* picture of where their own kids are this week before the reading.

**Proposed (light touch — restraint is the point)**
- **"Your family this week at a glance" strip:** a small data strip (not decoration) showing each child's avatar + this week's mission/research/XP status + a mini of the COTW `<MoneyMachine>`. PURPOSE: gives the guiding parent a 3-second read of family state before the coaching copy. Reuses `Avatar`, `MoneyMachine`, existing XP/mission queries.
- Evergreen cards: **keep as text.** Note explicitly: fine as-is.
- **Method:** component reuse only. No new art, no Higgsfield.

### 1.6 My Progress (FIC block) — `progress/page.tsx`

**Renders today**
- Level bar (animated), 3 headline stats, **FIC 4-stat grid** (missions / classes / championed / research — good data, flat), course bars, recent activity, and a **legacy lucide badge grid** (`first_lesson/module_master/...`).

**Findings**
- **Inconsistency/bug-ish:** the page still renders the *old* badge grid and has **not** adopted `<BadgeCase>`, the owner-locked professional-title credential shelf (Scout/Analyst/Risk Manager/Investor/Technician/CEO). Two competing badge systems on the achievements page.
- The FIC stat grid is meaningful but visually inert; the streak stat is a number where `StreakFlame` already exists.

**Proposed**
- **Adopt `<BadgeCase evaluateSelf>`** in place of (or above) the legacy badge grid. PURPOSE: unify on the credential system that's already the owner-locked direction; the credential shelf reads as an earned-rank trophy case (its own design intent).
- **Credential-earned celebration = a "wax seal" reveal** (embossed seal springs in), NOT confetti. PURPOSE: for teens/parents a credential should feel awarded/professional, not childish — register-correct reward (see §2.4).
- Reuse **`StreakFlame`** on the streak stat. PURPOSE: reuse a built primitive to make the headline stat feel alive; zero new art.
- **Method:** wiring existing components + one small SVG seal. No Higgsfield.

### 1.7 Fine as-is (call-outs — do NOT touch)
- **Practice Chart** (`chart/page.tsx`): TradingView Advanced widget, role-based line/candle default, quick symbols. Solid. (Optional far-future: a kid "what am I looking at?" annotation overlay — deferred, not in this plan.)
- **Live Sessions** (`live-sessions/page.tsx`): class-type grouping, RSVP counts, in-app recording player. Solid. Minor optional polish only: host avatar is the initial "C" — a single illustrated coach portrait would warm it (nice-to-have, Phase 3). Class-type group headers could take tiny type glyphs (low priority).
- **Courses / Games / Flashcards / Simulator:** already carry bespoke art + real interactivity. **Leave alone** — these are the quality bar the club pages should reach.

### 1.8 In-flux pages (another agent owns these — code-level notes only, do not build against)
- **Community** (`community/page.tsx`, 1176 lines): rooms (FIC Club / FTA Traders), `@mention`, categories, `Avatar` already wired, `evaluateBadges` fired on load, attachments/reel embeds. Visually the richest of the new pages. **One relevant note for whoever finishes it:** the community empty/first-post state and the "intro post" (which is Start-Here step 2) should share the designed empty-state system (§2.5) so the orientation funnel feels continuous. Don't design community visuals in detail while it's moving.
- **Onboarding** (`(auth)/onboarding/page.tsx`, 476 lines): already includes the avatar + display-name step via `AvatarPicker`, slide transitions, parent/child branches. In good shape. **Note:** the avatar packs currently resolve to **SVG** (`lib/avatars.ts` `AVATAR_EXT="svg"`) even though richer **PNG** illustrated packs already sit in the same folders — flipping `AVATAR_EXT` to `"png"` upgrades every avatar app-wide in one line once the owner confirms the PNGs are final. Flag, don't flip (another agent's lane).

---

## 2. Shared visual systems (systems over one-offs)

### 2.1 Illustration style guide (codify the brand DNA from §0)
Produce a short `STYLE.md` / Figma-less spec so every asset — local SVG or Higgsfield — is one family:
- Ground `#FBF7EF`; optional soft arch/halo behind subjects.
- **Decorative motif kit** (reusable SVG components): `<SunCircle>`, `<LeafSprig>`, `<Sparkle>`, `<DotCluster>` in gold. These are the connective tissue that make disparate assets read as one system — drop them behind emblems, empty states, celebration cards, the setup trail.
- Palette + market semantics as locked in §0 (green-team/red-team for all direction).
- Flat vector, warm, diverse, multi-generational, clean linework.
- **Two production tiers, one DNA:** (1) local SVG for diagrams/emblems/empties/motifs; (2) Higgsfield illustrated PNG for hero/collectible pieces (avatars, mission emblems). Same palette + motif kit across both.

### 2.2 Icon language beyond lucide (only where it teaches or brands)
- **Keep lucide** for nav + utility (consistency is a feature).
- **Bespoke SVG glyphs only where they carry information:** the 5 mission emblems, the `<MoneyMachine>` parts, the `<ResearchLadder>` rungs, the `<TrendGlyph>` arrow set (↗→↘↕), the `<CredentialSeal>`, `<SetupTrail>` nodes, and empty-state art. Ship them as a small typed `components/fic/glyphs/` set so they're reused, never one-off.

### 2.3 Micro-animation vocabulary (framer-motion) + restraint spec
**What animates, when:**
- **Entrance:** fade + slide-up 8–12px, stagger 0.04–0.08s (existing house style — keep).
- **Progress / reveal:** bar width + SVG path-draw on mount, easeOut ~0.8s; a single count-up on first number reveal (lesson-SVG precedent).
- **State change:** framer `layout` for cards moving between watchlist columns / ladder rungs.
- **Reward:** spring pop (stiffness 200–260) for XP + emblem/seal stamps; `Burst` confetti for kid-register completions; wax-seal emboss for credentials.
- **"Live" only:** the single red pulse dot on a live class (already present).

**Restraint spec — what NEVER animates:**
- Body text and prices/numbers (except the one first-reveal count-up).
- Anything on every re-render, anything idle/looping (no `float`/`glow` ambient loops on content — those keyframes exist in config but keep them off content), no parallax, no chart bounce.
- Modals get one entrance, no idle motion.
- **`prefers-reduced-motion` is honored universally** (flashcards already do this via `useReducedMotion` — make it the default in every new component: reduced → instant/opacity-only).
- **Sound:** opt-in, kid-register only (`useGameSound`), never for parents/teens by default.

### 2.4 Celebration moments (register-correct — reward without childishing teens/parents)
Standardize a single `useCelebrate()` + `<Celebrate variant>` on top of the existing `Burst`/`ScorePop`/`StreakFlame` primitives:

| Trigger | Kid | Teen | Parent |
|---|---|---|---|
| Start-Here 6/6 complete | confetti + sound + banner | confetti (muted) + banner | quiet "all set" banner |
| Mission complete | confetti + emblem stamp + XP pop + sound | emblem stamp + XP pop | (n/a — kids' surface) |
| Research card complete → verdict unlock | card shimmer + lock-break + XP | card shimmer + lock-break + XP | shimmer, no sound |
| Credential earned (`BadgeCase`) | seal emboss + small confetti | **wax-seal emboss** (no confetti) | **wax-seal emboss**, minimal |
| **Level up (XP threshold)** — *currently uncelebrated anywhere* | level-up burst + sound | level-up ribbon | quiet toast |

PURPOSE per row: reward the *specific* effort at a weight that fits the audience; credentials use an embossed seal (professional) rather than confetti (childish) so the pro-title system lands right for teens/parents. **Level-up is currently celebrated nowhere** — the ladder in `lib/xp.ts` exists but crossing it is silent; add it.

### 2.5 Designed empty states (an empty screen is an invitation, not a blank)
One `<EmptyState art=… title copy cta>` component, bespoke small warm-paper SVG per case (motif kit from §2.1):
- **Empty watchlist** → corkboard + one pin + dotted "add your first company" card. (Upgrade the existing decent-but-plain state.)
- **Empty missions** → a rolled mission scroll/map "waiting to be opened."
- **Empty notifications** → a calm bell/mailbox at rest, "You're all caught up" (positive framing, not void).
- **No week yet (This Week / Parent Corner)** → a "this week is being prepared" card with the sun-circle motif, not a bare `CalendarDays`.
- **Empty progress / recordings** → a friendly "your first lesson starts the story" prompt.
PURPOSE: these are first-run screens; they must invite the first action and carry brand warmth. All local SVG — no Higgsfield needed (simple line-art), though the watchlist hero could optionally be Higgsfield if the owner wants extra richness.

### 2.6 Register differences (kid / teen / parent) — codify what's ad-hoc today
Already partly coded (`isKid/isTeen/isParent`, simpler kid copy, kids' line-chart default, bigger kid type). Make it a documented contract:
- **Kids:** larger type, confetti + sound, playful copy ("Nailed it!"), collectible/mascot framing, line charts, mission emblems front-and-center.
- **Teens:** candles, restrained confetti, rank/level framing, credential titles appeal, no baby-talk, no default sound.
- **Parents:** substance-first, minimal motion, "family at a glance" data viz, wax-seal credential reveals, no sound, reading-optimized layouts.

---

## 3. Asset production list — method + estimated cost

All proposed **imagery is static illustration (no video)** — i.e. the *cheap* Higgsfield tier. Higgsfield's own tooling gives an exact number via `higgsfield generate cost <job>` before submit; the skill advises not to pre-guess, so the figures below are **planning estimates to confirm at run time**, not quotes. Budget on hand: **~880 credits**. Image gens (GPT Image 2 / Nano Banana — "budget-friendly") are single- to low-double-digit credits each; the entire imagery ask below is comfortably inside the budget with large headroom.

| # | Asset | Method | Higgsfield? | Est. credits |
|---|---|---|---|---|
| A | **5 mission emblems** (Brand Detective, Snack Stock, Money Machine, Stock vs Product, Family CEO) | Higgsfield Nano Banana / GPT Image 2; gen #1 then reference-lock #2–5 for consistency | **Yes** | ~30–75 total (≈6–15 ea; confirm via `higgsfield generate cost`; budget a couple of reroll passes) |
| B | `<MoneyMachine>` interactive (COTW) | Local React + inline SVG + framer-motion (lesson-SVG precedent); logo via existing `TradingViewMini` or monogram chip | No | 0 |
| C | `<ResearchLadder>` + verdict-unlock + `<TrendGlyph>` set | Local SVG + framer-motion | No | 0 |
| D | `<SetupTrail>` orientation journey | Local SVG (path-draw) + framer-motion | No | 0 |
| E | `<Celebrate>` / `useCelebrate` + level-up + `<CredentialSeal>` | framer-motion + reuse `Burst`/`ScorePop`/`StreakFlame`; seal = small SVG | No | 0 |
| F | `<EmptyState>` art set (watchlist, missions, notifications, no-week, progress) | Local SVG (motif kit) | No (optional: 1 Higgsfield watchlist hero) | 0 (opt ~6–15) |
| G | Decorative motif kit (`SunCircle/LeafSprig/Sparkle/DotCluster`) | Local SVG | No | 0 |
| H | `<BadgeCase>` adoption on Progress; `Avatar` into dashboard family strip | Wiring only | No | 0 |
| I | *(Optional, Phase 3)* Coach portrait for Live Sessions host | Higgsfield, matches avatar packs | Optional | ~6–15 |
| J | *(One-line, owner-gated)* flip `AVATAR_EXT` svg→png to activate richer avatar packs | Config flip | No | 0 |

**Estimated Higgsfield spend: ~30–75 credits** for the committed work (item A), i.e. **under ~10% of the ~880 balance**, with optional items F/I adding at most ~30 more. **Confirm exact cost with `higgsfield generate cost` before each batch** and log the spend per the account's logging norm. Everything else is local SVG / framer-motion / component reuse at zero credit cost — which is also the more maintainable, tweakable, brand-consistent path for anything data-driven (the brief's principle #2: teaching visuals must be components, not pictures).

---

## 4. Phased plan (ranked by engagement-impact ÷ effort)

### Phase 1 — highest impact, mostly zero-credit (the "stop being textboxes" phase)
1. **Mission emblems (5) + upgraded completion celebration.** *Why:* most kid-facing surface, currently the most generic (meaningless rotating gradient); emblems give collectible identity and are the brief's explicit ask; completion reuses `Burst`. Only credit spend in Phase 1 (~30–75).
2. **`<MoneyMachine>` interactive for Company of the Week.** *Why:* the marquee weekly teaching moment, currently a 5-block text form; the reusable teach-with-visuals component the brief specifically calls for; zero credits; motif shared with the Money Machine emblem.
3. **Watchlist `<ResearchLadder>` + verdict-unlock moment + `<TrendGlyph>`.** *Why:* makes the app's best pedagogy (no verdict without homework) *feel* like leveling up; converts an anticlimactic `disabled`→enabled into an earned reward; zero credits.
4. **Start Here `<SetupTrail>` + 6/6 celebration.** *Why:* orientation is the first-run make-or-break funnel; a visible journey with a destination drives completion; zero credits.
5. **Foundations that Phase 1 needs anyway:** the decorative **motif kit** (§2.1/G), the **`<Celebrate>`/`useCelebrate`** system incl. the missing **level-up** moment (§2.4/E), and **universal `prefers-reduced-motion`** (§2.3). These are shared infrastructure the four features above all consume.

### Phase 2 — completion + consistency
6. **Designed empty states** across watchlist / missions / notifications / no-week / progress (§2.5).
7. **Progress page: adopt `<BadgeCase>`** (retire the legacy badge grid), add `<CredentialSeal>` reveal, reuse `StreakFlame` on the streak stat (§1.6).
8. **Dashboard family strip → `Avatar`** and **Parent Corner "family at a glance"** strip (§1.1, §1.5).
9. **Register contract** documented + applied consistently (§2.6).

### Phase 3 — polish / nice-to-have
10. Live Sessions coach portrait (Higgsfield, optional) + class-type group glyphs.
11. Watchlist column stage glyphs; optional Higgsfield watchlist empty-state hero.
12. Owner-gated: flip `AVATAR_EXT` to PNG once packs are final (one line).

### Explicitly fine as-is (no work)
Chart, Courses, Games, Flashcards, Simulator, and the overall token/`.paper-card` system. Community + Onboarding: another agent's lane — hand off the empty-state + avatar-PNG notes only.

---

## 5. Open questions for the owner
1. **Mission emblems — Higgsfield or local SVG?** Higgsfield gives collectible richness that matches the avatar packs (~30–75 credits, recommended); local SVG is zero-cost, infinitely tweakable, guaranteed-consistent, but flatter. Default recommendation: **Higgsfield**.
2. **Company logos in Company of the Week / watchlist:** OK to show **real brand logos** (via the TradingView symbol widget, which already renders them) for recognition value, or prefer neutral **monogram brand-chips** to sidestep any trademark question? (Educational "company of the week" use is typically fine, but it's your call.)
3. **Avatar packs:** are the illustrated **PNG** packs final? If yes, flip `AVATAR_EXT` svg→png (one line) to activate them everywhere — should this ship inside Phase 1?
4. **Money Machine data:** OK to add a small **admin field** to author 2–4 discrete "revenue streams" per week (richer inputs), or keep v1 mapping the existing 5 free-text COTW fields to machine parts?
5. **Sound:** confirm kid-only, opt-in, off for teens/parents by default (matches current `useGameSound` posture).
6. **Level-up celebration:** confirmed as a wanted addition (currently the XP ladder in `lib/xp.ts` is crossed silently)?
