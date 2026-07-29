# Live + Leaderboard canvas — extraction notes (fetched 2026-07-28 via DesignSync)
Source: `Cheat Code Live + Leaderboard.dc.html` in the claude.ai/design project (dbbc01a5-…). The full HTML is in the design project; these notes capture every element + exact values for implementation. Dark ground #0D0B0E phone frames, canvas #141216, same token family as the primary canvas.

## L1 — Live · Schedule (route: /live-sessions)
- Header: script "live" + orange pill "● 1 ON AIR" + right link "Replay library ›" (#FF9A4D).
- ON-AIR hero card: gradient `linear-gradient(140deg,#241009 0%,#17141A 62%)`, 1.5px #FF7A1A border, orange halo (.12): host avatar w/ cc-ping ring ("OG"), title "Market Open · The Club Room", meta "OptionsOG & Maya · started 9:30 AM · 2.3K in room", orange **Join** pill.
- Mono kicker "TODAY" (orange) then session rows (card #17141A, border #2A2530, r16): time column (mono 14px + "PM ET" 8px) | 1px divider | title + host chips (20px avatars, belt-colored 1.5px rings: TR=blue #3D8BFF, JC=purple #A66BFF, MY/OG=white) + "host · duration" | right: RSVP state — going = orange-tinted pill "Going ✓" (rgba(255,122,26,.12) bg, #FF7A1A border, #FF9A4D text) vs default ghost pill "RSVP" (#221E28/#2A2530/#C8C2CE), under it mono "412 RSVP'd".
- Event badge on session title: small yellow chip "TSLA DELIVERIES" (#FFC24B bg, #0D0B0E text, 8.5px).
- "Tomorrow · Wed Jul 29" kicker (soft, not orange) → same rows.
- Calendar strip: dashed-border card "📅 RSVPs land on your calendar + a nudge 10 min before doors" + "Sync calendar" link.
- 5-tab bar, Club active.

## L2 — Live · Replay Library (route: /live-sessions/replays or tab)
- Header: ← + script "replays" + right chip "★ PRO LIBRARY" (mono, #FFC24B on #221E28).
- Filter pills: All (orange active) / Market Open / Deep dives / AMAs.
- 2-col replay grid, card = thumbnail area (92px, diagonal-stripe placeholder `repeating-linear-gradient(135deg,#221A26 0 12px,#1B1520 12px 24px)`) + body:
  - duration chip bottom-right (mono on rgba(0,0,0,.7))
  - orange play button center (32px circle rgba(255,122,26,.92))
  - resume state: 3px orange progress bar bottom + meta "resume 27:04" (#FF9A4D)
  - watched state: green chip "✓ WATCHED" top-left (rgba(74,227,131,.15) bg / #4AE383)
  - LOCKED (Pro) state: desaturated thumb (filter:saturate(.4)), 🔒 circle instead of play, title in #C8C2CE, meta "Pro only" (#FFC24B)
  - body: title 11.5px/700, meta "Mon Jul 27 · OG & Maya".
- Upsell card (gradient+orange border, halo): 🔓 "Unlock the full vault — 214 replays · every session since day one · Pro, $99/mo" + orange "Go Pro" pill. (IMPLEMENTATION: use real pricing/entitlements copy.)
- Footer line: "Free members keep the last 2 Market Opens · replays post 1 hr after air".

## R1 — Leaderboard · The Ladder (route: /leaderboard)
- Header: script "the ladder" + link "How ranking works ›".
- Period pills: This week (orange) / Month / All-time + right dropdown chip "Rookies ▾" (cohort filter).
- Ranked list card (#17141A r18, rows split by #221E28 hairlines): rank # mono (gold #FFC24B for #1, #C8C2CE others) | 38px avatar w/ 2.5px belt ring + Black Belts get orange live dot | name + belt chip (BLACK=#F4F0EC bg/dark text, PURPLE=#A66BFF, BLUE=#3D8BFF, GREEN=#4AE383, YELLOW=#FFC24B) + mono meta "14 graded calls · 79% hit" | right: XP mono "2,840 ⚡" (gold for #1) + movement "▲ 3" (#4AE383) / "▼ 1" (#FF4D6D) / "— holds" (soft).
- YOUR row pinned below (gradient + orange border card): rank 38, avatar (emoji ok), "QuietFox WHITE **YOU**", meta "3 calls · 2 hits · 190 ⚡ to #30", right "486 ⚡ · ▲ 14 today", plus progress bar to next rank (orange gradient fill 72%).
- IMPLEMENTATION HONESTY: "graded calls · % hit" columns are Phase-W dependent — until the grading engine exists, show real XP ⚡ + real rank movement and OMIT calls/hit-rate meta (do not fake).

## R2 — Leaderboard · Family + Kid-safe (routes: /family/leaderboard + kid view of /leaderboard)
- Family ladder: script "family ladder" + "vs. other families ▾" chip; explainer line "Family score = the average of every member's weekly ⚡ — so the 11-year-old's missions count as much as dad's calls." Rows: rank | stacked member avatars (overlapping, belt/emoji rings) | family name (+ YOU tag) + meta ("4 members · 12-day streak 🔥", "Jordan carried Tuesday 💪") | right "612 ⚡ avg" + movement.
- Kid-safe variant (under 13): kicker "KID-SAFE VARIANT · WHAT JORDAN SEES"; card headed "🏅 Your week, Jordan" + mono "NO RANKS UNDER 13"; 3 stat tiles (⚡ 340 XP this week / 🔥 6 day streak / 🎯 5/7 missions); orange-tinted note "🆚 Kids race THEIR OWN last week — beat 310 ⚡ to level up. No strangers, no rankings."
- Weekly prize row: "🏆 Weekly prize · family #1 — Golden fridge-magnet badge + 500 bonus ⚡ split" + mono "RESETS SUN 8PM".
