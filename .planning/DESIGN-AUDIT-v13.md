# Cheat Code Club — Design Audit (v13 / "Living Thread")

**Subject:** https://cheatcode-club.vercel.app — `/`, `/challenge/`, `/pricing/`, `/about/`
**Method:** taste-skill (brief-inference + audit-first) · redesign-skill (premium-upgrade audit) · emil-design-eng (motion/detail craft) · find-animation-opportunities (motion gate). Applied against the **binding** `DESIGN-LANGUAGE.md` ("Living Thread"), owner hard-rules, and the compliance floor.
**Evidence:** live Playwright renders at 1280 + 390 (full-page screenshots in this scratchpad: `home-*.png`, `challenge-*.png`, `pricing-*.png`, `about-*.png`, `home-reduced.png`) plus runtime probes. Source read read-only from `/Users/kwaysclawd/projects/cheatcode-club-site` (NOT modified).

**Runtime health (all green):** 0 console errors on any page/viewport · 0 horizontal overflow at 390 or 1280 · thread draws fully (path len 4836, offset→0, 11 nodes light) · hero word rotates smarter→better→richer · countdown live (37d) · sticky mobile CTA reveals on scroll · reduced-motion freezes thread (offset 0), pins hero word to SMARTER, pauses ambient video. Fonts (Clash Display, General Sans) load. `assets/site.js` is **not referenced** by any page — it is dead legacy; its `window scroll` listeners and price-flicker do not run (good — do not re-wire it).

**EXCLUDED (another agent is mid-edit — not audited here):** (1) home feature vignettes being swapped from `.app` div-mock to real screenshots; (2) mission set-piece reframed as the explicit `1,000,000` GOAL; (3) hero text-stack above the phone fan. Findings below deliberately avoid these three. Challenge `/` mobile ≈10k px long is a **known-accepted** long-form funnel.

---

## 1. Design Read (taste-skill 0.B)

Reading this as: **a redesign-preserve, premium-consumer marketing site for everyday/family investors, in a warm-editorial "Living Thread" language** (cream canvas + Clash Display display type + Instrument Serif italic voice + JetBrains Mono data + one scroll-drawn orange thread as the through-line), leaning toward **hand-built vanilla CSS/JS with product-saturated density and restrained, connection-only motion** — Linear/Stripe craft with warmer energy, sparse minimalism explicitly rejected. Dials inferred from the language: `DESIGN_VARIANCE 7 · MOTION_INTENSITY 5 (connection/data-aliveness only) · VISUAL_DENSITY 5`. The build is already good — genuinely on-language, no AI-purple, no terminal chrome, real object vocabulary (receipt, phones, ghost numerals, annotations, stat chips, CC infinity). The gaps are **craft-tier**: accent-color text contrast, missing press-feedback, generic easing, a mobile-nav dead-end, and desktop horizontal cream voids on the text-column pages.

---

## P1 — Defects / cheap-feeling details (fix first)

### P1-1 · Accent-colored text fails WCAG AA on cream (systemic)
- **Where:** every orange label/eyebrow/kicker/inline-link + green/kai-blue data text. Tokens in `assets/v13.css` `:root`. Concrete uses: `.hero__eyebrow`, `.feat__kicker`, `.kicker`, `.tier__badge`, `.tiers__note a`, `.qa a`, `.matrix … .yes`, `.up`, `.msg b` / `.app__kai b`.
- **What's wrong (measured on `--cream-100 #F6EFE3`):** `--orange #F0682A` ≈ **2.7:1**, `--green #1E9E6A` ≈ **3.0:1**, `--kai-blue #2F6BFF` ≈ **3.9:1**. All fail AA (4.5:1 small text); orange fails even the 3:1 large-text floor. These carry real reading load (section eyebrows, pricing badges, inline "see the challenge →" links).
- **Why:** redesign-skill *Interactivity/Contrast* + taste-skill 4.5 **Button/Form contrast** + 6.C WCAG AA. Bright brand accents are for **fills/graphics**, not body-size text on a light ground.
- **Fix (add text-safe accent tokens; keep bright accents for thread/fills/gradients):**
  ```css
  :root{
    --orange-text:#A8420E;  /* verify ≥4.5:1 on --cream-100 (≈5.0:1) */
    --green-text:#127A50;   /* verify ≥4.5:1 */
    --kai-blue-text:#2357D6;/* verify ≥4.5:1 */
  }
  ```
  Repoint small-text uses: `.feat__kicker,.kicker,.hero__eyebrow,.tier__badge,.tiers__note a,.qa a,.matrix-sec kicker → color:var(--orange-text)`; green data text (`.up,.matrix .yes,.stat-chip--up .stat-chip__val`) → `--green-text`; `.app__kai b,.msg b` → `--kai-blue-text`. Leave `--orange` as-is for `.thread`, gradient fills, `.tier__flag`, and large decorative gradient display words. **Respects Living Thread:** yes — thread/fills unchanged; only text legibility hardened.

### P1-2 · Legal / compliance disclaimer is below AA contrast
- **Where:** `.foot .fine` and `.foot__legal .fine` (all pages) use `color:var(--ink-300) #8B8F98`; also `.vstack__caption`, `.matrix-sec__note`, `.tier li.off`.
- **What's wrong:** `#8B8F98` on cream ≈ **2.85:1** — fails AA. This is the *education-not-advice / markets-involve-risk* disclaimer; the one string that most needs to be readable is the least readable on the page.
- **Why:** redesign-skill *Strategic Omissions / a11y* + taste-skill 6.C. Compliance text at 2.85:1 is both an a11y fail and a compliance-legibility risk.
- **Fix:** raise legal/caption text to `--ink-500 #565A63` (≈6.0:1, passes). `.foot .fine,.foot__legal .fine,.vstack__caption,.matrix-sec__note,.tier li.off{color:var(--ink-500)}`. Restrict `--ink-300` to genuinely non-text decoration only (`.app .rank`, `.ghost-num` stroke, `.cc-mark`). **Respects Living Thread:** yes (tonal only).

### P1-3 · Buttons have no press state and use generic easing
- **Where:** `.btn` in `assets/v13.css` (§8). Probed computed: `transition: transform 0.2s, box-shadow 0.2s` (keyword `ease`), `:hover{transform:translateY(-1px)}`, **no `:active`**.
- **What's wrong:** primary CTAs (the whole funnel: "Join the Club", "Save my spot", "Add FTA") give zero tactile feedback on press, and `0.2s ease` is the weak default curve. The site's most-clicked elements feel inert.
- **Why:** emil *Buttons must feel responsive* ("nothing in the real world…"), *use custom curves, never the weak built-ins*. redesign-skill *No active/pressed feedback*.
- **Fix:**
  ```css
  :root{ --ease-out:cubic-bezier(0.23,1,0.32,1); }
  .btn{ transition:transform .16s var(--ease-out), box-shadow .16s var(--ease-out); }
  @media (hover:hover) and (pointer:fine){ .btn:hover{ transform:translateY(-1px); box-shadow:var(--shadow-md); } }
  .btn:active{ transform:scale(.97); }   /* subtle; scale wins over the -1px on press */
  ```
  (Gating hover behind `hover:hover` also fixes P1-4.) **Respects Living Thread:** yes — press feedback is *feedback*, and the language already sanctions "magnetic CTAs," so tactile CTA motion is in-bounds.

### P1-4 · Hover transforms fire on touch (stuck hover)
- **Where:** `.btn:hover`, `.nav a:hover`, `.foot a:hover`, `.link-quiet:hover` — none gated.
- **What's wrong:** on touch, tap triggers `:hover`, leaving CTAs lifted / links recolored until the next paint. Feels broken on the primary (mobile) audience.
- **Why:** emil *Touch device hover states* — gate behind `@media (hover:hover) and (pointer:fine)`.
- **Fix:** wrap every `:hover` rule in `@media (hover:hover) and (pointer:fine){ … }`. **Respects Living Thread:** yes.

### P1-5 · Mobile header is a navigation dead-end
- **Where:** `.nav{display:none}` until `@media(min-width:900px)` on `/`, `/pricing/`, `/about/`; no hamburger/menu replaces it. Header on mobile shows only "Log in" + "Join the Club."
- **What's wrong:** on phones (the core audience) Features / AI / Family / Pricing / About are unreachable from the top of the page — only via the footer, thousands of px down. Cross-page discovery collapses on mobile.
- **Why:** redesign-skill *No "back"/navigation dead ends* + taste-skill 4.7 (nav must resolve on mobile — condense or move to a menu, not vanish). Note: this is *distinct from* the accepted hero-stack in-flight work.
- **Fix (minimal, on-language):** add a compact menu affordance in `.head-cta` shown only `<900px` — a text/icon "Menu" that toggles a cream sheet listing the 5 nav links + Pricing/About, or at minimum surface a persistent **Pricing** link beside "Log in". Reuse `--cream-100`, `--hairline`, `--font-body`; slide the sheet with `transform: translateY(-8px)+opacity`, `.2s var(--ease-out)`, reduced-motion → instant. **Respects Living Thread:** yes (new surface, existing tokens). Flag: adds one UI element the owner mockup didn't spec → **worth a quick owner nod**, but it's a functional gap, not a restyle.

---

## P2 — Polish upgrades

### P2-1 · Desktop horizontal cream voids on the text-column sections
- **Where:** `/challenge/` `.prose .wrap{max-width:760px}` (centered in the 1200px `.wrap`) — "Why most families never start" and the FAQ float as a ~760px column with ~260px cream each side at 1280 (see `challenge-desk.png`). Milder on `/pricing/` FAQ and `/about/` manifesto.
- **What's wrong:** DESIGN-LANGUAGE density bar ("every viewport-height shows product/objects, never text-only cream voids") — the card-gate only guards *vertical* voids, so these *horizontal* flanks pass the gate but still read as empty on desktop.
- **Why:** redesign-skill *Empty flat sections* + DESIGN-LANGUAGE §8 density. (About's manifesto is legitimately editorial-centered per taste-skill 4.3 — leave it; the challenge prose is the real offender.)
- **Fix:** give the challenge prose block a left thread-rail companion: pull a `.ghost-num` or a small stacked `.stat-chip` rail / one `.annotation` with arrow into the side gutter, or widen to a 2-col `[headline | body]` at `≥900px` so the section fills toward the thread. Keep FAQ centered but drop a faint `.cc-mark` infinity into its flank. **Respects Living Thread:** yes — uses sanctioned object vocabulary. Confirm object choice with owner (composition change).

### P2-2 · Pricing tier CTAs sit at ragged heights
- **Where:** `/pricing/` `.tier .btn` across the 3 columns. Free has 5 list items, Club 7, FTA 5 → buttons land at three different Y positions (see `pricing-desk.png`).
- **What's wrong:** misaligned CTA baseline across a comparison row reads as broken.
- **Why:** redesign-skill *Buttons not bottom-aligned in card groups* / *feature lists starting at different Y*.
- **Fix:** make each tier a flex column and float the CTA: `@media(min-width:820px){ .tier{display:flex;flex-direction:column} .tier ul{flex:1 1 auto} .tier .btn{margin-top:auto} }`. Prices already align (fixed `.tier__price`) and `.tier__desc{min-height:2.6em}` aligns descriptions — this finishes the job at the button line. **Respects Living Thread:** yes.

### P2-3 · Every transition uses the weak `ease` keyword
- **Where:** `.thread-node-dot` (`.35s ease` ×3), `.hero-word__w` (`opacity .45s ease`), `.stickybar` (`transform .3s ease`), `.btn` (see P1-3).
- **What's wrong:** built-in `ease` lacks intention; enters should use a strong ease-out, the sticky drawer should use a drawer curve.
- **Why:** emil *use custom easing curves; the built-ins are too weak* + *ease-out on enters*.
- **Fix:** define once and apply:
  ```css
  :root{ --ease-out:cubic-bezier(0.23,1,0.32,1); --ease-drawer:cubic-bezier(0.32,0.72,0,1); }
  .stickybar{ transition:transform .32s var(--ease-drawer); }
  .thread-node-dot{ transition:background .35s var(--ease-out),box-shadow .35s var(--ease-out),transform .35s var(--ease-out); }
  .hero-word__w{ transition:opacity .45s ease; } /* leave: a slow elegant crossfade wants plain ease, see P2-4 */
  ```
  **Respects Living Thread:** yes.

### P2-4 · Hero-word crossfade dips mid-swap
- **Where:** `assets/hero-word.js` FADE=450 + `.hero-word__w{transition:opacity .45s ease}`. Both outgoing and incoming words cross-fade over the same 450ms → a visible low-opacity trough where two gradient words overlap.
- **What's wrong:** the signature headline moment shows two ghosted words mid-transition instead of one clean morph.
- **Why:** emil *use blur to mask imperfect crossfades* — "you see two distinct objects; blur bridges them."
- **Fix (CSS only, JS untouched):**
  ```css
  .hero-word__w{ transition:opacity .45s ease, filter .45s ease; filter:blur(3px); }
  .hero-word__w.is-in{ filter:blur(0); }
  ```
  Keep `<20px` blur (Safari). Reduced-motion already flattens via the global block. **Respects Living Thread:** yes — polishes the owner-specified rotating word.

### P2-5 · Instant color on link hover
- **Where:** `.nav a:hover`, `.foot a:hover`, `.link-quiet:hover`, `.tiers__note a`, `.qa a` — color flips with no transition.
- **Why:** redesign-skill *instant transitions with zero duration*. emil: hover color = `ease`.
- **Fix:** `.nav a,.foot a,.link-quiet{transition:color .18s ease}` (inside the `hover:hover` block from P1-4). **Respects Living Thread:** yes.

### P2-6 · Web-font delivery blocks first paint; no preconnect/preload
- **Where:** `assets/v13.css` top: two `@import url(…fontshare…)` + `@import url(…googleapis…)`. No `<link rel="preconnect">`/`preload` in any `<head>`.
- **What's wrong:** CSS `@import` for fonts is discovered only *after* v13.css downloads → serialized network, delayed FOUT swap on the Clash Display LCP headline. taste-skill: never `<link>` Google Fonts in prod (here it's worse — `@import`).
- **Why:** taste-skill 3.A fonts + 6.D CWV (LCP < 2.5s). `display=swap` is present (good — no invisible-text FOIT, low CLS), but the swap flash and LCP delay are avoidable.
- **Fix:** add to every `<head>` before the stylesheet:
  ```html
  <link rel="preconnect" href="https://api.fontshare.com" crossorigin>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  ```
  and move the two `@import`s to `<link rel="stylesheet">` tags (parallel fetch), or self-host Clash Display + General Sans and `<link rel="preload" as="font" crossorigin>` the two hero weights. **Respects Living Thread:** yes (delivery only, same fonts).

### P2-7 · Reduced-motion block is a blunt global kill
- **Where:** `assets/v13.css` §9: `*{animation-duration:.001ms!important;transition-duration:.001ms!important;…}`.
- **What's wrong:** it also nukes opacity/color transitions that *aid comprehension* (hero-word gradient state, button press acknowledgment, sticky-bar presence). emil: reduced motion = fewer/gentler, **keep opacity + color**, remove movement.
- **Why:** emil *prefers-reduced-motion* + taste-skill 6.B.
- **Fix (soften):** instead of killing all transitions, target movement — keep short opacity/color:
  ```css
  @media (prefers-reduced-motion: reduce){
    *{ animation-duration:.001ms!important; animation-iteration-count:1!important; scroll-behavior:auto!important; }
    .thread-svg path{ transition:none } /* already static via JS */
    /* allow opacity/color transitions to remain (<=200ms) */
  }
  ```
  Retain the JS that pins hero word to SMARTER and pauses video. **Respects Living Thread:** yes — honors "no decorative motion" while keeping comprehension cues.

---

## P3 — Nice-to-have

### P3-1 · Em-dash saturation (taste-skill's #1 Tell) — **owner decision**
- **Where:** `&mdash;` pervasive across all four pages' copy (hero leads, feature body, receipt rows, FAQ, footer).
- **Why:** taste-skill 9.G bans the em-dash outright as the signature AI Tell. **However**, DESIGN-LANGUAGE §8 and the brief say *copy substance and messaging are preserved*, and this is a deliberate editorial voice, not model default.
- **Recommendation:** this is a **copy/owner call, not a unilateral defect** — flag only. If the owner wants to shed the Tell, replace ` — ` with a comma, colon, period, or parentheses per string (compliance wording unchanged). **Needs owner sign-off; do not bulk-edit copy without it.**

### P3-2 · About "room" uses invented usernames
- **Where:** `/about/` `.roomscr` — `@tradebytee`, `@marketmaven` hardcoded (home/challenge correctly use anonymous "A member").
- **Why:** owner hard-rule "no fabricated testimonials"; invented handles in a product mock read as semi-fabricated members and are inconsistent with the anonymized pattern elsewhere.
- **Fix:** genericize to "A member" / "Another member" (matches home/challenge) or clearly illustrative first-names. Low risk. **Respects Living Thread:** yes.

### P3-3 · Thread reads faintly on desktop
- **Where:** `--thread-w:2px` orange behind content; on cream at desktop the signature line is easy to miss (visible clearly only across `.band--ink`).
- **Why:** DESIGN-LANGUAGE §1 — the thread is *the* brand thesis; it should register.
- **Fix (subtle):** desktop-only bump `@media(min-width:900px){ .thread-svg path{ stroke-width:2.5px } }` and/or a faint drawn-portion glow via `filter:drop-shadow(0 0 3px color-mix(in srgb,var(--thread) 40%,transparent))`. Do **not** thicken mobile gutter lane. **Respects Living Thread:** yes (strengthens it) — but it's a visibility judgment; confirm with owner.

### P3-4 · Off-grid footer link padding
- **Where:** `.foot a{padding:3px 0}` — 3px is off the 8pt scale (`--s-1:4px`). Cosmetic.
- **Fix:** `padding-block:var(--s-1)`. (Mobile already gets 44px tap targets via the `≤720px` block — keep.)

---

## 2. Motion Opportunities (find-animation-opportunities — gated, capped)

Existing motion inventory (all connection/data-aliveness, on-language): thread draw-on-scroll, node lighting, hero-word rotation, ambient webm loops, countdown tick, sticky-bar slide, CTA hover lift. The interface is **already close to right** — it does NOT need more ambient motion. Only high-conviction, purpose-named additions below.

| # | Location | Today | Purpose | Frequency | Suggested motion (exact) |
| --- | --- | --- | --- | --- | --- |
| 1 | `.btn:active` (all CTAs) | No press feedback | **Feedback** | Tens/day (subtle, fast — allowed) | `:active{transform:scale(.97)}` + `transition:transform .16s var(--ease-out)`; hover gated `hover:hover`. (= P1-3) Highest leverage. |
| 2 | `.thread-node-dot` on `.thread-lit` | Cross-fades to lit | **State indication / connection** | Occasional | One-shot settle when a node lights: `transform:scale(1)→1.28→1.15` via `.35s var(--ease-out)` (already transitions; just add the overshoot keyframe on class add). Reinforces "thread reached this section." Reduced-motion → color-only. |
| 3 | Primary CTAs (`.btn`, desktop) | Static `translateY(-1px)` hover | **Feedback / delight** — *explicitly sanctioned* ("magnetic CTAs", DESIGN-LANGUAGE §5) | Occasional | Magnetic pull on `pointer:fine`: translate up to ±6px toward cursor, spring-interpolated (`stiffness 100, damping 12`) via a small rAF/motion-value on pointermove, snap back on leave. Gate `hover:hover and pointer:fine`; reduced-motion → none. |
| 4 | Feature-copy blocks as their thread node lights | Appear statically | **Preventing a jarring change / connection** | Once per scroll | *Gated:* when `.thread-lit` is set on a `[data-thread-node]`, settle its `.feat__copy`/`.lead` from `opacity:0;translateY(8px)` → in, `.5s var(--ease-out)`, `once`. Tie the reveal to the **thread reaching the node** (connection-motivated), never a free-floating scroll fade. |

**Every value above** uses the shared tokens (`--ease-out: cubic-bezier(0.23,1,0.32,1)`), animates only `transform`/`opacity`, includes reduced-motion degradation, and gates hover on `@media (hover:hover) and (pointer:fine)`.

### Do-NOT-animate list (rejections — required)
- **Countdown seconds** (`#cd-sec`, challenge). **Rejected:** ticks 60+/min, and it's data the user reads — animating each tick distracts. Text-swap only (current) is correct.
- **Header nav / links.** **Rejected:** navigation, seen constantly; motion makes it feel slow. Color transition only (P2-5).
- **Pricing feature matrix rows / tier hover-scale.** **Rejected:** functional comparison data the user is reading — decoration hinders (row hover-tint is enough).
- **Re-enabling legacy `site.js` live price-flicker / typewriter** on app panels. **Rejected:** decorative *and* fabricates live data — violates "no decorative motion" and the honest-data floor. Keep it dead.
- **Continuous thread shimmer / breathing.** **Rejected:** the language sanctions *draw-on-scroll* connection only; a perpetual shimmer is decoration.

**Verdict:** motion is well-judged and restrained; the single highest-leverage add is **#1 (CTA press feedback)** — it's the funnel's most-touched element and currently gives nothing back. #4 needs an owner nod (below).

---

## 3. "Respects Living Thread" summary + owner sign-off flags

**Fully within the approved language (no sign-off needed) — tokens/tonal/feedback only:** P1-1, P1-2, P1-3, P1-4, P2-2, P2-3, P2-4, P2-5, P2-6, P2-7, P3-2, P3-4, motion #1, #2, #3 (#3 is *explicitly listed* as allowed — "magnetic CTAs").

**Bends the language / needs a quick owner nod:**
- **P1-5 (mobile nav sheet)** — adds a UI surface the mockup didn't spec (functional gap, but new element).
- **P2-1 (challenge prose composition)** — introduces a side-gutter object; composition change.
- **P3-1 (em-dash)** — copy edit; "preserve copy" governs → owner call.
- **P3-3 (thread weight)** — alters the signature line's visual weight.
- **Motion #4 (node-lit content reveal)** — borderline vs "no decorative motion"; defensible only as *connection*-motivated (fires off the thread, not free scroll). Confirm before building.

**No finding proposes:** a new palette, terminal/daytrader chrome, people/lifestyle photos, fabricated stats, generic card containers, or income/return/win-rate language. Compliance floor intact.

---

## Ranked Top-10 (one line each)

1. **P1-1** Accent text fails AA on cream — orange 2.7:1 / green 3.0:1 / kai-blue 3.9:1; add darkened `--*-text` tokens, keep bright accents for fills/thread.
2. **P1-2** Legal/compliance footer disclaimer is `ink-300` ≈2.85:1 (fails AA) — raise fine/caption text to `ink-500`.
3. **P1-3** CTAs have no `:active` press state and use weak `ease` — add `scale(.97)` + `--ease-out` (funnel's most-clicked elements feel inert).
4. **P1-5** Mobile header is a nav dead-end (`.nav display:none` <900px, no menu) — Pricing/About unreachable from the top on phones.
5. **P1-4** Hover transforms not gated — tap leaves CTAs/links in stuck-hover on touch; wrap in `@media (hover:hover) and (pointer:fine)`.
6. **P2-6** Fonts via CSS `@import` with no preconnect/preload — serialized fetch delays the Clash Display LCP; add preconnect + `<link>`/self-host.
7. **P2-1** Challenge desktop prose = 760px column floating in ~260px cream flanks — density-bar void; add a thread-side object.
8. **P2-2** Pricing tier CTAs land at ragged heights (5/7/5 list items) — flex-column + `margin-top:auto` to align the button baseline.
9. **P2-4** Hero-word crossfade dips (two gradient words overlap) — mask with `filter:blur(3px)→0` alongside the opacity swap.
10. **Motion #1 / P2-3** Systemic easing upgrade — define `--ease-out`/`--ease-drawer` and apply to node-dot, sticky-bar, buttons (plus press feedback).
