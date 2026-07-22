# Domain Cutover Runbook — app.familyinvestingclub.com

Goal: `fta-dashboard-ruddy.vercel.app` disappears as a user-facing URL.
Primary URLs after cutover:
- Marketing (apex): `https://familyinvestingclub.com` — ALREADY live (Vercel project `fic-marketing`)
- App: `https://app.familyinvestingclub.com` — Vercel project `fta-dashboard`

Prepared 2026-07-22. Code is shipped and INERT until the env vars in step (c) are set.

---

## State verified at prep time (2026-07-22)

- `app.familyinvestingclub.com` **is attached** to Vercel project `fta-dashboard`
  (team `kways-clawds-projects`, project `prj_yS8ILWi6zivq5MnZ0mhShdbSm6sN`,
  team `team_HdJPSayY9d5So2dieJwtaiB7`). Attached via API during prep; Vercel
  reports it verified at the project level — it only needs DNS to point at it.
- DNS: `app.familyinvestingclub.com` has **NO** CNAME/A record yet (owner must add).
- Vercel envs `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_CANONICAL_HOST` are **NOT set**
  (correct — do not set until DNS is live, or auth callbacks break).
- Supabase (project `zvkercqohmmeyofycbgr` = "FTA") Auth Site URL still `http://localhost:3000`.
- Push-dispatch URL is **hardcoded in a Postgres function**, not a Vault secret.
  Only Vault secret present is `push_dispatch_secret`. Live function
  `public.dispatch_push_notification()` posts to
  `https://fta-dashboard-ruddy.vercel.app/api/push/dispatch`.

## Code already shipped (inert)

- `src/lib/site-url.ts` — single source of truth, reads `NEXT_PUBLIC_SITE_URL`,
  falls back to `window.location.origin`, then to the ruddy URL. Unchanged.
- `src/middleware.ts` — env-gated 308 host-canonicalization: if request host is
  `fta-dashboard-ruddy.vercel.app` AND `NEXT_PUBLIC_CANONICAL_HOST` is set,
  308-redirects to the same path on the canonical host. Inert until env set.
- `src/app/api/push/dispatch/route.ts` — VAPID subject now uses `siteUrl()`
  instead of the hardcoded ruddy URL.
- Note: `src/lib/server/membership.ts:16` still has a ruddy fallback but is
  another agent's WIP — left untouched; it reads `NEXT_PUBLIC_SITE_URL` first so
  it self-corrects once env (step c) is set.

---

## FLIP RUNBOOK — do in order

### (a) OWNER ONLY — GoDaddy DNS
Add a CNAME record in GoDaddy for `familyinvestingclub.com`:
- Type: `CNAME`
- Name/Host: `app`
- Value/Points to: `cname.vercel-dns.com`
- TTL: default (600s / 1 hour)

(Vercel also accepts `A app 76.76.21.21`; CNAME to `cname.vercel-dns.com` is preferred.)

Verify propagation:
```
dig @8.8.8.8 +short app.familyinvestingclub.com CNAME
dig @8.8.8.8 +short app.familyinvestingclub.com A
```
Then confirm the app serves: open `https://app.familyinvestingclub.com/login`.

### (b) OWNER ONLY — Supabase Auth URL config
Dashboard → project **FTA** (`zvkercqohmmeyofycbgr`) → Authentication → URL Configuration:
- **Site URL**: `https://app.familyinvestingclub.com`
- **Redirect URLs** (keep all three during transition):
  - `https://app.familyinvestingclub.com/**`
  - `https://fta-dashboard-ruddy.vercel.app/**`  (keep during transition; remove later)
  - `http://localhost:3000/**`  (keep for local dev)

### (c) Vercel envs + redeploy  (agent can do)
Set Production env vars on `fta-dashboard` and redeploy:
```
cd /Users/kwaysclawd/projects/fta-dashboard
printf 'https://app.familyinvestingclub.com' | vercel env add NEXT_PUBLIC_SITE_URL production
printf 'app.familyinvestingclub.com'         | vercel env add NEXT_PUBLIC_CANONICAL_HOST production
vercel --prod --yes            # redeploy so the new env is baked in
```
(If a var already exists, `vercel env rm <NAME> production --yes` first, then re-add.)
After this, hitting the ruddy host 308-redirects to the app host, and all
auth/email links resolve to `app.familyinvestingclub.com`.

### (d) Swap marketing login links  (agent can do)
In `/Users/kwaysclawd/projects/fic-marketing/index.html`, replace all
`fta-dashboard-ruddy.vercel.app` → `app.familyinvestingclub.com`
(3 occurrences: two `/login` CTAs + one lesson `<iframe src>`), then:
```
cd /Users/kwaysclawd/projects/fic-marketing
vercel deploy --prod --yes
```

### (e) Update Stripe webhook  (agent can do)
Webhook `we_1Tw0ZeF7Tbc3pSvJf6DsbgMb` → URL
`https://app.familyinvestingclub.com/api/stripe/webhook`.
`STRIPE_SECRET_KEY` lives in `/Users/kwaysclawd/breakout-alert-system/.env`.
```
SK=$(grep -E '^STRIPE_SECRET_KEY=' /Users/kwaysclawd/breakout-alert-system/.env | cut -d= -f2-)
curl -s https://api.stripe.com/v1/webhook_endpoints/we_1Tw0ZeF7Tbc3pSvJf6DsbgMb \
  -u "$SK:" \
  -d "url=https://app.familyinvestingclub.com/api/stripe/webhook"
```
Verify: response `url` field shows the app domain. (Signing secret `whsec_…` is
unchanged by a URL update, so no env change needed.)

### (f) Update Supabase push-dispatch URL  (agent can do)
The URL is **hardcoded in the trigger function**, not a Vault secret. Swap it
with CREATE OR REPLACE (the trigger `trg_notification_push_dispatch` persists —
do not recreate it). Run against project `zvkercqohmmeyofycbgr`:
```sql
create or replace function public.dispatch_push_notification()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_secret text;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets where name = 'push_dispatch_secret' limit 1;
  if v_secret is null then return new; end if;
  perform net.http_post(
    url := 'https://app.familyinvestingclub.com/api/push/dispatch',
    body := to_jsonb(new),
    headers := jsonb_build_object(
      'Content-Type','application/json','x-push-secret', v_secret),
    timeout_milliseconds := 5000
  );
  return new;
exception when others then return new; end;
$$;
```
Verify:
```sql
select substring(pg_get_functiondef('public.dispatch_push_notification'::regproc)
  from 'url := ''([^'']+)''') as dispatch_url;
```
Expect `https://app.familyinvestingclub.com/api/push/dispatch`.

### (g) E2E verification on the new domain
- `https://app.familyinvestingclub.com/login` serves the app (not a 404/redirect loop).
- Sign up a throwaway → confirmation email link points to app domain and lands on `/auth/callback`.
- Log in → reaches `/dashboard`.
- Invite flow email link points to app domain.
- Stripe: trigger a test event or a real checkout → webhook delivers 200 to app domain.
- Old host: `https://fta-dashboard-ruddy.vercel.app/login` 308-redirects to app host.

### Post-transition cleanup (days later, once stable)
- Remove `https://fta-dashboard-ruddy.vercel.app/**` from Supabase Redirect URLs.
- (Optional) keep the ruddy 308 redirect indefinitely — harmless.

---

## OWNER-ONLY ACTIONS (blocking) — the 2 things only the owner can do
1. **GoDaddy DNS** — add CNAME: name `app`, value `cname.vercel-dns.com` (step a).
2. **Supabase Auth URL config** — Site URL + Redirect URLs (step b).

## Billing note
Vercel Hobby prohibits commercial use. Upgrade `fta-dashboard` (and `fic-marketing`)
to Pro ($20/mo/member) before charging members.
