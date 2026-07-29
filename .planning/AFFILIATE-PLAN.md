# FTA / FIC Affiliate & Virality System — Plan

**Status:** PLAN ONLY (no code / migrations / deploys). Design doc for review.
**Author:** design pass, 2026-07-18.
**Scope:** Referral + revenue-share + XP-virality layer for the FTA dashboard app
(`fta-dashboard-ruddy.vercel.app`, Supabase ref `zvkercqohmmeyofycbgr`).
**Composes with:** `.planning/SCHOOL-ACCOUNTS-PLAN.md` (orgs/schools) — see §7 forward-compat.

---

## 0. Grounding (what already exists)

From the live schema — the plan is additive on top of these, nothing here is rebuilt:

| Object | Relevance |
|---|---|
| `families` (`stripe_customer_id`, `stripe_subscription_id`, `plan_tier`, `enrolled_at`, `expires_at`) | Attribution anchor. **No `referred_by` yet — we add it.** |
| `profiles` (`id`=auth.uid, `family_id`, `role` parent/child/coach/admin, `age_group` kids/teens/adults, `email`) | Affiliate = `role='parent'`. Minors = child + kids/teens. |
| `family_invites` (family-internal kid invites) | **Not** the parent→parent channel. Left untouched. Referral is a separate system. |
| `enrollments` (`family_id`, `program` fic\|fta, `status` active/completed/cancelled, unique(family,program)) | **The paid signal.** A conversion = a new active enrollment for a referred family. |
| `xp_events` (`user_id`, `amount`, `kind` CHECK ∈ lesson/quiz/flashcards/game/community/rsvp/**bonus**, `ref_id` text) | XP virality feeds this. Insert RLS = `user_id = auth.uid()`. No `referral` kind — Phase 1 reuses `bonus`. |
| `family_xp_leaderboard(window)` SECURITY DEFINER RPC | Template for the referral leaderboard (aggregate, never exposes raw rows). |
| `badges` / `user_badges` | Referral badges slot straight in. |
| Stripe LIVE (algo.cheatcode): FIC `$99/mo` plink, FTA `$2,997` plink, promo codes ON, **payment→enrollment MANUAL, no webhook** | Phase-1 attribution must survive with zero Stripe automation; webhook is Phase 2. |
| Next.js on Vercel (CLI deploys), Next API routes exist (`/api/report-card`) | Webhook + capture live as API routes. Service-role available server-side. |

Migrations are at `025`; **next free number is `026`**. New tables ship WITH RLS.

---

## 1. Referral Mechanics

### 1.1 Permanent code + share link + QR
- Every **parent** gets one **permanent, immutable** referral code at first onboarding
  (and backfilled for existing parents). Format: readable slug derived from family name +
  short random suffix, uppercase, ambiguous chars (`0/O/1/I`) stripped — e.g. `COFFIE-7K2Q`.
- Stored on a new `affiliate_accounts` row (§2.4), not on `profiles`, so tier/status/payout
  hang off it cleanly.
- **Share link** = app signup URL carrying the code:
  `https://fta-dashboard-ruddy.vercel.app/signup?ref=COFFIE-7K2Q`
  (later swap for a short branded domain). The marketing site
  (`family-trading-academy.vercel.app`) passes `?ref=` through to the app on its CTAs.
- **QR** = rendered client-side from the share link on `/referrals` (no image storage;
  a tiny inline QR lib or a data-URI generator). Downloadable as PNG + a printable one-pager.

### 1.2 Attribution flow (capture → signup → conversion)
```
click share link ?ref=CODE
      │  Next middleware sets cookie  fta_ref = CODE   (90d, SameSite=Lax, FIRST-touch:
      │  never overwrite an existing cookie → original sharer keeps credit)
      ▼
parent signs up + creates family (onboarding server action)
      │  read fta_ref → resolve CODE → referrer.  Run self-referral guard (§5).
      │  set  families.referred_by = <referrer profile id>
      │  set  families.referral_code_used = CODE
      │  insert referrals row (status='signed_up')
      │  award referrer +50 XP (signup milestone)
      ▼
referred family PAYS (FIC $99/mo or FTA $2,997)
      Phase 1: admin does the manual enrollment → same admin action flips the referral to
               'converted' and writes a PENDING commission (§2).
      Phase 2: Stripe webhook does it automatically (§1.4).
```
- **`families.referred_by`** is the denormalized first-touch pointer the task asked for; the
  `referrals` ledger is the auditable event trail. Both are written in the same transaction.
- Attribution is **locked at signup** (via `referred_by`). The eventual payment can happen
  any time later and is still credited to that referrer — no re-cookie needed at checkout.

### 1.3 Stripe payment-link attribution — recommended option
Three options were considered for tying a Stripe payment back to an affiliate:

| Option | Verdict |
|---|---|
| **Dedicated payment link per affiliate** | ✗ Impractical. Requires programmatically minting/managing dozens of links; heavy with a 2-link manual beta. |
| **Promo-code-per-affiliate** | ✗ Muddies revenue (forces a discount), needs the buyer to type a code, and promo codes are already used for beta discounts. Keep promo codes for pricing, not attribution. |
| **`client_reference_id` on the existing 2 links** | ✅ **RECOMMENDED.** Append `?client_reference_id=<CODE>` to the existing FIC/FTA plink on our own "Upgrade" button (value read from the `fta_ref` cookie / the family's `referred_by`). Zero new Stripe objects; captured automatically on the Checkout Session; visible in the Stripe dashboard payment list for **manual reconciliation today**, and consumed by the **webhook tomorrow**. |

So Phase 1 attribution backbone = **cookie → `families.referred_by`** (fully in our control,
independent of Stripe). `client_reference_id` is layered on the upgrade button as the
reconciliation/automation signal so nothing has to be re-plumbed for Phase 2.

### 1.4 Webhook design (Phase 2 — makes it automatic)
New Next API route `POST /api/stripe/webhook` (verifies signature, idempotent on `event.id`):

| Stripe event | Action |
|---|---|
| `checkout.session.completed` | Read `client_reference_id`; if absent, fall back to matching the customer's family `referred_by`. Auto-create the `enrollments` row **(this also finally kills the manual payment→enrollment step — an adjacent win beyond affiliates).** Flip referral → `converted`. Write commission (FTA bounty = one-time; FIC = seed the recurring series). Award conversion XP via SECURITY DEFINER. |
| `invoice.paid` (FIC recurring) | Append a recurring commission for that month (within the 12-mo window, §2.2), status `pending` → `approved` after the hold. |
| `charge.refunded` / `charge.dispute.created` | Clawback the matching commission (§2.3). |
| `customer.subscription.deleted` | Mark referral `churned`; stop future recurring commission. |

Idempotency table `stripe_events(event_id pk, processed_at)` guards replays.

---

## 2. Tiers, Revenue Share & Payouts

### 2.1 Tier ladder (10 / 20 / 30%)
Tier is driven **primarily by active paying referred families**, with an **XP-level
accelerator** so engaged families can climb faster:

| Tier | Rate | Qualify (either) |
|---|---|---|
| **Friend** | **10%** | Default on account creation (0–2 active paid referrals). |
| **Advocate** | **20%** | ≥3 active paid referred families **OR** parent reaches Level 5 *and* ≥1 active paid referral. |
| **Ambassador** | **30%** | ≥8 active paid referred families **OR** Level 7 "Playbook Pro" *and* ≥4 active paid referrals. |

- "Active paid referred family" = a referred family with ≥1 active `enrollments` row.
- **Sticky / no whiplash:** tier is recomputed at each monthly payout close, never demoted
  mid-period, and a **60-day grace** applies before a demotion takes effect if a referred
  family churns. Tier upgrades apply to *future* commissions (not retroactive).

### 2.2 What counts (FIC recurring vs FTA bounty)
| Program | Model | At 10 / 20 / 30% |
|---|---|---|
| **FIC $99/mo** | **Recurring share** of each successful monthly charge, per referred family, for up to **12 months** per family (revisit before making it lifetime — protects margin). | $9.90 / $19.80 / **$29.70** per month, capped 12mo (~$356/yr max per family at Ambassador). |
| **FTA $2,997** | **One-time bounty** = tier% of the sale, paid **after** the guarantee/refund window. | $299.70 / $599.40 / **$899.10** per referred FTA sale. |

- Commission is computed on **net** captured revenue (after Stripe fees + any promo discount),
  not list price, so a discounted sale pays proportionally less.
- FTA's $899 top-end bounty is generous but FTA is high-margin (digital + live cohort); the
  **guarantee-window hold + clawback (§2.3) + manual approval (§5)** cap the downside. If
  exposure feels high in beta, an interim **flat FTA bounty** (e.g. $250/$400/$600) is a
  drop-in swap of §2.2 without touching the ledger.

### 2.3 Churn / refund / dispute clawback
- **FTA bounty:** stays `pending` until the refund/guarantee window passes, then `approved`.
  Refund *before* payout → voided. Refund/dispute *after* payout → negative balance, deducted
  from the affiliate's next payout.
- **FIC recurring:** each month's commission is `pending` on charge, `approved` after a
  **~30-day hold** (covers early refunds; late disputes still trigger clawback whenever they
  land — Stripe disputes can arrive ~120 days out). Refunded/disputed month → that month's
  commission clawed back. Cancellation simply stops future accrual.
- The memory's cancel-after-cancel history is a live risk: **only ever pay on captured,
  non-refunded, non-disputed charges.** Never accrue on a scheduled/failed/uncaptured charge.

### 2.4 Payout rails — recommended
| Phase | Rail | Notes |
|---|---|---|
| **Beta (Phase 1–2)** | ✅ **Manual monthly payout run + "credit or cash" option.** Admin exports `approved` commissions per affiliate monthly, pays via Zelle/PayPal/Wise/ACH, marks `paid`. **Default = store/subscription credit** (apply commission against the affiliate's own FIC bill) → zero cash movement, keeps money in-ecosystem, ideal for a small beta with already-manual enrollment. | Min payout threshold $50 (roll under-threshold balances forward). |
| **Phase 3** | **Stripe Connect Express.** Affiliates onboard as connected accounts; automated monthly Transfers; W-9 / 1099 handling (US payees ≥$600/yr); payout-method UI. | Real cash automation + tax compliance. |

Proposed tables (design, not applied):
- `affiliate_accounts` — `owner_type` ('user' now, 'org' later — §7), `owner_id`, `family_id`,
  `code unique`, `tier`, `status` (active/paused/banned), `payout_method`, `payout_details`,
  `created_at`.
- `referrals` — `referrer_user_id`, `referred_family_id` (**unique** → one referrer per family),
  `code`, `status` (clicked/signed_up/converted/churned/disqualified), timestamps per stage.
- `referral_clicks` — lightweight click log (code, day, dedup key) for funnel counts.
- `commissions` — `referral_id`, `program`, `type` (recurring/bounty), `stripe_ref`
  (session/invoice id), `gross_cents`, `rate`, `commission_cents`, `status`
  (pending/approved/paid/clawed_back), `period`, timestamps.
- `payouts` — `affiliate_id`, `period`, `total_cents`, `method`, `status`, `paid_at`, `reference`.
- Plus `alter table families add column referred_by uuid references profiles(id)`,
  `referral_code_used text`.

---

## 3. XP Integration (virality engine)

Feeds the **existing** `xp_events` → existing level engine (`src/lib/xp.ts`, 7 levels) →
`family_xp_leaderboard`. **Parents only** (see §5 minors exclusion).

**Phase 1 avoids touching the `xp_events.kind` CHECK constraint** (additive-safe, per the
project's additive-build rule): reuse `kind='bonus'` with `ref_id='referral:<subtype>:<id>'`.
Add a proper `'referral'` kind in Phase 2 if desired.

| Trigger | XP | Anti-gaming cap |
|---|---|---|
| Share action (copy/native share) | +2 | 1/day (sharing is cheap). |
| Qualified unique click from your link | +1 | ≤10/day, once per unique referred visitor. |
| Referred **signup** (new family via your code) | **+50** | Once per referred family; voided on self-referral. |
| Referred **first payment** — FIC | **+200** | Once per referred family; server-side award. |
| Referred **first payment** — FTA | **+500** | Once per referred family; server-side award. |

- The meaningful XP is gated on **real conversions** (signup/payment) that are hard to fake and
  subject to §5 fraud controls; click/share XP is trivially small and capped. Disqualified
  referrals award **zero** XP and zero commission.
- **RLS note:** signup/share/click XP is inserted in the affiliate's own session (satisfies
  `with check user_id = auth.uid()`). **Conversion (payment) XP is inserted for the affiliate
  by an admin/webhook session → must go through a SECURITY DEFINER RPC or service role**,
  never a client insert.
- **Referral leaderboard:** new `referral_leaderboard(window)` SECURITY DEFINER RPC, mirroring
  `family_xp_leaderboard`. Ranks affiliates by **"families welcomed"** (converted count) + XP —
  **shows counts, not dollars**, so it stays wholesome and kid-safe/shareable.
- **Badges** (seed into `badges`, auto-award to `user_badges`): `first-referral` (1 signup),
  `welcoming-committee` (3 converted), `community-builder` (10 converted),
  `ambassador` (reach 30% tier).

---

## 4. Product Surfaces

### 4.1 `/referrals` page — **parent-only** (spec)
Route guard: redirect any `role IN (child)` / `age_group IN (kids,teens)` session away; only
render for `role='parent'`. Sections:
1. **Your code + share** — big code, copy-link, QR (inline-rendered + PNG download), native
   share sheet (`navigator.share`), SMS / WhatsApp / email presets, "print flyer" one-pager.
2. **Funnel stats** — clicks → signups → paid, as a 3-step funnel with counts + a 30-day
   sparkline (from `referral_clicks` + `referrals`).
3. **Earnings dashboard** — pending / approved / paid / lifetime; next payout date;
   credit-vs-cash toggle; recent commissions list.
4. **Tier progress** — current tier + rate, progress to next ("2 more paying families →
   unlock 20%"), full rate schedule.
5. **Your referrals** — list with **masked** family names (e.g. "The J. Family") + status chips
   (signed up / paid / churned), privacy-preserving.
6. **Payout settings** — method (Phase 2/3).

### 4.2 Home-page nudge
A parent-home card ("Invite a family, grow the circle → earn rewards") linking to `/referrals`.
Reuses the existing home card system. **Gated to appear after first value** (first lesson
complete or day 3) so it never front-loads the ask. Never rendered on kid/teen home.

### 4.3 Deck / community
- Orientation-deck slide ("Grow the circle — bring a family with you").
- Pinned community announcement + coach mention in a live session. Word-of-mouth between
  parents is the natural channel for a family brand — lean on it over paid.

---

## 5. Fraud / Abuse Controls & Minors Exclusion

**Fraud controls**
- **Self-referral block:** disqualify if referred family's parent email/phone matches the
  referrer, if `referred_by` resolves to the referrer's own family, or if the Stripe
  `payment_method` **fingerprint matches** between referrer and referred → auto-void commission.
- **One attribution per family:** `referrals.referred_family_id` is UNIQUE (first-touch wins).
- **Fake signups are worthless by design:** clicks/signups pay only tiny capped XP, never cash;
  **cash commission requires a real, captured, non-refunded conversion.**
- **Duplicate-family detection:** same email/phone/Stripe customer across "different" families →
  flag for review (prevents an affiliate minting fake families).
- **Manual approval gate (beta):** every commission is `pending` until admin approves at payout
  time — sufficient eyeball fraud check at small beta N.
- **Velocity/anomaly flags:** a spike of referrals from one affiliate holds the batch for review.

**Minors exclusion (hard rule)**
- Kids/teens **never** see revenue mechanics: no `/referrals` access, no code, no dollar
  figures, no commission, no payout — enforced at the **route level** (redirect) **and data
  level** (`affiliate_accounts` created only for `role='parent'`).
- Kids/teens **keep learning XP** and may see the wholesome "families welcomed" **count**
  leaderboard, but never any money surface. No financial incentive is ever offered to a minor
  (child-safety / COPPA posture). Kid/teen home surfaces carry **no** share/earn affordances.

---

## 6. Phased Build & Effort

### Phase 1 — Beta-shippable, works with manual enrollment — **effort: M (~3–5 days)**
Additive, ship-safe. No Stripe automation required.
- **DB (mig 026):** `families.referred_by` + `referral_code_used`; `affiliate_accounts`
  (auto-create per parent, permanent code + backfill existing parents); `referrals` ledger;
  `referral_clicks`. **No `xp_events` constraint change** (reuse `bonus`).
- **Capture:** Next middleware `?ref=` → `fta_ref` cookie (90d, first-touch). Onboarding
  server action writes `referred_by` + `referrals` row + self-ref guard + +50 XP.
- **Upgrade button:** append `?client_reference_id=<code>` to the FIC/FTA plinks.
- **`/referrals` page:** code, share buttons, QR, funnel stats, tier ladder (rules computed
  from current paid count), pending-earnings estimate. Parent-only guard + minors exclusion.
- **Admin:** a list view of referrals/conversions; the existing **manual enrollment step**
  gains one action — flip referral → `converted` + write a `pending` commission at the same time.
- **XP:** share/click/signup awards (client session); conversion award via a small
  SECURITY DEFINER RPC called by the admin action.
- *(Leaner "S" core if time-boxed: codes + `/referrals` + cookie→`referred_by` + manual admin
  credit; defer granular click tracking.)*

### Phase 2 — Automated webhook + payouts — **effort: M–L (~1–1.5 wk)**
- `POST /api/stripe/webhook` (§1.4): auto-enroll on payment **(removes the manual beta step)**,
  auto-convert referrals, auto-compute `commissions` (FTA bounty + FIC recurring), refund/
  dispute clawback, churn stop. `stripe_events` idempotency.
- `commissions` + `payouts` tables live; monthly tier recompute; `payouts` admin run
  (export approved → mark paid / auto-apply store credit).
- `referral_leaderboard` RPC + auto badge award. Optionally promote XP `kind='referral'`.

### Phase 3 — Stripe Connect + org composition — **effort: L (~2–3 wk)**
- Stripe Connect Express onboarding, automated Transfers/payouts, W-9/1099 tax, payout-method
  UI. Optional per-invoice revenue-share via transfers.
- **Compose with SCHOOL-ACCOUNTS/orgs** (§7).

---

## 7. Forward-compat with School Accounts / Orgs

`.planning/SCHOOL-ACCOUNTS-PLAN.md` is being drafted; keep the affiliate primitives
**entity-agnostic** so orgs slot in without a rewrite:
- `affiliate_accounts.owner_type` = `'user'` today, `'org'` later — a school/org can hold its
  own referral code, tier, and revenue-share ledger reusing the same `referrals` / `commissions`
  tables.
- Org-level overrides (custom rate, group/seat codes, org-admin dashboards) become a Phase 3
  extension, not a schema migration.
- A referred family can belong to an org *and* have an individual `referred_by`; keep both
  attributions distinct so org attribution and parent attribution never collide.

---

## 8. Open Decisions (flag before build)
1. FTA bounty: **tier% ($299–$899)** vs **flat cap ($250–$600)** — pick before Phase 1 admin credit.
2. FIC recurring window: **12-month** (recommended) vs lifetime.
3. Payout default: **store credit** (recommended for beta) vs cash-first.
4. Referral leaderboard visibility: **counts-only** (recommended, kid-safe) vs show earnings to parents only.
