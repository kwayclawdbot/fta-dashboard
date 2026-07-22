# Profile-Building Onboarding

Warm, multi-step onboarding that asks who a FIC family is (household, experience,
goals) — both to **understand** them (CRM) and to make the platform feel **built
for them** (personalized welcome + a dashboard "recommended next" card whose picks
map directly to their answers).

## Migration

`supabase/migrations/075_family_profiles.sql` (applied to project `zvkercqohmmeyofycbgr` / FTA)

- **`family_profiles`** — one row per family (`family_id` PK → `families`, `on delete cascade`).
  - `household jsonb` — `{ adults:int, kids:int, kid_age_ranges:text[] }` (bands: `under5 | 5-8 | 9-12 | 13-17`)
  - `experience text` — CHECK in (`none`, `beginner`, `some`, `active`)
  - `goals text[]` — `teach_kids | family_habit | build_wealth | learn_trading | prep_college | other`
  - `goals_other text`, `hear_about text`, `motivation text`
  - `completed_at timestamptz` — stamped **only** when the parent finishes (partial writes before that)
  - `updated_at timestamptz`
- **RLS (own-row)** — a parent reads/writes only their own family's row (`family_id = get_my_family_id() and get_my_role() = 'parent'`); kids never see it. Admins read any via the definer RPC below (also allowed on the SELECT policy). Helpers `get_my_family_id()/get_my_role()/is_admin()` from migration 039.
- **`admin_family_profile(family_id uuid) → jsonb`** — SECURITY DEFINER, admin-only (mirrors `admin_family_detail` in 037). Returns the row as jsonb or `null`.
- **`onboard_create_family(p_name, p_display_name, p_avatar_url) → uuid`** — SECURITY DEFINER. Creates the family, links the caller's profile (`role=parent`, `onboarding_complete=true`), and calls `claim_pending_membership` — all in one `auth.uid()` context. Idempotent (returns the existing family on retry).
  - **Fixes a pre-existing latent bug**: the original client-side `families.insert().select()` hit PostgREST's RETURNING-select RLS trap — the families SELECT policy (`id IN (my family_ids)`) rejects re-reading the new row before the profile is linked, so UI family creation 403'd with "new row violates row-level security policy". Only the service-role funnel path could create families. Verified live: `return=minimal` inserts succeed, `.select()` 403s; the RPC path works end to end.

## CRM wiring — TODO for the CRM lane / follow-up

The admin member/family detail pages (`/admin/crm/*`) are owned by the CRM lane and
were **not** edited here. To surface household / experience / goals there, call the
ready-made RPC:

```ts
const { data } = await supabase.rpc("admin_family_profile", { p_family_id: familyId });
// data => family_profiles row as jsonb, or null if the family hasn't filled it in
```

Render `household.adults/kids/kid_age_ranges`, `experience`, `goals[]` (+ `goals_other`),
`hear_about`, `motivation`. No table grant needed — the definer RPC gates on admin role.

## Files

| File | Role |
| --- | --- |
| `src/lib/onboarding-profile.ts` | Types, step copy, quiz→profile prefill, `deriveRecommendations` (pure), `composeWelcome`, fetch/save helpers. **Single source of truth** for recs so welcome + home card never drift. |
| `src/components/onboarding/ProfileSteps.tsx` | Reusable step screens: `HouseholdStep`, `ExperienceStep`, `GoalsStep`, `HearAboutStep`, `PersonalizedWelcome`. |
| `src/app/(auth)/onboarding/page.tsx` | Main onboarding — existing family/username/avatar + membership-claim flow **preserved**, profile steps added. |
| `src/app/(auth)/onboarding/profile/page.tsx` | Standalone backfill flow ("Tell us about your family"). |
| `src/components/dashboard/FamilyProfileHome.tsx` | Home card — backfill prompt (dismissible) or recommended-next. |
| `src/app/(dashboard)/dashboard/page.tsx` | Renders `<FamilyProfileHome>` for parents with a family. |

## Flow map

**New parent (main onboarding, `/onboarding`)**
```
0 Family name ─▶ 1 You (username + avatar)
                     │  Continue ⇒ establishFamily():
                     │    • create family  • update profile (onboarding_complete = TRUE)
                     │    • claim_pending_membership   ← membership activates HERE, never blocked
                     ▼
2 Household ─▶ 3 Experience ─▶ 4 Goals ─▶ 5 Found us     (each SKIPPABLE — "I'll do this later")
   └─ every advance upserts PARTIAL family_profiles ─┘
                     ▼
6 Personalized Welcome  (upsert with completed_at = now) ─▶ "Go to my dashboard"
```
- A parent who already has a family (resume / re-entry) is detected and jumps straight to step 2 — **never creates a second family**.
- Funnel users (`onboarding_complete = true` at registration) skip `/onboarding` entirely — that path is untouched.

**Existing family (backfill, `/onboarding/profile`)**
```
Household ─▶ Experience ─▶ Goals ─▶ Found us ─▶ Welcome ─▶ dashboard
(prefilled from existing family_profiles, else from free_class quiz)
```

**Dashboard home (`FamilyProfileHome`, parents only, self-contained)**
```
no completed profile  → dismissible "Tell us about your family" card → /onboarding/profile
completed < 7 days ago → "Recommended for your family" card (deriveRecommendations)
otherwise             → null
```

## Personalization mapping

**Prefill from the free-class funnel quiz** (`draftFromQuiz`, migration 060 quiz jsonb) — never re-ask what we know:

| Quiz field | Value | → Profile |
| --- | --- | --- |
| `experience` | `beginner` / `some` / `investing` | `experience` = `beginner` / `some` / `active` |
| `goal` | `kids_money` | `goals` = `[teach_kids]` |
| `goal` | `family_habit` | `goals` = `[family_habit]` |
| `goal` | `learn_myself` | `goals` = `[learn_trading]` |
| `goal` | `all` | `goals` = `[teach_kids, family_habit, build_wealth]` |
| `ages` | `young`/`teens`/`mixed`/`adults` | seeds `household.kids` + `kid_age_ranges` |

**Answers → recommended actions** (`deriveRecommendations`, ordered most-personal-first, capped at 3):

| Answer | Recommendation (href) |
| --- | --- |
| kids in household | Kid Missions (`/missions`) |
| experience `none`/`beginner` | Start Here — Lesson 1 (`/start-here`) |
| experience `some`/`active` | Build your Watchlist (`/watchlist`) + Practice Chart (`/simulator`) |
| goal `teach_kids` | Parent Corner (`/parent-corner`) |
| kids OR goal `family_habit` | This Week in FIC — together (`/dashboard?tab=this-week`) |
| (fallback) | Browse the courses (`/courses`) |

**Answers → welcome copy** (`composeWelcome`): "Welcome, The Osei family" + lines like
"2 kids learning alongside you" / "Starting from the very beginning — perfect." /
"You already invest — let's bring the family in."

## Regression safety

- `establishFamily()` performs the same three outcomes as the original `completeParent()` (create family, link profile, claim membership) via the `onboard_create_family` RPC — moved earlier (after the You step) so the paid membership is claimed **before** any optional step and can never be blocked by them. This also fixes the latent RLS bug that prevented UI family creation.
- Child flow (name / age / avatar) unchanged.
- Funnel users' `onboarding_complete = true` fast-path unchanged — they never hit `/onboarding`.

## Live verification (Playwright, fta-dashboard-ruddy.vercel.app)

| Scenario | Result |
| --- | --- |
| Fresh parent, FULL onboarding (desktop + 390) | Family created via RPC · welcome "Welcome, The Osei family / 2 kids learning alongside you / Starting from the very beginning — perfect. / Here to raise money-smart kids." · recs Kid Missions + Start Here + Parent Corner · dashboard recommend card present · `family_profiles` = `{household:{kids:2,adults:1,[5-8,13-17]}, experience:none, goals:[teach_kids,build_wealth], hear_about:null (skipped), completed}` ✓ |
| Skip a step | Hear-about skipped via "I'll do this later" → `hear_about` null, partial data still persisted ✓ |
| Existing family, no profile → backfill | Backfill card shown → standalone flow completed → card replaced by recommend card · `family_profiles` correct ✓ |
| Claim pending membership through onboarding | Pending **fta** row → after onboarding: enrollment `fta/active`, `family_tiers.tier=fta`, `pending_memberships.claimed_at` set ✓ |

Screenshots (desktop + 390 each step; welcome in light + dark) in the run artifacts. All disposable users/families/pending rows cleaned after.
