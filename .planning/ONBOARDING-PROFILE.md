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

- `establishFamily()` keeps the exact family-insert + profile-update + `claim_pending_membership` calls from the original `completeParent()` — just moved earlier (after the You step) so the paid membership is claimed **before** any optional step and can never be blocked by them.
- Child flow (name / age / avatar) unchanged.
- Funnel users' `onboarding_complete = true` fast-path unchanged — they never hit `/onboarding`.
