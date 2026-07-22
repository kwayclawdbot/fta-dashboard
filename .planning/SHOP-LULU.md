# Shop + Lulu Print-on-Demand — Owner Setup & Ratification

The book shop is **built and live** at `/shop` (public storefront), with an admin
console at `/admin/shop`. Purchases go through Stripe (same live account as
memberships) and are recorded as orders. Fulfillment to Lulu is **coded and wired
but intentionally dormant** until you complete the steps below — until then, every
paid order lands with a clear **"awaiting fulfillment setup"** banner in the admin
so nothing is silently lost.

---

## 1. Ratify the draft prices  ⚠ REQUIRED

Prices below were seeded as **placeholders**. Confirm or change each in
`/admin/shop` → edit product. (Lulu charges a per-book print + ship cost; set
retail so margin survives shipping.)

| Product | Kind | Audience | DRAFT price | Notes |
|---|---|---|---|---|
| Cheat Code Guide to Stocks | Textbook | Adults | **$49** | flagship, ~194pp |
| Cheat Code Guide to Money — Kids Edition | Guidebook | Kids | **$29** | ~88pp, 8.5×8.5 |
| Foundations of Investing — Teen Workbook | Workbook | Teens | **$24** | ~96pp |
| The Family Investing Workbook | Workbook | Family | **$24** | ~80pp |
| Lesson Plans — Parent Pack | Lesson Plans | Family | **$39** | ~120pp |
| Parent & Teacher Guide | Teacher Guide | Adults | **$34** | ~100pp |
| The Kids Bundle | Bundle | Kids | **$69** | vs $92 — save $23 |
| The Adults Bundle | Bundle | Adults | **$89** | vs $107 — save $18 |
| The Full Family Set | Bundle | Family | **$139** | vs $199 — save $60 |

Bundle contents:
- **Kids Bundle** = Kids Guidebook + Family Workbook + Lesson Plans
- **Adults Bundle** = Stocks Textbook + Family Workbook + Parent-Teacher Guide
- **Full Family Set** = all six individual titles

---

## 2. Lulu developer account + credentials  ⚠ REQUIRED for fulfillment

1. Create a Lulu developer account at **https://developers.lulu.com** (start on the
   **sandbox** — the shop is already pointed there).
2. In the developer dashboard, create an **API client** → copy the **Client Key**
   and **Client Secret**.
3. Add a **payment method** to the Lulu account (production orders won't print
   without one).
4. Set these Vercel **production** env vars (Project → Settings → Environment
   Variables), then redeploy:
   - `LULU_CLIENT_KEY` = your client key
   - `LULU_CLIENT_SECRET` = your client secret
   - `LULU_API_BASE` = `https://api.sandbox.lulu.com` while testing → switch to
     `https://api.lulu.com` when you go live with production creds + payment.

Until `LULU_CLIENT_KEY` / `LULU_CLIENT_SECRET` are present, orders stay at status
`paid` with error `awaiting_fulfillment_setup`.

---

## 3. Per-book print files + pod_package_id  ⚠ REQUIRED per title

For **each non-bundle** product (bundles inherit their members' files), in
`/admin/shop` → edit product:

1. **Interior PDF** — upload the print-ready interior (goes to the private
   `print-files` bucket). Must match the trim size of your pod_package_id.
2. **Cover PDF** — upload the print-ready wrap cover (spine width depends on page
   count — generate it from Lulu's cover template for that trim + page count).
3. **pod_package_id** — Lulu's SKU string encoding trim + color + binding + paper +
   finish. Example: `0600X0900BWSTDPB060UW444MXX`
   = **6×9**, **B&W**, **standard**, **paperback**, **60# white** interior, matte.
   Get the exact string for each trim from Lulu's pricing/POD package reference
   (developers.lulu.com → print job / pricing docs).

The admin product table shows a **"Ready"** vs **"Needs setup"** flag per book so
you can see at a glance what's fulfillable.

---

## 4. Real cover art  (recommended)

Covers currently use branded **SVG placeholders** (`/public/shop/*.svg`). Upload
real cover images per product in `/admin/shop` (stored in the public
`community-media` bucket under `shop/`). These are the storefront thumbnails —
separate from the print-ready **Cover PDF** in step 3.

---

## 5. What's already done (no action needed)

- **DB**: migrations `065` (schema + RLS + private `print-files` bucket) and `066`
  (catalog seed) applied to the FTA Supabase project.
- **Stripe**: shop webhook endpoint registered on the live account —
  `id = we_1Tw2N3F7Tbc3pSvJCQMsTcmc`, event `checkout.session.completed`, URL
  `/api/shop/webhook`. Signing secret stored as `SHOP_STRIPE_WEBHOOK_SECRET`
  (Vercel prod + local). `STRIPE_SECRET_KEY` set on Vercel prod.
- **Guard**: the membership webhook now ignores `metadata.kind==='shop'` sessions,
  so book purchases never create a bogus FIC/FTA membership.
- **Fulfillment**: on a paid shop order the webhook inserts the order (idempotent
  on `stripe_session_id`) and attempts Lulu submission, degrading gracefully to
  `awaiting_fulfillment_setup` when creds/PDFs are missing. Admin has **Submit to
  Lulu** (retry) and **Sync** (status → in_production / shipped + tracking).

## Go-live checklist
- [ ] Ratify / adjust all 9 prices
- [ ] Create Lulu account, add payment method, get client key + secret
- [ ] Set `LULU_CLIENT_KEY` / `LULU_CLIENT_SECRET` / `LULU_API_BASE` on Vercel
- [ ] Per title: upload interior PDF, cover PDF, set pod_package_id
- [ ] Upload real cover art per product
- [ ] Place one sandbox test order end-to-end, confirm it reaches Lulu
- [ ] Flip `LULU_API_BASE` to `https://api.lulu.com` and redeploy
