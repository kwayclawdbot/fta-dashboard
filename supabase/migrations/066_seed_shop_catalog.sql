-- ============================================================================
-- 066 — Seed the shop catalog: 6 individual titles + 3 bundles.
--
-- ⚠ DRAFT PRICES — owner ratification required before promoting the shop.
-- Prices below are placeholders chosen to sit sensibly against Lulu print cost
-- + margin; the owner must confirm each in .planning/SHOP-LULU.md.
--
-- Products seed ACTIVE so the storefront renders end-to-end, but they carry NO
-- lulu_pod_package_id / interior_pdf_path / cover_pdf_path yet — so any purchase
-- lands as an order flagged 'awaiting_fulfillment_setup' until the owner uploads
-- real print PDFs and sets each pod_package_id. Cover art is a branded SVG
-- placeholder (public/shop/*.svg); owner to supply real cover art.
--
-- Idempotent: ON CONFLICT (slug) upserts, so re-running is safe.
-- ============================================================================

insert into public.shop_products
  (slug, title, subtitle, description, audience, kind, price_cents, compare_at_cents, cover_image_path, page_count, active, sort)
values
  ('cheat-code-guide-to-stocks',
   'Cheat Code Guide to Stocks',
   'The adult textbook — stocks for people who think stocks are boring',
   E'The grown-up starting line for stock investing: honest, occasionally funny, and completely free of suit-and-tie jargon. It walks a total beginner from "what even is a stock" to reading a real company like an owner, one plain-English chapter at a time.\n- What a share actually is, in pizza-slice terms\n- How to read a company before you buy a piece of it\n- Risk, diversification, and the mistakes that quietly cost people money\n- The five House Rules that keep an account from blowing up',
   'adults', 'textbook', 4900, null, '/shop/cheat-code-guide-to-stocks.svg', 194, true, 10),

  ('money-kids-edition',
   'Cheat Code Guide to Money — Kids Edition',
   'The kids guidebook — a money adventure for ages 8–12',
   E'A read-with-your-kid money adventure about pizza, piggy banks, and growing a money tree. It turns earning, saving, and owning-a-slice into a story an 8–12 year-old actually wants to finish.\n- Where money comes from and the four ways to make it\n- Saving vs. spending, told as a tug-of-war\n- The big idea of owning a slice of a company\n- Read-together prompts on every spread',
   'kids', 'guidebook', 2900, null, '/shop/money-kids-edition.svg', 88, true, 20),

  ('foundations-teen-workbook',
   'Foundations of Investing — Teen Workbook',
   'The teens workbook — learn by doing, not by lecture',
   E'A do-it-yourself workbook for teens who learn by doing. Every concept comes with a fill-in exercise, so "I get it" turns into "I can do it" — built to sit alongside the Foundations curriculum (Grades 6–10).\n- Guided exercises for budgeting, saving, and first investments\n- Real-company research worksheets\n- Goal-setting and habit trackers\n- Answer keys for self-checking',
   'teens', 'workbook', 2400, null, '/shop/foundations-teen-workbook.svg', 96, true, 30),

  ('family-investing-workbook',
   'The Family Investing Workbook',
   'The family workbook — one page a week, together',
   E'The shared notebook for your weekly family investing club. One page a week, done together at the kitchen table: a company to study, a concept to learn, and a decision to make as a team.\n- 52 weekly one-page sessions\n- Company-of-the-week study sheets\n- Family watchlist and decision log\n- Kid and parent prompts side by side',
   'family', 'workbook', 2400, null, '/shop/family-investing-workbook.svg', 80, true, 40),

  ('lesson-plans-parent-pack',
   'Lesson Plans — Parent Pack',
   'The parent lesson plans — teach it yourself, no degree required',
   E'The teach-it-yourself kit for parents who want structure without a teaching degree. Ready-to-run lesson plans with objectives, scripts, and activities — open the page, follow along, done.\n- Sequenced lesson plans with clear objectives\n- Word-for-word discussion scripts\n- Hands-on activities and games\n- Printable handouts and checklists',
   'family', 'lesson_plans', 3900, null, '/shop/lesson-plans-parent-pack.svg', 120, true, 50),

  ('parent-teacher-guide',
   'Parent & Teacher Guide',
   'The coaching manual — never get stumped in front of the room',
   E'The confidence manual for the adult in the room. It gives parents and teachers the background, answers, and coaching moves to lead every lesson without ever getting stumped.\n- Plain-English background on every concept\n- Common kid questions, with answers\n- Coaching moves and discussion facilitation\n- How to adapt each lesson by age',
   'adults', 'teacher_guide', 3400, null, '/shop/parent-teacher-guide.svg', 100, true, 60),

  ('kids-bundle',
   'The Kids Bundle',
   'Guidebook + Family Workbook + Lesson Plans',
   E'Everything a family needs to start teaching a younger kid: the story-driven guidebook, the hands-on family workbook, and the parent lesson plans — together as a set that saves versus buying each on its own.',
   'kids', 'bundle', 6900, 9200, '/shop/kids-bundle.svg', null, true, 100),

  ('adults-bundle',
   'The Adults Bundle',
   'Stocks Textbook + Family Workbook + Teacher Guide',
   E'The adult self-starter set: the flagship stocks textbook, the family workbook to practice with, and the parent-teacher guide to lead the room — the fastest way from zero to confidently coaching your household.',
   'adults', 'bundle', 8900, 10700, '/shop/adults-bundle.svg', null, true, 110),

  ('full-family-set',
   'The Full Family Set',
   'The whole shelf — every book in the line',
   E'The whole shelf. Every book in the Cheat Code Guides line — the adult stocks textbook, the kids guidebook, both workbooks, the parent lesson plans, and the parent-teacher guide — one matching set for the entire family, at the biggest saving we offer.',
   'family', 'bundle', 13900, 19900, '/shop/full-family-set.svg', null, true, 120)
on conflict (slug) do update set
  title            = excluded.title,
  subtitle         = excluded.subtitle,
  description      = excluded.description,
  audience         = excluded.audience,
  kind             = excluded.kind,
  price_cents      = excluded.price_cents,
  compare_at_cents = excluded.compare_at_cents,
  cover_image_path = excluded.cover_image_path,
  page_count       = excluded.page_count,
  active           = excluded.active,
  sort             = excluded.sort,
  updated_at       = now();

-- Bundle membership (idempotent).
insert into public.shop_bundle_items (bundle_id, product_id, sort)
select b.id, p.id, x.sort
from (values
  ('kids-bundle',      'money-kids-edition',           1),
  ('kids-bundle',      'family-investing-workbook',    2),
  ('kids-bundle',      'lesson-plans-parent-pack',     3),
  ('adults-bundle',    'cheat-code-guide-to-stocks',   1),
  ('adults-bundle',    'family-investing-workbook',    2),
  ('adults-bundle',    'parent-teacher-guide',         3),
  ('full-family-set',  'cheat-code-guide-to-stocks',   1),
  ('full-family-set',  'money-kids-edition',           2),
  ('full-family-set',  'foundations-teen-workbook',    3),
  ('full-family-set',  'family-investing-workbook',    4),
  ('full-family-set',  'lesson-plans-parent-pack',     5),
  ('full-family-set',  'parent-teacher-guide',         6)
) as x(bundle_slug, product_slug, sort)
join public.shop_products b on b.slug = x.bundle_slug
join public.shop_products p on p.slug = x.product_slug
on conflict (bundle_id, product_id) do nothing;
