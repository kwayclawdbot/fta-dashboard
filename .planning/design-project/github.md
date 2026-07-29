repo: kwayclawdbot/fta-dashboard
branch: main

## Last sync
date: 2026-07-26T23:53:40Z

### Updated in this project
- Added a 5-card onboarding/splash carousel (cream + volt orange), light and dark
- Family mode grounded on the real belt ladder (src/lib/belts.ts: White → Yellow → Blue I/II → Purple I/II → Black) and real preset avatars

### Updated in this project
- Added Family mode: 8 screens on the warm-paper + gold register (:root default in globals.css), light and dark
- Copied family art: public/art/kitchen-story.jpg, couch-story.jpg, levelup-story.jpg, public/missions/snack-stock.webp, family-ceo.webp

### Updated in this project
- Read the club-mode design tokens (volt orange ramp, warm-sand light, obsidian dark) from src/app/globals.css
- Rebuilt the mobile app UI as 15 screens in both light and dark themes
- Added 7 screens the mock set didn't cover: Screener, Missions, Leaderboard, Practice Portfolio, Live Room, Alerts, Settings
- Copied real brand assets: public/icons/club-infinity-192.png (+512), public/assets/kai/avatar.webp, waving.webp, watchful.webp

## Screen map
| Screen | Built from |
| --- | --- |
| Home, Discover | src/app/(dashboard)/dashboard/DashboardHomeClient.tsx, discover/DiscoverClient.tsx |
| The Club | src/app/(dashboard)/community/CommunityClient.tsx |
| Watchlist / My Signals, Kai Watch | src/app/(dashboard)/watchlist/page.tsx, alerts/AlertsClient.tsx |
| Ticker research | src/app/(dashboard)/research/[ticker]/ResearchClient.tsx |
| Ask Kai | src/app/(dashboard)/kai/ |
| Learn | src/app/(dashboard)/courses/, flashcards/ |
| You | src/app/(dashboard)/progress/, u/[username]/ |
| Screener | src/app/(dashboard)/screener/, src/lib/screener.ts |
| Missions | src/app/(dashboard)/missions/ |
| Leaderboard | src/app/(dashboard)/leaderboard/ |
| Practice portfolio | src/app/(dashboard)/simulator/ |
| Live room | src/app/(dashboard)/live-sessions/, community/ClubLiveTab.tsx |
| Alerts | src/app/(dashboard)/alerts/, src/lib/push.ts |
| Settings | src/app/(dashboard)/settings/, src/components/ThemeToggle.tsx |
| Theme tokens | src/app/globals.css ([data-mode="club"] light + dark; :root family light + [data-theme="dark"]) |
| Family home, Kid home | src/app/(dashboard)/family/overview/, dashboard/DashboardHomeClient.tsx |
| Family members | src/app/(dashboard)/family/members/ |
| Family leaderboard | src/app/(dashboard)/family/leaderboard/, leaderboard/, src/lib/belts.ts |
| Games | src/app/(dashboard)/games/ (candle-battle, trend-or-trap), public/missions/ |
| Learn journey | src/app/(dashboard)/courses/, flashcards/, src/lib/free-journey.ts |
| Parent corner | src/app/(dashboard)/parent-corner/ |
| Progress | src/app/(dashboard)/progress/, src/lib/badges.ts |
| Belts + avatars | src/lib/belts.ts, src/lib/avatars.ts, src/components/BeltBadge.tsx, public/avatars/{adults,teens,kids}/ |
| Onboarding splash | src/app/(auth)/, src/lib/onboarding-profile.ts (owner mockups) |
