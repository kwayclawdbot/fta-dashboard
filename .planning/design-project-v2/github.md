repo: kwayclawdbot/fta-dashboard
branch: main

## Last sync
date: 2026-07-27T12:42:56Z

### Updated in this project
- Built mobile mockups of every Club screen in the reference UI language
- Lifted palette (volt #FF6A00, teal, kai blue), Sora/Inter/Plex Mono type, and at-scale fixture content from the repo

## Screen map
| Screen | Built from |
| --- | --- |
| Feed / Discussions / Changed my mind | src/app/(dashboard)/community/ClubModeShell.tsx, CommunityClient.tsx, src/components/social/ChangedMyMind.tsx |
| Discussion thread | src/components/social/TickerDebate.tsx, src/components/research/TickerThread.tsx |
| Share research (compose) | src/components/social/ResearchObjectCompose.tsx |
| The Lounge | src/components/community/LiveRooms.tsx, ClubChatDrawer.tsx |
| Live rooms / In the room | src/app/(dashboard)/community/ClubLiveTab.tsx, src/components/live/LiveEventCard.tsx |
| Member profile | src/app/(dashboard)/u/[username]/page.tsx, src/components/clubhome/People.tsx |
| Content + tokens | src/lib/clubhome/fixtures.ts, src/app/globals.css, tailwind.config.ts |
