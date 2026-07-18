-- ============================================
-- Dual-program seed: FIC foundations (adults / teens / kids)
-- + FTA Trade Ready 6-week skeleton + Beta Cohort 1.
--
-- Content sources: Intro To Stocks textbook (adult foundations),
-- Kids Stock Workbook + Learn 2 Earn (Kids Corner), FTA-BETA-6WEEK-PLAN
-- (execution stack). Video ids intentionally NULL — the course-builder
-- pipeline fills them as lessons are produced.
-- drip_week on FIC lessons = FTA cohort week mapping (plan's pre-recorded
-- table). FIC-only members ignore drip_week (evergreen).
-- Legacy catalog (program NULL) is left untouched.
-- ============================================

-- ── FIC courses ─────────────────────────────────────────────────

INSERT INTO courses (id, slug, title, description, program, min_tier, sort_order, published) VALUES
('f1c00000-0000-0000-0001-000000000001', 'fic-adult-foundations', 'Adult Foundations — Intro to Stocks',
 'The Cheat Code textbook as a course: markets, charts, options, risk, and opening your account. The foundation every parent runs underneath the live program.',
 'fic', 'challenge', 1, true),
('f1c00000-0000-0000-0002-000000000001', 'fic-teens-foundations', 'Teen Foundations',
 'The same foundations, built for 13-17: real examples, real companies, and paper trading from day one.',
 'fic', 'challenge', 2, true),
('f1c00000-0000-0000-0003-000000000001', 'fic-kids-corner', 'Kids Corner — Money Explorers',
 'Story-based money and market adventures for ages 8-12, straight from the Kids Stock Workbook.',
 'fic', 'challenge', 3, true)
ON CONFLICT (id) DO NOTHING;

-- ── FIC: Adult Foundations (track adults, 6 weekly modules) ─────

INSERT INTO modules (id, course_id, track, title, description, sort_order) VALUES
('f1c00000-0001-0001-0000-000000000001', 'f1c00000-0000-0000-0001-000000000001', 'adults', 'Week 1 — Why Invest & How Markets Work', 'Compounding, what a stock is, and how the market actually functions. (Book ch. 1-2)', 1),
('f1c00000-0001-0002-0000-000000000001', 'f1c00000-0000-0000-0001-000000000001', 'adults', 'Week 2 — Reading Charts', 'Candlesticks, timeframes, support and resistance, trend, and volume. (Book: Technical Analysis)', 2),
('f1c00000-0001-0003-0000-000000000001', 'f1c00000-0000-0000-0001-000000000001', 'adults', 'Week 3 — Patterns, Indicators & Fundamentals', 'Chart patterns, MAs, RSI, MACD, plus fundamentals lite: P/E, earnings, catalysts.', 3),
('f1c00000-0001-0004-0000-000000000001', 'f1c00000-0000-0000-0001-000000000001', 'adults', 'Week 4 — Options Foundations', 'Calls, puts, premium, and Greeks lite — buying options on a thesis without blowing up. (Book p113-136)', 4),
('f1c00000-0001-0005-0000-000000000001', 'f1c00000-0000-0000-0001-000000000001', 'adults', 'Week 5 — Risk & Psychology', 'Position sizing, the 1-2% rule, stops, R:R, psychology, and the trade journal. (Book p137+)', 5),
('f1c00000-0001-0006-0000-000000000001', 'f1c00000-0000-0000-0001-000000000001', 'adults', 'Week 6 — Accounts & Your First Trade', 'Opening a brokerage account, options approval, order types, and the first-trade checklist. (Book p145+)', 6)
ON CONFLICT (id) DO NOTHING;

INSERT INTO lessons (id, module_id, title, description, drip_week, has_quiz, sort_order) VALUES
('f1c00000-0001-0001-0001-000000000001', 'f1c00000-0001-0001-0000-000000000001', 'Why Invest — The Power of Compounding', 'Why a dollar planted early beats a dollar planted late, every single time.', 1, false, 0),
('f1c00000-0001-0001-0002-000000000001', 'f1c00000-0001-0001-0000-000000000001', 'What a Stock Is & How the Market Works', 'Shares, tickers, indices, and what actually happens when you press buy.', 1, true, 1),
('f1c00000-0001-0002-0001-000000000001', 'f1c00000-0001-0002-0000-000000000001', 'Candlestick Anatomy & Timeframes', 'Open, high, low, close — one candle is one battle between buyers and sellers.', 2, false, 0),
('f1c00000-0001-0002-0002-000000000001', 'f1c00000-0001-0002-0000-000000000001', 'Support, Resistance, Trend & Volume', 'The levels where price fights, and how to tell who is winning the war.', 2, true, 1),
('f1c00000-0001-0003-0001-000000000001', 'f1c00000-0001-0003-0000-000000000001', 'Chart Patterns & Indicators', 'Flags, wedges, moving averages, RSI, and MACD — signals, not magic.', 3, false, 0),
('f1c00000-0001-0003-0002-000000000001', 'f1c00000-0001-0003-0000-000000000001', 'Fundamentals Lite: P/E, Earnings & Catalysts', 'Why stocks move: earnings, news, and the numbers that matter without the MBA.', 3, true, 1),
('f1c00000-0001-0004-0001-000000000001', 'f1c00000-0001-0004-0000-000000000001', 'Calls, Puts & Premium (Greeks Lite)', 'The right, not the obligation — how options actually work.', 4, false, 0),
('f1c00000-0001-0004-0002-000000000001', 'f1c00000-0001-0004-0000-000000000001', 'Buying Options on a Thesis — Without Blowing Up', 'Position rules that let you use leverage and keep your account.', 4, true, 1),
('f1c00000-0001-0005-0001-000000000001', 'f1c00000-0001-0005-0000-000000000001', 'Position Sizing, the 1-2% Rule, Stops & R:R', 'Protect the money first — the math that keeps you in the game.', 5, false, 0),
('f1c00000-0001-0005-0002-000000000001', 'f1c00000-0001-0005-0000-000000000001', 'Trading Psychology & the Trade Journal', 'Plans over feelings. Small losses are wins. The journal proves it.', 5, true, 1),
('f1c00000-0001-0006-0001-000000000001', 'f1c00000-0001-0006-0000-000000000001', 'Opening a Brokerage Account + Options Approval', 'Step-by-step account setup for the family, including options approval levels.', 6, false, 0),
('f1c00000-0001-0006-0002-000000000001', 'f1c00000-0001-0006-0000-000000000001', 'Order Types & the First-Trade Checklist', 'Market, limit, stop — and the written plan every first trade must have.', 6, true, 1)
ON CONFLICT (id) DO NOTHING;

-- ── FIC: Teen Foundations (track teens, 6 weekly modules) ───────

INSERT INTO modules (id, course_id, track, title, description, sort_order) VALUES
('f1c00000-0002-0001-0000-000000000001', 'f1c00000-0000-0000-0002-000000000001', 'teens', 'Week 1 — Money, Markets & Why Start Now', 'Compounding hits different when you start at 15.', 1),
('f1c00000-0002-0002-0000-000000000001', 'f1c00000-0000-0000-0002-000000000001', 'teens', 'Week 2 — Charts 101', 'Candles, timeframes, and reading the trend like a pro.', 2),
('f1c00000-0002-0003-0000-000000000001', 'f1c00000-0000-0000-0002-000000000001', 'teens', 'Week 3 — Patterns & Why Stocks Move', 'Patterns, indicators, earnings, and catalysts.', 3),
('f1c00000-0002-0004-0000-000000000001', 'f1c00000-0000-0000-0002-000000000001', 'teens', 'Week 4 — Options, Simply', 'Calls and puts without the jargon wall.', 4),
('f1c00000-0002-0005-0000-000000000001', 'f1c00000-0000-0000-0002-000000000001', 'teens', 'Week 5 — Risk Like a Pro', 'The rules that separate traders from gamblers.', 5),
('f1c00000-0002-0006-0000-000000000001', 'f1c00000-0000-0000-0002-000000000001', 'teens', 'Week 6 — Getting Real', 'Paper trading and the first-trade checklist.', 6)
ON CONFLICT (id) DO NOTHING;

INSERT INTO lessons (id, module_id, title, description, drip_week, has_quiz, sort_order) VALUES
('f1c00000-0002-0001-0001-000000000001', 'f1c00000-0002-0001-0000-000000000001', 'Compounding — Why Starting at 15 Beats 40', 'The math that makes time your biggest edge.', 1, false, 0),
('f1c00000-0002-0001-0002-000000000001', 'f1c00000-0002-0001-0000-000000000001', 'How the Stock Market Actually Works', 'Roblox, Nike, Apple — you already know these companies. Now own the idea of them.', 1, true, 1),
('f1c00000-0002-0002-0001-000000000001', 'f1c00000-0002-0002-0000-000000000001', 'Candlesticks & Timeframes', 'One candle = one battle. Learn to read the scoreboard.', 2, false, 0),
('f1c00000-0002-0002-0002-000000000001', 'f1c00000-0002-0002-0000-000000000001', 'Support, Resistance & Trend', 'Where price fights, and who has been winning the war.', 2, true, 1),
('f1c00000-0002-0003-0001-000000000001', 'f1c00000-0002-0003-0000-000000000001', 'Chart Patterns & Indicators', 'Flags, wedges, RSI, MACD — signals traders actually use.', 3, false, 0),
('f1c00000-0002-0003-0002-000000000001', 'f1c00000-0002-0003-0000-000000000001', 'Earnings & Catalysts — Why Stocks Move', 'The news cycle, earnings season, and how hype becomes price.', 3, true, 1),
('f1c00000-0002-0004-0001-000000000001', 'f1c00000-0002-0004-0000-000000000001', 'Calls & Puts Explained', 'The right, not the obligation — options without the jargon.', 4, false, 0),
('f1c00000-0002-0004-0002-000000000001', 'f1c00000-0002-0004-0000-000000000001', 'Why Options Can Grow (or Vaporize) Fast', 'Leverage cuts both ways — the rules that keep you safe.', 4, true, 1),
('f1c00000-0002-0005-0001-000000000001', 'f1c00000-0002-0005-0000-000000000001', 'The 1-2% Rule & Position Sizing', 'Protect the money first. The math that keeps you in the game.', 5, false, 0),
('f1c00000-0002-0005-0002-000000000001', 'f1c00000-0002-0005-0000-000000000001', 'Psychology & the Journal', 'Plans over feelings. Your journal is your coach.', 5, true, 1),
('f1c00000-0002-0006-0001-000000000001', 'f1c00000-0002-0006-0000-000000000001', 'Paper Trading Setup', 'Practice before we play — set up your paper account.', 6, false, 0),
('f1c00000-0002-0006-0002-000000000001', 'f1c00000-0002-0006-0000-000000000001', 'The First-Trade Checklist', 'Every trade gets a written plan. Build yours.', 6, true, 1)
ON CONFLICT (id) DO NOTHING;

-- ── FIC: Kids Corner (track kids, 6 weekly modules) ─────────────

INSERT INTO modules (id, course_id, track, title, description, sort_order) VALUES
('f1c00000-0003-0001-0000-000000000001', 'f1c00000-0000-0000-0003-000000000001', 'kids', 'Week 1 — Money & the Money Machine', 'What money is, why prices sneak up, and the ways people earn.', 1),
('f1c00000-0003-0002-0000-000000000001', 'f1c00000-0000-0000-0003-000000000001', 'kids', 'Week 2 — What Is a Stock?', 'Owning a tiny piece of the companies you already love.', 2),
('f1c00000-0003-0003-0000-000000000001', 'f1c00000-0000-0000-0003-000000000001', 'kids', 'Week 3 — Reading the Chart Story', 'Green teams, red teams, and spotting who is winning.', 3),
('f1c00000-0003-0004-0000-000000000001', 'f1c00000-0000-0000-0003-000000000001', 'kids', 'Week 4 — Companies We Love', 'Picking strong companies your family actually uses.', 4),
('f1c00000-0003-0005-0000-000000000001', 'f1c00000-0000-0000-0003-000000000001', 'kids', 'Week 5 — Protecting Your Treasure', 'The House Rules of money.', 5),
('f1c00000-0003-0006-0000-000000000001', 'f1c00000-0000-0000-0003-000000000001', 'kids', 'Week 6 — Your First Pretend Trade', 'Practice before we play — your first paper trade.', 6)
ON CONFLICT (id) DO NOTHING;

INSERT INTO lessons (id, module_id, title, description, drip_week, has_quiz, sort_order) VALUES
('f1c00000-0003-0001-0001-000000000001', 'f1c00000-0003-0001-0000-000000000001', 'What Is Money (and Why Prices Sneak Up)', 'Money sitting still loses — meet inflation, the sneaky shrink ray.', 1, false, 0),
('f1c00000-0003-0001-0002-000000000001', 'f1c00000-0003-0001-0000-000000000001', 'The Ways People Make Money', 'Work, business, investing, trading — the four buckets.', 1, true, 1),
('f1c00000-0003-0002-0001-000000000001', 'f1c00000-0003-0002-0000-000000000001', 'Owning a Piece of Roblox & Nike', 'A stock is a tiny slice of a real company — even ones you play and wear.', 2, false, 0),
('f1c00000-0003-0002-0002-000000000001', 'f1c00000-0003-0002-0000-000000000001', 'The Stock Market — Where Everyone Trades', 'The big store where people buy and sell company pieces all day.', 2, true, 1),
('f1c00000-0003-0003-0001-000000000001', 'f1c00000-0003-0003-0000-000000000001', 'Candles: Green Teams vs Red Teams', 'Every candle is a tug-of-war. Green means buyers won. Red means sellers won.', 3, false, 0),
('f1c00000-0003-0003-0002-000000000001', 'f1c00000-0003-0003-0000-000000000001', 'Climbing or Falling? Spotting the Trend', 'Look at the battles in a row — who has been winning the war?', 3, true, 1),
('f1c00000-0003-0004-0001-000000000001', 'f1c00000-0003-0004-0000-000000000001', 'Picking Companies Your Family Uses', 'Your watchlist starts at home — what does your family buy, play, and wear?', 4, false, 0),
('f1c00000-0003-0004-0002-000000000001', 'f1c00000-0003-0004-0000-000000000001', 'What Makes a Company Strong?', 'Lots of customers, growing sales, and products people love.', 4, true, 1),
('f1c00000-0003-0005-0001-000000000001', 'f1c00000-0003-0005-0000-000000000001', 'The House Rules of Money', 'Protect the money first. Plans over feelings. Practice before we play.', 5, false, 0),
('f1c00000-0003-0005-0002-000000000001', 'f1c00000-0003-0005-0000-000000000001', 'Small Losses Are Wins', 'Why losing a little on purpose beats losing a lot by accident.', 5, true, 1),
('f1c00000-0003-0006-0001-000000000001', 'f1c00000-0003-0006-0000-000000000001', 'Paper Trading — Practice Before We Play', 'Pretend money, real skills — your first practice trade.', 6, false, 0),
('f1c00000-0003-0006-0002-000000000001', 'f1c00000-0003-0006-0000-000000000001', 'My Family Trade Plan', 'Make your plan together and post it in the group.', 6, true, 1)
ON CONFLICT (id) DO NOTHING;

-- ── FTA: Trade Ready 6-week execution program ───────────────────
-- Modules track NULL = families attend together (live classes are shared).
-- module.sort_order = cohort week number (resolver keys on this).

INSERT INTO courses (id, slug, title, description, program, min_tier, sort_order, published) VALUES
('f7a00000-0000-0000-0001-000000000001', 'fta-trade-ready', 'FTA Trade Ready — The 6-Week Live Program',
 'Beginner to ICT trader in six weeks: market structure, supply & demand, liquidity sweeps, fair value gaps, ORB, and the full execution playbook — taught live, family-style.',
 'fta', 'academy', 10, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO modules (id, course_id, track, title, description, sort_order) VALUES
('f7a00000-0000-0001-0000-000000000001', 'f7a00000-0000-0000-0001-000000000001', NULL, 'Week 1 — Market Structure: Who Really Moves the Price', 'Highs, lows, trend structure, and the big-player story. Intro to liquidity: where is everyone''s stop loss hiding?', 1),
('f7a00000-0000-0002-0000-000000000001', 'f7a00000-0000-0000-0001-000000000001', NULL, 'Week 2 — Supply & Demand: Where the Big Money Hides', 'Where banks bought and sold, why price returns to unmitigated zones, and how to draw them properly.', 2),
('f7a00000-0000-0003-0000-000000000001', 'f7a00000-0000-0000-0001-000000000001', NULL, 'Week 3 — Liquidity Sweeps: The Bait & the Grab', 'Equal highs and lows as bait, the sweep-then-reverse model, and sweeps as trade confirmation.', 3),
('f7a00000-0000-0004-0000-000000000001', 'f7a00000-0000-0000-0001-000000000001', NULL, 'Week 4 — Fair Value Gaps: The Gaps Price Comes Back to Fill', 'The 3-candle FVG, why gaps fill, and the FVG as your entry zone.', 4),
('f7a00000-0000-0005-0000-000000000001', 'f7a00000-0000-0000-0001-000000000001', NULL, 'Week 5 — ORB: The Opening Bell Play', 'The opening range, why the open concentrates volume, and range - break - retest - target.', 5),
('f7a00000-0000-0006-0000-000000000001', 'f7a00000-0000-0000-0001-000000000001', NULL, 'Week 6 — The Full Playbook + Trade Ready Exam', 'Structure, zone, sweep, FVG, ORB timing — the complete checklist, live walkthroughs, and your certification.', 6)
ON CONFLICT (id) DO NOTHING;

INSERT INTO lessons (id, module_id, title, description, drip_week, has_quiz, sort_order) VALUES
('f7a00000-0000-0001-0001-000000000001', 'f7a00000-0000-0001-0000-000000000001', 'Live Class: Market Structure & Who Moves Price', 'HH/HL structure mapping on real charts, plus the whale-needs-to-buy story and the pool-party liquidity intro.', 1, false, 0),
('f7a00000-0000-0001-0002-000000000001', 'f7a00000-0000-0001-0000-000000000001', 'Drill: Map the Structure on 3 Charts', 'Mark highs, lows, and trend on three fresh charts. Bring them Saturday — we review YOURS.', 1, true, 1),
('f7a00000-0000-0002-0001-000000000001', 'f7a00000-0000-0002-0000-000000000001', 'Live Class: Supply & Demand Zones', 'The warehouse-restock story, drawing zones properly, and zone flips on break. NVDA/SPY replays.', 2, false, 0),
('f7a00000-0000-0002-0002-000000000001', 'f7a00000-0000-0002-0000-000000000001', 'Drill: Draw 3 Zones on Real Charts', 'Find and draw three unmitigated zones. Predict which one price returns to first.', 2, true, 1),
('f7a00000-0000-0003-0001-000000000001', 'f7a00000-0000-0003-0000-000000000001', 'Live Class: Liquidity Sweeps (The Bait & the Grab)', 'Equal highs/lows as bait, the fishing-lure move, sweep-then-reverse, and CHoCH confirmation.', 3, false, 0),
('f7a00000-0000-0003-0002-000000000001', 'f7a00000-0000-0003-0000-000000000001', 'Drill: Find 3 Equal-Lows Charts & Predict the Sweep', 'Hunt three charts with equal lows. Call the sweep before it happens.', 3, true, 1),
('f7a00000-0000-0004-0001-000000000001', 'f7a00000-0000-0004-0000-000000000001', 'Live Class: Fair Value Gaps', 'The 3-candle imbalance, skipped-stairs-get-rebuilt, internal vs external liquidity, FVG as the entry.', 4, false, 0),
('f7a00000-0000-0004-0002-000000000001', 'f7a00000-0000-0004-0000-000000000001', 'Drill: Mark 3 FVGs & Watch the Fill', 'Mark three fresh FVGs and track which fill first.', 4, true, 1),
('f7a00000-0000-0005-0001-000000000001', 'f7a00000-0000-0005-0000-000000000001', 'Live Class: The Opening Range Breakout', 'Gates-open-at-the-racetrack: the opening range, break, retest, target — with real ORB days from the scanner.', 5, false, 0),
('f7a00000-0000-0005-0002-000000000001', 'f7a00000-0000-0005-0000-000000000001', 'Drill: Replay 3 ORB Days', 'Range, break, retest, target — walk three historical opens and log each play.', 5, true, 1),
('f7a00000-0000-0006-0001-000000000001', 'f7a00000-0000-0006-0000-000000000001', 'Live Class: The Full Execution Model', 'Structure, zone, sweep, FVG, ORB timing — complete trades start to finish, live.', 6, false, 0),
('f7a00000-0000-0006-0002-000000000001', 'f7a00000-0000-0006-0000-000000000001', 'Trade Ready Exam: Fresh Chart + Paper Trade', 'Mark up a chart you have never seen and execute a paper trade with the full checklist. Pass = certified.', 6, true, 1)
ON CONFLICT (id) DO NOTHING;

-- ── Beta Cohort 1 + enroll existing families ────────────────────

INSERT INTO cohorts (id, program, name, start_date, weeks) VALUES
('c0000000-0000-0000-0000-0000000000b1', 'fta', 'FTA Beta Cohort 1', '2026-07-20', 6)
ON CONFLICT (id) DO NOTHING;

-- Beta DB: every existing family joins the beta cohort.
INSERT INTO enrollments (family_id, program, cohort_id)
SELECT f.id, 'fta', 'c0000000-0000-0000-0000-0000000000b1'
FROM families f
ON CONFLICT (family_id, program) DO NOTHING;
