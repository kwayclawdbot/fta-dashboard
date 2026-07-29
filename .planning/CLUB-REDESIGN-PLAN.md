# Cheat Code Club — App Redesign Program (owner brief 2026-07-24, decisions resolved same day)

Source: owner's full redesign brief (Club = default vibrant/social/premium experience; Family Mode preserved; FTA advanced desk). Assessment flags resolved by owner:
1. FAMILY MODE: keeps existing warm-paper + gold identity — NO purple repaint. (Purple dropped from the system.)
2. FTA gold = METALLIC confirmed. Belts: builder visually tests tuned amber-honey yellow against the new Volt-Orange system; if collision persists, restructure ladder toward White→Blue (drop yellow) — owner sees comparison before ship.
3. Teal NEVER on price/performance data (hard rule). Standard green stays for positive price.
4. LOGO: figure-8 / INFINITY mark (not C◇C — Chanel risk avoided): two loops, Volt-Orange gradient loop + Green-Teal gradient loop; solid single-color variants for ≤32px; wordmark CHEAT CODE CLUB geometric.
5. Five-item nav APPROVED (supersedes News top-level + Leaderboard top-level from 07-23): Home | Discover | Community | Watchlist | Profile-More (mobile ≤5, Community prominent). News→Discover tab; Leaderboard/Learn/Practice/Progress → Profile-More + contextual; kids keep their own adapted nav (missions/games surface for kids within the scheme — design in R2).
6. Mockup scale numbers: don't over-engineer cold-start thresholds (owner: don't worry) — still hide obviously-sad counts sensibly.
7. Kai Watch copy promises signals + interpretation, never thesis-omniscience.
8. No "gm" (crypto-coded); warm greeting without it.

## Design system (binding)
- Light default (60/40): warm sand base #F6ECD9-family (NOT pure white), cream cards, subtle borders, soft shadows. Dark: charcoal/obsidian #0F1115-family, high-energy not gamer.
- Accents: VOLT ORANGE #FF5A00→#FFB000 (brand/CTAs/active states — tune endpoint away from FTA gold; strategic not flooded) · GREEN-TEAL #00C389→#00B4D8 (support/secondary/AI-community accents; never price data) · KAI BLUE #2563FF (all Kai/AI surfaces) · FTA metallic gold (unchanged) · Family Mode = existing warm-paper+gold (unchanged).
- Type: Sora Bold/ExtraBold headlines · Inter UI · Space Mono/IBM Plex Mono market data. (Marketing site keeps Fraunces — accepted divergence.)
- Components: rounded cards, 8px system, restrained motion; NO glass excess/crypto-gamer/bank-generic; existing LazyMotion + token architecture extends with a MODE dimension (club|family|fta skins over shared components).

## OWNER VISUAL REFERENCE (binding inspo): .planning/redesign-refs/club-redesign-mockup-1.png (received 07-24)
Full app mockup — extract these patterns per lane:
- Logo: interlocked orange-C + teal-C reading toward ∞ — merge with the infinity decision (two interlocked gradient loops; the mock's CC-interlock IS the infinity DNA). Taglines ("Invest smarter…", "ONE CLUB. ALL INVESTORS.") = MARKETING ONLY — owner 07-24: NO taglines inside the app.
- Nav (R2): Home | Discover | ★COMMUNITY CENTER (owner override 07-24: center slot stays the elevated Community button — NOT a ⊕ action button, mock overridden) | Watchlist | Profile.
- Home (R3): greeting (NO "gm" per decision 8 — mock shows it, decision overrides) + day-streak chip; "Today in the Club" stat chips (members online, new posts, ideas shared, Kai alerts); Trending-in-the-Club ticker cards w/ sparklines; ASK KAI card = orange→teal gradient w/ KAI ROBOT MASCOT (new asset need — generate a consistent Kai mascot character, Higgsfield/nano-banana, keep friendly-not-childish) + "Ask Kai Anything" CTA; Recent Club Activity w/ avatars.
- Discover (R3): For You/Trending/Top Research/Most Discussed tabs; ranked trending list w/ sparklines; Top Research author cards (logo, title, author, likes/comments); Stock Finder card w/ "AI" chip + orange "Launch Stock Finder" CTA.
- Watchlist (R4): Watchlist Performance area chart (+total return, up/down/flat counts); rows w/ community-sentiment dot strips; KAI ALERTS card = orange→teal gradient header w/ per-alert toggle rows ("NVDA crossed above $1,000 · Price Alert · 2m ago") → maps directly onto C6 alert_rules/events.
- Family Mode (R5 check): mock shows PURPLE family mode — OVERRIDDEN by owner decision 1 (warm gold stays). Extract the STRUCTURE not the color: family header card (family name, member avatars, crown), Family Watchlist chip row, Weekly Family Research w/ "Teaching Moment" card, Family Progress tiles (portfolio return, lessons, streak).
- Dark mode: charcoal w/ same accent system (mock's right column) — matches R1 spec.

## Lanes (C7 runs parallel per owner; app repo)
- R1 TOKENS+BRAND: mode-dimensional token system (club palette above; family/fta skins = current identities), Sora/Inter/mono stack, infinity logo (SVG buildable — geometric; Higgsfield only if needed for brand-art moments), favicon/PWA icons, belt-vs-orange visual test (decision point → owner).
- R2 NAV: five-item scheme all roles (kid adaptation), floating Kai button, Kai leaves primary nav (contextual entries per brief §11), TopBar/More restructure, tour anchors updated (tour v3 content pass).
- R3 HOME+DISCOVER: Home = community-first (greeting no-gm, community activity w/ avatars, trending ticker cards, Ask-Kai gradient card, few quality posts — summary not infinite feed); Discover = For You/Trending/Top Research/Most Discussed/News tabs + Stock Finder (screener moves here, "Launch Stock Finder" CTA, advanced keep "Screener" inside).
- R4 WATCHLIST+KAI WATCH: performance summary + My Stocks (sentiment/discussion/avatars per row) + KAI WATCH premium surface: natural-language rule creation (Kai parses NL → C6 alert_rules; new signal kinds: sentiment-velocity, news-event; scoped promises per decision 7), visually premium Kai-blue treatment.
- R5 COMMUNITY+POLISH: For You/Following/Research/Discussions tabs, ticker-tag + bull/bear positioning on posts, ticker-page aggregation header, FTA density pass (denser data layouts, metallic gold), Family Mode integration check (mode-entry feel), drip/marketing screenshot refresh, cross-app QA.
Each lane: prod-verified, both themes, 390px, zero residue, tour/hints kept coherent.
