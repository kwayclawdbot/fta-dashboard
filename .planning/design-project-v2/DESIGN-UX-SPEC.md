# CHEAT CODE APP — DESIGN & UX/UI SPEC v1
**2026-07-28 · The design language of the conversion. Companion to CONVERSION-PLAN.md.**
Source of truth: the `Cheat Code App` canvas (23 boards) + `App Light` twin + `Family` register + board 22's identity rules. Everything below is extracted from the mockups, not invented.

---

## 1. Design philosophy — "reading the room"

The app is a **social trading floor**, not a terminal and not a feed. Every screen answers one question: *what does the Club think, and how sure is it?* That drives four laws:

1. **The number is the hero.** Every screen leads with one big honest number (conviction %, value, streak, score) set in mono or condensed display — never buried in a paragraph.
2. **Orange is signal, not decoration.** #FF7A1A appears ONLY for: brand marks, live states (LIVE NOW, live dots, active tab), and the single primary CTA per screen. If orange appears twice for two different reasons on one screen, one of them is wrong.
3. **Market truth is green/pink, never red.** Up = #4ADE80, down = #F472B6. Pink-not-red keeps losses honest without alarm-register. Red exists nowhere in the system.
4. **Status is worn, not claimed.** Belts color your avatar ring everywhere — chart pins, chat, leaderboards. Identity renders automatically from the reputation system; users never self-decorate.

## 2. Color system

### Dark theme (primary canvas)
| Token | Value | Use |
|---|---|---|
| `--cc-bg` | #141216 | Canvas — warm black, never pure #000 |
| `--cc-card` | #1C1920 | Raised card |
| `--cc-card2` | #232028 | Nested surface / chips |
| `--cc-line` | #2B2731 | Hairlines only — borders never brighter than text |
| `--cc-ink` | #F4F0EC | Warm off-white text |
| `--cc-soft` | #8D8794 | Secondary text |
| `--cc-dim` | #5D5865 | Tertiary / inactive |
| `--cc-orange` | #FF7A1A | Signal (law #2) · ink-on-orange = #0D0B0E |
| `--cc-up` / `--cc-down` | #4ADE80 / #F472B6 | Market truth (law #3) |
| `--cc-blue` | #38BDF8 | Kai surfaces + blue belt |
| `--cc-purple` / `--cc-yellow` | #A78BFA / #FACC15 | Purple belt / yellow belt + HEADS-UP alerts |

**Glow law:** halos at 40% opacity (`0 0 16px rgba(255,122,26,.3)`) on exactly two things — key conviction rings and the primary CTA. Nothing else glows.

### Light theme (App Light twin)
Same architecture, swapped ground: warm paper canvas, ink text, identical orange/green/pink (they test AA on both grounds), halos softened ~50%. Light is not a separate design — it is the same screens re-grounded; every component reads both themes from tokens with zero layout change.

### Mode registers (data-mode axis, unchanged)
- **club** — the primary canvas exactly as drawn (dark or light).
- **family** — the Family canvas register: warmer ground, rounded-friendlier radii, gold in place of volt-adjacent accents, celebratory XP moments; derived from adult style per the standing adult-first rule, never childish.
- **fta** — same layout system, metallic-gold accent lane replaces orange; true-dark chat retained. Gold and orange never appear together.
- Belt hexes are **intrinsic** — identical across all themes and modes (they are identity, not decoration).

## 3. Type system — four voices, strict jobs

| Voice | Face | Job | Rules |
|---|---|---|---|
| **Display** | Barlow Condensed, italic, 700-800, uppercase | Headlines, wordmark, hero numbers' labels, section breaks | Italic always; tight leading (1.0-1.1); never below 20px; never for body |
| **Script** | Kaushan Script | Section identity marks only: *discover, club, live, watch, you, learn, belts, go pro* | One per screen, top-left, ~34px; NEVER for data, buttons, or sentences |
| **Body/UI** | Instrument Sans 400-700 | Everything conversational: posts, descriptions, buttons, forms | 14-15px base; 600+ for emphasis instead of color changes |
| **Mono** | IBM Plex Mono 400-600 | Data voice: kickers (11px, 0.22em tracking, uppercase), prices, %, serials, timestamps, tickers | All numbers users compare are mono — alignment is a feature |

The mono kicker (`RISING FAST`, `WHERE THE CLUB STANDS`, `KAI'S VERDICT · UPDATED 6:02 AM`) is the system's section-label primitive — it replaces heading hierarchies inside cards.

## 4. Component canon (from the boards, already seeded in `src/components/cc/ui.tsx`)

- **Conviction ring** — conic progress ring; orange = club weighted signal (halo allowed), green/pink = sentiment splits, blue = Kai confidence, white = XP/score. Center always holds the number.
- **Ranked tile** — ticker rail card: colored-initial badge (no logo pipeline), conviction %, rank-movement arrow (▲6 = *rank* delta, not price — label it).
- **Sparkline** — 1.6px stroke, no axes, no dots; tone = trend direction.
- **Stat row** — 3-5 mono values with dim labels, hairline-separated; the "receipts" pattern (4,312 opinions · +14 shift · 88% black belts).
- **Evidence chip** — small mono pill proving a claim (`RSI reset ✓`, `Call flow 3.1x ✓`, `Club shift +14 ✓`); alerts and verdicts are built from stacks of these.
- **Typed alert card** — edge-colored: BUY green edge, SELL pink edge, HEADS-UP yellow edge; kicker + thesis line + evidence chips + action row. Never a red panic register.
- **Belt identity kit** — avatar ring in belt color (2px), belt chip beside name on every post, orange live-node dot = Black Belts only, 🔥×n streak flair. Renders from data everywhere a face appears — feed, chat, chart pins, leaderboards.
- **Countdown chip** — ⏳ Xd Xh mono, for circles and events; live counts down, never static.
- **Presence stack** — small avatar cluster + count ("826 watching now"); greys until presence lands, then real.
- **Sub-tab chips** — pill row under the script title (FEED · CIRCLES · LIVE); active = orange fill with dark ink, inactive = card2 ghost.
- **Level ladder** — key-levels / belt-ladder shared pattern: dashed hairlines, current position as orange pill.
- **Zone chart** — price chart with entry band (green tint), invalidation band (pink tint), dashed level lines, mono labels (board 19) — built on lightweight-charts annotation layer.
- **Cashtag** — `$NVDA` in orange within text, always hot-linked to the ticker page.
- **Shell** — mobile: 430px column, 5-tab bottom bar (safe-area padded), Kai FAB on adult club surfaces; desktop: existing sidebar re-skinned to the same IA, content max-widths per surface (feed 680, boards 1100), phone truth first — desktop derives.

## 5. Motion

- **Purposeful, brief, interruptible.** Entrances: 200-350ms fade+rise, staggered ≤80ms. Rings sweep once on mount (600ms ease-out). Numbers count up only on first reveal.
- **`cc-ping`** (scale+fade pulse) is reserved for live states — live dots, LIVE NOW, active circles.
- **No casino energy** (standing rule): no confetti storms, no slot-machine numbers, no trade-triggered celebration. Celebrations exist exactly at: belt/rank promotion, streak milestones, lesson/unit completion, first-win moments — one tasteful beat, then done.
- **Tilt/parallax** is the ownership-card signature — it stays exclusive to LivingCard so the collectible keeps its specialness.
- `prefers-reduced-motion` collapses everything to fades; charts and counters render final-state.

## 6. UX principles

1. **5-tab IA, sub-tabs inside.** Home · Discover · Club · Watch · You. Depth lives in pill sub-tabs and push-in detail screens (back arrow, no tab bar). Persona nav variants (kid/family/free) keep their slot arrangements from the inventory — the IA converts, the persona logic doesn't change.
2. **One primary action per screen.** The orange CTA is singular: Join, Mint, Arm alert, Check, Continue. Everything else is ghost/quiet.
3. **Honest numbers, labeled.** Raw sentiment vs weighted signal are visually distinct and labeled (`RAW SENTIMENT` vs `WEIGHTED SIGNAL` kickers). While the weighted engine is unbuilt, the ring says raw — never fake precision. Same ethic as ownership cards' self-reported/verified marks.
4. **Gated ≠ hidden.** Free/kid/teen walls show the surface with a LockedState explaining the unlock (existing pattern, re-skinned). Meters (3 reads/wk, 3 Kai msgs/day) surface remaining counts honestly.
5. **Compliance floor is part of the design.** "Not investment advice" footers on technicals/fundamentals/Kai boards, "Opinions are the Club's, not brokers'" at auth, no profit promises anywhere — these are typeset elements of the system (mono, dim), not legal afterthoughts.
6. **Everything social carries identity.** No anonymous numbers: takes, picks, alerts-shared-to-club all show the belt-ringed author. Reputation context is what makes the numbers mean something.
7. **The room is alive.** Presence counts, typing indicators, countdown chips, live dots — the app should feel occupied. Where realtime isn't built yet, omit rather than fake.

## 7. Accessibility & quality gates

- Contrast: ink-on-bg 12.8:1; soft-on-bg ≥4.6:1; orange-on-dark used ≥15px or bold; verify AA on BOTH themes per component.
- Touch targets ≥44px; tab bar safe-area padded; thumb-reach for primary CTAs (bottom half on phone).
- All rings/sparklines carry text equivalents (the number is always also text).
- Focus states: 2px orange offset ring (visible on both themes); full keyboard traversal on desktop.
- Performance: public + first-paint surfaces SSR; charts/motion lazy; LCP < 2.5s on mid-range mobile; no layout shift when live numbers hydrate (skeletons share exact footprints — Collection precedent).

## 8. Conversion do/don't (supersedes prior COLOUR LAW where they conflict)

| Do | Don't |
|---|---|
| Compose with type, hairlines, and objects-with-identity (rings, tiles, chips) | Generic rounded-rect card grids (standing rule — survives conversion) |
| One script mark + one mono kicker system per screen | Script in sentences; display font in body sizes |
| Green/pink for every market delta | Red anywhere; orange for gains |
| Belt color from data | Belt color as decoration |
| Label raw vs weighted, estimated vs measured | Fake precision, invented confidence |
| Dark and light from the same tokens | Forking layouts per theme |

## 9. Immediate design tasks (feeds Phase 0)

1. Token extraction PR: the §2 tables into `globals.css` `data-theme` axis (values above are dark; pull light values from the App Light canvas during implementation).
2. Font wiring: add Barlow Condensed italic + Instrument Sans via next/font; retire Sora from converted surfaces (Sora stays on unconverted routes until their phase).
3. Grow `src/components/cc/ui.tsx` into the canon (§4) — it already ships Kicker/ScriptTitle/Card/Chip/CcMark/TickerBadge/BeltAvatar/Ring/Sparkline/Delta/buttons; add EvidenceChip, AlertCard, StatRow, RankedTile, CountdownChip, SubTabs, LevelLadder, ZoneChart.
4. Storybook-style gallery route (`/cc/gallery`, dev-only) rendering every primitive in both themes for review before any screen converts.
