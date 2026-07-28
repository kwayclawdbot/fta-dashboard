-- 205 · BEAT LINKS — the four Wednesday beats pointed at a page that isn't there
--
-- Migration 199 seeded the pre-season rhythm with `href = '/live'` on every
-- `live` beat (w1-live … w4-live). There is no `/live` page. The live-class
-- surface is `/live-sessions` (src/app/(dashboard)/live-sessions). `/live` only
-- exists as an API namespace and as a middleware path prefix, so the four beats
-- would have 404d the moment week 1 opened on Aug 1 — the first click a
-- pre-season member makes at the Wednesday class.
--
-- EXACT-MATCH ON THE BAD VALUE. This does not touch a beat whose href has since
-- been edited to anything else, and re-running it is a no-op: after the first
-- pass no row matches '/live' any more. The renderer also rewrites '/live' at
-- read time (src/lib/challenge/state.ts · beatHref), so the two are belt and
-- braces — this migration is what makes the stored data honest.

update challenge_beats
   set href = '/live-sessions'
 where href = '/live';
