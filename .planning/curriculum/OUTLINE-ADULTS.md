# OUTLINE — ADULTS · 60 days, beginner → intermediate

## The spine: the investor's decision cycle

This isn't a textbook with a chapter list. It's **the loop a real investor runs**, taught in the order they run it. Every single day answers a question you're actually sitting there asking:

```
FIND ──▶ EVALUATE ──▶ DECIDE & SIZE ──▶ MANAGE ──▶ SELL ──┐
  ▲                                                        │
  └────────────────────────────────────────────────────────┘
```

| Phase | Days | The question a member is actually asking |
|---|---|---|
| **1 · FIND** | 1–12 | *Where do good picks even come from? How do I go from nothing to a short list?* |
| **2 · EVALUATE** | 13–24 | *What makes a pick a good one? How do I tell a good company at a fair price from a bad one?* |
| **3 · DECIDE & SIZE** | 25–36 | *I like it. When do I buy, and how much?* |
| **4 · MANAGE** | 37–48 | *I own it now. What am I supposed to be doing?* |
| **5 · SELL** | 49–60 | *When do I sell? How do I take a win without panicking or getting greedy?* |

**Here's what you walk out with. This is the promise, and every rep points at it.** By Day 60, an adult who shows up has:

- a **way of finding candidates** they run on a schedule — real life, the Club board, a screener, earnings movers — instead of buying whatever crossed their feed;
- **three written reasons for owning something**, made by filling in the four-question pick checklist, each one with a line that says what would prove them wrong;
- **paper positions where the share count came from maths**, each with a stop and a written reason;
- a **journal** written at the moment of the decision, not after they found out how it went;
- and **at least one scale-out and one get-out-because-I-was-wrong**, done for real — the two hardest moves in investing, both practised before either one costs a dollar.

**Textbook stuff shows up where it changes a decision, never as its own chapter.** Financial statements live inside EVALUATE as "reading the company's story", and only the lines that actually change your mind. Taxes live inside SELL, stuck to a sale you're really making. Spreading your money around lives inside DECIDE & SIZE as "how much should any one pick be". Index funds live in FIND, because they're the score your own picks have to beat. Charts show up three times, each time to do a job: find where buyers turned up before, put a stop somewhere sensible, and follow a winner up. There's no chapter on candlesticks, because a candlestick on its own has never answered a question anyone was asking.

---

## Register and mechanics

**How it reads:** like a friend who already learned this the hard way, explaining it over coffee. Plain and friendly, never childish. You're a smart adult who was just never taught this stuff — small words, real respect. Contractions everywhere. Short sentences. Every fancy word gets translated in the same breath. No exclamation marks, and nothing that sounds like a brochure. `feedbackScale("adult")` gives zero particles, so the reward is a sentence that lands. Which means the sentence has to be good.

**Structure:** 5 phases × 12 days. Each phase is two 6-day blocks: five teaching days, then a day where you pull it all back out. The second of those days in each phase is the **PHASE BOSS**.

```
Phase (12 days) = Block A: 5 teach + 1 CHECKPOINT
                  Block B: 5 teach + 1 BOSS
Checkpoints: days 6, 18, 30, 42, 54
Bosses:      days 12, 24, 36, 48, 60   ← node_kind: 'boss', carries quizId
```

**XP:** every lesson is worth exactly **50 XP** (`lesson.xp: 50`). The five bosses also carry a `quizId`: **+30 for a pass, +20 more if you got everything right first try.** Nothing else in a lesson pays XP.

**The belt walk** (full table in CURRICULUM-OVERVIEW §7): Yellow **Day 3** · Blue I **Day 8** · Blue II **Day 15** · Purple I **Day 26** · Purple II **Day 41** · **Black Belt lands during the Day 60 Graduation Boss** — 3,250 lifetime XP if you went perfect on all five bosses, against a 3,200 threshold. Pass the bosses without perfect runs and you finish on 3,150. Fifty short. You earn that last bit in the Club, and that's on purpose.

**Length:** 5–8 minutes; `duration_minutes` 5–8; 6–11 steps. Checkpoints run 8 minutes, bosses 9–10. Bosses are the only days allowed past 8.

**Step recipes** — the shape of the day follows the idea being taught. No recipe repeats more than three times in a phase.

| Code | Shape |
|---|---|
| **R1** Classic | warm-up · explainer · MC · explainer · true/false · MC · rep |
| **R2** Scene-led | warm-up · scene-MC · explainer · scene-MC · tap_the_scene · explainer · rep |
| **R3** Sort-led | warm-up · explainer · sort_buckets · explainer · sort_buckets · MC · rep |
| **R4** Dial-led | warm-up · explainer · estimate_dial · explainer · estimate_dial · MC · rep |
| **R5** Predict-led | warm-up · explainer · prediction · explainer · MC · true/false · rep |
| **R6** Build-led | warm-up · explainer · build_sentence · MC · build_sentence · rep |
| **R7** Order-led | warm-up · explainer · order_sequence · MC · explainer · rep |
| **R8** Checkpoint | 4 graded on the block · 2 `pool` (weakest due skills) · applied rep. No explainers — today you're pulling it back out, not learning it again |
| **R9** Boss | 10–11 steps, everything from the phase, ending on the Family Table. Carries `quizId` |
| **R10** Apply | warm-up · explainer · a longer real-world rep that makes you produce something |
| **R11** Allocate | warm-up · explainer · allocation_split · MC · allocation_split · rep |
| **R12** Compare | warm-up · explainer · scene_compare · MC · estimate_dial · rep |
| **R13** Checklist-run | warm-up · explainer · `checklist_card` fill · sort_buckets · MC · rep — the Phase 2 workhorse |
| **R14** Worked problem | warm-up · explainer · `calc_step` · explainer · `calc_step` · MC · rep — sizing, margins, scaling out, tax |

**The examples are real companies on real days that really happened.** Every number is written into the JSON by hand and dated, never pulled live: Costco, Nike, Nvidia, Adobe, Netflix, Chipotle, Delta, Ford, Visa, Home Depot, Spotify, Peloton, Meta (2022), Domino's.

---

# PHASE 1 · FIND — Where good picks come from (Days 1–12)

*Difficulty 1–2. New interactions required: none.*

### Block 1 — Getting set up (Days 1–6)

| Day | Lesson | The ONE concept | Steps · min | Interactions | Warm-up recalls | Real-world rep |
|---:|---|---|---|---|---|---|
| 1 | **You already know more than you think** | A share is a real slice of a real business. And you already know a pile of businesses — you paid several of them this week | 7 · 6 | R1 · MC ×2, true/false, sort_buckets | — (opens on the hook) | Add **one company you personally handed money to this month** to the family watchlist |
| 2 | **How does this company actually make money?** | The first question every time: can you say in one sentence who pays this company, and what they get for it? | 8 · 7 | R6 · build_sentence ("___ pays ___ for ___"), MC ×2 | Day 1 | Write that one sentence for yesterday's company, in your own words |
| 3 | **Where the price actually comes from** | Nobody sets the price. It's two lines of people haggling — what buyers are offering, what sellers are asking, and whoever gave in last. **← SAMPLE WRITTEN** | 8 · 7 | R5 · prediction, MC ×2, true/false | Day 2 | Find the bid, the ask, and the gap between them on a company from your watchlist |
| 4 | **Where your money is going to live** | A brokerage account is just a place that holds your shares for you. Which kind — taxable, IRA, Roth, 401(k) — depends on *when you'll need the money*, not on what's inside it | 9 · 8 | R3 · sort_buckets ×2 (which wrapper for which goal), order_sequence (tap → owned), MC | Day 1 | Name the account you'd use for money you need in three years, and say why |
| 5 | **The thing you have to beat** | An index fund buys a little of everything for almost nothing. So picking your own stocks only makes sense if you beat that. And fees come straight off your score | 9 · 8 | R4 · estimate_dial ×2 (what 1% costs over 20 years; what the index returned), MC, true/false | Day 4 | Add one broad index ETF to the watchlist. It's the measuring stick, not a pick |
| 6 | **CHECKPOINT · Getting set up** | Retrieval Days 1–5 + 2 pooled | 7 · 8 | R8 · MC ×2, sort_buckets, estimate_dial, pool ×2 | Days 1–5 | Write your three-line setup: which account, what you're measuring against, and what it costs you to trade |

### Block 2 — The hunt (Days 7–12)

| Day | Lesson | The ONE concept | Steps · min | Interactions | Warm-up recalls | Real-world rep |
|---:|---|---|---|---|---|---|
| 7 | **Where to look first: your own life** | You already pay about twenty companies every month. That's a list nobody else has, and you understand those businesses better than any screener will | 8 · 7 | R10 · build_sentence, sort_buckets ("do I understand how they make money — yes / not really"), MC | Day 2 | Walk one room and list every company whose stuff is in it. Keep the ones you can explain |
| 8 | **Where to look second: what other people noticed** | The Club board and the earnings-movers list tell you what somebody else *spotted*. Not what they *decided*. Take the name, never the verdict | 8 · 7 | R3 · sort_buckets ×2 (noticing / conclusion), MC ×2 | Day 7 | Take one name off the Club board and add it with a note saying what YOU want to check |
| 9 | **Where to look third: what a screener really does** | A screener — a filter for stocks — doesn't find good companies. It throws out the ones that break a rule you picked. So the rules are the whole skill | 9 · 8 | R3 · sort_buckets ×2 (filter narrows / filter tells you nothing), MC, estimate_dial | Day 8 | Run one filter in the app's screener and note how many names it knocked out |
| 10 | **Two filters worth running** | One **quality** filter — steady profits, not much debt, no drama. One **growth-at-a-fair-price** filter — growing fast without being priced like a miracle. Here are the exact recipes, run for real | 10 · 8 | R14 · calc_step, sort_buckets, MC ×2, extended screener rep | Day 9 | Run both recipes in the screener and save the two lists |
| 11 | **From 100 names to 5** | A company only earns a spot on your list when you can write one line saying why it's worth a look. No line, no spot | 9 · 8 | R6 · build_sentence ×2 (the watchlist note frame), sort_buckets, MC | Day 10 | Cut your list down to **five names**, each with its one-line reason |
| 12 | **🏆 PHASE BOSS · FIND** | Everything from Days 1–11, plus the Family Table. **What you walk out with: your own way of finding picks, written down so you can run it again** | 11 · 10 | R9 · order_sequence (the funnel), sort_buckets, MC ×4, estimate_dial, build_sentence, Family Table. **quizId** | Days 1–11 | Make and save your **Hunting Funnel card**: your four sources, your two filters, your rule for earning a spot, and the day of the week you do this |

---

# PHASE 2 · EVALUATE — What makes a good pick (Days 13–24)

*Difficulty 2–3. New interactions required: `checklist_card`, `sort_buckets`, `estimate_dial`, `calc_step`, `build_sentence`.*

**This whole phase is built around one thing: a four-question checklist.** You get the whole card on Day 13, then fill in one quarter of it at a time across Days 14–23. After that it never goes away — it comes back in every later phase as a real thing in the app. You don't finish this phase with knowledge. You finish it with **a filled-in checklist for three real companies.**

```
THE PICK CHECKLIST
 1 · THE BUSINESS   Do I get how it makes money — is it growing, and does it keep any of it?
 2 · THE MOAT       Why can't somebody else just take this?
 3 · THE PRICE      What am I paying versus what I'm getting — next to its own past, and next to its rivals?
 4 · THE THESIS     Why this, why now — and what would tell me I'm wrong?
 VERDICT            Strong · Solid · Mixed · Weak
```

### Block 3 — The business (Days 13–18)

| Day | Lesson | The ONE concept | Steps · min | Interactions | Warm-up recalls | Real-world rep |
|---:|---|---|---|---|---|---|
| 13 | **The whole checklist, in one look** | Four questions, in this order, because any one of them can end it right there and save you the other three. Business → Moat → Price → Thesis. **← WRITTEN AS THE TEEN SAMPLE** | 9 · 8 | R13 · checklist_card, order_sequence, sort_buckets, MC | Day 11 | Open a checklist card for the first of your five names |
| 14 | **Business Q1 · Who pays, and for what** | A big company is usually three businesses in a trench coat. Normally one of them brings in most of the money. Find that one | 9 · 8 | R3 · sort_buckets ×2 (which segment earns it), estimate_dial, MC | Day 13 | Find your company's revenue split and name the part that carries it |
| 15 | **Business Q2 · Is the growth real?** | Selling to more people is real growth. Charging the same people more, or buying another company, is a different thing — and it usually doesn't last as long | 10 · 8 | R14 · calc_step (growth rate), sort_buckets (volume / price / bolt-on), MC ×2 | Day 14 | Work out one company's revenue growth and say which kind it is |
| 16 | **Business Q3 · Does it keep any of it?** | Gross margin — what's left after making the thing — tells you what kind of business it is. Operating margin — what's left after running the whole company — tells you if the people in charge are any good | 10 · 8 | R14 · calc_step ×2 (both margins), estimate_dial (margin by industry), MC | Day 15 | Work out gross and operating margin, then compare both to three years ago |
| 17 | **Business Q4 · Cash or debt** | You only need three things here: how much they owe, whether they can cover the interest, and whether the profit shows up as actual cash | 10 · 8 | R3 · sort_buckets ×2, calc_step (net debt), MC | Day 16 | Find net debt and operating cash flow, and note whether cash flow beats net income |
| 18 | **CHECKPOINT · The company's story** | Five numbers that tell one story, not five separate facts. Retrieval Days 13–17 + 2 pooled | 9 · 8 | R8 · build_sentence (the story in one paragraph), calc_step, sort_buckets, MC, pool ×2 | Days 13–17 | Fill in **section 1** of the checklist card for all three of your candidates |

### Block 4 — Moat, price, and why you'd own it (Days 19–24)

| Day | Lesson | The ONE concept | Steps · min | Interactions | Warm-up recalls | Real-world rep |
|---:|---|---|---|---|---|---|
| 19 | **The moat, and how to test it** | A moat is the reason some other company can't just show up, copy you, and undercut you on price. Four kinds, and one test: did it hold its margins while somebody tried? | 10 · 8 | R3 · sort_buckets ×2 (which kind; real moat / just a good year), MC ×2 | Day 17 | Read the Competition part of a 10-K. Name the moat and your evidence — or say there isn't one |
| 20 | **What you pay vs. what you get** | A price on its own tells you nothing. $8 isn't cheap and $800 isn't expensive. It only means something next to what you're getting for it | 9 · 8 | R4 · estimate_dial ×2, MC ×2, true/false. **← WRITTEN AS THE KID SAMPLE** | Day 19 | Compare share price and market cap for two candidates, and note which is really the bigger company |
| 21 | **Is that number high? Compared to what?** | The P/E — the price divided by one year of profit — means nothing on its own. The real question is whether it's high **for this company** and high **for this industry** | 11 · 8 | R14 · calc_step (compute P/E), R12 · scene_compare (its own 5-year band), estimate_dial, MC | Day 20 | Work out one candidate's P/E, then put it next to its own 5-year range and one rival |
| 22 | **When paying up is fine, and when it's a trap** | A high price means people already expect big things. So ask what's baked in. If the company grows exactly as expected, the stock can still go nowhere | 10 · 8 | R5 · prediction (the beat that sold off), calc_step, MC ×2 | Day 21 | Find what growth people expect from your candidate, and ask whether the price already assumes it |
| 23 | **Your reason: why this, why now, what would prove me wrong** | A thesis — your written reason for owning something — needs three parts: what makes it work, why now, and what would tell you you're wrong. Skip that last part and it's just a feeling with a ticker on it | 10 · 8 | R6 · build_sentence ×2 (the thesis frame; the invalidation), sort_buckets (falsifiable / not), MC | Day 22 | Write the full reason line and the what-would-prove-me-wrong line for your best candidate |
| 24 | **🏆 PHASE BOSS · EVALUATE** | Everything from Days 13–23, plus the Family Table. **What you walk out with: three finished checklists, each with a verdict** | 11 · 10 | R9 · checklist_card, calc_step ×2, sort_buckets, MC ×4, build_sentence, Family Table. **quizId** | Days 13–23 | Fill all four sections for **three** companies and give each one a **Strong / Solid / Mixed / Weak** verdict with two reasons |

---

# PHASE 3 · DECIDE & SIZE — When to buy, and how much (Days 25–36)

*Difficulty 3–4. New interactions required: `calc_step` (heavily), `tap_the_scene`, `allocation_split`, `paper_trade` action.*

### Block 5 — Getting in (Days 25–30)

| Day | Lesson | The ONE concept | Steps · min | Interactions | Warm-up recalls | Real-world rep |
|---:|---|---|---|---|---|---|
| 25 | **Pick your price before you peek at the price** | Write down what you'd happily pay while the real price is still off the screen. After that it isn't analysis anymore. It's just whether you stick to it | 9 · 8 | R6 · build_sentence, prediction, MC ×2 | Day 23 | Write your buy price for one candidate before you open the quote — then open it |
| 26 | **Reading the chart for exactly one thing** | You're looking for one thing: where buyers have shown up before. Those levels are a memory of what people paid. Use them to time a buy, and for nothing else | 10 · 8 | R2 · tap_the_scene ×2, scene-MC, explainer | Day 25 | Find a level your candidate has bounced off three or more times |
| 27 | **Where the stop goes** | A stop — an order that gets you out automatically — goes where the reason you bought stops being true. Not at a round 10% because that felt about right | 10 · 8 | R2 · tap_the_scene, scene-MC, sort_buckets (stop reason valid / not), MC | Day 26 | Set the stop for your candidate and write the sentence that explains it |
| 28 | **Buy a bit now, or the whole thing?** | Buying in pieces keeps you paying attention. A small first bite makes you keep watching, and you only add the rest once you turn out to be right | 9 · 8 | R7 · order_sequence, MC ×2, true/false | Day 27 | Decide small-first or all-at-once for your candidate, and write what would make you add the rest |
| 29 | **Adding more: a plan, or a rescue?** | Same button, two very different things. Buying more because you planned to is a plan. Buying more because it dropped and you want your average to look better is something else | 10 · 8 | R3 · sort_buckets ×2 (planned / rescuing), prediction, MC | Day 28 | Look at any position you've ever added to and be honest about which one it was |
| 30 | **CHECKPOINT · Sticking to the plan** | Retrieval Days 25–29 + 2 pooled | 9 · 8 | R8 · tap_the_scene, sort_buckets, build_sentence, MC, pool ×2 | Days 25–29 | Write the entry plan for all three candidates: price, stop, small-first or all-at-once, and what triggers the rest |

### Block 6 — How much (Days 31–36)

| Day | Lesson | The ONE concept | Steps · min | Interactions | Warm-up recalls | Real-world rep |
|---:|---|---|---|---|---|---|
| 31 | **How many shares? Here's the maths** | `account × risk% ÷ (entry − stop) = shares`. You'll run it three times today, until it stops feeling like maths | 11 · 8 | R14 · calc_step ×3 (the full worked-problem class), MC ×2 | Day 27 | **Paper trade:** work out the size with the formula and open it at exactly that size |
| 32 | **How much to buy when there's no obvious exit** | Some things you plan to hold for years, so there's no price that says "get out". For those, size it by how much you'd be okay owning if you turn out to be wrong | 9 · 8 | R11 · allocation_split, MC ×2, estimate_dial | Day 31 | Size a no-stop position that way, and write down the number that made you comfortable |
| 33 | **How much should any ONE pick be?** | Putting a lot in one name is where the big gains come from, and also where accounts die. Here's the sane range, and what decides where you sit in it | 10 · 8 | R11 · allocation_split ×2 (with an outcome reveal), calc_step, MC | Day 32 | Check no paper position is bigger than the range you picked, and fix the one that is |
| 34 | **When your five picks are secretly one pick** | Five stocks that all move on the same news is one bet wearing five name tags. Counting names hides it | 10 · 8 | R3 · sort_buckets ×2 (shared driver / independent), allocation_split, MC | Day 33 | Name the two paper holdings most likely to drop on the same headline |
| 35 | **Cash, and the drop you can actually sit through** | Cash isn't doing nothing — it's got a job. And how big a drop you can stomach is something you plan for, not something you find out the hard way | 10 · 8 | R11 · allocation_split with drawdown reveal, calc_step, MC | Day 34 | Work out what your paper book is worth after a 30% fall, and decide honestly whether you'd still be holding |
| 36 | **🏆 PHASE BOSS · DECIDE & SIZE** | Everything from Days 25–35, plus the Family Table. **What you walk out with: three paper positions, sized on purpose, each with a stop** | 11 · 10 | R9 · calc_step ×3, tap_the_scene, allocation_split, MC ×3, sort_buckets, Family Table. **quizId** | Days 25–35 | Open **three** paper positions, each sized by the formula, each with a stop and a written reason for buying |

---

# PHASE 4 · MANAGE — Owning it without wrecking it (Days 37–48)

*Difficulty 4. New interactions required: `order_sequence`, `scene_compare`.*

### Block 7 — The owner's job (Days 37–42)

| Day | Lesson | The ONE concept | Steps · min | Interactions | Warm-up recalls | Real-world rep |
|---:|---|---|---|---|---|---|
| 37 | **Everything changes the second you own it** | Before you buy, you're hunting for reasons to like it. Once you own it the job flips — now you're hunting for reasons you're wrong. That flip does not happen on its own | 9 · 7 | R5 · prediction, MC ×2, true/false | Day 31 | Reread your own reason for buying and mark the one line you'd argue with today |
| 38 | **The note that makes future-you smarter** | Write down what you decided and why, right when you decide it. A note that only says what happened teaches you nothing later | 9 · 7 | R7 · order_sequence (what an entry contains), build_sentence, MC | Day 37 | Write the full journal entry for your oldest paper position — from memory first, then go check |
| 39 | **Earnings day as an owner** | You're not asking "was that a good number?" You're asking one narrow question: did the thing my reason depends on still happen? | 10 · 8 | R5 · prediction (plausible distractors only), scene-MC ×2, sort_buckets (touches my thesis / doesn't) | Day 38 | Before the numbers come out, write the one line in the release that would actually matter to you |
| 40 | **Great quarter, bad news** | What a company says about next quarter beats what it just reported about last quarter. A big number plus a gloomy forecast is bad news, no matter what the headline says | 10 · 8 | R2 · scene-MC ×2, tap_the_scene, explainer | Day 39 | Read one company's latest guidance line and mark it against your thesis: fine, dented, or broken |
| 41 | **Is your reason still true? The three-question check** | Once a month, ten minutes, three questions: *is the thing that makes it work still working · is the moat still holding · am I any closer to the line where I said I'd be wrong?* | 9 · 8 | R13 · checklist_card (the review card), sort_buckets, MC | Day 40 | Run the three questions on all three paper positions |
| 42 | **CHECKPOINT · Checking in on what you own** | Retrieval Days 37–41 + 2 pooled | 9 · 8 | R8 · checklist_card, order_sequence, sort_buckets, MC, pool ×2 | Days 37–41 | Write a one-page review of the whole paper book |

### Block 8 — Adjusting without meddling (Days 43–48)

| Day | Lesson | The ONE concept | Steps · min | Interactions | Warm-up recalls | Real-world rep |
|---:|---|---|---|---|---|---|
| 43 | **When adding more makes sense** | Add when your reason got stronger, not when the price got lower. Three triggers that count, and three that only feel like they do | 10 · 8 | R3 · sort_buckets ×2 (legitimate trigger / not), prediction, MC | Day 41 | Check whether any paper position has a real add trigger. Most days the answer is no |
| 44 | **Trimming for reasons that aren't "it went up"** | Three honest reasons to make a position smaller: it grew into too big a slice, your reason got weaker, or the money has a better job somewhere else | 10 · 8 | R11 · allocation_split (drifted → restored), calc_step, MC | Day 43 | Measure how much your book has drifted and point at the one position that's got too big |
| 45 | **News, noise, and the headline machine** | One test for any story: does it change the **business**, or just the **mood**? Nearly all of them only change the mood | 10 · 8 | R3 · sort_buckets ×2 (business / mood), scene_compare, MC | Day 44 | Sort three real headlines about a holding yourself, then check whether any of them changed your thesis |
| 46 | **Your brain on a position** | Three tricks your head plays once you own something. Anchoring — you get stuck on the price you paid. Loss aversion — losing hurts way more than winning feels good. And sunk cost — you keep throwing good money after bad | 10 · 8 | R5 · prediction (what will *you* do?), MC ×2, true/false | Day 45 | Write down the decision you'd most regret making if your biggest holding dropped 30% |
| 47 | **The bet you never decided to make** | Winners grow, losers shrink, and one day you look up and your book is making a big bet nobody ever chose | 10 · 8 | R11 · allocation_split, sort_buckets, calc_step, MC | Day 46 | Run the portfolio check and name the bet you're making that you never decided to make |
| 48 | **🏆 PHASE BOSS · MANAGE** | Everything from Days 37–47, plus the Family Table. **What you walk out with: a written review of every position you hold on paper** | 11 · 10 | R9 · checklist_card, sort_buckets ×2, scene-MC, MC ×4, allocation_split, Family Table. **quizId** | Days 37–47 | Full book review: for every position — is the reason still true?, the verdict, and what you'll do (hold / add / trim / exit), with your reasons |

---

# PHASE 5 · SELL — Exits, scaling out, taking profit (Days 49–60)

*Difficulty 4–5. New interactions required: `calc_step`, `scale_ladder` (see below), `tap_the_scene`.*

**This phase gets a full twelve days because it's the part nobody teaches, and the part the owner named first.** Everything up to here is about getting in. Then people improvise the getting-out, at the exact moment they're least able to think straight.

**One NEW INTERACTION belongs to this phase — `scale_ladder`.** You put 2–4 sell points on a price scale ("a third here, a third here, let the rest run"), set a stop for what's left, and then the lesson runs a real price path through *your* ladder. It shows you what you got, next to two other choices: *sold the lot at the first target* and *held everything to the end*. That's the only honest way to teach this, because scaling out is **never the best move looking backwards and usually the right move looking forwards** — and you only feel that by watching all three numbers at the same time. Inputs: `entry`, `stop`, `path[]` (authored price path), `tranches`, `reveal`. Win state: none — like `prediction`, it shows you something, it doesn't grade you.

### Block 9 — Ways out (Days 49–54)

| Day | Lesson | The ONE concept | Steps · min | Interactions | Warm-up recalls | Real-world rep |
|---:|---|---|---|---|---|---|
| 49 | **There are only two good reasons to sell** | Your reason stopped being true, or the money has a better job somewhere else. That's the list. Boredom, a red day, a scary headline, "locking in a win" — those are one of the two in a costume, or they're nothing | 10 · 8 | R3 · sort_buckets ×2 (honest reason / costume), prediction, MC | Day 46 | Take every sale you've ever made and sort it. Be honest, nobody else sees this |
| 50 | **Selling because your reason stopped being true** | The line you wrote on a calm day is the only one you'll believe on a bad one. Today you learn to write one that actually goes off | 10 · 8 | R6 · build_sentence ×2 (the invalidation frame), sort_buckets (would this actually trigger?), MC | Day 49 | Rewrite the what-would-prove-me-wrong line on all three paper positions so each one is a specific thing you could check |
| 51 | **Scaling out in thirds** | Sell some at your target, lift the stop on the rest, let the last bit run. You'll never get the top. Nobody does — not the pros, not you. That's what you pay to never get the bottom either. **← SAMPLE WRITTEN** | 11 · 8 | R14 + `scale_ladder` ×2, calc_step, MC | Day 50 | **Paper trade:** do a real scale-out on your best-performing paper position |
| 52 | **Following a winner up** | You move the stop up as the price climbs. Keep it too close and one normal wobble knocks you out of a winner for nothing | 10 · 8 | R2 · tap_the_scene ×2 (place the trail), scene_compare, MC | Day 51 | Set a trailing stop on what's left of yesterday's scale-out, and write the rule you used |
| 53 | **Taking profit when nothing is wrong** | Sometimes you sell a bit of something that's doing great, purely because it got too big. Nothing's broken. That's exactly what makes it hard | 10 · 8 | R11 · allocation_split (drifted → restored), calc_step, MC ×2 | Day 52 | Trim one paper position back to size, and write in the journal that size was the whole reason |
| 54 | **CHECKPOINT · How you get out** | Retrieval Days 49–53 + 2 pooled | 9 · 8 | R8 · scale_ladder, sort_buckets, calc_step, MC, pool ×2 | Days 49–53 | Write the exit plan for every paper position: what proves you wrong, first target, scale rule, trail rule |

### Block 10 — The cost, the head, and the rules (Days 55–60)

| Day | Lesson | The ONE concept | Steps · min | Interactions | Warm-up recalls | Real-world rep |
|---:|---|---|---|---|---|---|
| 55 | **What this sale actually costs you** | Sell inside a year and the tax bill is usually bigger than if you'd waited. Sometimes hanging on a few more weeks is worth it. Sometimes that's just an excuse not to sell | 11 · 8 | R14 · calc_step ×2 (after-tax proceeds both ways), sort_buckets (short / long), MC | Day 53 | For each paper position, note the date it crosses to long-term, and whether that changes your exit plan |
| 56 | **The loss you're allowed to take** | A loss can shrink your tax bill. But buy the same thing back too soon and the taxman pretends the loss never happened. That rule has a name — the wash sale — and people trip over it all the time | 10 · 8 | R3 · sort_buckets ×2 (wash sale / clean), order_sequence, MC | Day 55 | Work out whether any paper exit you've made would have counted as a wash sale |
| 57 | **Why you sell your winners too early** | People grab small wins fast and sit on losers forever. There's a name for it — the disposition effect — and it's the exact opposite of what works. Here's why your head does it | 10 · 8 | R5 · prediction, MC ×2, true/false | Day 51 | Write down the price where you'd think "I should have sold" — then notice you just glued yourself to a number |
| 58 | **Deciding now what you'll do later** | Write down today what you'll do at −20%, at −30%, and at +50%. Calm you makes better calls than scared you. So let calm you go first | 9 · 8 | R6 · build_sentence ×2, prediction, MC | Day 57 | Write and file the plan for the whole paper book, before you need it |
| 59 | **Your family's written rules** | One page for the household: what you'll own, how much of any one thing, how you buy, and what you do when it drops | 9 · 8 | R6 · build_sentence ×2 (the policy clauses), sort_buckets, MC | Day 58 | Draft your household's page and share it to the family surface |
| 60 | **🏆 GRADUATION BOSS · The whole loop** | One company, all five phases, start to finish — found it, checked it, sized it, owned it, got out. Everything from all 60 days | 11 · 10 | R9 · checklist_card, calc_step ×2, scale_ladder, tap_the_scene, MC ×4, Family Table. **quizId** | Days 1–59 | Walk the family through one whole case: how you found it, the checklist, the size and stop, the review, and the exit plan |

**Belt note:** the Day 60 boss is where lifetime XP crosses **3,200** — the Black Belt line — for anyone who went perfect on all five bosses. The ceremony fires inside the graduation screen. Anything less lands on 3,150, and the last 50 XP gets earned in the Club.

---

## Where the audit's coverage gaps landed

Every gap is covered, and every one is stuck to the decision that needs it instead of sitting on its own:

| Gap | Where it lives now | Attached to |
|---|---|---|
| Account types (taxable / IRA / Roth / 401k) | Day 4 | Where your money is going to live |
| Fees and expense ratios | Day 5 | The thing you have to beat |
| Index funds and ETFs | Day 5 | The measuring stick, and the default for money you're not picking |
| Research process | Days 7–12 | The hunt itself |
| Income statement | Days 14–16 | Business Q1–Q3 of the pick checklist |
| Balance sheet + cash flow | Day 17 | Business Q4 — only the lines that change your mind |
| Moats | Day 19 | Checklist section 2 |
| Valuation | Days 20–22 | Checklist section 3 |
| Chart reading | Days 26, 27, 52 | Timing a buy, placing a stop, following a winner up |
| Position sizing | Days 31–32 | With the maths, three times |
| Diversification & allocation | Days 33–35 | "How much should any one pick be" |
| Correlation | Day 34 | The five picks that are one pick |
| Drawdown | Day 35 | The drop you can sit through |
| Bonds / cash / emergency fund | Day 35 | Cash as a position with a job |
| Bid / ask / order matching | Day 3 | Where the price actually comes from |
| Rebalancing | Days 44, 53 | Trimming, and taking profit when nothing is wrong |
| Capital gains, dividends, wash sales | Days 55–56 | What **this** sale costs you |

## How this track lines up with teens and kids

**Same day number = same idea, in all three tracks.** Day 51 is scaling out for the adult, scaling out on the paper account for the teen, and "taking some of your win off the table" for the eight-year-old. Full tables in OUTLINE-TEENS.md and OUTLINE-KIDS.md, and the short version is in CURRICULUM-OVERVIEW §8.

**Adults come first.** Teens and kids are built down from these lessons. The idea gets picked here, and the other two tracks find an honest way to carry it.
