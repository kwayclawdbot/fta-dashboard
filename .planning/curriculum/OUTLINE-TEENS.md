# OUTLINE — TEENS (15–18) · 60 days, beginner → intermediate

## What this track is

The junior **real** Club. Not a kids app with a teen skin. Not the adult track with the words made smaller.

A sixteen-year-old can smell condescension through a screen, and they'll close the tab the second they do. So the rule for building this off the adult track is narrow and strict: **the examples change and the situation we assume changes. The words don't.** We say *gross margin* and *operating margin* and *net debt* and *invalidation* — and then we explain them properly, using Spotify instead of Costco and a $400 balance instead of a retirement account.

Three rules run every line of teen copy:

1. **The stakes are their stakes.** First-job money. A $400 balance. A car in two years. A summer paycheck that legally counts for a Roth IRA. Never "your retirement", never "when you have a mortgage", never "as you approach your peak earning years".
2. **Don't ask permission.** *"Here's how you test a moat."* Not *"Let's find out what a moat might be!"* We're not asking whether they'd like to learn this.
3. **They're allowed to be right.** A bunch of days in this track land on things most adults get wrong — that a $9 stock isn't cheaper than a $900 one, that a company can be profitable and still run out of money, that beating earnings and dropping 9% is normal. When a teen nails one of those, the feedback says so. Plainly, and once. Earn it, don't sprinkle it.

---

## The spine: the investor's decision cycle

Same spine as adults, same day numbers, same concept on each day. This isn't a parallel course. It's the same course, said a different way.

```
FIND ──▶ EVALUATE ──▶ DECIDE & SIZE ──▶ MANAGE ──▶ SELL ──┐
  ▲                                                        │
  └────────────────────────────────────────────────────────┘
```

| Phase | Days | The question a teen is actually asking |
|---|---|---|
| **1 · FIND** | 1–12 | *Where do picks even come from? I've got $400 and a list of nothing.* |
| **2 · EVALUATE** | 13–24 | *How do I tell a good business from a company I just happen to like?* |
| **3 · DECIDE & SIZE** | 25–36 | *I like it. When do I buy, and how much of a small account goes in?* |
| **4 · MANAGE** | 37–48 | *I own it. Am I supposed to be doing something every day, or not?* |
| **5 · SELL** | 49–60 | *When do I sell — without panicking, and without holding forever out of pure stubbornness?* |

**Where they end up.** By Day 60, a teen who's shown up has:

- a **hunting funnel** they run on a set day of the week — one that survives a school week;
- **three written theses** built from the four-question pick checklist, each one with an invalidation they could actually go and check;
- **a paper book of sized positions**, every one sized by maths they did themselves, each with a stop and a written reason;
- a **journal** written at the moment they decided, not after they found out;
- **at least one scale-out and one thesis-broke exit they actually executed**, both practised twice, years before either one costs real money;
- and two things almost nobody gets told at seventeen: **whose name is on their account and what changes at 18**, and — if they earn — **that a paycheck makes them eligible for a Roth IRA.**

**The paper account opens on Day 11**, at the end of the hunt, so the candidates found in Phase 1 have somewhere to go and Phases 3, 4 and 5 have somewhere to run. Everything from Day 25 on happens in that account.

**Textbook stuff is woven in where it's doing a job, never as its own unit.** Financial statements live inside EVALUATE, as reading a company's story, and only the lines that change a decision. Account mechanics live on Day 4, attached to opening one. Holding periods live on Day 55, attached to an exit. Diversification lives in DECIDE & SIZE, as *how much of a small account any one name can be*. Index funds show up in FIND, as the bar a pick has to clear. Chart reading shows up three times, each time with a job: finding where buyers turned up before, placing a stop, trailing an exit. There's no chapter on candlesticks, because a candlestick on its own has never answered a question anyone was actually asking.

---

## Register and mechanics

**Register:** talk to them like a peer. Direct, unhurried. The reader is a capable person who hasn't been taught this yet — not someone who needs coaxing. No exclamation marks, no "let's dive in", no "you've got this". `feedbackScale("teen")` gives **12 particles** — enough that a right answer feels like something, few enough that the sentence still has to carry the reward. Kai speaks three times and never celebrates: an intro saying why today matters, a line after a wrong answer that names why the wrong option looked good, and an outro pointing at the next decision.

**Difficulty ceiling is 4** (adults go to 5). Same ramp shape, top of the range one notch lower. The notch shows up as ambiguity — teens get fewer days where two answers are both defensible and the graded one wins on having the better reason.

**Structure:** 5 phases × 12 days. Each phase is two 6-day blocks: five teaching days, then a retrieval day. The second retrieval day of each phase is the **PHASE BOSS**.

```
Phase (12 days) = Block A: 5 teach + 1 CHECKPOINT
                  Block B: 5 teach + 1 BOSS
Checkpoints: days 6, 18, 30, 42, 54
Bosses:      days 12, 24, 36, 48, 60   ← node_kind: 'boss', carries quizId
```

**XP:** every lesson is exactly **50 XP** (`lesson.xp: 50`). The five bosses also carry a `quizId`: **+30 for passing, +20 more for a perfect first-try run.** Nothing else inside a lesson gives XP. **Paper-account returns never feed XP and never feed a leaderboard** — a teen who gets lucky on a paper position gains nothing on the path, and one who gets unlucky loses nothing. The XP is for the reps, not the results. That rail is the only thing stopping the paper book turning into a scoreboard.

**The belt walk** (same as adults, see CURRICULUM-OVERVIEW §7): Yellow **Day 3** · Blue I **Day 8** · Blue II **Day 15** · Purple I **Day 26** · Purple II **Day 41** · **Black Belt crosses during the Day 60 Graduation Boss** — 3,250 lifetime XP with five perfect bosses, against a 3,200 threshold. Pass the bosses without perfect runs and you finish on 3,150 — fifty short — and you earn the last of it in the Club. That's on purpose, and it's the same for everyone.

**Length:** `duration_minutes` 5–8; **8–11 steps**. Checkpoints run 8 minutes; bosses 9–10, and bosses are the only days allowed past 8. Teen lessons carry the same number of steps as the adult day at the same number, or slightly more, with each step shorter.

**Step recipes** — the structure follows the concept. No recipe repeats more than three times in a phase.

| Code | Shape |
|---|---|
| **R1** Classic | warm-up · explainer · MC · explainer · true/false · MC · rep |
| **R2** Scene-led | warm-up · scene-MC · explainer · scene-MC · tap_the_scene · explainer · rep |
| **R3** Sort-led | warm-up · explainer · sort_buckets · explainer · sort_buckets · MC · rep |
| **R4** Dial-led | warm-up · explainer · estimate_dial · explainer · estimate_dial · MC · rep |
| **R5** Predict-led | warm-up · explainer · prediction · explainer · MC · true/false · rep |
| **R6** Build-led | warm-up · explainer · build_sentence · MC · build_sentence · rep |
| **R7** Order-led | warm-up · explainer · order_sequence · MC · explainer · rep |
| **R8** Checkpoint | 4 graded on the block · 2 `pool` (weakest due skills) · applied rep. No explainers — this is retrieval, not re-teaching |
| **R9** Boss | 10–11 steps, cumulative across the phase, ending on the Family Table. Carries `quizId` |
| **R10** Apply | warm-up · explainer · extended real-world rep with a structured output |
| **R11** Allocate | warm-up · explainer · allocation_split · MC · allocation_split · rep |
| **R12** Compare | warm-up · explainer · scene_compare · MC · estimate_dial · rep |
| **R13** Checklist-run | warm-up · explainer · `checklist_card` fill · sort_buckets · MC · rep — the Phase 2 workhorse |
| **R14** Worked problem | warm-up · explainer · `calc_step` · explainer · `calc_step` · MC · rep — sizing, margins, scaling out, holding periods |

**Worked examples** are real companies on real historical episodes. Every figure is authored and dated in the JSON, never quoted live: **Spotify, Nike, Roblox, Chipotle, Nvidia, Netflix, Apple, Duolingo, Shopify, Costco, Crocs, Celsius, Take-Two.** They're picked because a teen can already tell you what the company sells — which means the lesson gets to spend all of its time on the part they don't know.

**Verdict words are exactly four, in this order, everywhere: Strong · Solid · Mixed · Weak.** Never good/bad, never buy/avoid, never stars.

---

# PHASE 1 · FIND — Where picks come from (Days 1–12)

*Difficulty 1–2. New interactions required: none.*

### Block 1 — The workshop (Days 1–6)

| Day | Lesson | The ONE concept | Steps · min | Interactions | Warm-up recalls | Real-world rep |
|---:|---|---|---|---|---|---|
| 1 | **Somebody owns Spotify. The list is open.** | A share is a real slice of a real company. Every company you use has a list of owners, and it's not a closed list | 8 · 6 | R1 · MC ×2, true/false, sort_buckets | — (opens on the hook) | Add **one company you personally paid money to this month** to the family watchlist |
| 2 | **You use it free. Somebody's still paying.** | Every pick starts with one question: who hands this company money, and what for? If you can't say it in one sentence, you don't have a pick yet | 9 · 7 | R6 · build_sentence ("___ pays ___ for ___"), MC ×2, sort_buckets | Day 1 | Write the one-sentence money model for yesterday's company, in your own words |
| 3 | **Nobody sets the price** | Nobody decides the price. It's two lines of people haggling — what buyers offer, what sellers want, and whoever caved last | 9 · 7 | R5 · prediction, MC ×2, true/false **← SAMPLE WRITTEN** | Day 2 | Find the bid, the ask and the gap between them on a watchlist company |
| 4 | **Whose name is on the account** | Every account has an owner and someone who controls it, and until you're 18 those are two different people. A custodial (UTMA) account is legally *yours* but your parent runs it. And the day you earn a paycheck, a second door opens — the Roth IRA | 11 · 8 | R3 · sort_buckets ×2 (owner / controller · counts as earned income / doesn't), order_sequence (open → co-sign → 18 → 21), estimate_dial (Roth cap vs. your actual earnings), MC | Day 1 | Find out which account you're on and write down **the date control transfers to you**. If you earned anything this year, write the number you could legally put in a Roth |
| 5 | **You're competing with a fund that doesn't try** | An index fund buys the whole market for almost nothing, and it beats most people who try. Picking your own stocks is only worth doing if you clear that bar — so fees and the benchmark are one conversation, not two | 10 · 8 | R4 · estimate_dial ×2 (what a 1% fee costs on *your* balance by 30; what the index returned), MC, true/false | Day 4 | Add one broad index ETF as your yardstick, and write down its last full-year return. That number is the bar |
| 6 | **CHECKPOINT · Setting up** | Retrieval Days 1–5 + 2 pooled | 8 · 8 | R8 · MC ×2, sort_buckets, estimate_dial, pool ×2 | Days 1–5 | Write your three-line workshop statement: which account you're on, what your benchmark is, and what one trade costs you |

### Block 2 — The hunt (Days 7–12)

| Day | Lesson | The ONE concept | Steps · min | Interactions | Warm-up recalls | Real-world rep |
|---:|---|---|---|---|---|---|
| 7 | **Your phone is a shortlist** | You already pay fifteen or twenty companies. That's a candidate list nobody else has, and you understand those products better than any screen could tell you | 9 · 7 | R10 · build_sentence, sort_buckets ("I can explain how they make money — yes / not really"), MC | Day 2 | Open your app list and last month's order history. List every company. Keep only the ones you can explain |
| 8 | **Take the name, never the verdict** | Somebody else noticing a stock gives you a name. Somebody else's conclusion isn't evidence. A stock you saw posted is a name to look into, not a case that's already been made | 9 · 7 | R3 · sort_buckets ×2 (noticing / conclusion · what they saw / what they concluded), MC ×2 | Day 7 | Take one name off the Club board or from someone who mentioned it this week. Add it with a note saying what **you** want to check — and don't write down what they said |
| 9 | **A screener only deletes** | A screener never finds you a good company. All it does is remove the ones that fail a rule you picked. Which makes the rules the entire skill | 10 · 8 | R3 · sort_buckets ×2 (this filter narrows / this filter tells you nothing), MC, estimate_dial | Day 3 | Run one filter in the screener and write down how many names it removed and how many survived |
| 10 | **Good companies, and good companies you can afford** | Two screens worth running. A **quality screen** — steady margins, low debt, returns that keep showing up. And a **growth-at-a-reasonable-price screen** — growth you're not paying a silly price for. You set both up for real, filter by filter | 11 · 8 | R14 · calc_step, sort_buckets, MC ×2, extended screener rep | Day 9 | Run both recipes in the screener and save the two result sets |
| 11 | **No note, no slot** | A name only earns a watchlist slot when you can write the one line saying why it's worth studying. No line, no slot. Today the paper account opens and the survivors go in | 10 · 8 | R6 · build_sentence ×2 (the watchlist-note frame), sort_buckets, MC | Day 8 | Cut your combined list down to **five names**, each with a one-line reason — then **open your paper account** (paper money, no real dollars, and it stays that way for the rest of this course) |
| 12 | **🏆 PHASE BOSS · FIND** | Everything from Days 1–11, plus the Family Table. **Output: your hunting funnel, written down so you can run it again** | 11 · 10 | R9 · order_sequence (the funnel), sort_buckets, MC ×4, estimate_dial, build_sentence, Family Table. **quizId** | Days 1–11 | Produce and save the **Hunting Funnel card**: your four sources, your two screens, your slot rule, and the day of the week you run it — pick a day that survives a school week |

---

# PHASE 2 · EVALUATE — What makes a good pick (Days 13–24)

*Difficulty 2–3. New interactions required: `checklist_card`, `sort_buckets`, `estimate_dial`, `calc_step`, `build_sentence`.*

**This whole phase is built around one thing: the four-question pick checklist.** It shows up whole on Day 13, gets filled in a quarter at a time across Days 14–23, and comes back as a live object in every phase after this. A teen finishes this phase not with knowledge but with **filled-in checklists for three real companies, each carrying a verdict they can defend at a dinner table.**

```
THE PICK CHECKLIST
 1 · THE BUSINESS   Do I understand how it makes money — is it growing, and does it keep what it earns?
 2 · THE MOAT       Why can't a competitor take this?
 3 · THE PRICE      What am I paying versus what I'm getting — against its own history and its peers?
 4 · THE THESIS     Why this, why now — and what would prove me wrong?
 VERDICT            Strong · Solid · Mixed · Weak
```

### Block 3 — The business (Days 13–18)

| Day | Lesson | The ONE concept | Steps · min | Interactions | Warm-up recalls | Real-world rep |
|---:|---|---|---|---|---|---|
| 13 | **Four questions. Any one of them can end it.** | Business → Moat → Price → Thesis, in that order. Each question can end the whole thing on the spot, which saves you the evening you'd have spent on the next one | 10 · 8 | R13 · checklist_card, order_sequence, sort_buckets, MC **← SAMPLE WRITTEN** | Day 11 | Open a checklist card for the first of your five names |
| 14 | **One company, three businesses, one that matters** | Revenue by segment — how much money comes from each part of the company. Take-Two isn't one business and neither is Apple. Usually one part is carrying the whole result | 10 · 8 | R3 · sort_buckets ×2 (which segment earns it · big / actually matters), estimate_dial, MC | Day 13 | Find your company's revenue split and name the segment that carries it |
| 15 | **More customers, or just a higher price?** | Growth from *more users* lasts. Growth from *raising the price*, or from *buying another company*, is real money and a completely different thing. The market pays for the three very differently | 11 · 8 | R14 · calc_step (growth rate), sort_buckets (more users / higher price / bolt-on), MC ×2 | Day 14 | Compute one company's revenue growth, then say which of the three kinds it is |
| 16 | **Why Spotify keeps 25 cents and Nvidia keeps 75** | **Gross margin** — what's left of each dollar after making the thing — tells you what kind of business it is. **Operating margin** — what's left after running the whole company — tells you whether the people in charge are any good. Two numbers, two totally different jobs | 11 · 8 | R14 · calc_step ×2 (both margins), estimate_dial (margin by industry), MC | Day 15 | Compute gross and operating margin for one candidate, then compare both to three years ago |
| 17 | **A company can be profitable and still run out of money** | Only three lines off the balance sheet and cash flow statement change a decision: net debt (what it owes minus what it's got), whether it can cover its interest, and whether the profit is showing up as actual cash | 11 · 8 | R3 · sort_buckets ×2 (changes the decision / doesn't), calc_step (net debt), MC | Day 2 | Find net debt and operating cash flow. Note whether cash flow is bigger than net income, and by how much |
| 18 | **CHECKPOINT · Reading the company's story** | The five numbers tell one story, not five separate facts. Retrieval Days 13–17 + 2 pooled | 10 · 8 | R8 · build_sentence (the story in one paragraph), calc_step, sort_buckets, MC, pool ×2 | Days 13–17 | Fill in **section 1** of the checklist card for all three of your candidate companies |

### Block 4 — Moat, price, thesis (Days 19–24)

| Day | Lesson | The ONE concept | Steps · min | Interactions | Warm-up recalls | Real-world rep |
|---:|---|---|---|---|---|---|
| 19 | **How to tell a real moat from one good year** | Four kinds of moat — brand, network, cost, switching. And one test that sorts a real one from a lucky year: *did it hold its margin while a competitor came straight at it?* | 11 · 8 | R3 · sort_buckets ×2 (which kind · real moat / just a good year), MC ×2 | Day 16 | Read the Competition section of a real 10-K. Name the moat and the evidence for it — or write that there isn't one |
| 20 | **A $9 stock isn't cheaper than a $900 one** | A share price on its own tells you nothing. It only means something next to earnings, next to what the company used to cost, or next to a rival. Most adults never learn this | 10 · 8 | R4 · estimate_dial ×2, MC ×2, true/false | Day 19 | Compare share price and market cap for two candidates and write which is actually the bigger company |
| 21 | **Is 24 high? Wrong question.** | A multiple — the price divided by the profits — isn't about whether the number looks big. It's whether it's big *for this company*, and big *for this industry* | 11 · 8 | R14 · calc_step (compute P/E) + R12 · scene_compare (its own 5-year band), estimate_dial, MC | Day 20 | Compute one candidate's P/E, then place it against its own 5-year range and against one peer |
| 22 | **It beat earnings and dropped 9%** | A multiple is a forecast somebody already paid for. So the question is always: how much growth is baked into this price? And what happens when that growth just shows up on time, and nothing better | 11 · 8 | R5 · prediction (the beat that sold off), calc_step, MC ×2 | Day 21 | Find your candidate's expected growth rate and write whether the current multiple already contains it |
| 23 | **A thesis you can't be wrong about isn't one** | A real thesis names three things: what has to happen, roughly when, and what would prove you wrong. Skip that last one and it's just a feeling with a ticker attached | 11 · 8 | R6 · build_sentence ×2 (the thesis frame; the invalidation), sort_buckets (falsifiable / not), MC | Day 13 | Write the full thesis line and the invalidation line for your strongest candidate |
| 24 | **🏆 PHASE BOSS · EVALUATE** | Everything from Days 13–23, plus the Family Table. **Output: three finished checklists with verdicts** | 11 · 10 | R9 · checklist_card, calc_step ×2, sort_buckets, MC ×4, build_sentence, Family Table. **quizId** | Days 13–23 | Complete all four sections for **three** companies and give each one a **Strong / Solid / Mixed / Weak** verdict with two reasons |

---

# PHASE 3 · DECIDE & SIZE — When to buy, and how much (Days 25–36)

*Difficulty 3. New interactions required: `calc_step` (heavily), `tap_the_scene`, `allocation_split`, `paper_trade` action.*

**Everything in this phase happens in the paper account you opened on Day 11.** Adults do the sizing rep once, because they'll be doing the live version next month. A teen's real account is years away, so the reps repeat on purpose: sizing gets done on **Day 31**, again on **Day 36**, and again on **Day 44**. The paper account is the only place this habit can form, and one rep doesn't make a habit.

### Block 5 — Entry (Days 25–30)

| Day | Lesson | The ONE concept | Steps · min | Interactions | Warm-up recalls | Real-world rep |
|---:|---|---|---|---|---|---|
| 25 | **Name your price before the app shows you one** | Write down the price you'd be happy to own it at *while the quote is off screen*. Everything after that is discipline, not analysis | 10 · 8 | R6 · build_sentence, prediction, MC ×2 | Day 23 | Write your entry price for one candidate before opening the quote — then open it and write whether the real number moved you |
| 26 | **A chart remembers what people paid** | Support and resistance are just memory — prices where buyers or sellers already showed up. You use them to time an entry. That's the whole job | 11 · 8 | R2 · tap_the_scene ×2, scene-MC, explainer | Day 3 | Find a level your candidate has touched three or more times, and mark it |
| 27 | **A stop is a sentence, not a percentage** | Your stop goes where **the reason you bought stops being true**. It's a decision about the business, written as a price. Not a number you picked because it felt comfortable | 11 · 8 | R2 · tap_the_scene, scene-MC, sort_buckets (valid stop reason / not), MC | Day 26 | Set the stop for your paper candidate and write the sentence that justifies exactly that price |
| 28 | **Half now. The other half has to be earned.** | Going in stages buys you information. A starter position keeps you paying attention, and the second chunk gets earned by the company — it isn't just scheduled | 10 · 8 | R7 · order_sequence, MC ×2, true/false | Day 25 | Decide starter or full for your paper candidate, and write the specific event that would trigger the second tranche |
| 29 | **Same button, opposite meaning** | Averaging in follows a plan you wrote in advance. Averaging down is usually a broken thesis being rescued with maths. Identical click, completely different meaning | 11 · 8 | R3 · sort_buckets ×2 (planned / rescuing), prediction, MC | Day 28 | For your paper candidate, write both rules **before** you own it: the condition where a second buy is planned, and the condition where it would be a rescue |
| 30 | **CHECKPOINT · Entry discipline** | Retrieval Days 25–29 + 2 pooled | 10 · 8 | R8 · tap_the_scene, sort_buckets, build_sentence, MC, pool ×2 | Days 25–29 | Write the full entry plan for all three candidates: price, stop, starter or full, second-tranche trigger |

### Block 6 — Size (Days 31–36)

| Day | Lesson | The ONE concept | Steps · min | Interactions | Warm-up recalls | Real-world rep |
|---:|---|---|---|---|---|---|
| 31 | **How much you buy is maths, not a feeling** | `account × risk% ÷ (entry − stop) = shares`. That's it. Today you do it three times, until it stops needing a calculator | 11 · 8 | R14 · calc_step ×3 (the full worked-problem class), MC ×2 | Day 27 | **Paper trade:** size a position with the formula and open it at exactly that many shares — not a rounder, nicer number |
| 32 | **No stop? Then size for being wrong** | Some things you own have no price that proves you wrong. For those you use the conviction ladder — you size them by *how much you'd still be okay owning if the whole idea turns out to be wrong* | 10 · 8 | R11 · allocation_split, MC ×2, estimate_dial | Day 31 | Size a no-stop paper position by the ladder and write the number that made you comfortable |
| 33 | **The size that can't take you out** | Going big on one name is where the returns come from and where accounts die. Here's the sensible range for a single name, and what decides where in that range you sit | 11 · 8 | R11 · allocation_split ×2 (with outcome reveal), calc_step, MC | Day 32 | Check that no paper position is outside the band you chose, and resize the one that is |
| 34 | **Five names, one bet** | Correlation — when things move together because they run on the same thing. A five-name book can secretly be a one-bet book, and having five names is the exact thing that hides it | 11 · 8 | R3 · sort_buckets ×2 (shared driver / independent), allocation_split, MC | Day 19 | Name the two paper holdings most likely to fall on the same day, and write the headline that would do it |
| 35 | **The drop you can actually sit through** | Cash is a position with a job. How far down you can sit still is something you decide up front — not something you find out about yourself at the bottom | 11 · 8 | R11 · allocation_split with drawdown reveal, calc_step, MC | Day 34 | Compute what your paper book is worth after a 30% fall — **in dollars, not percent** — and write whether you'd still be holding |
| 36 | **🏆 PHASE BOSS · DECIDE & SIZE** | Everything from Days 25–35, plus the Family Table. **Output: three sized paper positions with stops** | 11 · 10 | R9 · calc_step ×3, tap_the_scene, allocation_split, MC ×3, sort_buckets, Family Table. **quizId** | Days 25–35 | Open **three** paper positions. Re-run the sizing formula from scratch on all three — second time on this maths — each with a stop and a written entry reason |

---

# PHASE 4 · MANAGE — Owning it without wrecking it (Days 37–48)

*Difficulty 3–4. New interactions required: `order_sequence`, `scene_compare`.*

**Every rep in this phase runs on the paper book built in Phase 3.** Nothing here is a made-up portfolio. The positions being reviewed are the ones they opened themselves.

### Block 7 — The owner's job (Days 37–42)

| Day | Lesson | The ONE concept | Steps · min | Interactions | Warm-up recalls | Real-world rep |
|---:|---|---|---|---|---|---|
| 37 | **The moment you own it, your job flips** | Before you buy, you're hunting for reasons to be interested. The second you own it, your job is hunting for reasons you're wrong. Nobody makes that switch by accident | 10 · 7 | R5 · prediction, MC ×2, true/false | Day 31 | Reread your own entry reason on the oldest paper position and mark the one line you would now argue with |
| 38 | **Future-you needs the reason, not the result** | Write down the decision *and why you made it*, right when you make it. An outcome logged with no reasoning teaches nobody anything — least of all you in March | 10 · 7 | R7 · order_sequence (what an entry contains), build_sentence, MC | Day 37 | Write the full journal entry for your oldest paper position — from memory first, then open the order and check what you got wrong |
| 39 | **You're not checking whether the number was good** | On earnings day you're checking exactly one thing: is the specific thing your thesis runs on still happening? Whether the headline number was good is somebody else's question | 11 · 8 | R5 · prediction (plausible distractors only), scene-MC ×2, sort_buckets (touches my thesis / doesn't) | Day 23 | Before the print, write the one line in the release that would actually matter to your thesis |
| 40 | **Great quarter, bad news** | What a company says about next quarter beats what it reports about last quarter. Guidance can break a thesis that the headline number looks like it just confirmed | 11 · 8 | R2 · scene-MC ×2, tap_the_scene, explainer | Day 39 | Read one holding's latest guidance line and mark it against your thesis: intact, dented, or broken |
| 41 | **Ten minutes, three questions, once a month** | Is the thing still working · is the moat still holding · am I any closer to being wrong? That's the whole review. Doing it monthly beats doing it constantly | 10 · 8 | R13 · checklist_card (the review card), sort_buckets, MC | Day 19 | Run the three-question review on all three paper positions and record all nine answers |
| 42 | **CHECKPOINT · The owner's review** | Retrieval Days 37–41 + 2 pooled | 10 · 8 | R8 · checklist_card, order_sequence, sort_buckets, MC, pool ×2 | Days 37–41 | Produce a one-page written review of the whole paper book |

### Block 8 — Adjusting without meddling (Days 43–48)

| Day | Lesson | The ONE concept | Steps · min | Interactions | Warm-up recalls | Real-world rep |
|---:|---|---|---|---|---|---|
| 43 | **Add because it got stronger, not because it got cheaper** | Three real reasons to add to a position — and three that only feel real, all of which are the price falling in a disguise | 11 · 8 | R3 · sort_buckets ×2 (legitimate trigger / not), prediction, MC | Day 29 | Test every paper position against the three legitimate triggers and record the verdict. Most weeks nothing qualifies, and that is the finding |
| 44 | **Trim for a reason that isn't the price** | Three honest reasons to make a position smaller: it drifted past the size you picked, the thesis got watered down, or that money has a better job somewhere else. "It went up" isn't on the list | 11 · 8 | R11 · allocation_split (drifted → restored), calc_step, MC | Day 33 | Measure drift across the paper book, find the position that grew past its band, and **re-run the sizing maths to get exactly how many shares to sell** — third time on this formula. Execute the trim on paper |
| 45 | **Does it change the business, or only the mood?** | One test for any piece of news, from a filing or from your feed: does it change what the company earns, or only how people feel today? Almost everything published does the second | 11 · 8 | R3 · sort_buckets ×2 (business / mood), scene_compare, MC | Day 40 | Sort three real headlines or posts about one of your holdings yourself, then check whether any of them changed your thesis |
| 46 | **You won't think straight about a stock you own** | Anchoring — getting stuck on the price you paid. Loss aversion — a loss stinging more than the same gain feels good. Sunk cost — staying in because you're already in. Taught here, because here's where they start biting | 11 · 8 | R5 · prediction (what will *you* do?), MC ×2, true/false | Day 35 | Write down the decision you would most regret making if your largest paper holding fell 30% tomorrow |
| 47 | **The bet you never decided to make** | Whole-portfolio checks: drift, correlation creeping in, and the big concentrated bet you never chose but definitely have | 11 · 8 | R11 · allocation_split, sort_buckets, calc_step, MC | Day 34 | Run the portfolio check on the paper book and name, in one sentence, the bet you're making that you never decided to make |
| 48 | **🏆 PHASE BOSS · MANAGE** | Everything from Days 37–47, plus the Family Table. **Output: a full written review of the paper book** | 11 · 10 | R9 · checklist_card, sort_buckets ×2, scene-MC, MC ×4, allocation_split, Family Table. **quizId** | Days 37–47 | Full book review: for every paper position — thesis intact?, verdict, action (hold / add / trim / exit), each one with its reason |

---

# PHASE 5 · SELL — Exits, scaling out, taking profit (Days 49–60)

*Difficulty 4 (track ceiling). New interactions required: `calc_step`, `scale_ladder`, `tap_the_scene`.*

**This phase gets the full twelve days because selling is the most ignored skill in investing.** Everything before it teaches getting in. Almost nobody teaches getting out — so people make it up at the exact moment they're least able to think straight. A teen who learns the exit first starts somewhere most adults never get to.

**One NEW INTERACTION belongs to this phase — `scale_ladder`.** The learner places 2–4 exit tranches on an authored price scale ("a third here, a third here, trail the rest"), sets a stop for what's left, and the reveal runs the authored outcome through their ladder. Then it shows what they got against two other ways it could have gone: *sold the lot at the first target* and *held the lot all the way*. It's the only honest way to teach scaling out, because the whole point of scaling out is that it's **never the best move looking back, and usually the right move looking forward** — and that only lands when all three outcomes are on screen at once. Inputs: `entry`, `stop`, `path[]`, `tranches`, `reveal`. Win state: none — like `prediction`, it's a reveal, not a grade.

**Scale-outs get executed twice: Day 51, and again at the Day 54 checkpoint.**

### Block 9 — The exit toolkit (Days 49–54)

| Day | Lesson | The ONE concept | Steps · min | Interactions | Warm-up recalls | Real-world rep |
|---:|---|---|---|---|---|---|
| 49 | **The only two honest reasons to sell** | The thesis broke, or the money has a better job to do. Everything else — boredom, a red day, a post you saw, "locking in a win" — is one of those two in a costume, or it's nothing at all | 11 · 8 | R3 · sort_buckets ×2 (honest reason / costume), prediction, MC | Day 44 | Classify every paper sale you've made so far, including the Day 44 trim. Then write down the one you nearly made and didn't, and which reason it would have been |
| 50 | **The rule you'll actually follow when it's down 30%** | The invalidation you wrote while you were calm is the only instruction you'll trust while you're panicking. So it has to be specific enough to actually fire | 11 · 8 | R6 · build_sentence ×2 (the invalidation frame), sort_buckets (would this actually trigger?), MC | Day 23 | Rewrite the invalidation on all three paper positions so each one names a specific, checkable event with a date or a number |
| 51 | **You're never going to sell at the top** | You sell a piece at your target, the stop goes up on the rest, and the last piece runs. You give up the perfect exit, and in exchange you never get the worst one | 11 · 8 | R14 + `scale_ladder` ×2, calc_step, MC | Day 50 | **Paper trade:** execute a real scale-out on your best-performing paper position — first tranche sold, stop raised on the rest |
| 52 | **Trail it too close and your winner turns into nothing** | Trailing a stop up behind a position that's working: how far behind to put it, and why the classic mistake is putting it so close that ordinary noise knocks you out | 11 · 8 | R2 · tap_the_scene ×2 (place the trail), scene_compare, MC | Day 27 | Set a trailing stop on the remainder of yesterday's scale-out and write the rule you used to pick that distance |
| 53 | **The hardest sell: nothing is wrong** | Rebalancing is a sell decision. The position outgrew the size you gave it, the thesis is completely fine, and you trim anyway. Easy to explain. Really hard to actually do | 11 · 8 | R11 · allocation_split (drifted → restored), calc_step, MC ×2 | Day 44 | Trim one paper position back to its band purely on size, and journal that size was the only reason |
| 54 | **CHECKPOINT · The exit toolkit** | Retrieval Days 49–53 + 2 pooled | 10 · 8 | R8 · scale_ladder, sort_buckets, calc_step, MC, pool ×2 | Days 49–53 | Write the exit plan for every paper position — invalidation, first target, scale rule, trail rule — and **execute a second scale-out**, on a different position from Day 51 |

### Block 10 — The account, the head, and the rules (Days 55–60)

| Day | Lesson | The ONE concept | Steps · min | Interactions | Warm-up recalls | Real-world rep |
|---:|---|---|---|---|---|---|
| 55 | **The account you'll have at 18** | At 18, control of the custodial account moves to you, and the first fully taxable account of your life starts running. From that day every position carries a clock: under a year and over a year get taxed differently. That makes **holding period a habit attached to an exit**, not a form you fill in later | 11 · 8 | R14 · calc_step ×2 (days to the one-year line; proceeds either side of it), order_sequence (what changes at transfer), sort_buckets (short / long), MC | Day 4 | For each paper position, write the date it would cross one year — and say whether that date changes your exit plan. For at least one of them the honest answer should be no |
| 56 | **The mistake with a name** | Sell at a loss, buy the same thing back inside 30 days, and the loss doesn't count. "I'll just buy it back next week" isn't a clever move. It's a specific mistake with a specific name: the wash sale | 11 · 8 | R3 · sort_buckets ×2 (wash sale / clean), order_sequence (the 30-day window), MC | Day 55 | Check every exit in your paper book. Would any of them have been a wash sale? For the closest one, write the earliest date a clean re-entry was possible |
| 57 | **You sell winners early and losers never** | Anchoring to what you paid, hating to watch a gain round-trip, and the disposition effect — the habit of selling winners quick and hanging onto losers forever. Three reasons the sell button gets pressed at exactly the wrong end | 11 · 8 | R5 · prediction, MC ×2, true/false | Day 46 | Write down the price at which you'd feel "I should have sold" — then notice that you just anchored, and write what you anchored to |
| 58 | **Decide it while you're calm. Follow it while you're scared.** | What you'll do at −20%, at −30%, and at +50%. Written down before you need it, because the version of you that needs it won't be writing anything | 10 · 8 | R6 · build_sentence ×2, prediction, MC | Day 57 | Write and file the pre-commitment for the whole paper book — all three levels, every position |
| 59 | **Your rules, in writing, before there's real money** | An investing policy: what you'll own, how much of any one thing, how you get in, and what you do when it falls. Yours, your household's, and the bits where they don't match | 10 · 8 | R6 · build_sentence ×2 (the policy clauses), sort_buckets, MC | Day 35 | Draft your policy, share it to the family surface, and mark the one clause you and the adults in your house do not agree on |
| 60 | **🏆 GRADUATION BOSS · The full cycle** | One company, all five phases, in one run — found, evaluated, sized, managed, exited. Everything from all 60 days | 11 · 10 | R9 · checklist_card, calc_step ×2, scale_ladder, tap_the_scene, MC ×4, Family Table. **quizId** | Days 1–59 | Present one complete case to the family from your paper book: how you found it, the checklist, the size and the stop, the review, and the exit plan |

**Belt note:** the Day 60 boss is where lifetime XP crosses **3,200** — the Black Belt line — for a teen who went perfect on all five bosses. The ceremony fires inside the graduation screen. Anything less lands on 3,150, and the last 50 XP gets earned in the Club. Same numbers as the adults, on purpose.

---

## Where the audit's coverage gaps landed

Every gap closed, and every one attached to the decision that needs it. Same map as the adults except the three teen-specific rows, marked **†**.

| Gap | Where it lives now | Attached to |
|---|---|---|
| Custodial / UTMA accounts, and what changes at 18 **†** | Days 4, 55 | Opening an account; and the account converting |
| Roth IRA, and why a paycheck unlocks it **†** | Day 4 | The workshop — the one account earned income opens |
| Fees and expense ratios | Day 5 | The benchmark you have to beat |
| Index funds and ETFs | Day 5 | The yardstick, and the default for money you're not managing |
| Research process | Days 7–12 | The hunting funnel itself |
| Income statement | Days 14–16 | Business Q1–Q3 of the pick checklist |
| Balance sheet + cash flow | Day 17 | Business Q4 — only the lines that change a decision |
| Moats | Day 19 | Checklist section 2 |
| Valuation | Days 20–22 | Checklist section 3 |
| Chart reading | Days 26, 27, 52 | Entry timing, stop placement, trailing an exit |
| Position sizing | Days 31, 32, 36, 44 | With the maths, four times |
| Diversification & allocation | Days 33–35 | How much of a small book any one name can be |
| Correlation | Day 34 | The one-bet book |
| Drawdown | Day 35 | The fall you can sit through, in dollars |
| Cash as a holding | Day 35 | Cash as a position with a job |
| Bid / ask / order matching | Day 3 | Why price moves at all |
| Rebalancing | Days 44, 53 | Trimming, and selling when nothing is wrong |
| Holding period, short vs. long **†** | Day 55 | The account you'll have at 18 — as an exit habit |
| Wash sale | Day 56 | The mistake with a name, inside the paper book |

---

## Where the teen track diverges from adults

**Same day number = same concept, in all three tracks.** Day 51 is scaling out for the adult, scaling out on the paper account for the teen, and "taking some of your win off the table" for the eight-year-old. The teen track carries the adult concept on **57 of 60 days**. Three days swap the concept itself:

| Day | Adult concept | Teen concept | Why it changes |
|---:|---|---|---|
| **4** | Brokerage, custody, and which wrapper (taxable / IRA / Roth / 401k) holds which money | **Custodial / UTMA accounts: whose name is on it, what a parent co-signing actually means, what changes at 18 — plus heavy weighting on the Roth IRA** | A teen can't open their own brokerage account, so "which wrapper" isn't their live question. "Whose account is this, actually?" is. And money from a real job genuinely qualifies for a Roth, which makes it the single most useful mechanical fact you can hand a working 16-year-old |
| **55** | Short- vs. long-term capital gains on a sale you are making | **The account you'll have at 18** — what happens when a custodial account converts, what a first taxable account means, and short-vs-long taught as a **holding-period habit attached to an exit decision** | The adult is filing this year. The teen is inheriting an account and starting a clock. Taught as a tax exercise it's dead on arrival. Taught as "this date is now part of your exit plan", it's a habit they carry into the account they'll actually have |
| **56** | Loss harvesting and the wash-sale rule, with the tax mechanics | **The wash-sale rule kept, framed entirely inside the paper account as "the mistake with a name"** — lighter on mechanics | Harvesting losses against a tax bill isn't a teen's situation. The *rule* still is, because the behaviour it punishes — selling in frustration and buying straight back — is exactly what a new investor does, and naming it early is worth more than the arithmetic |

**Everything else is the same concept, said a different way.** Where adults get Costco's gross margin, teens get Spotify's. Where adults are told to classify every sale they've ever made, teens classify the paper sales they made in this course. The concept, the day and the skill are identical.

**Shifts in emphasis that are not concept changes:**

- **Phases 3, 4 and 5 run entirely on the paper account**, which opens on **Day 11** instead of being assumed to exist. Every rep across those thirty-six days says "paper" out loud.
- **The key reps repeat.** Sizing on Days 31, 36 and 44. Scaling out on Days 51 and 54. Adults do each one once, because they'll do the live version within weeks. A teen's real account is years out, so the paper account is the only place the motion can go automatic — and once won't do that.
- **Warm-up spacing is designed, not defaulted.** Where the adult table often recalls yesterday, the teen table alternates near recalls (−1 to −2 days) with long ones (−6 to −20): Day 17 recalls Day 2, Day 26 recalls Day 3, Day 39 recalls Day 23, Day 50 recalls Day 23, Day 59 recalls Day 35. Same mechanism, wider spacing, on the +2 / +6 / +15 schedule the pedagogy section lays out.
- **Feedback scaled to the register:** `feedbackScale("teen")` = 12 particles, against the adult's 0 and the kid's 20.
- **Difficulty ceiling 4**, against the adult 5.

---

## Compliance note — read this before you author a single step

All six rails from CURRICULUM-OVERVIEW §9 apply, unchanged. Three of them bind harder here.

**1. No options, futures, margin, leverage, crypto or forex — anywhere.** Not as a lesson, not as an aside, not as a wrong answer, not as a "you'll learn this later" tease. Those words don't appear in this track at all.

This isn't a hypothetical rail. **The FIC teen track that's live right now teaches options to minors** — *"Calls & Puts Explained"* and *"Why Options Can Grow (or Vaporize) Fast"* are seeded teen lessons today (`014_seed_dual_program.sql`). **This 60-day track replaces both of them, and they should be pulled from the FIC program whether or not this curriculum ships.** Options belong in FTA, to adults, or nowhere.

**2. Every practice action is labelled paper in the step copy itself**, not just on the screen it lands on. "Paper trade: size a position…" — the word shows up in the instruction the teen reads, every single time, across all thirty-six days of Phases 3–5.

**3. Paper-account performance never touches XP, levels, belts, streaks or any leaderboard.** A paper book that's up earns exactly the same 50 XP as one that's down. The reward is for the rep — the sizing done, the scale-out executed, the journal entry written. The moment simulator returns feed a leaderboard, this turns into a game about being right, which is the opposite of everything these sixty days teach.

And, unchanged: education, never advice; no instruction verbs (*buy, sell, short, load up, take profits, add here*) anywhere in the copy; companies only ever as **dated historical worked examples**; verdicts in exactly **Strong / Solid / Mixed / Weak**; no performance promises; and every number authored and fixed, so the lesson reads exactly the same in five years.
