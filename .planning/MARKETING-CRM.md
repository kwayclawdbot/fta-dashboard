# Marketing CRM module

A marketing system inside the admin CRM: upload contacts as leads, receive
Facebook Lead Ads, run an email/SMS pipeline with a kanban, and track who
converts vs. who goes cold. Lives under `/admin/crm/*` and reuses the existing
admin shell + security posture.

Live: https://fta-dashboard-ruddy.vercel.app
- Leads:     /admin/crm/leads
- Pipeline:  /admin/crm/pipeline   (kanban)
- Campaigns: /admin/crm/campaigns

## Security model (identical to migration 037)

All four marketing tables have **RLS enabled with zero client policies**. Nothing
reads or writes them directly from the browser. Two doors only:

1. **Admin-gated `SECURITY DEFINER` RPCs** (`admin_marketing_*`) — each calls
   `_mkt_require_admin()` which raises unless `profiles.role='admin'` for
   `auth.uid()`. The `(admin)` layout already gates the routes; the RPCs gate
   the data. Base-table RLS is never loosened.
2. **Server routes** under `/api/marketing/*` using the service role, each
   guarded by an admin-JWT check (`requireAdmin`) — except the two public
   endpoints below which authenticate by other means.

Public endpoints (no session, by design):
- `GET /api/marketing/unsubscribe?token=` — the signed HMAC token *is* the auth.
- `GET/POST /api/marketing/fb-leads` — Meta verify-token / webhook signature.

## Data model — migration `043_marketing_crm.sql`

- `marketing_leads` — email (citext), phone, first/last name, `source`
  (csv|facebook|manual|referral), `stage`
  (new|contacted|engaged|nurture|converted|cold|unsubscribed), tags[], notes,
  custom jsonb, consent_source, converted_profile_id, last_activity_at.
  Unique `(email, source)` — same email may arrive from CSV *and* Facebook, but
  never twice from one source.
- `marketing_lead_events` — lead_id, `type`
  (imported|emailed|smsed|opened|clicked|replied|stage_changed|converted), meta.
- `marketing_campaigns` — name, channel (email|sms), subject, body, segment
  jsonb ({stages, tags}), status (draft|sending|sent|failed), stats.
- `marketing_sends` — campaign_id, lead_id, status (queued|sent|failed|skipped),
  error, sent_at.

RPCs: `admin_marketing_leads`, `_lead_detail`, `_import`, `_add_lead`,
`_set_stage`, `_update_lead`, `_sync_conversions`, `_campaigns`,
`_create_campaign`, `_segment_leads`. Applied to prod (project `zvkercqohmmeyofycbgr`).

## Features

- **CSV import** (`/admin/crm/leads`) — hand-rolled RFC-4180 parser (no deps),
  column-mapping UI (email required; name/phone/tags optional), dedupe by
  email+source, import summary (imported / updated / skipped). Plus a single
  add-lead form.
- **Kanban** (`/admin/crm/pipeline`) — columns = stages
  (new→contacted→engaged→nurture→converted / cold). HTML5 draggable cards (no
  dep). Card = name/email/source/days-since + cold badge. Click → drawer with
  event timeline, notes, stage select, one-click "Convert". Stage changes log
  `stage_changed` events.
- **Conversion tracking** — `Sync conversions` (and `admin_marketing_sync_conversions`)
  matches lead emails against `profiles.email`; any match ⇒ stage `converted`,
  `converted_profile_id` set, `converted` event logged.
- **Cold detection** — a lead not converted/unsubscribed with no activity for
  21+ days is flagged `is_cold` (badge in kanban + "Cold only" filter). Move to
  cold via the drawer stage select.
- **Campaigns** (`/admin/crm/campaigns`) — build email/SMS, `{{first_name}}`
  merge, segment picker (stages + tags) with live recipient count, preview,
  then Save & dry-run or Save & send. Always excludes `unsubscribed`; records
  `marketing_sends` + `emailed`/`smsed` events.
  - **Email** via Resend. The marketing from-address is
    `hello@familyinvestingclub.com`, which is **not yet a verified Resend
    domain**, so live sends return 403 and are recorded as failed with the real
    error; the UI shows a DNS banner. The pipeline is complete and works the
    moment the domain is verified.
  - **SMS** via Twilio. This number is **shared with the Kai product's inbound
    webhook**, so UI batch SMS sends are **forced to dry-run** (server override
    `allow_live_sms:true` only). SMS copy auto-appends "Reply STOP to opt out".
    STOP handling belongs to Kai's inbound webhook on this number and is *not*
    implemented here.
  - **Unsubscribe** — every email footer carries a per-lead signed HMAC link
    (`MARKETING_TOKEN_SECRET`); visiting it flips the lead to `unsubscribed`.
- **Facebook Lead Ads** — receiving end is built and live
  (`/api/marketing/fb-leads`): GET verify-token echo, POST maps `field_data` to
  a `source='facebook'` lead. Full connect is owner-blocked (needs a Meta app +
  Page token).

## Environment

`.env.local` (local) + Vercel production:
- `MARKETING_TOKEN_SECRET` — HMAC key for unsubscribe tokens (generated).
- `FB_LEADS_VERIFY_TOKEN` — Meta webhook verify token (generated).
- `RESEND_API_KEY`, `MARKETING_FROM_EMAIL` — email sending.
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` — SMS.

## OWNER TODO (blocked items)

1. **Verify Resend domain** — add the Resend DNS records (SPF + DKIM) for
   `familyinvestingclub.com` at GoDaddy, then click Verify in the Resend
   dashboard. Until done, email campaigns record as `failed` (banner shows).
2. **Connect Facebook Lead Ads** (Meta side):
   1. Create a Meta developer app at developers.facebook.com → add the
      **Webhooks** and **Lead Ads** products.
   2. Under Webhooks → object **Page**, set:
      - Callback URL: `https://fta-dashboard-ruddy.vercel.app/api/marketing/fb-leads`
      - Verify token: value of `FB_LEADS_VERIFY_TOKEN` (shown on the Leads page
        "Connect Facebook" card, admin-only).
      - Subscribe to the **`leadgen`** field.
   3. Generate a **Page access token** for the FIC page and subscribe the page
      to the app.
   4. New Lead Ad submissions then land automatically as `source='facebook'`.
      (Production payloads that carry only a `leadgen_id` need the Page token to
      fetch full fields via the Graph API — that retrieval step is the only part
      still gated on step 3.)
3. **Dedicated marketing SMS number** (optional) — to enable live SMS blasts
   without touching Kai's shared Twilio number, provision a separate number and
   swap `TWILIO_PHONE_NUMBER`, then the `allow_live_sms` guard can be relaxed.
