-- ============================================
-- Seed Content: Courses, Modules, Lessons, Quizzes, Badges, Live Sessions
-- Run in Supabase SQL Editor
-- ============================================

-- ── Courses ──────────────────────────────────────────────────────

INSERT INTO courses (id, slug, title, description, thumbnail_url, min_tier, sort_order, published) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'stocks-options', 'Stocks & Options Mastery', 'Master the foundations of stock trading and options strategies. Learn how markets work, read charts like a pro, manage risk, and execute your first trades with confidence.', NULL, 'challenge', 0, true),
  ('c1000000-0000-0000-0000-000000000002', 'forex', 'Forex Trading', 'Dive into the world''s largest financial market. Understand currency pairs, leverage, technical analysis for forex, and build a consistent trading strategy.', NULL, 'challenge', 1, true),
  ('c1000000-0000-0000-0000-000000000003', 'futures', 'Futures Trading', 'Learn to trade futures contracts — from E-mini S&P to commodities. Understand margin, contract specs, and strategies that institutional traders use.', NULL, 'academy', 2, true),
  ('c1000000-0000-0000-0000-000000000004', 'crypto', 'Crypto Trading', 'Navigate the crypto markets with confidence. Learn blockchain basics, read crypto charts, understand DeFi, and develop strategies for this 24/7 market.', NULL, 'academy', 3, true)
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, published = EXCLUDED.published, sort_order = EXCLUDED.sort_order;

-- ── Stocks & Options Modules ─────────────────────────────────────

INSERT INTO modules (id, course_id, track, title, description, sort_order) VALUES
  ('m1000000-0000-0000-0001-000000000001', 'c1000000-0000-0000-0000-000000000001', 'adults', 'Module 1: Getting Started', 'Your first steps into the trading world — setting up accounts, understanding market basics.', 0),
  ('m1000000-0000-0000-0001-000000000002', 'c1000000-0000-0000-0000-000000000001', 'adults', 'Module 2: Chart Reading Basics', 'Learn to read price charts, identify patterns, and understand what the market is telling you.', 1),
  ('m1000000-0000-0000-0001-000000000003', 'c1000000-0000-0000-0000-000000000001', 'adults', 'Module 3: Risk Management', 'The most important skill in trading — protecting your capital and managing position sizes.', 2),
  ('m1000000-0000-0000-0001-000000000004', 'c1000000-0000-0000-0000-000000000001', 'adults', 'Module 4: Your First Trade', 'Put it all together — paper trading, building your plan, and going live safely.', 3)
ON CONFLICT (id) DO NOTHING;

-- Stocks Lessons
INSERT INTO lessons (id, module_id, title, description, video_provider, video_id, video_duration_sec, drip_week, has_quiz, sort_order) VALUES
  ('l1000000-0001-0001-0000-000000000001', 'm1000000-0000-0000-0001-000000000001', 'Welcome to Trading', 'An introduction to what trading is, the different markets, and what to expect on your journey.', 'youtube', 'p7HKvqRI_Bo', 480, 0, false, 0),
  ('l1000000-0001-0001-0000-000000000002', 'm1000000-0000-0000-0001-000000000001', 'How Markets Work', 'Understanding exchanges, order types, bid/ask spreads, and market hours.', 'youtube', 'Xn7KWR9EOGQ', 720, 0, true, 1),
  ('l1000000-0001-0001-0000-000000000003', 'm1000000-0000-0000-0001-000000000001', 'Your Trading Account Setup', 'Step-by-step guide to opening a brokerage account and navigating the platform.', 'youtube', 'A7fZpDjz0aM', 600, 0, false, 2),
  ('l1000000-0001-0002-0000-000000000001', 'm1000000-0000-0000-0001-000000000002', 'Candlestick Patterns', 'Reading candlesticks — doji, hammer, engulfing, and what they signal.', 'youtube', 'dAqGGGK5uAM', 900, 1, true, 0),
  ('l1000000-0001-0002-0000-000000000002', 'm1000000-0000-0000-0001-000000000002', 'Support & Resistance', 'Identifying key price levels where buyers and sellers meet.', 'youtube', 'WYODNUqGLWk', 840, 1, false, 1),
  ('l1000000-0001-0002-0000-000000000003', 'm1000000-0000-0000-0001-000000000002', 'Trend Lines & Channels', 'Drawing trend lines, identifying channels, and trading with the trend.', 'youtube', '8TlvWAGMVas', 720, 1, false, 2),
  ('l1000000-0001-0003-0000-000000000001', 'm1000000-0000-0000-0001-000000000003', 'Position Sizing', 'How to calculate the right position size for every trade based on your account.', 'youtube', 'ZJjRnKpg5LI', 660, 2, true, 0),
  ('l1000000-0001-0003-0000-000000000002', 'm1000000-0000-0000-0001-000000000003', 'Stop Losses & Take Profit', 'Setting protective stops and profit targets to automate your risk management.', 'youtube', 'p7HKvqRI_Bo', 780, 2, false, 1),
  ('l1000000-0001-0003-0000-000000000003', 'm1000000-0000-0000-0001-000000000003', 'Risk-Reward Ratios', 'Understanding R:R ratios and why they matter more than win rate.', 'youtube', 'Xn7KWR9EOGQ', 600, 2, false, 2),
  ('l1000000-0001-0004-0000-000000000001', 'm1000000-0000-0000-0001-000000000004', 'Paper Trading Practice', 'Practice trading with virtual money before risking real capital.', 'youtube', 'A7fZpDjz0aM', 1200, 3, false, 0),
  ('l1000000-0001-0004-0000-000000000002', 'm1000000-0000-0000-0001-000000000004', 'Building a Trading Plan', 'Create your personal trading plan — rules, setups, journal, and routine.', 'youtube', 'dAqGGGK5uAM', 900, 3, true, 1),
  ('l1000000-0001-0004-0000-000000000003', 'm1000000-0000-0000-0001-000000000004', 'Going Live Safely', 'Transitioning from paper to live trading with a risk-first mindset.', 'youtube', 'WYODNUqGLWk', 1080, 4, false, 2)
ON CONFLICT (id) DO NOTHING;

-- ── Forex Modules ─────────────────────────────────────────────────

INSERT INTO modules (id, course_id, track, title, description, sort_order) VALUES
  ('m1000000-0000-0000-0002-000000000001', 'c1000000-0000-0000-0000-000000000002', 'adults', 'Module 1: Forex Fundamentals', 'Understanding the forex market, currency pairs, and how to get started.', 0),
  ('m1000000-0000-0000-0002-000000000002', 'c1000000-0000-0000-0000-000000000002', 'adults', 'Module 2: Technical Analysis for Forex', 'Chart patterns, indicators, and strategies specific to currency trading.', 1),
  ('m1000000-0000-0000-0002-000000000003', 'c1000000-0000-0000-0000-000000000002', 'adults', 'Module 3: Forex Strategy & Execution', 'Building and executing your forex trading strategy.', 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO lessons (id, module_id, title, description, video_provider, video_id, video_duration_sec, drip_week, has_quiz, sort_order) VALUES
  ('l1000000-0002-0001-0000-000000000001', 'm1000000-0000-0000-0002-000000000001', 'What is Forex?', 'Introduction to the foreign exchange market — the largest financial market in the world.', 'youtube', 'DYpSm7E8FBg', 600, 0, false, 0),
  ('l1000000-0002-0001-0000-000000000002', 'm1000000-0000-0000-0002-000000000001', 'Currency Pairs Explained', 'Major, minor, and exotic pairs — understanding how currencies are quoted.', 'youtube', 'fgqBCB_zp4A', 720, 0, true, 1),
  ('l1000000-0002-0001-0000-000000000003', 'm1000000-0000-0000-0002-000000000001', 'Leverage & Margin', 'How leverage works in forex and managing margin requirements.', 'youtube', 'WcfKaZL4vpA', 660, 0, false, 2),
  ('l1000000-0002-0002-0000-000000000001', 'm1000000-0000-0000-0002-000000000002', 'Forex Chart Patterns', 'Key chart patterns that work in currency markets.', 'youtube', 'nseHrlLfMVg', 840, 1, true, 0),
  ('l1000000-0002-0002-0000-000000000002', 'm1000000-0000-0000-0002-000000000002', 'Forex Indicators', 'RSI, MACD, moving averages applied to forex trading.', 'youtube', '6nb_05EEHDI', 780, 1, false, 1),
  ('l1000000-0002-0003-0000-000000000001', 'm1000000-0000-0000-0002-000000000003', 'Building a Forex Strategy', 'Developing your own forex trading system step by step.', 'youtube', 'c2n81dFoYBM', 900, 2, false, 0),
  ('l1000000-0002-0003-0000-000000000002', 'm1000000-0000-0000-0002-000000000003', 'Live Forex Trading Session', 'Watch a real forex trade from analysis to execution.', 'youtube', 'VZDHTknVwjI', 1200, 2, true, 1)
ON CONFLICT (id) DO NOTHING;

-- ── Futures Modules ───────────────────────────────────────────────

INSERT INTO modules (id, course_id, track, title, description, sort_order) VALUES
  ('m1000000-0000-0000-0003-000000000001', 'c1000000-0000-0000-0000-000000000003', 'adults', 'Module 1: Futures Basics', 'Understanding futures contracts, margin, and the major futures markets.', 0),
  ('m1000000-0000-0000-0003-000000000002', 'c1000000-0000-0000-0000-000000000003', 'adults', 'Module 2: Futures Trading Strategies', 'Professional strategies for trading E-mini, commodities, and more.', 1),
  ('m1000000-0000-0000-0003-000000000003', 'c1000000-0000-0000-0000-000000000003', 'adults', 'Module 3: Advanced Futures', 'Spreads, seasonality, and institutional-level futures techniques.', 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO lessons (id, module_id, title, description, video_provider, video_id, video_duration_sec, drip_week, has_quiz, sort_order) VALUES
  ('l1000000-0003-0001-0000-000000000001', 'm1000000-0000-0000-0003-000000000001', 'What Are Futures?', 'Introduction to futures contracts and how they differ from stocks.', 'youtube', 'CC9VeHrI3Es', 600, 0, false, 0),
  ('l1000000-0003-0001-0000-000000000002', 'm1000000-0000-0000-0003-000000000001', 'Futures Contract Specs', 'Understanding tick sizes, contract values, expiration, and rollover.', 'youtube', 'JZbqH_a_gzE', 720, 0, true, 1),
  ('l1000000-0003-0001-0000-000000000003', 'm1000000-0000-0000-0003-000000000001', 'Margin & Leverage in Futures', 'How futures margin works and managing risk with leverage.', 'youtube', 'De_KiJhPeks', 660, 0, false, 2),
  ('l1000000-0003-0002-0000-000000000001', 'm1000000-0000-0000-0003-000000000002', 'E-mini S&P 500 Trading', 'Trading the most popular futures contract in the world.', 'youtube', 'pWBZjIAxfNk', 900, 1, false, 0),
  ('l1000000-0003-0002-0000-000000000002', 'm1000000-0000-0000-0003-000000000002', 'Commodity Futures', 'Trading gold, oil, and agricultural futures.', 'youtube', '69cGkEU9Ciw', 840, 1, true, 1),
  ('l1000000-0003-0003-0000-000000000001', 'm1000000-0000-0000-0003-000000000003', 'Spread Trading', 'Calendar spreads, inter-commodity spreads, and pairs trading.', 'youtube', 'UxJE0pGDZ84', 780, 2, false, 0),
  ('l1000000-0003-0003-0000-000000000002', 'm1000000-0000-0000-0003-000000000003', 'Institutional Futures Strategies', 'How the pros trade futures — order flow, volume profile, and market internals.', 'youtube', '3bFg31Cg5AE', 1080, 2, true, 1)
ON CONFLICT (id) DO NOTHING;

-- ── Crypto Modules ────────────────────────────────────────────────

INSERT INTO modules (id, course_id, track, title, description, sort_order) VALUES
  ('m1000000-0000-0000-0004-000000000001', 'c1000000-0000-0000-0000-000000000004', 'adults', 'Module 1: Crypto Foundations', 'Blockchain basics, wallets, exchanges, and getting started with crypto.', 0),
  ('m1000000-0000-0000-0004-000000000002', 'c1000000-0000-0000-0000-000000000004', 'adults', 'Module 2: Crypto Trading', 'Technical analysis and strategies specific to cryptocurrency markets.', 1),
  ('m1000000-0000-0000-0004-000000000003', 'c1000000-0000-0000-0000-000000000004', 'adults', 'Module 3: DeFi & Advanced Crypto', 'Decentralized finance, yield farming, and advanced crypto strategies.', 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO lessons (id, module_id, title, description, video_provider, video_id, video_duration_sec, drip_week, has_quiz, sort_order) VALUES
  ('l1000000-0004-0001-0000-000000000001', 'm1000000-0000-0000-0004-000000000001', 'What is Blockchain?', 'Understanding the technology behind cryptocurrencies.', 'youtube', 'rYQgy8QDEBI', 600, 0, false, 0),
  ('l1000000-0004-0001-0000-000000000002', 'm1000000-0000-0000-0004-000000000001', 'Setting Up Your Crypto Wallet', 'Hot wallets, cold wallets, and keeping your crypto safe.', 'youtube', '41JCpzvnn_0', 720, 0, true, 1),
  ('l1000000-0004-0001-0000-000000000003', 'm1000000-0000-0000-0004-000000000001', 'Choosing a Crypto Exchange', 'Comparing exchanges — fees, security, and features.', 'youtube', 'bBC-nXj3Ng4', 540, 0, false, 2),
  ('l1000000-0004-0002-0000-000000000001', 'm1000000-0000-0000-0004-000000000002', 'Crypto Chart Analysis', 'Technical analysis techniques that work in crypto markets.', 'youtube', 'GGberGnxiJk', 900, 1, false, 0),
  ('l1000000-0004-0002-0000-000000000002', 'm1000000-0000-0000-0004-000000000002', 'Bitcoin Trading Strategies', 'Strategies for trading BTC — swing trading, breakouts, and more.', 'youtube', '1YyAzVmP9xQ', 840, 1, true, 1),
  ('l1000000-0004-0003-0000-000000000001', 'm1000000-0000-0000-0004-000000000003', 'Introduction to DeFi', 'What is DeFi, how it works, and the major protocols.', 'youtube', 'Yb6825iv0Vk', 780, 2, false, 0),
  ('l1000000-0004-0003-0000-000000000002', 'm1000000-0000-0000-0004-000000000003', 'Advanced Crypto Strategies', 'Yield farming, liquidity providing, and managing a crypto portfolio.', 'youtube', 'SSo_EIwHSd4', 960, 2, true, 1)
ON CONFLICT (id) DO NOTHING;

-- ── Quizzes ──────────────────────────────────────────────────────

INSERT INTO quizzes (lesson_id, questions, passing_score) VALUES
  ('l1000000-0001-0001-0000-000000000002', '[{"question":"What is a bid-ask spread?","options":["The difference between the highest buy and lowest sell price","The commission your broker charges","The daily price range","The gap between market open and close"],"correctIndex":0},{"question":"Which order type guarantees execution but not price?","options":["Limit order","Stop order","Market order","Trailing stop"],"correctIndex":2},{"question":"What are standard US stock market hours (ET)?","options":["8:00 AM - 4:00 PM","9:30 AM - 4:00 PM","9:00 AM - 3:30 PM","10:00 AM - 5:00 PM"],"correctIndex":1}]', 70),
  ('l1000000-0001-0002-0000-000000000001', '[{"question":"What does a hammer candlestick signal?","options":["Continuation of downtrend","Potential bullish reversal","Strong selling pressure","Market indecision"],"correctIndex":1},{"question":"What is a doji candle?","options":["A candle with no wick","A candle where open and close are nearly equal","A very large bullish candle","A gap down candle"],"correctIndex":1}]', 70),
  ('l1000000-0001-0003-0000-000000000001', '[{"question":"If you have a $10,000 account and risk 2% per trade, what is your max loss?","options":["$100","$200","$500","$1,000"],"correctIndex":1},{"question":"What is the recommended risk per trade for beginners?","options":["5-10%","3-5%","1-2%","0.1%"],"correctIndex":2}]', 70),
  ('l1000000-0001-0004-0000-000000000002', '[{"question":"What should a trading plan include?","options":["Entry/exit rules, risk management, and journaling","Just entry signals","Only the stocks you like","Your profit goals"],"correctIndex":0}]', 70),
  ('l1000000-0002-0001-0000-000000000002', '[{"question":"In the pair EUR/USD, which is the base currency?","options":["USD","EUR","Both","Neither"],"correctIndex":1},{"question":"What is a pip in forex?","options":["1% of the trade","The smallest price increment (usually 0.0001)","The spread","A type of order"],"correctIndex":1}]', 70),
  ('l1000000-0002-0002-0000-000000000001', '[{"question":"What is a double bottom pattern?","options":["A bearish reversal","A bullish reversal pattern","A continuation pattern","A gap pattern"],"correctIndex":1}]', 70),
  ('l1000000-0002-0003-0000-000000000002', '[{"question":"What is the most traded currency pair?","options":["GBP/USD","USD/JPY","EUR/USD","AUD/USD"],"correctIndex":2}]', 70),
  ('l1000000-0003-0001-0000-000000000002', '[{"question":"What is the tick size of the E-mini S&P 500?","options":["$12.50","$25.00","$50.00","$5.00"],"correctIndex":0}]', 70),
  ('l1000000-0003-0002-0000-000000000002', '[{"question":"What commodity is traded most by volume?","options":["Gold","Silver","Crude Oil","Natural Gas"],"correctIndex":2}]', 70),
  ('l1000000-0003-0003-0000-000000000002', '[{"question":"What is a calendar spread?","options":["Buying and selling the same contract on different days","Buying and selling the same asset with different expiration dates","Trading only during certain months","A daily trading strategy"],"correctIndex":1}]', 70),
  ('l1000000-0004-0001-0000-000000000002', '[{"question":"What is a private key?","options":["Your exchange password","A secret code that controls your crypto wallet","Your wallet address","A type of cryptocurrency"],"correctIndex":1}]', 70),
  ('l1000000-0004-0002-0000-000000000002', '[{"question":"What makes crypto markets different from stocks?","options":["Lower fees","They trade 24/7","They are regulated","They only go up"],"correctIndex":1}]', 70),
  ('l1000000-0004-0003-0000-000000000002', '[{"question":"What is a liquidity pool?","options":["A group of investors","Tokens locked in a smart contract to facilitate trading","A type of exchange","A wallet feature"],"correctIndex":1}]', 70)
ON CONFLICT (lesson_id) DO NOTHING;

-- ── Badges ───────────────────────────────────────────────────────

INSERT INTO badges (id, slug, title, description, icon_url, criteria) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'first-lesson', 'First Steps', 'Complete your first lesson', NULL, '{"type":"lessons_completed","count":1}'),
  ('b1000000-0000-0000-0000-000000000002', 'five-lessons', 'Getting Serious', 'Complete 5 lessons', NULL, '{"type":"lessons_completed","count":5}'),
  ('b1000000-0000-0000-0000-000000000003', 'ten-lessons', 'Dedicated Learner', 'Complete 10 lessons', NULL, '{"type":"lessons_completed","count":10}'),
  ('b1000000-0000-0000-0000-000000000004', 'first-quiz', 'Quiz Whiz', 'Pass your first quiz', NULL, '{"type":"quizzes_passed","count":1}'),
  ('b1000000-0000-0000-0000-000000000005', 'perfect-score', 'Perfect Score', 'Score 100% on any quiz', NULL, '{"type":"quiz_perfect","count":1}'),
  ('b1000000-0000-0000-0000-000000000006', 'three-day-streak', '3-Day Streak', 'Learn 3 days in a row', NULL, '{"type":"streak","count":3}'),
  ('b1000000-0000-0000-0000-000000000007', 'seven-day-streak', 'Week Warrior', 'Learn 7 days in a row', NULL, '{"type":"streak","count":7}'),
  ('b1000000-0000-0000-0000-000000000008', 'course-complete', 'Course Graduate', 'Complete an entire course', NULL, '{"type":"course_completed","count":1}'),
  ('b1000000-0000-0000-0000-000000000009', 'first-trade', 'First Trade', 'Execute your first simulated trade', NULL, '{"type":"sim_trades","count":1}'),
  ('b1000000-0000-0000-0000-000000000010', 'profitable-trader', 'In the Green', 'End a simulated session with profit', NULL, '{"type":"sim_profit","count":1}')
ON CONFLICT (slug) DO NOTHING;

-- ── Live Sessions (sample) ───────────────────────────────────────

INSERT INTO live_sessions (id, title, description, scheduled_at, duration_min, zoom_join_url, status, track, min_tier) VALUES
  ('s1000000-0000-0000-0000-000000000001', 'Weekly Market Breakdown', 'Join Coach Marcus for a live breakdown of this week''s market action. We''ll review key levels, upcoming catalysts, and trade setups.', now() + interval '2 days', 60, NULL, 'scheduled', 'all', 'challenge'),
  ('s1000000-0000-0000-0000-000000000002', 'Options Strategy Workshop', 'Deep dive into covered calls and credit spreads — when to use them and how to manage risk.', now() + interval '5 days', 90, NULL, 'scheduled', 'stocks-options', 'academy'),
  ('s1000000-0000-0000-0000-000000000003', 'Forex Asia Session Review', 'Live analysis of overnight forex moves and setups for the London open.', now() + interval '7 days', 45, NULL, 'scheduled', 'forex', 'academy'),
  ('s1000000-0000-0000-0000-000000000004', 'Family Trading Q&A', 'Open Q&A session — bring your questions about any market. Parents and kids welcome!', now() + interval '3 days', 60, NULL, 'scheduled', 'all', 'challenge'),
  ('s1000000-0000-0000-0000-000000000005', 'Intro to Chart Reading', 'Beginner-friendly session on reading candlestick charts and identifying basic patterns.', now() - interval '3 days', 60, NULL, 'completed', 'all', 'challenge')
ON CONFLICT (id) DO NOTHING;
