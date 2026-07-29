# Membership-gating flow — IN-PROGRESS handoff (2026-07-22)

Owner flow: marketing → Stripe purchase → buyer gets create-account email; NO public self-serve signup; admin can invite members directly (bypass Stripe) for FIC or FTA. Session hit subagent cap mid-build; owner restarting CLI with CLAUDE_CODE_MAX_SUBAGENTS_PER_SESSION raised. FIRST ACTION after restart: spawn Opus agent to finish (full agent prompt already drafted in the 07-22 transcript; essentials below).

## DONE (verify, don't redo)
- Migration 042 APPLIED to prod via MCP (stub file supabase/migrations/042_pending_memberships.sql): `pending_memberships` (email, program fic|fta, source stripe|admin, stripe_session, invited_by, claimed_at; RLS on, NO client policies) + `claim_pending_membership(p_family_id)` SECURITY DEFINER → creates enrollment for caller's email's latest unclaimed row, marks claimed; granted to authenticated.
- UNCOMMITTED working-tree files in ~/projects/fta-dashboard (all written, build NOT yet run):
  - src/lib/server/membership.ts — serviceClient() + provisionMembership(): pending row insert; new user → auth.admin.inviteUserByEmail(redirectTo ${SITE}/auth/callback?next=/onboarding); existing user w/ family → immediate enrollment + claim; existing w/o family → pending (claims at onboarding). Uses listUsers(perPage:1000) to find users — beta-scale TODO.
  - src/app/api/admin/invite/route.ts — POST {email, program}; Bearer JWT → service client getUser → profiles.role==='admin' gate → provisionMembership(source admin).
  - src/app/api/stripe/webhook/route.ts — manual signature verify (t/v1 HMAC-SHA256 of `${t}.${payload}`, 10-min tolerance, timingSafeEqual); checkout.session.completed → email from customer_details; program = amount_total>=100000 ? fta : fic; provision(source stripe).
  - src/app/(auth)/login/page.tsx — Sign-up link replaced w/ "New here? Join the club" → familyinvestingclub.com.
  - src/app/(auth)/signup/page.tsx — server redirect() to familyinvestingclub.com (family invite flow /signup/invite/[code] untouched — must keep working).
  - src/app/(auth)/onboarding/page.tsx — after family insert + profile update: supabase.rpc("claim_pending_membership", {p_family_id: fam.id}).
  - src/app/(admin)/admin/users/page.tsx — "+ Invite member" button + modal (email + FIC/FTA) → POST /api/admin/invite w/ session access token. (useState/createClient already imported in that file.)
- Stripe webhook endpoint CREATED on live account algo.cheatcode (acct_1O1BkLF7Tbc3pSvJ) via sk from ~/breakout-alert-system/.env: id `we_1Tw0ZeF7Tbc3pSvJf6DsbgMb`, url https://fta-dashboard-ruddy.vercel.app/api/stripe/webhook, event checkout.session.completed. SIGNING SECRET (not yet stored anywhere else): `whsec_yftUIs8xh9sx07Q0u2c2uh68jxI4FeNq`

## REMAINING (the finishing agent's job)
1. STRIPE_WEBHOOK_SECRET → .env.local + Vercel production env (vercel CLI authed as kwayclawdbot-7301; repo dir linked). NEVER commit the secret.
2. Marketing nav swap ~/projects/fic-marketing/index.html: `<a class="cta" href="https://fta-dashboard-ruddy.vercel.app/signup">Sign up</a>` → `<a class="cta" href="https://buy.stripe.com/6oUaEX5J1bxP50E9lpbEA0a">Join FIC</a>` (keep Log in + footer Member login). Deploy fic-marketing project (`vercel deploy --prod --yes`), verify live on familyinvestingclub.com.
3. npm run build green → commit narrowly (listed files + migration stub; stash .planning/CREDIT-LOG.md if dirty; never .env.local) → pull-rebase → push → Vercel deploy.
4. E2E on live prod (service key in .env.local; run node from repo dir; playwright at /Users/kwaysclawd/.nvm/versions/node/v25.6.0/lib/node_modules/playwright/index.mjs):
   a. /login has no Sign-up link + has Join-the-club; /signup redirects to marketing; /signup/invite/CODE still renders.
   b. Admin invite: disposable admin → POST /api/admin/invite (program fta) → {ok, mode:'invited'} + pending row + invited auth user; then create family+profile for invitee, sign in as invitee (anon key + password set via admin), call claim RPC → returns 'fta', enrollment exists, claimed_at set.
   c. Webhook: hand-signed POST (payload {type:'checkout.session.completed', data:{object:{id:'cs_test_e2e', amount_total:9900, customer_details:{email:'stripe-e2e@ftamarketing.test'}}}}) → 200 {received:true} + fic/stripe pending row + invited user; bad signature → 400.
   d. CLEAN all disposables (auth users, pending rows, enrollments, profiles, families) — zero residue.
5. SMS owner (~/breakout-alert-system/.env Twilio → +17038630655): flow live + ⚠️ BLOCKER: Supabase Site URL STILL http://localhost:3000 (re-verified 07-22 via generateLink) — ALL invite/create-account emails link to localhost until owner sets Supabase Dashboard → Auth → URL Configuration: Site URL https://app.familyinvestingclub.com (or ruddy until CNAME lands) + Redirect URLs https://app.familyinvestingclub.com/** and https://fta-dashboard-ruddy.vercel.app/**.

## Related owner-pending (unchanged)
GoDaddy: CNAME app→cname.vercel-dns.com · Resend domain DNS verify (resend key = send-only, in ~/breakout-alert-system/.env; account has ZERO verified domains — tested 07-21) · schools@ mailbox forward · Vercel Pro upgrade · schools pricing ratify · avatar direction pick (The Firm rec) · W2 lessons review · Guide Ch3 verdict.
