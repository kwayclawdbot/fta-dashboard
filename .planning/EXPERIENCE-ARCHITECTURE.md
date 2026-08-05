# EXPERIENCE ARCHITECTURE — domain-selected experiences (Club / Family / Kid / Whitelabel)

Status: DRAFT — awaiting owner ratification 2026-08-05
Depends on: CHEATCODE-CLUB-ARCHITECTURE.md (ratified 07-24), SEO-ARCHITECTURE.md (ratified 07-25),
SCHOOL-ACCOUNTS-PLAN.md (design only, unbuilt), DOMAIN-CUTOVER.md (blocked on owner DNS)

## 0. The one-sentence change

Today the app *infers* its experience (household shape + URL prefix, `DashboardShell.tsx:181`).
This plan inverts that: **the entry domain stamps an explicit, stored experience at
registration, and the app renders from the stored value everywhere after that.**

## 1. Vocabulary — four axes, kept orthogonal

| Axis | Values | Where it lives | What it controls |
|---|---|---|---|
| **Experience (door)** | `club` \| `family` \| (later) `org:<id>` | NEW — stored on `families.door` | Branding, nav manifest, dashboard composition, default Kai persona, wordmark, canonical host |
| **Register** | kid / teen / adult (`lib/register.ts`) | derived from profile | Capabilities, kid safety, kid nav — UNCHANGED |
| **Tier** | free / fic / fta (+ challenge_pass) | `enrollments` | Entitlements/paywalls — UNCHANGED |
| **Skin** | `data-mode` club/family/fta × light/dark | CSS, `globals.css` | Tokens only — becomes a *function of* experience instead of inference |

Rules that keep this sane:
- **Kid is never a door.** Kids enter via family invite inside the Family experience; kid UX
  = Family experience × kid register (per feedback: kid versions DERIVED from adult style).
- **Tier never changes per door** (ratified 07-24: both doors checkout into the same membership).
- **FTA is not an experience** — it stays a route-scoped skin (`/fta/*`) + tier, inside either door.

## 2. Domain → experience resolution

### Registry (Phase E1: code constant; Phase E3: DB table)

```ts
// src/lib/experience/registry.ts
{
  club:   { hosts: ["app.cheatcode.com"],           brand: "Cheat Code Club",       mode: "club" },
  family: { hosts: ["app.familyinvestingclub.com"], brand: "Family Investing Club", mode: "family" },
}
// unknown host → family (current prod host) until cheatcode DNS lands
```

### Resolution rules

1. **Logged-out pages** (login, checkout, challenge, public SSR): host wins.
   `middleware.ts` resolves host → experience, stamps `x-experience` request header;
   layouts read it for wordmark/`data-mode`. This is what makes the login page on
   cheatcode.com look like Club and on familyinvestingclub.com look like FIC.
2. **Registration**: the door is stamped **at provisioning**, once, at all three entry paths:
   - Stripe webhook → `provisionMembership()` gains a `door` arg, derived from which
     checkout the session came from (checkout metadata carries the host/door).
   - Admin invite API → explicit `door` param (default from admin UI selector).
   - Family invite code → **inherits the family's stored door** (invites can't cross doors).
3. **Logged-in on the "wrong" domain — interstitial, not silent redirect** (owner decision
   2026-08-05): the mismatch is a product surface.
   - **Club member on the family domain** → interstitial pitching Family Mode
     ("Register for Family Mode" → the Add-your-family conversion flow; secondary action
     returns them to their Club home).
   - **Family member on the club domain** → "Do you want to view in Club Mode?" —
     accepting sets a session-scoped club-view override (cookie), **adults only; kid/teen
     registers NEVER get club view** (kids-never-escalate rule). Declining returns them
     to their family home.
   - The stored door itself never changes from a visit; conversion is always the explicit
     flow below.
4. **Door conversion** is an explicit product action, not a domain side effect:
   solo Club member taps "Add your family" (lane C1 surface) → `families.door` flips to
   `family`. Never flipped by which URL someone happened to visit.

## 2b. Minor-content visibility (owner decisions 2026-08-05)

Now that `feed_posts`/`post_comments` carry `author_register` (mig 214, shipped):
- **Kid rows: family-only, everywhere.** Shipped in 214. Never club-wide, never public.
- **Teen rows: Family-mode surfaces only.** Family-door viewers (and the teen's own
  family) see teen posts/activity; club-door surfaces filter them out. Requires the
  E1 `families.door` column → implement as a `viewer_door()` policy-safe helper
  (same pattern as `get_my_family_id()`; feed tables are not in the Realtime
  publication, but keep predicates function/own-column based per the 018/019 laws)
  plus door-aware filters on the service-role routes (`/api/club/thinking`, `/api/search`).
- **Adult rows: club-wide** (unchanged).

## 3. Data model

### Phase E1 (migration)

```sql
alter table families add column door text not null default 'family'
  check (door in ('club','family'));
-- backfill: door = 'club' where household is solo (reuse isSoloHousehold logic
-- server-side against family_profiles.household), else 'family'
```

Stored on `families` (the membership/tenant unit), not `profiles` — every member of a
household shares one door; register still differentiates individuals within it.

### Phase E3 (whitelabel) — implements SCHOOL-ACCOUNTS-PLAN as ratified prior art

- `organizations` (type school|class, parent_org_id, license fields) + `org_members`
  join table (NOT an org_id column on profiles — child can hold family + classes).
- `experience_configs` table: key, display name, wordmark asset, token overrides (JSONB
  of the raw CSS vars — the `--g50..--g900` remap trick makes this a pure data problem),
  nav manifest, kai persona key, domains[].
- Custom domains attached via Vercel Domains API; middleware falls through
  host → experience_configs lookup (edge-cached) before the static registry.
- Schools render **FIC-branded, never "Cheat Code"** (ratified) — i.e. school configs
  fork from the family experience base.
- Hard constraints carried forward from migrations 018/019 (verbatim laws):
  no self-referential subqueries in RLS policies; Realtime-streamed tables need
  pure own-column/JWT predicates → org_id denormalized onto chat_messages, JWT
  custom-claims hook injecting org_ids[].

## 4. Code changes by chokepoint (Phase E1 — no visual redesign, plumbing only)

| Chokepoint | Change |
|---|---|
| `src/middleware.ts` | host → experience resolve; stamp `x-experience`; logged-in canonical-host redirect |
| `src/app/(dashboard)/layout.tsx` | load `families.door` into the user/entitlement batch |
| `DashboardShell.tsx:181` | `mode = pathname.startsWith("/fta") ? "fta" : door` — inference deleted |
| `src/lib/mode.ts` | `MemberMode` derived from stored door, not `isSolo` (isSolo stays for other uses) |
| `(auth)/layout.tsx`, `page.tsx`, checkout/challenge shells | replace hardcoded `data-mode="club"` with header-resolved experience |
| `src/lib/server/membership.ts` | `provisionMembership({door})`; Stripe checkout sessions carry door in metadata |
| `/api/admin/invite` | door param + admin modal selector |
| `signup/invite/[code]` | inherit family door into user_metadata for pre-onboarding branding |
| `src/lib/kai/persona.ts` | persona selection reads door: kid→kid (always), family adult→family-adult, club→club (matches ratified C-lane rule) |

Everything downstream (nav wordmarks, MODE_BRAND, tier chip labels, favicon) already keys
off mode/brand indirection and comes along for free.

## 5. Phases

- **E1 — Plumbing (build now):** migration + backfill, registry, middleware, three signup
  stamps, chokepoint swap, canonical-host redirect (inert for club until cheatcode.com DNS
  lands — safe to ship ahead of it). Zero visual change for existing users by construction:
  backfill reproduces today's inferred mode exactly.
- **E2 — Divergence (rides v3/C-lanes):** per-experience nav manifests, onboarding wizard
  door step (already spec'd in design-project-v2 CONVERSION-PLAN), dashboard composition
  differences, door-aware email templates (lane C4), "Add your family" conversion surface (C1).
- **E3 — Whitelabel (after schools deal is real):** organizations + org_members,
  experience_configs, custom domain attach flow, school onboarding (roster codes, no
  student emails per minor-safety rule), teacher/principal SECURITY DEFINER read tools.

## 6. Open items / owner blockers

- cheatcode.com DNS still parked at Bluehost (standing blocker) — E1 ships anyway; the
  club host entry activates the day DNS points at Vercel.
- SEO-ARCHITECTURE names `app.cheatcode.com`, DOMAIN-CUTOVER uses `app.familyinvestingclub.com`
  — E1's registry treats both as first-class hosts of the same Vercel app; no conflict.
- Branch: E1 is server/data plumbing outside the v3 import wall.
