# Free-Class Funnel — Audit (2026-07-22)

Live: https://fta-dashboard-ruddy.vercel.app/free-class · Playwright @ 390px.

## What exists today (single file: `src/app/free-class/page.tsx`, 644 lines)

A single client component that swaps `step` state (0=hook, 1–3=quiz, 4=register)
with framer-motion, plus a Confirmation/hub view. Two API routes:
`GET /api/free-class/next` (next class + video url) and
`POST /api/free-class/register` (creates FREE user + family + enrollment + RSVP +
`free_class_registrations` row + best-effort `marketing_leads` mirror). Migration
060 adds the `free` tier, `free_class` class_type, `app_settings`, and
`free_class_registrations`.

## KEEP — these work and must survive the rebuild
- **Instant account creation, no email dependency.** `auth.admin.createUser` with
  `email_confirm: true` → client `signInWithPassword` immediately. No Resend
  round-trip. Correct given the rate-limited mailer.
- **Family + FREE enrollment + tier derivation** via `family_tiers` view.
- **RSVP wiring** to the next `free_class` `live_sessions` row.
- **ICS builder** (`src/lib/free-class.ts`, dependency-free) + confirmation card.
- **Confirmation experience**: class card, Add-to-calendar, video, Join-FIC CTA
  ($99/mo), "Explore the app free". Warm-paper premium register, adult-first.
- **Live data**: 1 upcoming class ("Free Class — Raising Investors, Not
  Spenders", Wed Jul 29 · 7:00 PM). Placeholder walkthrough video seeded.

## WEAK vs high-converting quiz-funnel practice — VERIFIED
| Gap | Verified? | Evidence |
|---|---|---|
| Single-page = no per-step routes / deep-links | ✅ true | URL stays `/free-class` through hook→q1→q2 in Playwright; no `/q/[n]` routes exist. |
| No per-step tracking / analytics | ✅ true | No events table, no logging. Only a terminal `free_class_registrations` row on full completion (currently **0 rows**). Everything before "submit" is invisible. |
| No partial-lead capture | ✅ true | Email is only sent at the FINAL register submit, bundled with password. A visitor who quizzes + gives email but doesn't finish leaves **zero trace**. `marketing_leads` mirror only fires on full success. |
| No UTM / source attribution | ✅ true | Nothing reads `utm_*` or `referrer`. `free_class_registrations.source` is hardcoded `'funnel'`. 244 existing leads are all `csv`/`manual`. |
| No personalized result step | ✅ true | Quiz answers are collected but never reflected back; they go straight into a jsonb blob. No "based on your answers…" moment. |
| No urgency / social proof | ✅ true | No seat count, no "X families registered". Only a static class-date chip. |
| No reminder capture as its own step | ⚠️ partial | Phone field exists (optional) but buried in the register form; no SMS opt-in, no standalone reminder ask. |
| No email capture BEFORE password | ✅ true | Email + password are one gated step — highest-friction placement, worst for lead capture. |
| No exit-intent | ✅ true | None. |
| Not resumable | ✅ true | State is in-memory React; refresh at q2 → back to hook. |

## Rebuild target (migrations 070–074 mine)
Multi-page routes (`/free-class` hook → `/q/[step]` → `/save` email → `/result`
→ `/register` → `/confirmed`), a resumable `funnel_sessions` + `funnel_events`
server model, UTM capture, partial-lead sweep into `marketing_leads`
(source `free_class`), honest urgency + social proof, exit-intent on the email
step, and an admin `/admin/crm/funnel` analytics page. KEEP-list above is reused
verbatim (confirmation component + register API extended, not rewritten).
