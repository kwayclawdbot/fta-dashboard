-- 209_seed_missions_expansion.sql
-- Kid Missions expansion (Lane C): 5 -> 12. Adds 7 business-detective quests in
-- the existing voice (concept-first, plain, no price talk, compliance-safe).
-- Sorts 6-12 append after the existing 1-5. The Missions surface already renders
-- any published row and auto-scales the set-progress math, so no component change.
--
-- Asset dependency (design follow-up, not a blocker): each new slug wants a
-- matching emblem .webp under /public/missions/ to sit alongside the first five.
--
-- Idempotent: ON CONFLICT (slug) DO NOTHING.

insert into fic_missions (slug, title, description, kid_prompt, xp_reward, sort) values
('moat-finder', 'Moat Finder',
 'Spot why one company is hard to copy: the first idea of a competitive advantage.',
 'Pick a company you love. Now imagine you tried to start one just like it tomorrow. What would be HARD to copy: the brand, the price, the app everyone already uses? Write down the one thing that protects it.',
 35, 6),

('two-sides', 'Two Sides',
 'Name one strength AND one risk for the same company: the habit of looking at both sides.',
 'Every company has a superpower and a weak spot. Pick one company, tell us ONE thing it does great, and ONE thing that could make people buy less of it. Both, not just the good part.',
 30, 7),

('need-or-want', 'Need or Want',
 'Sort what a company sells into needs vs wants: the choice behind every dollar.',
 'Look at a company you like. Is what it sells something people NEED (like food or a phone) or something they WANT (like a game skin or fancy sneakers)? Tell us which, and why it matters when times get tough.',
 25, 8),

('patience-pays', 'Patience Pays',
 'See how a small amount, left alone, grows: the long game in one picture.',
 'Ask a grown-up to help you use the practice chart. Imagine you put in a little and did NOTHING for a long time. What happened to the line? Tell us what surprised you about waiting.',
 30, 9),

('customer-detective', 'Customer Detective',
 'Interview a real customer to learn why a company keeps them: research from the real world.',
 'Find someone in your house who buys from a company you picked. Ask them: why THIS one and not a cheaper one? Write down their answer. That reason is worth real money to the company.',
 30, 10),

('compare-two', 'Compare Two',
 'Put two rivals side by side and make a call: the beginning of real analysis.',
 'Pick two companies that fight for the same customers (like two sneaker brands, or two game makers). Which one would YOU rather own a slice of, and what is the one reason that decided it?',
 35, 11),

('teach-it-back', 'Teach It Back',
 'Explain a company to someone younger than you: you only truly know it if you can teach it.',
 'Pick any company from your Family Watchlist and explain it to someone younger (a sibling, a cousin, a friend). Keep it so simple they get it. Then tell us the one sentence that made it click.',
 40, 12)

on conflict (slug) do nothing;
