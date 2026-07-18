-- ============================================
-- Link completed HTML lessons to database records
-- Run AFTER 010_seed_fta_curriculum.sql
-- ============================================

-- TF-100 Module 1: What Are Financial Markets
-- L1.1 - Why Financial Markets Exist
UPDATE lessons SET video_provider = 'html', video_id = 'https://fta-university.vercel.app/TF-100-Adults/Module-1/L1.1-slides.html'
WHERE id = '30000000-0001-0001-0001-000000000001';

-- L1.1 - How Exchanges Work (interactive version)
UPDATE lessons SET video_provider = 'html', video_id = 'https://fta-university.vercel.app/TF-100-Adults/Module-1/L1.1-interactive.html'
WHERE id = '30000000-0001-0001-0002-000000000001';

-- L1.1 - Supply and Demand (demo-v2 lesson)
UPDATE lessons SET video_provider = 'html', video_id = 'https://fta-university.vercel.app/demo-v2/lesson.html'
WHERE id = '30000000-0001-0001-0003-000000000001';

-- TF-100 Module 2: Types of Markets
-- The Stock Market
UPDATE lessons SET video_provider = 'html', video_id = 'https://fta-university.vercel.app/TF-100-Adults/Module-1/L1.2-slides.html'
WHERE id = '30000000-0001-0002-0001-000000000001';

-- The Forex Market
UPDATE lessons SET video_provider = 'html', video_id = 'https://fta-university.vercel.app/TF-100-Adults/Module-1/L1.3-slides.html'
WHERE id = '30000000-0001-0002-0002-000000000001';

-- The Futures Market
UPDATE lessons SET video_provider = 'html', video_id = 'https://fta-university.vercel.app/TF-100-Adults/Module-1/L1.4-slides.html'
WHERE id = '30000000-0001-0002-0003-000000000001';

-- TF-100 Module 3: How Markets Operate
-- Market Participants
UPDATE lessons SET video_provider = 'html', video_id = 'https://fta-university.vercel.app/TF-100-Adults/Module-1/L1.1-slides-v2.html'
WHERE id = '30000000-0001-0003-0001-000000000001';

-- TF-101 Module 1: Candlestick Basics
-- L1.1 - Candlestick Anatomy (OHLC)
UPDATE lessons SET video_provider = 'html', video_id = 'https://fta-university.vercel.app/TF-101-Adults/Module-1-v2/L1.1-lesson.html'
WHERE id = '30000000-0002-0001-0001-000000000001';

-- INV-101 Module 1: How the Stock Market Works
-- L1.1 - How the Stock Market Works
UPDATE lessons SET video_provider = 'html', video_id = 'https://fta-university.vercel.app/INV-101-Adults/Module-1/L1.1-slides.html'
WHERE id = '30000000-0005-0001-0001-000000000001';
