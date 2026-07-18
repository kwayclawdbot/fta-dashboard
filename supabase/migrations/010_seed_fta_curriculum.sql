-- ============================================
-- FTA University — Full Curriculum Seed
-- ============================================

-- Clear old data (cascade deletes modules→lessons)
DELETE FROM courses;

-- ============================================
-- FREE TIER: Trading Fundamentals
-- ============================================

INSERT INTO courses (id, slug, title, description, min_tier, sort_order, published) VALUES
('10000000-0001-0000-0000-000000000001', 'tf-100', 'Introduction to Financial Markets', 'What are financial markets, how exchanges work, and who participates in them.', 'challenge', 1, true),
('10000000-0002-0000-0000-000000000001', 'tf-101', 'Chart Reading Basics', 'Candlestick anatomy, timeframes, support and resistance, trend identification, and volume.', 'challenge', 2, true),
('10000000-0003-0000-0000-000000000001', 'tf-102', 'Risk Management Foundations', 'Position sizing, risk-to-reward ratios, stop losses, and the 1-2% rule.', 'challenge', 3, true),
('10000000-0004-0000-0000-000000000001', 'tf-103', 'Trading Psychology', 'Emotions in trading, discipline, journaling, and building a trading plan.', 'challenge', 4, true);

-- TF 100
INSERT INTO modules (id, course_id, title, description, sort_order) VALUES
('20000000-0001-0001-0000-000000000001', '10000000-0001-0000-0000-000000000001', 'What Are Financial Markets', 'Understanding why markets exist and how they function.', 0),
('20000000-0001-0002-0000-000000000001', '10000000-0001-0000-0000-000000000001', 'Types of Markets', 'Stocks, forex, futures, crypto, and options — an overview of each.', 1),
('20000000-0001-0003-0000-000000000001', '10000000-0001-0000-0000-000000000001', 'How Markets Operate', 'Market participants, order types, and trading sessions.', 2);

INSERT INTO lessons (id, module_id, title, description, sort_order, has_quiz) VALUES
('30000000-0001-0001-0001-000000000001', '20000000-0001-0001-0000-000000000001', 'Why Financial Markets Exist', 'The purpose of financial markets and their role in the economy.', 0, false),
('30000000-0001-0001-0002-000000000001', '20000000-0001-0001-0000-000000000001', 'How Exchanges Work', 'From the NYSE to NASDAQ — how orders get matched and trades executed.', 1, false),
('30000000-0001-0001-0003-000000000001', '20000000-0001-0001-0000-000000000001', 'Supply and Demand in Markets', 'The fundamental force that drives all price movement.', 2, true),
('30000000-0001-0002-0001-000000000001', '20000000-0001-0002-0000-000000000001', 'The Stock Market', 'Stocks, shares, and equity — owning a piece of a company.', 0, false),
('30000000-0001-0002-0002-000000000001', '20000000-0001-0002-0000-000000000001', 'The Forex Market', 'The largest financial market in the world — currency trading.', 1, false),
('30000000-0001-0002-0003-000000000001', '20000000-0001-0002-0000-000000000001', 'The Futures Market', 'Contracts for future delivery — commodities, indexes, and more.', 2, false),
('30000000-0001-0002-0004-000000000001', '20000000-0001-0002-0000-000000000001', 'The Crypto Market', 'Digital assets, blockchain, and the newest financial frontier.', 3, false),
('30000000-0001-0002-0005-000000000001', '20000000-0001-0002-0000-000000000001', 'The Options Market', 'Contracts that give you the right (not obligation) to buy or sell.', 4, true),
('30000000-0001-0003-0001-000000000001', '20000000-0001-0003-0000-000000000001', 'Market Participants', 'Retail traders, institutional investors, market makers, and their roles.', 0, false),
('30000000-0001-0003-0002-000000000001', '20000000-0001-0003-0000-000000000001', 'Order Types & Execution', 'Market orders, limit orders, stop orders — how to actually place a trade.', 1, false),
('30000000-0001-0003-0003-000000000001', '20000000-0001-0003-0000-000000000001', 'Market Hours & Sessions', 'When markets are open, pre-market, after-hours, and global sessions.', 2, true);

-- TF 101
INSERT INTO modules (id, course_id, title, description, sort_order) VALUES
('20000000-0002-0001-0000-000000000001', '10000000-0002-0000-0000-000000000001', 'Candlestick Basics', 'Reading the building blocks of every chart.', 0),
('20000000-0002-0002-0000-000000000001', '10000000-0002-0000-0000-000000000001', 'Chart Structure', 'Support, resistance, and trend identification.', 1),
('20000000-0002-0003-0000-000000000001', '10000000-0002-0000-0000-000000000001', 'Volume & Trends', 'What volume tells you that price alone cannot.', 2);

INSERT INTO lessons (id, module_id, title, description, sort_order, has_quiz) VALUES
('30000000-0002-0001-0001-000000000001', '20000000-0002-0001-0000-000000000001', 'Candlestick Anatomy (OHLC)', 'Open, High, Low, Close — reading the building blocks of every chart.', 0, false),
('30000000-0002-0001-0002-000000000001', '20000000-0002-0001-0000-000000000001', 'Bullish vs Bearish Candles', 'What the color and size of candles tell you about buyer/seller strength.', 1, false),
('30000000-0002-0001-0003-000000000001', '20000000-0002-0001-0000-000000000001', 'Timeframes and What They Mean', '1-minute to monthly charts — choosing the right timeframe.', 2, true),
('30000000-0002-0002-0001-000000000001', '20000000-0002-0002-0000-000000000001', 'Support and Resistance', 'The two most important concepts in technical analysis.', 0, false),
('30000000-0002-0002-0002-000000000001', '20000000-0002-0002-0000-000000000001', 'Trend Identification', 'Higher highs, lower lows — reading market direction.', 1, false),
('30000000-0002-0002-0003-000000000001', '20000000-0002-0002-0000-000000000001', 'Intro to Chart Patterns', 'Flags, wedges, triangles — shapes that predict price movement.', 2, true),
('30000000-0002-0003-0001-000000000001', '20000000-0002-0003-0000-000000000001', 'Volume Basics', 'What volume tells you that price alone cannot.', 0, false),
('30000000-0002-0003-0002-000000000001', '20000000-0002-0003-0000-000000000001', 'Volume Confirmation', 'How to use volume to confirm breakouts and reversals.', 1, true);

-- TF 102
INSERT INTO modules (id, course_id, title, description, sort_order) VALUES
('20000000-0003-0001-0000-000000000001', '10000000-0003-0000-0000-000000000001', 'Why Risk Management Matters', 'The skill that separates profitable traders from the rest.', 0),
('20000000-0003-0002-0000-000000000001', '10000000-0003-0000-0000-000000000001', 'Position Sizing & Stops', 'Calculating size and protecting your capital.', 1);

INSERT INTO lessons (id, module_id, title, description, sort_order, has_quiz) VALUES
('30000000-0003-0001-0001-000000000001', '20000000-0003-0001-0000-000000000001', 'Why Risk Management is #1', 'The one skill that separates profitable traders from the rest.', 0, false),
('30000000-0003-0001-0002-000000000001', '20000000-0003-0001-0000-000000000001', 'Risk-to-Reward Ratios', 'How to ensure your winners are bigger than your losers.', 1, false),
('30000000-0003-0001-0003-000000000001', '20000000-0003-0001-0000-000000000001', 'The 1-2% Rule', 'Never risk more than 1-2% of your account on a single trade.', 2, true),
('30000000-0003-0002-0001-000000000001', '20000000-0003-0002-0000-000000000001', 'Position Sizing Basics', 'How to calculate the right number of shares or contracts.', 0, false),
('30000000-0003-0002-0002-000000000001', '20000000-0003-0002-0000-000000000001', 'Setting Stop Losses', 'Where to place your stop and why it matters more than your entry.', 1, true);

-- TF 103
INSERT INTO modules (id, course_id, title, description, sort_order) VALUES
('20000000-0004-0001-0000-000000000001', '10000000-0004-0000-0000-000000000001', 'Trading Emotions', 'Understanding the psychology that drives bad decisions.', 0),
('20000000-0004-0002-0000-000000000001', '10000000-0004-0000-0000-000000000001', 'Discipline & Planning', 'Building the habits and systems of a professional trader.', 1);

INSERT INTO lessons (id, module_id, title, description, sort_order, has_quiz) VALUES
('30000000-0004-0001-0001-000000000001', '20000000-0004-0001-0000-000000000001', 'Fear, Greed & FOMO', 'The three emotions that destroy trading accounts.', 0, false),
('30000000-0004-0001-0002-000000000001', '20000000-0004-0001-0000-000000000001', 'Revenge Trading & Tilt', 'How to recognize when emotions are driving your decisions.', 1, true),
('30000000-0004-0002-0001-000000000001', '20000000-0004-0002-0000-000000000001', 'Journaling Your Trades', 'The most powerful tool for improving — and most traders skip it.', 0, false),
('30000000-0004-0002-0002-000000000001', '20000000-0004-0002-0000-000000000001', 'Building a Trading Plan', 'Your complete blueprint — entries, exits, risk rules, and routine.', 1, true);

-- ============================================
-- INVESTOR TRACK
-- ============================================

INSERT INTO courses (id, slug, title, description, min_tier, sort_order, published) VALUES
('10000000-0005-0000-0000-000000000001', 'inv-101', 'Stock Market Investing', 'Fundamental analysis, value investing, portfolio building, and dividend strategies.', 'academy', 10, true),
('10000000-0006-0000-0000-000000000001', 'inv-102', 'Options for Investors', 'Covered calls, protective puts, LEAPS, and options as portfolio insurance.', 'academy', 11, true),
('10000000-0007-0000-0000-000000000001', 'inv-200', 'Crypto Investing', 'Blockchain fundamentals, DeFi, crypto portfolio allocation, and long-term strategies.', 'academy', 12, true),
('10000000-0008-0000-0000-000000000001', 'inv-201', 'Portfolio Management & Wealth Building', 'Asset allocation, diversification, tax-efficient investing, and generational wealth.', 'academy', 13, true),
('10000000-0009-0000-0000-000000000001', 'inv-300', 'Advanced Investment Analysis', 'Deep fundamental analysis, sector rotation, macro economics, and SEC filings.', 'academy', 14, true);

INSERT INTO modules (id, course_id, title, description, sort_order) VALUES
('20000000-0005-0001-0000-000000000001', '10000000-0005-0000-0000-000000000001', 'How the Stock Market Works', 'Exchanges, IPOs, and how companies go public.', 0),
('20000000-0005-0002-0000-000000000001', '10000000-0005-0000-0000-000000000001', 'Fundamental Analysis', 'Reading financials and valuing companies.', 1),
('20000000-0005-0003-0000-000000000001', '10000000-0005-0000-0000-000000000001', 'Building Your Portfolio', 'DCA, dividends, and putting it all together.', 2);

INSERT INTO lessons (id, module_id, title, description, sort_order, has_quiz) VALUES
('30000000-0005-0001-0001-000000000001', '20000000-0005-0001-0000-000000000001', 'How the Stock Market Works', 'Exchanges, IPOs, and how companies go public.', 0, false),
('30000000-0005-0001-0002-000000000001', '20000000-0005-0001-0000-000000000001', 'Reading Financial Statements', 'Income statements, balance sheets, and cash flow.', 1, false),
('30000000-0005-0001-0003-000000000001', '20000000-0005-0001-0000-000000000001', 'P/E Ratios & Valuation', 'How to tell if a stock is cheap or expensive.', 2, true),
('30000000-0005-0002-0001-000000000001', '20000000-0005-0002-0000-000000000001', 'Value Investing Principles', 'Buy great companies at fair prices.', 0, false),
('30000000-0005-0002-0002-000000000001', '20000000-0005-0002-0000-000000000001', 'Growth vs Value Investing', 'Two philosophies, different approaches, both profitable.', 1, true),
('30000000-0005-0003-0001-000000000001', '20000000-0005-0003-0000-000000000001', 'Dollar Cost Averaging', 'The simplest and most powerful investing strategy.', 0, false),
('30000000-0005-0003-0002-000000000001', '20000000-0005-0003-0000-000000000001', 'Dividend Investing', 'Getting paid to hold stocks — building passive income.', 1, false),
('30000000-0005-0003-0003-000000000001', '20000000-0005-0003-0000-000000000001', 'Building a Stock Portfolio', 'Diversification, allocation, and putting it all together.', 2, true);

-- ============================================
-- SWING TRADER TRACK — Core
-- ============================================

INSERT INTO courses (id, slug, title, description, min_tier, sort_order, published) VALUES
('10000000-0010-0000-0000-000000000001', 'sw-101', 'Swing Trading Foundations', 'What swing trading is, identifying opportunities, and multi-timeframe analysis.', 'academy', 20, true),
('10000000-0011-0000-0000-000000000001', 'sw-102', 'Technical Analysis for Swing Traders', 'Advanced patterns, indicators, Fibonacci, and volume analysis.', 'academy', 21, true),
('10000000-0012-0000-0000-000000000001', 'sw-200', 'Swing Trading Strategies', 'Pullbacks, breakouts, mean reversion, trend following, and gap trading.', 'academy', 22, true),
('10000000-0013-0000-0000-000000000001', 'sw-201', 'Swing Risk & Trade Management', 'Position sizing, ATR stops, scaling, overnight risk, and journaling.', 'academy', 23, true),
('10000000-0014-0000-0000-000000000001', 'sw-300', 'Advanced Swing Trading', 'Building systems, backtesting, intermarket analysis, and optimization.', 'academy', 24, true);

INSERT INTO modules (id, course_id, title, description, sort_order) VALUES
('20000000-0010-0001-0000-000000000001', '10000000-0010-0000-0000-000000000001', 'What is Swing Trading', 'Understanding where swing trading fits.', 0),
('20000000-0010-0002-0000-000000000001', '10000000-0010-0000-0000-000000000001', 'The Swing Trader''s Toolkit', 'Scanners, watchlists, and multi-timeframe analysis.', 1);

INSERT INTO lessons (id, module_id, title, description, sort_order, has_quiz) VALUES
('30000000-0010-0001-0001-000000000001', '20000000-0010-0001-0000-000000000001', 'Swing vs Day Trading vs Investing', 'Understanding where swing trading fits and why it works.', 0, false),
('30000000-0010-0001-0002-000000000001', '20000000-0010-0001-0000-000000000001', 'Identifying Swing Opportunities', 'How to spot setups with 2-14 day potential.', 1, true),
('30000000-0010-0002-0001-000000000001', '20000000-0010-0002-0000-000000000001', 'Multi-Timeframe Analysis', 'Using daily, 4H, and weekly charts together.', 0, false),
('30000000-0010-0002-0002-000000000001', '20000000-0010-0002-0000-000000000001', 'Scanners & Watchlists', 'Building your daily watchlist and finding the best setups.', 1, true);

-- ============================================
-- DAY TRADER TRACK — Core
-- ============================================

INSERT INTO courses (id, slug, title, description, min_tier, sort_order, published) VALUES
('10000000-0020-0000-0000-000000000001', 'dt-101', 'Day Trading Foundations', 'PDT rule, workspace setup, pre-market routine, and order types.', 'academy', 30, true),
('10000000-0021-0000-0000-000000000001', 'dt-102', 'Intraday Technical Analysis', 'Level 2, VWAP, ORB, intraday S/R, and tape reading.', 'academy', 31, true),
('10000000-0022-0000-0000-000000000001', 'dt-200', 'Day Trading Strategies', 'Momentum, reversals, scalping, gap and go, and news catalyst trading.', 'academy', 32, true),
('10000000-0023-0000-0000-000000000001', 'dt-201', 'Intraday Risk Management', 'Daily loss limits, time-based stops, scaling, and end-of-day procedures.', 'academy', 33, true),
('10000000-0024-0000-0000-000000000001', 'dt-300', 'Advanced Day Trading', 'Market microstructure, dark pools, order flow, and trading as a business.', 'academy', 34, true);

INSERT INTO modules (id, course_id, title, description, sort_order) VALUES
('20000000-0020-0001-0000-000000000001', '10000000-0020-0000-0000-000000000001', 'What is Day Trading', 'PDT rule, account requirements, and fundamentals.', 0),
('20000000-0020-0002-0000-000000000001', '10000000-0020-0000-0000-000000000001', 'Workspace & Routine', 'Setup, software, and the pre-market process.', 1);

INSERT INTO lessons (id, module_id, title, description, sort_order, has_quiz) VALUES
('30000000-0020-0001-0001-000000000001', '20000000-0020-0001-0000-000000000001', 'What is Day Trading', 'All positions closed same day — the intraday world.', 0, false),
('30000000-0020-0001-0002-000000000001', '20000000-0020-0001-0000-000000000001', 'The PDT Rule & Account Requirements', 'Pattern Day Trader rule, $25K requirement, and workarounds.', 1, false),
('30000000-0020-0001-0003-000000000001', '20000000-0020-0001-0000-000000000001', 'Order Types for Day Traders', 'Market, limit, stop, trailing stop — precision execution.', 2, true),
('30000000-0020-0002-0001-000000000001', '20000000-0020-0002-0000-000000000001', 'Day Trader''s Workspace Setup', 'Monitors, software, data feeds, and broker selection.', 0, false),
('30000000-0020-0002-0002-000000000001', '20000000-0020-0002-0000-000000000001', 'Pre-Market Routine', 'The 30-minute routine that sets up your entire trading day.', 1, false),
('30000000-0020-0002-0003-000000000001', '20000000-0020-0002-0000-000000000001', 'Market Hours & Session Analysis', 'Open, mid-day, power hour — when to trade and when to sit out.', 2, true);

-- ============================================
-- CONCENTRATION COURSES (Swing)
-- ============================================

INSERT INTO courses (id, slug, title, description, min_tier, sort_order, published) VALUES
('10000000-0030-0000-0000-000000000001', 'sw-so-101', 'Swing Trading Stocks', 'Stock selection, scanning for setups, sector analysis, and position management.', 'academy', 25, true),
('10000000-0031-0000-0000-000000000001', 'sw-so-200', 'Swing Trading Options', 'Buying calls/puts on swings, spreads, Greeks, and rolling positions.', 'academy', 26, true),
('10000000-0032-0000-0000-000000000001', 'sw-fx-101', 'Forex for Swing Traders', 'Currency pairs, sessions, interest rates, and economic calendars.', 'academy', 27, true),
('10000000-0033-0000-0000-000000000001', 'sw-fx-200', 'Forex Swing Strategies', 'Carry trades, news-based swings, multi-pair correlation.', 'academy', 28, true),
('10000000-0034-0000-0000-000000000001', 'sw-fu-101', 'Futures for Swing Traders', 'Futures contracts, major markets, margin, and contract specs.', 'academy', 29, true),
('10000000-0035-0000-0000-000000000001', 'sw-fu-200', 'Futures Swing Strategies', 'Seasonal patterns, spread trading, COT reports.', 'academy', 30, true),
('10000000-0036-0000-0000-000000000001', 'sw-cr-101', 'Crypto for Swing Traders', 'Crypto market structure, on-chain analysis, 24/7 considerations.', 'academy', 31, true),
('10000000-0037-0000-0000-000000000001', 'sw-cr-200', 'Crypto Swing Strategies', 'Altcoin rotation, BTC dominance, DeFi yield combos.', 'academy', 32, true);

-- ============================================
-- CONCENTRATION COURSES (Day Trading)
-- ============================================

INSERT INTO courses (id, slug, title, description, min_tier, sort_order, published) VALUES
('10000000-0040-0000-0000-000000000001', 'dt-so-101', 'Day Trading Stocks', 'Stock selection, small cap vs large cap, pre-market gaps, and DMA.', 'academy', 35, true),
('10000000-0041-0000-0000-000000000001', 'dt-so-200', 'Day Trading Options', '0DTE, weeklies, reading options flow, and scalping options.', 'academy', 36, true),
('10000000-0042-0000-0000-000000000001', 'dt-fx-101', 'Day Trading Forex', 'Session trading, pip values, major pair behavior, and execution.', 'academy', 37, true),
('10000000-0043-0000-0000-000000000001', 'dt-fx-200', 'Forex Day Trading Strategies', 'Session open breakouts, news spikes, London breakout.', 'academy', 38, true),
('10000000-0044-0000-0000-000000000001', 'dt-fu-101', 'Day Trading Futures', 'ES, NQ, CL, GC — tick charts, market profile, intraday leverage.', 'academy', 39, true),
('10000000-0045-0000-0000-000000000001', 'dt-fu-200', 'Futures Day Trading Strategies', 'Opening range, volume profile, order flow, footprint charts.', 'academy', 40, true),
('10000000-0046-0000-0000-000000000001', 'dt-cr-101', 'Day Trading Crypto', 'BTC/ETH intraday, funding rates, liquidations, DEX vs CEX.', 'academy', 41, true),
('10000000-0047-0000-0000-000000000001', 'dt-cr-200', 'Crypto Day Trading Strategies', 'Crypto breakouts, liquidation cascades, memecoin momentum.', 'academy', 42, true);
