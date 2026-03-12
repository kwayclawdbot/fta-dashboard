-- Add YouTube video IDs to all lessons
-- These are public trading education videos from YouTube
-- Run in Supabase SQL Editor

-- Update all lessons to use YouTube provider and assign video IDs
-- We use a CTE to number lessons per course so we can assign videos systematically

WITH lesson_numbered AS (
  SELECT
    l.id,
    l.title,
    c.slug as course_slug,
    ROW_NUMBER() OVER (PARTITION BY c.slug ORDER BY m.sort_order, l.sort_order) as lesson_num
  FROM lessons l
  JOIN modules m ON l.module_id = m.id
  JOIN courses c ON m.course_id = c.id
)
UPDATE lessons SET
  video_provider = 'youtube',
  video_id = CASE
    -- Stocks & Options course videos (general trading education)
    WHEN id IN (SELECT id FROM lesson_numbered WHERE course_slug = 'stocks-options' AND lesson_num = 1) THEN 'p7HKvqRI_Bo'
    WHEN id IN (SELECT id FROM lesson_numbered WHERE course_slug = 'stocks-options' AND lesson_num = 2) THEN 'Xn7KWR9EOGQ'
    WHEN id IN (SELECT id FROM lesson_numbered WHERE course_slug = 'stocks-options' AND lesson_num = 3) THEN 'A7fZpDjz0aM'
    WHEN id IN (SELECT id FROM lesson_numbered WHERE course_slug = 'stocks-options' AND lesson_num = 4) THEN 'dAqGGGK5uAM'
    WHEN id IN (SELECT id FROM lesson_numbered WHERE course_slug = 'stocks-options' AND lesson_num = 5) THEN 'WYODNUqGLWk'
    WHEN id IN (SELECT id FROM lesson_numbered WHERE course_slug = 'stocks-options' AND lesson_num = 6) THEN '8TlvWAGMVas'
    WHEN id IN (SELECT id FROM lesson_numbered WHERE course_slug = 'stocks-options' AND lesson_num = 7) THEN 'ZJjRnKpg5LI'
    -- Forex course videos
    WHEN id IN (SELECT id FROM lesson_numbered WHERE course_slug = 'forex' AND lesson_num = 1) THEN 'DYpSm7E8FBg'
    WHEN id IN (SELECT id FROM lesson_numbered WHERE course_slug = 'forex' AND lesson_num = 2) THEN 'fgqBCB_zp4A'
    WHEN id IN (SELECT id FROM lesson_numbered WHERE course_slug = 'forex' AND lesson_num = 3) THEN 'WcfKaZL4vpA'
    WHEN id IN (SELECT id FROM lesson_numbered WHERE course_slug = 'forex' AND lesson_num = 4) THEN 'nseHrlLfMVg'
    WHEN id IN (SELECT id FROM lesson_numbered WHERE course_slug = 'forex' AND lesson_num = 5) THEN '6nb_05EEHDI'
    WHEN id IN (SELECT id FROM lesson_numbered WHERE course_slug = 'forex' AND lesson_num = 6) THEN 'c2n81dFoYBM'
    WHEN id IN (SELECT id FROM lesson_numbered WHERE course_slug = 'forex' AND lesson_num = 7) THEN 'VZDHTknVwjI'
    -- Futures course videos
    WHEN id IN (SELECT id FROM lesson_numbered WHERE course_slug = 'futures' AND lesson_num = 1) THEN 'CC9VeHrI3Es'
    WHEN id IN (SELECT id FROM lesson_numbered WHERE course_slug = 'futures' AND lesson_num = 2) THEN 'JZbqH_a_gzE'
    WHEN id IN (SELECT id FROM lesson_numbered WHERE course_slug = 'futures' AND lesson_num = 3) THEN 'De_KiJhPeks'
    WHEN id IN (SELECT id FROM lesson_numbered WHERE course_slug = 'futures' AND lesson_num = 4) THEN 'pWBZjIAxfNk'
    WHEN id IN (SELECT id FROM lesson_numbered WHERE course_slug = 'futures' AND lesson_num = 5) THEN '69cGkEU9Ciw'
    WHEN id IN (SELECT id FROM lesson_numbered WHERE course_slug = 'futures' AND lesson_num = 6) THEN 'UxJE0pGDZ84'
    WHEN id IN (SELECT id FROM lesson_numbered WHERE course_slug = 'futures' AND lesson_num = 7) THEN '3bFg31Cg5AE'
    -- Crypto course videos
    WHEN id IN (SELECT id FROM lesson_numbered WHERE course_slug = 'crypto' AND lesson_num = 1) THEN 'rYQgy8QDEBI'
    WHEN id IN (SELECT id FROM lesson_numbered WHERE course_slug = 'crypto' AND lesson_num = 2) THEN '41JCpzvnn_0'
    WHEN id IN (SELECT id FROM lesson_numbered WHERE course_slug = 'crypto' AND lesson_num = 3) THEN 'bBC-nXj3Ng4'
    WHEN id IN (SELECT id FROM lesson_numbered WHERE course_slug = 'crypto' AND lesson_num = 4) THEN 'GGberGnxiJk'
    WHEN id IN (SELECT id FROM lesson_numbered WHERE course_slug = 'crypto' AND lesson_num = 5) THEN '1YyAzVmP9xQ'
    WHEN id IN (SELECT id FROM lesson_numbered WHERE course_slug = 'crypto' AND lesson_num = 6) THEN 'Yb6825iv0Vk'
    WHEN id IN (SELECT id FROM lesson_numbered WHERE course_slug = 'crypto' AND lesson_num = 7) THEN 'SSo_EIwHSd4'
    ELSE video_id
  END
WHERE video_id IS NULL OR video_provider IS NULL;

-- Verify the update
SELECT c.slug, l.title, l.video_provider, l.video_id
FROM lessons l
JOIN modules m ON l.module_id = m.id
JOIN courses c ON m.course_id = c.id
ORDER BY c.sort_order, m.sort_order, l.sort_order;
