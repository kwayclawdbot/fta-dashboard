# Light ↔ Dark token map — Cheat Code App canvas

Method: **positional lockstep walk**. Both canvases were opened in a real browser and every
painted node was visited along an identical DOM path, recording the computed colour for each
paint role (`bg` / `text` / `border-*`). A pair below therefore means *the same literal node*
paints with those two values — it is one semantic token expressed in two themes, not a guess.

**Structural identity: 2611 paint records in the dark canvas, all matched in the light canvas (0 unmatched paths).** The two files are the same DOM with a swapped palette.

Dark canvas ground: `#141216` · Light canvas ground: `#E9E5DC`

Clean 1:1 pairs: **86** · one-to-many (dark value that splits in light): **1**

## 1:1 pairs

| # | dark | light | paint records | roles |
| --- | --- | --- | --- | --- |
| 1 | `#2A2530` (T.violet-800) | `#E5DFD5` (T.orange-100) | 757 | border, bg, gradient |
| 2 | `#F4F0EC` (T.orange-50) | `#1A1614` (T.orange-900) | 245 | text, bg, border |
| 3 | `#17141A` (T.violet-900) | `#FFFFFF` (T.neutral-0) | 219 | bg, gradient, border |
| 4 | `#6E6774` (T.neutral-500) | `#9B9289` (T.orange-400) | 199 | text, bg |
| 5 | `#FF7A1A` (T.orange-400) | `#FF7A1A` (T.orange-400-b) | 170 | bg, text, border, gradient |
| 6 | `#8F8894` (T.neutral-400) | `#7B7369` (T.neutral-500) | 169 | text, border, bg |
| 7 | `#4AE383` (T.green-400) | `#0BA05A` (T.teal-600) | 103 | text, gradient, border, bg |
| 8 | `#FF9A4D` (T.orange-300) | `#D95E00` (T.orange-500) | 58 | text |
| 9 | `#3A3240` (T.violet-800-b) | `#D8D0C4` (T.orange-100-b) | 53 | bg, border |
| 10 | `#C8C2CE` (T.violet-200) | `#4E463E` (T.orange-700) | 51 | text |
| 11 | `#3A2418` (T.orange-800) | `#F2DCC2` (T.orange-100-c) | 47 | border, bg |
| 12 | `#000000` (T.neutral-950) | `#000000` (T.neutral-950) | 33 | border, text |
| 13 | `#FF4D6D` (T.red-300) | `#D92652` (T.red-400) | 28 | text, gradient, bg, border |
| 14 | `#FFC24B` (T.orange-300-b) | `#D99A00` (T.amber-500) | 25 | text, gradient, border, bg |
| 15 | `#E8E2E4` (T.pink-100) | `#2E2925` (T.orange-800) | 21 | text |
| 16 | `#3D8BFF` (T.blue-300-b) | `#3D8BFF` (T.blue-300) | 18 | text, border, bg |
| 17 | `#76B900` (T.lime-600) | `#76B900` (T.lime-600) | 13 | text, gradient |
| 18 | `#101408` (T.lime-900) | `#101408` (T.lime-900) | 12 | bg, gradient |
| 19 | `#1E3050` (T.blue-800) | `#B7D3E6` (T.blue-100) | 12 | border, gradient |
| 20 | `#A66BFF` (T.violet-200-b) | `#A66BFF` (T.violet-200) | 10 | border, gradient, text, bg |
| 21 | `#FF7A1A/0.5` (T.orange-400a50) | `#FF7A1A/0.5` (T.orange-400a50) | 8 | border |
| 22 | `#B8B2BC` (T.neutral-200) | `#5A534C` (T.orange-600) | 8 | text |
| 23 | `#2E3A18` (T.lime-800) | `#C9DCA8` (T.lime-200) | 8 | border |
| 24 | `#2E5578` (T.blue-600) | `#7FA8C4` (T.blue-300-b) | 8 | border |
| 25 | `#173A26` (T.green-850) | `#D4F0E0` (T.green-100) | 7 | bg |
| 26 | `#20503A` (T.teal-800) | `#96D4B4` (T.green-200) | 7 | gradient, border |
| 27 | `#5A2A38` (T.pink-700) | `#F0BFCB` (T.red-100) | 7 | gradient, border |
| 28 | `#1A0E10` (T.red-900) | `#1A0E10` (T.red-900) | 6 | bg, gradient |
| 29 | `#4A4250` (T.violet-700) | `#C4BBAD` (T.orange-200) | 6 | bg |
| 30 | `#5BC4F0` (T.blue-300) | `#0E86BE` (T.blue-500) | 6 | text, gradient, bg |
| 31 | `#111014` (T.indigo-900) | `#FBF8F2` (T.amber-0) | 6 | bg, border |
| 32 | `#E82127` (T.red-400) | `#E82127` (T.red-400-b) | 5 | text |
| 33 | `#0E1216` (T.blue-900) | `#0E1216` (T.blue-900) | 5 | bg |
| 34 | `#B8AEB0` (T.neutral-200-b) | `#7A6A5E` (T.orange-500-b) | 5 | text |
| 35 | `#FF7A1A/0.18` (T.orange-400a18) | `#FF7A1A/0.18` (T.orange-400a18) | 5 | shadow, bg |
| 36 | `#000000/0` (T.neutral-950a00) | `#000000/0` (T.neutral-950a00) | 4 | border, gradient |
| 37 | `#2E7A4E` (T.green-600) | `#6FCB9B` (T.green-300) | 4 | bg |
| 38 | `#322347` (T.violet-800-c) | `#D6C4EC` (T.violet-100) | 4 | border |
| 39 | `#1E3247` (T.blue-800-b) | `#B9D6EA` (T.blue-100-b) | 4 | border |
| 40 | `#FF7A1A/0.35` (T.orange-400a35) | `#FF7A1A/0.35` (T.orange-400a35) | 4 | border, shadow |
| 41 | `#FF7A1A/0.15` (T.orange-400a15) | `#FF7A1A/0.15` (T.orange-400a15) | 4 | shadow, border |
| 42 | `#FF7A1A/0.4` (T.orange-400a40) | `#FF7A1A/0.4` (T.orange-400a40) | 4 | border |
| 43 | `#4A2A12` (T.orange-800-b) | `#F2CFA6` (T.orange-100-g) | 4 | border |
| 44 | `#FFFFFF/0.2` (T.neutral-0a20) | `#FFFFFF/0.2` (T.neutral-0a20) | 4 | border |
| 45 | `#000000/0.35` (T.neutral-950a35) | `#FFFFFF/0.55` (T.neutral-0a55) | 3 | bg |
| 46 | `#0E1B2E` (T.blue-850) | `#E4F1FA` (T.blue-50) | 3 | bg, gradient |
| 47 | `#3A2530` (T.pink-800) | `#3A2530` (T.pink-800) | 3 | bg |
| 48 | `#7A4A22` (T.orange-700) | `#F0B375` (T.orange-200-b) | 3 | bg |
| 49 | `#4AE383/0.12` (T.green-400a12) | `#4AE383/0.12` (T.green-400a12) | 3 | bg |
| 50 | `#4AE383/0.14` (T.green-400a14) | `#4AE383/0.14` (T.green-400a14) | 3 | bg |
| 51 | `#140E14` (T.magenta-900) | `#140E14` (T.magenta-900) | 2 | bg |
| 52 | `#ED1C24` (T.red-400-b) | `#ED1C24` (T.red-400-c) | 2 | text |
| 53 | `#141208` (T.amber-900) | `#141208` (T.amber-900) | 2 | bg |
| 54 | `#FF9900` (T.orange-400-b) | `#FF9900` (T.orange-400-d) | 2 | text |
| 55 | `#FF7A1A/0.12` (T.orange-400a12) | `#FF7A1A/0.12` (T.orange-400a12) | 2 | bg, shadow |
| 56 | `#8A3446` (T.red-600) | `#EBA7B6` (T.red-200) | 2 | bg |
| 57 | `#4A2530` (T.pink-800-b) | `#F3D2DA` (T.red-100-b) | 2 | bg |
| 58 | `#FFFFFF` (T.neutral-0) | `#FFFFFF` (T.neutral-0) | 2 | text |
| 59 | `#4E4854` (T.neutral-700) | `#8A8178` (T.neutral-400) | 2 | text, bg |
| 60 | `#A9BED0` (T.blue-200) | `#43607A` (T.blue-600) | 2 | text |
| 61 | `#0D0B0E/0.8` (T.violet-900a80) | `#FFFFFF/0.85` (T.neutral-0a85) | 2 | bg |
| 62 | `#E50914` (T.red-500) | `#E50914` (T.red-500) | 1 | text |
| 63 | `#00A4EF` (T.blue-500) | `#00A4EF` (T.blue-500-b) | 1 | text |
| 64 | `#FF4D3D` (T.red-300-b) | `#FF4D3D` (T.red-300) | 1 | text |
| 65 | `#171226` (T.indigo-850) | `#171226` (T.indigo-850) | 1 | bg, gradient |
| 66 | `#C9B5FF` (T.indigo-100) | `#C9B5FF` (T.indigo-100) | 1 | text |
| 67 | `#3D5AFE` (T.blue-300-c) | `#3D5AFE` (T.blue-300-c) | 1 | bg |
| 68 | `#000000/0.55` (T.neutral-950a55) | `#FFFFFF/0.7` (T.neutral-0a70) | 1 | bg |
| 69 | `#B8B8A0` (T.yellow-300) | `#B8B8A0` (T.yellow-300) | 1 | text |
| 70 | `#A3E635` (T.lime-400) | `#A3E635` (T.lime-400) | 1 | text |
| 71 | `#B0A6C0` (T.violet-200-c) | `#B0A6C0` (T.violet-200-b) | 1 | text |
| 72 | `#9BB4C4` (T.blue-300-d) | `#9BB4C4` (T.blue-300-d) | 1 | text |
| 73 | `#4285F4` (T.blue-300-e) | `#4285F4` (T.blue-300-e) | 1 | text |
| 74 | `#101A28` (T.blue-850-c) | `#EDF5FB` (T.blue-50-c) | 1 | bg, gradient |
| 75 | `#5B7A94` (T.blue-500-b) | `#5B7A94` (T.blue-500-c) | 1 | text |
| 76 | `#FF4D6D/0.14` (T.red-300a14) | `#FF4D6D/0.14` (T.red-300a14) | 1 | bg |
| 77 | `#FFC24B/0.14` (T.orange-300a14) | `#FFC24B/0.14` (T.orange-300a14) | 1 | bg |
| 78 | `#FFFFFF/0.1` (T.neutral-0a10) | `#FFFFFF/0.1` (T.neutral-0a10) | 1 | bg |
| 79 | `#FF7A1A/0.9` (T.orange-400a90) | `#FF7A1A/0.9` (T.orange-400a90) | 1 | bg |
| 80 | `#FF7A1A/0.08` (T.orange-400a08) | `#FF7A1A/0.08` (T.orange-400a08) | 1 | bg |
| 81 | `#FF7A1A/0.07` (T.orange-400a07) | `#FF7A1A/0.07` (T.orange-400a07) | 1 | bg |
| 82 | `#FF7A1A/0.14` (T.orange-400a14) | `#FF7A1A/0.14` (T.orange-400a14) | 1 | shadow, bg |
| 83 | `#7FB3FF` (T.blue-200-b) | `#7FB3FF` (T.blue-200) | 1 | text |
| 84 | `#7FE3A8` (T.green-300) | `#7FE3A8` (T.green-300-b) | 1 | text |
| 85 | `#5BC4F0/0.06` (T.blue-300a06) | `#5BC4F0/0.06` (T.blue-300a06) | 1 | bg |
| 86 | `#FFD98A` (T.amber-200) | `#B07A00` (T.amber-600) | 1 | text |

## One-to-many — PORT CAREFULLY

These dark values do **not** collapse to a single light value. The light theme distinguishes
surfaces the dark theme merges. Bind by the role listed, never by the hex.

| dark | light values (× records) | total |
| --- | --- | --- |
| `#0D0B0E` (T.violet-900-b) | `#F7F4EF` ×135 · `#1A1614` ×31 · `#FFFFFF` ×4 | 170 |

## Type scale identity

Dark type variants: 157 · Light: 157 · shared: 157

**Type scale is identical across themes — port one scale.**


## Radius identity

**Identical (21 steps).** 0px, 1.5px, 2px, 3px, 4px, 5px, 6px, 7px, 8px, 9px, 10px, 11px, 12px, 13px, 14px, 16px, 18px, 20px, 24px, 34px, 50%

## Board parity

| # | dark board | light board | match |
| --- | --- | --- | --- |
| 1 | 01 HOME | 01 HOME | ✅ |
| 2 | 02 DISCOVER | 02 DISCOVER | ✅ |
| 3 | 03 TICKER · NVDA | 03 TICKER · NVDA | ✅ |
| 4 | 04 CLUB · FEED | 04 CLUB · FEED | ✅ |
| 5 | 05 LIVE · THE CLUB ROOM | 05 LIVE · THE CLUB ROOM | ✅ |
| 6 | 06 WATCH | 06 WATCH | ✅ |
| 7 | 07 YOU · PROFILE | 07 YOU · PROFILE | ✅ |
| 8 | 08 LEARN | 08 LEARN | ✅ |
| 9 | 09 SPLASH | 09 SPLASH | ✅ |
| 10 | 10 LOGIN | 10 LOGIN | ✅ |
| 11 | 11 PRICING | 11 PRICING | ✅ |
| 12 | 12 TICKER · TECHNICALS | 12 TICKER · TECHNICALS | ✅ |
| 13 | 13 TICKER · FUNDAMENTALS | 13 TICKER · FUNDAMENTALS | ✅ |
| 14 | 14 TICKER · KAI REPORT | 14 TICKER · KAI REPORT | ✅ |
| 15 | 15 DISCOVER · SCREENER | 15 DISCOVER · SCREENER | ✅ |
| 16 | 16 CLUB · CIRCLES | 16 CLUB · CIRCLES | ✅ |
| 17 | 17 WATCHLIST · CLUB PICKS | 17 WATCHLIST · CLUB PICKS | ✅ |
| 18 | 18 WATCH · KAI ALERTS | 18 WATCH · KAI ALERTS | ✅ |
| 19 | 19 ALERT · VIEW SETUP | 19 ALERT · VIEW SETUP | ✅ |
| 20 | 20 LEARN · PATH | 20 LEARN · PATH | ✅ |
| 21 | 21 LEARN · MICRO LESSON | 21 LEARN · MICRO LESSON | ✅ |
| 22 | 22 BELTS · RANK SYSTEM | 22 BELTS · RANK SYSTEM | ✅ |
| 23 | 23 INSIDE A CIRCLE | 23 INSIDE A CIRCLE | ✅ |
