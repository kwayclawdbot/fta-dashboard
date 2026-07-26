# The Cheat Code Design Grammar

> PART III of `.planning/CLUB-CONVERGENCE-PLAN.md`, made literal.
> **These are code-review pass/fail gates, not guidelines.** Every convergence-pass
> PR is checked against them line by line. A surface either passes or it goes back.

Hide the logos and the app is still unmistakably Cheat Code — from its interaction
patterns, its hierarchy, and this grammar. Not its color.

---

## The eight primitives

Every screen is built ONLY from these. If a piece of UI isn't one of them, it
doesn't ship.

| # | Primitive | Component | Use it for |
|---|-----------|-----------|------------|
| 1 | **Page intro** | `grammar/PageIntro` | The opening composition: headline, context, 0–2 actions |
| 2 | **Signal row** | `ui/TickerRow` | A ticker / event / alert / person in a list |
| 3 | **Feature canvas** | *(composed per-surface)* | The one dominant experience of the screen |
| 4 | **Editorial section** | `grammar/EditorialSection` | Titled content on the open canvas — **no card** |
| 5 | **Object card** | `grammar/ObjectCard` | The **only** sanctioned container — persistent objects only |
| 6 | **Action sheet** | *(per-surface / Kai sheet)* | Universal contextual actions |
| 7 | **Kai layer** | `kai/*` + `.club-field-kai` | Wherever Kai speaks — consistent Kai-blue |
| 8 | **Status chip** | `grammar/StatusChip` | Tiny semantic indicators |

Import them from one place: `import { PageIntro, EditorialSection, ObjectCard, StatusChip, TickerRow, Tabs } from "@/components/grammar";`

---

## The four pass/fail rules

### 1. Containment communicates meaning, or it doesn't exist

**FAIL:** `rounded-2xl border bg-card p-4` reached for as a way to group things.
The boxed-card idiom repeated in grids is banned (owner standing rule).

**PASS:** hierarchy from typography, spacing, hairlines, full-bleed color fields,
and scale. Containment appears **only** on `ObjectCard`, and only around a
persistent object (thesis, lesson, alert/setup, person, ticker, live_event) that
has its own identity and URL. If the thing inside isn't a real object, it gets an
`EditorialSection` (open canvas), not a card.

- Grouping content → `EditorialSection`
- Wrapping a persistent object → `ObjectCard`
- Everything else → open canvas + spacing

### 2. The type scale gets contrast

Kill the everything-is-13px density. Four tiers, enforced:

| Tier | Size | Where |
|------|------|-------|
| Feature heading | **32–40px** | `PageIntro` title, feature-canvas headline |
| Section lead | **20–24px** | `EditorialSection` title |
| Reading body | **16px** | context lines, prose, object titles |
| Metadata | **tiny (10–12px), only** | timestamps, counts, chip labels, eyebrows |

Tiny text is for metadata **only**. If body copy is 13px because "it fits," the
surface fails. `PageIntro` and `EditorialSection` bake these sizes in — use them
and the scale is correct for free.

### 3. Accent discipline — one dominant + one supporting, per screen

- **Club** = volt dominant, **teal** supporting.
- **Family** = gold dominant.
- **FTA** = metallic dominant.
- The register accent is the `gold-*` ramp / `var(--accent-solid)` — globals.css
  remaps it per `data-mode`, so components never fork. Use `StatusChip tone="accent"`
  and `ObjectCard accent="accent"` for the dominant, `tone="support"` / `accent="support"`
  (teal) for the one supporting signal.
- **Kai-blue ONLY when Kai speaks.** `tone="kai"`, `accent="kai"`, `.club-field-kai`,
  `.text-kai-blue`, the Kai FAB and Kai sheet — nowhere else. A non-AI status in
  Kai-blue is a hard fail.
- No third simultaneous accent. Badge/sentiment noise stays reduced.

### 4. Motion communicates product meaning, not component garnish

Every animation answers "what does this communicate?" Valid: feedback (press,
hover-lift), state change (rank rises, Changed My Mind transforms, near-trigger
tightens/pulses), spatial continuity (sheet enters/exits one direction),
explanation. Invalid: "it looked cool," infinite decorative loops on informational
content.

- `ObjectCard` lifts 1px on hover — that's feedback, keep it subtle.
- `StatusChip pulse` is for genuinely **live** states only.
- Keyboard-initiated actions (⌘K) do **not** animate.
- `prefers-reduced-motion` is respected everywhere (transforms drop, comprehension-
  aiding opacity/color may stay). Every motion utility here is already gated.

---

## Shell application (Sprint 1 scope)

S1 applied the type scale + containment pass to the **shell** surfaces only:
navigation, top bar, universal search, the Kai sheet, empty states, buttons/tabs.
Content surfaces (Home, Discover, The Club, Ticker, Learn, Family, FTA) are
restyled in S2+ — do not restyle them here.

The nav is one permanent mental model — `Home · Discover · Club · Watchlist · You`
— and a register changes exactly one slot (Parent → Family, Kid → Learn/Missions/Me).
Kai is a system capability (a side/bottom sheet carrying page context), not a
destination. Search is a command surface (⌘K), not a page.
