# FIC 60-Day Curriculum — Overview

**Status:** draft for owner approval. Nothing is seeded until this document and the three outlines are signed off.
**Scope:** 60 daily lessons × 3 tracks (adults, teens, kids) = 180 authored lessons, including 5 checkpoints and 5 phase bosses per track (counted inside the 60).
**Promise:** a complete beginner who shows up daily finishes able to **find** candidates on a schedule, **evaluate** them against a repeatable checklist, **size** a position with arithmetic, **manage** it against a written thesis, and **sell** it — including scaling out of a winner and exiting a broken thesis — on paper, before any of it costs real money.

---

## 0. What this replaces — read this first

The FIC program today is **48 lessons** seeded by `supabase/migrations/014_seed_dual_program.sql`: 12 adult, 12 teen, 12 kid, 12 FTA. Two are live-stepped (mig 167); 34 sit in `steps_draft` (mig 177) awaiting publish. This 60-day curriculum **supersedes the 36 FIC lessons** in that set. FTA's 12 are untouched.

Two findings from reading the existing content that the owner needs to see before approving anything:

**1. The current adult and teen tracks teach options.** Adult lessons 7 and 8 are *"Calls, Puts & Premium (Greeks Lite)"* and *"Buying Options on a Thesis — Without Blowing Up"*. The teen track carries the same two: *"Calls & Puts Explained"* and *"Why Options Can Grow (or Vaporize) Fast"* — taught to minors. That is a direct collision with the equities-only rail. Whatever else is decided here, **those four lessons should be pulled from the FIC program**, independent of this curriculum shipping. Options belong in FTA, to adults, or nowhere.

**2. The existing arc is a technical-analysis course wearing an investing course's clothes.** Of 12 adult lessons, five are chart mechanics (candles, timeframes, support/resistance, patterns, indicators) and exactly one — *"Fundamentals Lite: P/E, Earnings & Catalysts"* — covers what a business is worth. A member finishes able to name a hammer candle and unable to say why one company earns 70 cents on the dollar and another earns four. That inversion is the "very basic, not good content" problem in one sentence, and it is why EVALUATE — the phase that answers *what actually makes a good pick* — is twelve days long, and why chart reading is not a phase at all.

---

## 1. What's wrong with the learning world today

The current lessons teach vocabulary. A member finishes them knowing what "market cap" means and still cannot answer the only question that matters — *is this a good business, and what am I paying for it?* Definitions are not skills. A skill is a decision you can make under uncertainty and defend afterwards.

**The spine is the investor's decision cycle, not a table of contents.** Every phase answers a question a member is actually facing, in the order they face it:

```
FIND ──▶ EVALUATE ──▶ DECIDE & SIZE ──▶ MANAGE ──▶ SELL ──┐
  ▲                                                        │
  └────────────────────────────────────────────────────────┘
```

| Phase | Days | The question |
|---|---|---|
| **1 · FIND** | 1–12 | Where do good picks come from? How do I get from nothing to a shortlist? |
| **2 · EVALUATE** | 13–24 | What makes a good stock pick? |
| **3 · DECIDE & SIZE** | 25–36 | I like it. When do I buy, and how much? |
| **4 · MANAGE** | 37–48 | I own it. What am I supposed to be doing now? |
| **5 · SELL** | 49–60 | When do I sell? How do I take profit without panicking or getting greedy? |

Textbook topics are woven in where they are **load-bearing on a decision**, never as their own unit. Financial statements live inside EVALUATE as "reading the company's story", and only the lines that change a decision. Taxes live inside SELL, attached to an actual sale. Diversification lives inside DECIDE & SIZE as "how much should any one pick be". Index funds live in FIND as the benchmark your picks must beat. Chart reading appears three times, each time for a job — finding where buyers showed up before, placing a stop, trailing an exit — and never as a chapter on candlesticks, because a candlestick has never on its own answered a question anyone was asking.

**The end state is the promise.** By Day 60 a diligent adult has built a hunting funnel they run on a schedule, written three real theses with the checklist, sized and opened paper positions with stops, journaled them at the moment of decision, and executed **at least one scale-out and one thesis-broke exit** — the two hardest moves in investing, both practised before either one costs real money. Teens run the identical cycle on the paper account; kids run it scaled down on the family watchlist with parent-together decisions.

---

## 1b. Eight anti-patterns, taken from the live content — none of these ship again

These are not style preferences. Every one of them is quoted from a lesson currently in the database, and every one of them is a reason a member closed the tab.

1. **One template, thirty-six times.** All 36 live FIC lessons run the identical six-step sequence: explainer → MC → explainer → true/false → explainer → match-pairs → real-world. By lesson four the member knows the shape of the screen before they read it, and a predictable shape is a skippable shape. **Rule: structure follows the concept.** A magnitude lesson is mostly dial. A chart lesson is mostly scene. An income-statement lesson is mostly sort-and-build. The outlines below specify a distinct step recipe per day, and no recipe repeats more than three times in a phase.

2. **Unlosable predictions.** Live distractors include *"It stays exactly at $50"* and *"Price will trade sideways forever."* Nobody picks those. A prediction where the learner cannot genuinely be wrong is a cutscene with buttons. **Rule: every distractor must be a real answer a smart beginner would give**, and the reveal must explain why the tempting wrong one was tempting. Where a prediction has an obviously-correct option, it should have been a multiple choice.

3. **Match-pairs as a four-term glossary.** Four lefts, four rights, elimination solves the last two for free — the learner gets 100% having reasoned about half the content. **Rule: `match_pairs` only for application-level pairs** (a margin figure → the industry it belongs to), with **more rights than lefts** so elimination fails. If neither condition holds, it should be `sort_buckets` or nothing.

4. **Real-world reps that don't exercise the skill.** The live position-sizing lesson ends by asking the member to add Costco to their watchlist. Watchlist-adding is the rep for *one* skill — noticing a company — and it is currently the rep for all of them. **Rule: the closing rep must be the skill.** A sizing lesson ends with a sizing calculation against the member's own paper account. A filing lesson ends with a number typed out of a real filing. If the only available rep is a watchlist add, the day is probably not ready to ship.

5. **Arithmetic skills taught with zero arithmetic.** The live position-sizing lesson never once poses *"$10,000 account, 1% risk, entry $50, stop $47 — how many shares?"* That question **is** the skill; everything around it is preamble. **Rule: if a concept has a calculation, the learner performs it** — via `estimate_dial` for magnitude or a typed answer with tolerance for arithmetic.

6. **Charts taught in prose.** `LessonSceneSpec` and `LessonScene` are fully built, wire the price-up/price-down colours off the authored points so a scene can never contradict itself, and ship a play badge that wipes the tape in. **They are used zero times.** Meanwhile five adult lessons describe candlesticks in paragraphs. **Rule: no chart concept is taught without a scene on screen.** Every chart day in this curriculum (adult Days 26, 27, 40, 52) is built on `LessonScene`.

7. **Kids = adults with words swapped and steps deleted.** The current kid lessons are the shortest in the set. That is exactly backwards. A seven-year-old needs *more* scaffolding, more concrete objects to move with their hands, and more repetition of the same idea in different clothes. **Rule: kid lessons have the same or more steps than adult lessons at the same day, with shorter individual steps** — more, smaller, more physical.

8. **`figure: {kind:"stat"}` used for slogans.** Live examples: `"Interest on interest"`, `"Time > timing"`. A stat figure is a large-type slot next to an explainer; putting a slogan in it wastes the most visually dominant element on the screen on something the paragraph already said. **Rule: a `stat` figure carries a number, a ratio, or a labelled diagram. Never a phrase.** `"73%"` / `"gross margin, software"` is a stat. `"Time > timing"` is a bumper sticker.

**And the finding that outranks all of them: members abandon partway through lesson *one*.** Day 1 in each track carries the entire retention burden of the program. Its opening is not an introduction — it is the only argument we get. All three Day 1 lessons open on a concrete, slightly uncomfortable fact about a company the learner already uses, not on a welcome.

---

## 1c. What the curriculum has to cover that no current lesson touches

An audit of the live content found these entirely absent from all three tracks. They are the spine of Phases 1, 2 and 4 below, and their absence is why the current program reads as a technical-analysis skim:

- Account types — taxable, IRA, Roth, 401(k); UTMA/custodial for the kid and teen context
- Taxes — capital gains (short vs. long), dividends, wash sales
- Fees and expense ratios
- Diversification, asset allocation, rebalancing
- Index funds and ETFs
- Reading financial statements — income statement, balance sheet, cash flow, the 10-K
- Moats and competitive advantage
- A repeatable research process
- Portfolio-level risk — correlation, drawdown
- Bonds, cash, and the emergency fund
- Bid/ask, the spread, and how an order actually matches

**Chart reading is one phase of four, not the centre of gravity.** That single re-weighting is the substance of this whole rewrite.

---

## 1d. THE VOICE — the standing production rule

**Owner direction, 2026-07-28:** *"I want the writing to sound more human to human. More simple to understand and relate. Not uptight or complex, no big words. Should be written like it's a 'for dummies' book."*

This is not a style preference. It is the **single most important rule in this document**, because a member who doesn't finish the sentence never gets to the concept. Every lesson, every option, every feedback line, every Kai line, in all three tracks, is written this way. A lesson that fails the voice check does not ship, no matter how good the teaching is.

### The nine rules

**1. Talk TO them, like a friend across the table.** Say "you". Say "let's". Use contractions everywhere — "you'll", "isn't", "here's", "that's". Write the way you'd explain it to a mate who asked you a real question over coffee.

**2. Short sentences. One idea each.** If a sentence has a dash-clause and a sub-clause hanging off it, break it into two or three sentences. Two short sentences always beat one clever one.

**3. No big words when a small one exists.** Use, not utilize. Before, not prior to. So, not therefore. Buy, not acquire. About, not approximately. Show, not demonstrate. Use, not leverage. Start, not commence. If you catch yourself reaching for a formal word, you're writing an essay, not a lesson.

**4. Translate every term of art in the same breath.** The first time a real word appears, plain speech follows it immediately, in the same sentence. Not a glossary. Not a footnote. Right there: *"the spread — the gap between what buyers will pay and what sellers will take."* After that you can use the word freely, because they own it now.

**5. Analogies come from normal life.** Garage sales. Pizza. Gas prices. Sneakers. Allowance. Concert tickets. Buying a used car. Not literary metaphors, not anything that would show up in a business book.

**6. Warm, and a little funny, is good. Corny beats clever.** A joke that makes someone smile and keeps reading is worth more than a line that makes them admire the writing. Nobody has ever finished a course because the prose was elegant.

**7. Say the quiet part.** Where a real investor would admit something out loud, admit it. *"Nobody sells at the top. Not the pros, not you, not anyone."* That one sentence buys more trust than three paragraphs of careful hedging.

**8. Feedback teaches, and it's kind.** A wrong answer gets a friendly explanation of why that answer was tempting, then hands the question straight back. Never "Incorrect." Never a lecture. The tone is *"ah, that one gets everybody — here's what's actually going on."*

**9. Kai is a friendly coach, never a professor.** Kai talks like the friend who already made this mistake and wants to save you from it. Short lines. Warm. Occasionally funny. Kai never uses a word the lesson hasn't already explained, and never says "great job".

### Calibration — before / after

These are taken from the first draft of these very samples. The left column is what "good writing" looked like before the owner's note. The right column is the standard now.

| ❌ Too uptight | ✅ The voice |
|---|---|
| "Here is a thing worth accepting early, because fighting it costs people more money than almost any other habit: you will not sell at the high." | "Let's get one thing out of the way: you're never going to sell at the exact top. Nobody does. Chasing it costs people more money than almost any other mistake." |
| "That trade — no maximum, no minimum — is what the rest of this lesson makes concrete." | "That's the deal you're making: you give up the perfect exit, and in return you never get the worst one. The rest of this lesson shows you exactly how." |
| "The mechanics are three rules, and they are boring on purpose. Boring is what survives a stressful morning." | "There are three rules. They're boring on purpose — boring is exactly what you want when the market's going nuts and your heart's pounding." |
| "The question changes shape. It stops being 'what's the best price to sell at' — which is unanswerable — and becomes 'how do I want to be positioned across every path this could take?'" | "So the question changes. Stop asking 'what's the perfect price to sell at?' (there's no answer). Start asking 'what's my plan if this goes up, down, or sideways?' (that one has an answer)." |
| "Price is set by an auction between buyers and sellers — the bid, the ask, and the last time the two crossed." | "Nobody sets the price. It's just two lines of people haggling — what buyers are offering, what sellers are asking, and whoever gave in last." |
| "A moat is a structural reason a competitor cannot simply copy you and cut price." | "A moat is the reason some other company can't just show up, copy you, and undercut you on price." |
| "Compounding — returns earning returns — is the mechanism by which time becomes the dominant variable." | "Your gains start making their own gains. That's compounding. It's why starting early beats starting big." |
| "This is why 'the price already reflects the news' is not a slogan." | "This is why people say news is 'already priced in'. It's not a saying. It's just what happened while you were reading the headline." |

### Per-track calibration

- **Adults get "for dummies" — friendly and plain, never childish.** The reader is a smart adult who was never taught this. Simple words, real respect. You can say "here's the thing" and "honestly"; you cannot say "yay" or use an exclamation mark.
- **Teens can be a notch looser.** Slightly more slang, slightly shorter, and they're allowed to be told when they've beaten an adult at something — where it's true.
- **Kids were already simple.** They get one warmth pass, not further simplification. The risk in the kid track is the opposite one: talking down. Don't.

### The read-aloud test

Before a lesson ships, read it out loud. If you run out of breath in a sentence, it's too long. If you'd feel silly saying it to a friend, rewrite it. If you'd naturally say it a different way than it's written — write it the way you'd say it.

---

## 2. Pedagogy model — teach → check → apply → review

Four moves, in that order, every single day. The order is not decorative; each move fails without the one before it.

**TEACH.** One concept per day. Not two. The concept is fully articulated before anything is asked — including the part that is counterintuitive, and the part that is commonly got wrong. A lesson never introduces a term in a question. If the learner meets a word for the first time inside a question, we have failed and the question is measuring reading comprehension, not understanding.

**CHECK.** Two to four graded interactions on the concept just taught. Wrong answers run the existing mastery loop (`ChoiceCore`): wrong → the guide explains *why the wrong option was tempting* → the same question is re-asked with reshuffled options → only the corrected attempt resolves the step. `firstTry` is what feeds `skill_mastery`, so mastery stays honest while the learner is never left stuck.

**APPLY.** The lesson leaves the lesson. `RealWorldStep` deep-links into the live product and comes back with a verified artifact — a ticker actually on the family watchlist, a research page actually opened. This is the single biggest thing we have that Duolingo does not: the rep is real. Every day ends with one, and the rep is *small* — one ticker, one line of a filing, one paper order with a written reason. Small enough that skipping it feels lazier than doing it.

**REVIEW.** Three mechanisms, all of which run on machinery that already exists:
- **Daily warm-up.** Step 1 of every lesson is a single retrieval question from an earlier day, authored into the JSON (deterministic, no LLM). It costs 15 seconds and it is the difference between a course people finish and a course people remember. The outline tables name the source day for every warm-up, so the spacing is designed rather than accidental — a concept comes back at roughly +2, +6 and +15 days.
- **Checkpoints every 6 days** (days 6, 18, 30, 42, 54). 60% of the checkpoint re-tests the block's five concepts; 40% interleaves concepts from earlier blocks. Interleaving is uncomfortable and it is exactly why it works — the learner has to *choose* which idea applies before applying it.
- **`skill_mastery` — built, correct, and completely inert.** Migration 166 gives every `(user_id, skill_id)` a `mastery_score` (+12 correct / −8 wrong), a doubling `interval_days` capped at 30, and a `next_review_at`, with an index on `(user_id, next_review_at)` placed specifically for a "weakest due skill" query. **Nothing in the product reads that schedule.** We are writing to a spaced-repetition engine and never asking it a question.

  This is the **highest-leverage unlock in the entire plan**, and the curriculum is the reason to switch it on. Two pieces:

  **(i) A `pool` step type.** A step declares `{ type: "pool", skill: "auto_weakest", count: 2, from: "checkpoint-b4" }` and the engine resolves it at render time against `skill_mastery` — pulling the member's weakest *due* skills and serving authored questions tagged with those skill ids. The question bank is hand-written and stored per block; only the *selection* is dynamic. Zero LLM, consistent with the engine's standing rule. This turns twelve identical checkpoints into twelve personalised ones for one small engine change.

  **(ii) A `Today's Review` surface on the Learn home.** A single card, above the path, that appears only when the member has skills past `next_review_at`: *"3 ideas are ready for review — 90 seconds."* Tapping it runs a mini-lesson assembled from the pool bank for exactly those skills. It is the daily-goal "Practice" slot that `FIC-LEARNING-WORLD.md` already specifies but nothing currently fills, and it is what makes a 60-day course stick past day 61. Existing `XP.FLASHCARDS` economics (20 XP, once per day) apply — no new XP path.

  **Owner decision #10:** approve the `pool` step type + the Today's Review surface as part of this curriculum's engineering scope rather than a later phase. Without it, review days are static and the SR engine stays a write-only log.

Flashcards (existing `XP.FLASHCARDS = 20`, once per day, SM-lite doubling to a 30-day cap) are the optional fourth layer. Today there are three code-defined sets (`foundations`, `candlestick-patterns`, `chart-patterns`) keyed to a `themeWeek`; the 72 existing visual candlestick/chart-pattern cards are the only illustrated assets in the product and should be folded into the DECIDE & SIZE and SELL review days rather than retired. This curriculum needs **ten new sets, one per block**, each covering that block's five concepts, surfaced on the path at the checkpoint node. They are never required to advance.

---

## 3. Structure — 5 phases, 10 blocks, one rhythm

```
60 days = 5 phases × 12 days = 10 blocks × 6 days

Block  = 5 teaching days + 1 retrieval day

Phase  = Block A: 5 teach + CHECKPOINT
         Block B: 5 teach + PHASE BOSS

Checkpoints:  days  6 · 18 · 30 · 42 · 54
Bosses:       days 12 · 24 · 36 · 48 · 60   ← node_kind 'boss', carries quizId
```

**Why 6 and not 7.** A six-day block gives a five-day-a-week learner a checkpoint every Saturday and the Sunday as slack; a seven-day-a-week learner finishes in 60 days flat. Either way the retrieval day always lands at the end of a block, never mid-idea, and a member who falls behind resumes at a block boundary rather than in the middle of a concept. **Owner decision #1:** confirm the 6-day block (10 weeks at 6/week) versus a strict 60-calendar-day run.

**Why five phases and not four.** The decision cycle has five stages and the fifth — SELL — is the one the owner named first and the one no retail curriculum teaches properly. Giving it a full twelve days is the single most differentiating choice in this plan. It also happens to land the XP economy exactly (see §7).

---

## 4. Difficulty ramp

Difficulty is the `difficulty: 1–5` field on `LessonJSON`. It ramps on three independent axes so the course gets harder without getting longer:

| Axis | Day 1 | Day 60 |
|---|---|---|
| **Abstraction** | One company, one number | A whole portfolio, relationships between numbers |
| **Steps to an answer** | One hop ("revenue went up → good") | Three hops ("margin fell → because input costs rose → but they raised price next quarter → so the decline is timing, not damage") |
| **Ambiguity** | One right answer | Two defensible answers; the graded one is the one with the better *reason*, and the feedback says so |
| **Consequence** | Nothing is at stake | A wrong answer is a paper position sized wrong, and the reveal shows what that cost |

Mapped to the field:

- Days 1–12 (FIND) → `difficulty 1–2`
- Days 13–24 (EVALUATE) → `difficulty 2–3`
- Days 25–36 (DECIDE & SIZE) → `difficulty 3–4`
- Days 37–48 (MANAGE) → `difficulty 4`
- Days 49–60 (SELL) → `difficulty 4–5`

Kids' track uses the same ramp shape, ceiling `difficulty 3`. Teens ceiling `difficulty 4`. The *ceiling rising* is the point — a member on day 50 should feel the course grew with them, not that it padded.

---

## 5. Interaction vocabulary

### 5a. What exists today (use these first — zero engineering cost)

| Type | What it's for | Where it earns its keep |
|---|---|---|
| `explainer` | The teach move. Paragraphs + one optional `figure` (`stat` or `quote`) | Every lesson, 1–2 per lesson. The `figure: {kind:"stat"}` is the workhorse for "gross margin: **73%**" |
| `multiple_choice` | The primary check. Supports `framing` (the drawn annotation mark on one word) and an authored `scene` | 2–3 per lesson |
| `multiple_choice` + `scene` | The micro-lesson format — one authored price figure, four options, one Check | The whole of Phase 3, and every earnings-reaction question |
| `true_false` | Fast myth-busting, relabellable to `Fact / Myth` | Days that have a famous misconception (Day 26 "a cheap stock is a bargain") |
| `match_pairs` | Vocabulary that must connect to meaning, not float free | Income-statement lines → what they measure; verdict word → what it means |
| `prediction` | Commit-then-reveal. Never punished — the reveal is the teaching | Every earnings/event day; the strongest hook in the whole set |
| `real_world` | Escape into the product, return with a verified artifact | Closing step of every lesson |

That vocabulary alone can carry roughly **70% of the 180 lessons**. We should build no new interaction until an existing one has been genuinely tried and found to distort the concept.

### 5b. NEW INTERACTIONS — proposed, ranked by reuse value

Ranked by *how many of the 180 lessons need it* and how load-bearing it is on the decision cycle — not by how fun it is. Each is specced tightly enough for engineering to size.

---

**#1 — `checklist_card`** — the signature artifact of the whole curriculum. Needed by ~26 lessons and, more importantly, by the product outside lessons. **Build first.**

This is not really a step type. It is a **persistent member-owned object** that a lesson step can open, fill one section of, and close — the same card the member later opens from their watchlist without a lesson running.

```
THE PICK CHECKLIST                              ← one card per company, per member
 1 · THE BUSINESS   Do I understand how it makes money — is it growing, does it keep what it earns?
 2 · THE MOAT       Why can't a competitor take this?
 3 · THE PRICE      What am I paying vs. what I'm getting — against its own history and its peers?
 4 · THE THESIS     Why this, why now — and what would prove me wrong?
 VERDICT            Strong · Solid · Mixed · Weak
```

- **Inputs (step side):** `section` (1–4 or `"verdict"`), `ticker` (or `"member_choice"`), `prompt`, `fields: [{id, label, kind: "short_text"|"number"|"choice", options?, hint}]`, `modelAnswer` (an authored worked example shown *after* the member commits their own, never before).
- **Storage:** a `pick_checklists` row per `(user_id, ticker)` with a jsonb body. The card is the member's, not the lesson's — Day 13 opens it, Day 18 fills section 1, Day 24 assigns a verdict, and Day 41 reopens it for the monthly review. **The learner watches one object accumulate for 48 days.**
- **Behaviour:** the step shows only the section it owns. Completed sections render collapsed above it, so the member sees their own earlier answers each time — the single strongest continuity device available.
- **Win state:** not graded. Completion = every field non-empty. The `modelAnswer` reveal is the teaching, and it explicitly says *"here's how one analyst answered it — yours doesn't have to match, but it does have to be specific."*
- **Animation:** the newly-filled section seals with a left-to-right ink sweep, 320ms, and the card's progress rail (4 segments) advances one segment. On verdict, the four words appear and the chosen one locks with the accent.
- **Compliance:** the card outputs the **member's own** assessment. It never contains a recommendation from us. The verdict field offers exactly Strong / Solid / Mixed / Weak and nothing else.
- **Why it's #1:** the owner's brief is *"a repeatable checklist the member fills in, not theory chapters."* This is that, literally. It is also the only artifact in the plan that survives the course — a member who stops on Day 30 still has three filled checklists and a habit.

---

**#2 — `calc_step`** — needed by ~31 lessons. **Build with #1.**

A typed numeric answer with a tolerance and a stepped worked solution. This is the fix for the audit's fifth anti-pattern: *arithmetic skills taught with zero arithmetic.*

- **Inputs:** `question`, `given: [{label, value}]` (the problem's facts, pinned above the keypad), `answer`, `tolerance`, `unit`, `solution: [{line, value}]` (the worked steps), `explanation`, `reinforce`
- **Behaviour:** a numeric keypad, not a slider — the member types a number. `given` stays visible so this tests the *method*, never recall of the inputs. Check grades against `answer ± tolerance`.
- **Win state:** within tolerance on the first attempt. Wrong → the solution reveals **one line at a time, on tap**, so the member finds their own break point rather than being handed the answer. Then the same problem class is re-asked with different numbers (the `ChoiceCore` mastery loop, adapted).
- **Animation:** each solution line slides in from the left with its value counting up from 0, 260ms, on the member's tap. The count-up matters — it makes the size of each intermediate result felt.
- **The problem class it exists for:** `$10,000 account · 1% risk · entry $50 · stop $47 → how many shares?` Answer: 33. That single question is the whole of position sizing, and the live curriculum never asks it. Also carries: margin calculations, growth rates, P/E, net debt, after-tax proceeds on a sale, and the scale-out arithmetic.

---

**#3 — `sort_buckets`** — needed by ~34 lessons across all three tracks. **Build first.**

Drag or tap N items into 2–3 labelled buckets.

- **Inputs:** `prompt`, `buckets: [{id, label, hint?}]`, `items: [{label, bucketId, why}]`, `explanation`, `reinforce`
- **Behaviour:** tap an item then tap a bucket (mobile-first; drag optional on pointer devices). Items land with a snap. A misplaced item does not bounce back immediately — it sits wrong until Check, so the learner is grading a whole mental model, not one guess.
- **Win state:** all items in correct buckets. On Check, correct items lock with a tick; wrong items lift back to the tray *with their `why` line shown one at a time*. `firstTry` = all correct on first Check.
- **Animation:** item scales 1.0 → 0.94 on grab, translates to bucket in 220ms EASE_OUT, bucket label pulses once. Wrong items shake 4px, twice, then return in 260ms.
- **Why it beats `match_pairs`:** categories with many members (five costs into "fixed" vs "variable") are the natural shape of most of Phase 2, and `match_pairs` forces an artificial 1:1.

---

**#4 — `estimate_dial`** — needed by ~22 lessons. **Build second.**

A slider or stepper the learner moves to a numeric answer, checked against a tolerance band, then revealed against a labelled scale.

- **Inputs:** `question`, `min`, `max`, `step`, `unit` (`%`, `×`, `$`), `answer`, `tolerance`, `scaleMarks: [{value, label}]`, `reveal: {headline, body}`
- **Behaviour:** learner drags; the live value prints in mono above the thumb. On Check, the true value slides in as a second marker and the scale marks label themselves ("supermarket 3% · software 78%").
- **Win state:** `|guess − answer| ≤ tolerance`. Outside tolerance is *not* failure — the reveal still teaches, and `bumpMastery` is called positive-only like `prediction`.
- **Animation:** true-value marker travels from the learner's guess to the answer in 500ms so the *distance* is felt. The scale marks fade up behind it, staggered 40ms.
- **Why:** magnitude is the thing beginners lack. Knowing "gross margin" is a definition; knowing a software company runs at ~75% and a grocer at ~25% is a skill. Multiple choice teaches recognition; a dial teaches calibration.

---

**#5 — `tap_the_scene`** — needed by ~18 lessons, almost all in Phase 3. **Cheap: reuses `LessonScene` entirely.**

Answer by tapping a region of the authored price figure instead of picking from a list.

- **Inputs:** existing `LessonSceneSpec` + `zones: [{fromIndex, toIndex, correct, feedback}]`, `prompt`
- **Behaviour:** the scene renders as today (including the play badge that wipes the tape in). Invisible hit-zones sit over point ranges. A tap draws a translucent accent band over that span.
- **Win state:** tapping a `correct: true` zone. A wrong tap shows that zone's `feedback` line and dims it, then invites another tap — the mastery loop, in place.
- **Animation:** band wipes open from the tap point outward, 200ms. On correct, band border firms to accent and the caption above rewrites to name what was found ("this is where the sellers ran out").
- **Why:** "where did the trend break" is a *spatial* question. Making it a list of four sentences turns a chart-reading skill into a reading-comprehension test.

---

**#6 — `build_sentence`** — needed by ~14 lessons. **Phase 2 and Phase 4 workhorse.**

Fill a fixed sentence frame from a word bank.

- **Inputs:** `frame` (string with `{0} {1}` slots), `bank: string[]`, `answer: number[]`, `explanation`, `reinforce`
- **Behaviour:** tap a bank word, it flies into the next empty slot. Tap a filled slot to return the word. Check grades the whole sentence.
- **Win state:** exact slot match. Wrong → the slots that are wrong glow, the correct ones stay.
- **Animation:** word travels bank→slot on an arc, 240ms; the completed sentence gets one slow read-through highlight left-to-right before Check unlocks.
- **Why:** this is how we teach the *thesis*, which is the single most valuable artifact in Phase 4. `"I own {NVIDIA} because {data-centre demand is growing faster than supply}. I am wrong if {gross margin falls below 60% for two quarters}."` A learner who can fill that frame can write one.

---

**#9 — `order_sequence`** — needed by ~9 lessons. Drag 4–6 cards into the right order. Inputs `prompt`, `items: [{label, position, why}]`. Win = exact order; wrong items ripple to their true position on reveal with the `why` printed. Used for: what happens on earnings day, the order cash moves through a business, the research checklist, the steps of a rebalance.

---

**#7 — `scale_ladder`** — needed by ~9 lessons, all in Phase 5, and it is the only honest way to teach the owner's most-named skill.

The learner places 2–4 exit tranches on an authored price scale, sets a stop for the remainder, and the reveal runs the authored outcome through *their* ladder — then shows it beside two alternatives.

- **Inputs:** `entry`, `initialStop`, `path: number[]` (the authored price path, same doctrine as `LessonSceneSpec` — hand-written, stable forever), `tranches: {count, sizes}`, `alternatives: ["sold_all_at_first_target", "held_everything"]`, `reveal`
- **Behaviour:** the price scale renders vertically beside a `LessonScene`-style tape. The member drags tranche markers to price levels and drags the stop. Check runs the path.
- **Win state: none.** Like `prediction`, this is a reveal, not a grade — `bumpMastery` is positive-only. **This is essential to the pedagogy:** the whole point of scaling out is that it is *never optimal in hindsight and usually right in advance*. If we graded it, we would be teaching hindsight.
- **The reveal is three numbers side by side:** what the member's ladder returned, what selling everything at the first target returned, and what holding the lot returned. On some authored paths the ladder wins; on some it doesn't; and the copy names that directly. A learner only *feels* the trade-off by watching all three at once.
- **Animation:** the tape plays left to right (reusing the `LessonScene` wipe). As the price crosses each tranche marker, that marker fires — a small accent pulse and a running "realised" total counting up. The stop, if hit, closes the remainder with a single grey sweep. 1.4s total, one hero motion for the lesson.

---

**#8 — `allocation_split`** — needed by ~7 lessons, all Phase 4, but they are the *most important* seven. Distribute 100 units across 3–5 named holdings with a live total; the reveal shows the consequence of the split against an authored scenario ("your 60% position fell 30%; the portfolio fell 18%"). Inputs `holdings`, `scenario: [{holdingId, move}]`, `reveal`. **Paper only, always — this is a shape lesson, never an allocation recommendation, and the reveal copy must never imply the shown split is the right one.**

---

**#10 — `scene_compare`** — two authored `LessonScene`s side by side, pick which one shows X. Trivial to build (it is `multiple_choice` with two figures instead of one) and worth ~6 lessons.

---

**#11 — `pool`** — the spaced-repetition selector described in §2. Not an interaction so much as a *slot*: it resolves to one of the existing graded types, chosen by `skill_mastery.next_review_at`. Needed by all 12 checkpoints × 3 tracks = 36 lessons, plus the Today's Review surface. **Ranked #1 by leverage even though it is ranked #8 by novelty — build it with `sort_buckets`.**

---

**A note on `micro_video`.** The migration-177 drafts reference a `micro_video` step type. **It does not exist** — there is no entry in the `StepSpec` union and no component in the step registry, so any lesson using it renders the engine's "this step isn't available in your app version" fallback. This curriculum uses **no video anywhere**; every concept is carried by authored text, illustration and interaction. If video is wanted later it is a genuine NEW INTERACTION requiring a schema type, a registry entry, a player component, and a hosting decision — size it separately and do not assume it is half-built.

---

**#8 — RealWorldAction extensions** — not new step types, two new values on the existing `RealWorldAction` union:

- `paper_trade` — deep-links to the paper account; verified by a paper-order row for `ticker` created after the step was reached. **Requires a written thesis field on the order** — the rep is the sentence, not the click.
- `read_filing` — deep-links to a specific filing section; the learner types one number they found, checked against an authored answer with tolerance. Verifies attention, not honesty.

`paper_trade` unlocks the whole back half of the teen and adult tracks. **Owner decision #2:** approve `paper_trade` + `read_filing` as the two real-world actions to build, and confirm the paper account is live enough to verify against by the time Phase 4 seeds.

---

### 5c. Build order recommendation

Ship the course in phase order and build interactions just ahead of the phase that needs them:

| Before seeding | Build |
|---|---|
| **Phase 1 · FIND** (days 1–12) | **Nothing.** Existing step types cover all 12 days × 3 tracks. |
| **Phase 2 · EVALUATE** (13–24) | `checklist_card`, `calc_step`, `sort_buckets`, `estimate_dial`, `build_sentence` |
| **Phase 3 · DECIDE & SIZE** (25–36) | `tap_the_scene`, `allocation_split`, `paper_trade` action |
| **Phase 4 · MANAGE** (37–48) | `order_sequence`, `scene_compare`, `pool` + Today's Review surface |
| **Phase 5 · SELL** (49–60) | `scale_ladder` |

This means **Phase 1 (36 lessons across three tracks) can be authored and shipped with zero engine work** — the whole FIND phase, including the screener lessons, runs on what already exists. That is the fastest possible path to something real in front of members.

---

## 5d. Skill coverage — the 15 skills, mapped

Mastery is measured against the fifteen skills already seeded in migration 164, not against courses. Every day in the outlines declares 1–3 of these in `skills[]`, and every graded step carries one on `step.skill` so `bump_skill_mastery` fires. The distribution below is the check that the course is balanced — no skill orphaned, no skill carrying the whole thing.

| Skill id | Days that teach it (adult numbering) | Home in the cycle |
|---|---|---|
| `stock_ownership` | 1, 2, 4, 7, 12 | FIND |
| `market_basics` | 3, 5, 8, 9, 45 | FIND |
| `revenue` | 2, 10, 14, 15 | FIND / EVALUATE |
| `growth` | 15, 22, 39 | EVALUATE |
| `margins` | 16, 19, 21 | EVALUATE |
| `profit` | 16, 17, 20 | EVALUATE |
| `financial_statements` | 14, 16, 17, 18 | EVALUATE |
| `competitive_advantage` | 19, 24, 41 | EVALUATE |
| `valuation` | 20, 21, 22, 24 | EVALUATE |
| `technical_analysis` | 26, 27, 40, 52 | DECIDE & SIZE / SELL |
| `risk` | 27, 31, 32, 35, 58 | DECIDE & SIZE |
| `portfolio_construction` | 33, 34, 44, 47, 53, 59 | DECIDE & SIZE / MANAGE |
| `diversification` | 33, 34, 47 | DECIDE & SIZE |
| `market_psychology` | 29, 37, 46, 49, 57 | MANAGE / SELL |
| `thesis_building` | 11, 13, 23, 25, 38, 41, 50, 60 | threaded, all five phases |

`thesis_building` appears first on **Day 11** — before the member has evaluated anything — because the one-line note that earns a watchlist slot is already a proto-thesis. It then returns seven more times, ending on the graduation boss. It is the skill the whole course exists to produce, so it is threaded rather than saved for the end.

Note the shape this produces on the **Investor Brain** bars. After FIND, four bars are moving and eleven are flat — a legible "you have started". After EVALUATE, the six fundamentals bars are the tallest on the board, which is precisely the corrective the current curriculum needs. `technical_analysis` never becomes the tallest bar in this design, and that is the point.

---

## 6. Illustration & animation direction

### The ground rule
The adult register is the source. Kids' art is the adult art **scaled up and warmed**, never a different art style. If a drawing would embarrass a 42-year-old on a train, it does not ship in any track.

### Illustration
**Flat editorial vector with a drawn hand.** Strokes are confident and slightly uneven — drawn, not generated. Two colours plus ink: `ink` for structure, `volt-orange` for the one thing being pointed at, `kai-blue` reserved exclusively for the guide. Gold appears only as annotation (it labels; it never prices — same rule the existing `LessonScene` already follows).

**Objects, not scenes.** Every illustration is a single object with identity: a receipt, a factory roofline, a ledger rule, a set of scales, a vending machine, a stack of slices, a key. Never a "business person at a laptop", never an isometric city, never a robot. The register rule from the brand register applies here without exception: **no generic containers, no stock-illustration people.** An object with identity is memorable at 200px on a phone; a scene is mush.

**One drawing per concept, reused across the block.** The receipt drawn on Day 14 for "who pays, and for what" is the same receipt on Day 16 when we cross out the cost of goods. The learner watches one object accumulate meaning across a phase. This is cheaper to produce *and* better pedagogy.

**Kid derivation:** same object, +40% scale, one extra warm tone, and — only in the kid track — eyes. The receipt gets eyes. The receipt does not get a hat, a catchphrase, or a name.

### Animation
**Motion must carry the concept, or it does not ship.** Test: if you removed the animation and the idea got harder to grasp, keep it. If the idea is unchanged, delete it.

Legitimate motion:
- A **line draws left to right** because time moves left to right.
- A **bar grows** because the number grew.
- A **stack splits** because the money split.
- A **band wipes open** because a range is being marked out.
- **Two things travel toward each other** because they are being compared.

Illegitimate motion: floating, breathing, parallax, decorative shimmer, anything looping.

**Timing:** 180–420ms, `EASE_OUT` (the existing engine constant). Staggers at 40ms. One hero motion per lesson — the moment the concept lands — and everything else is quiet.

**Reduced motion:** every animation resolves to its end state. The existing `useReducedMotion` gate is already respected everywhere in `LessonEngine`; new interactions must match.

**Register scaling** is already solved by `feedbackScale()`: kid 20 particles, teen 12, adult 0. Do not add a second celebration system. Adults get typography and a tick; that *is* the reward for an adult, and the boards agree.

### Kai
Kai is the guide, rendered as the existing `GuideLine` — a kai-blue spark, not a face. He speaks in exactly three situations and no others:

1. **Intro** (`guide.intro`) — one line that frames why today matters. Never "Let's learn about X!"
2. **After a wrong answer** — names *why the wrong option was tempting*, then hands back the question.
3. **Outro** (`guide.outro`) — one line that connects today to the next decision, not a summary.

Kai never celebrates, never uses exclamation marks in the adult register, and never says "great job". His job is to be the person in the room who has seen this mistake before.

---

## 7. XP economy — how 60 days lands on the belt ladder

The curriculum is designed *to the existing economy*, not around it. Nothing in `xp.ts` or `belts.ts` changes.

**Rules we adopt:**
- Every lesson is worth exactly **`XP.LESSON = 50`** (`lesson.xp: 50` in every authored file). Flat, all 60 days, all 3 tracks. De-duped by `lessonId`, so a replay pays nothing — the path is honest.
- Only the **5 phase bosses** (days 12, 24, 36, 48, 60) carry a `quizId`. A passed boss adds `XP.QUIZ_PASS = 30`; a boss with every graded step right on the first try adds `XP.QUIZ_PERFECT_BONUS = 20` on top. Max **+50 per boss, +250 across the course.**
- Checkpoints (days 6, 18, 30, 42, 54) are ordinary 50-XP lessons with no quiz row. They are harder, not richer — difficulty is the reward.
- Flashcards, community posts, RSVPs and games stay exactly as they are. They are the *surplus*, and the design below deliberately depends on them.

**The ladder, walked:**

| Day | Lesson XP | Boss XP | Lifetime | Level | Belt |
|---:|---:|---:|---:|---|---|
| 1 | 50 | — | 50 | 1 Explorer | White |
| **3** | 150 | — | **150** | 2 Money Mapper | **Yellow Belt** |
| **8** | 400 | — | **400** | 3 Chart Reader | **Blue Belt I** |
| 12 | 600 | +50 | 650 | 3 | Blue I *(FIND boss)* |
| **15** | 750 | +50 | **800** | 4 Zone Hunter | **Blue Belt II** |
| 24 | 1200 | +100 | 1300 | 4 | Blue II *(EVALUATE boss)* |
| **26** | 1300 | +100 | **1400** | 5 Sweep Spotter | **Purple Belt I** |
| 36 | 1800 | +150 | 1950 | 5 | Purple I *(SIZE boss)* |
| **41** | 2050 | +150 | **2200** | 6 Trade Ready | **Purple Belt II** |
| 48 | 2400 | +200 | 2600 | 6 | Purple II *(MANAGE boss)* |
| 59 | 2950 | +200 | 3150 | 6 | Purple II |
| **60** | 3000 | +250 | **3250** | 7 Playbook Pro | **Black Belt** *(crosses 3200 inside the graduation boss)* |

**Three things this buys us, and they are the whole retention design:**

1. **A belt on day 3.** 150 XP is the Yellow Belt threshold and three lessons is 150 XP exactly. A member who does three days gets a ceremony. That is the earliest honest reward the existing ladder allows, and day 3 is where courses are won or lost.
2. **Every crossing lands somewhere that means something.** Blue I on day 8, mid-block, as a surprise. Blue II on day 15 — the first lesson of EVALUATE, so the hardest phase opens on a promotion. Purple I on day 26, two days into DECIDE & SIZE. Purple II on day 41, seven days before the MANAGE boss.
3. **Black Belt crosses *inside* the Graduation Boss — and only if you earned it.** 3,000 lesson XP + 250 boss XP = 3,250 against a 3,200 threshold, so with five perfect bosses the ceremony fires during the final lesson of the course. Pass the bosses without perfect runs and you land at 3,150 — **50 XP short**, closed by three flashcard decks, or ten days of showing up in the Club. The curriculum alone cannot quite reach Black. That is deliberate, and it is the FIC thesis in numbers: *the last belt is earned in the community, not in the coursework.*

**Owner decision #3:** confirm flat 50 XP per lesson and quiz rows on the five bosses only. Any other split breaks the day-60 landing.

**Streaks.** The curriculum assumes one lesson = one streak day. Two design asks:
- A **block-complete** marker on the path (the 6th node) rather than a 7-day flame, so the streak's visual rhythm matches the curriculum's rhythm.
- **One repair per phase.** A missed day can be recovered by completing two lessons the next day, at most five times across the course. Generous enough to survive a bad week, scarce enough to still mean something. Note there is **no streak state in the database today** — `dayStreak()` in `src/components/learn/kit.tsx` derives it client-side from `lesson_progress.completed_at`, with a today-or-yesterday tolerance and no freeze mechanic. A repair needs a real row. **Owner decision #4.**

---

## 8. Family sync — the differentiator

**Same day number = same concept, in every track.** Day 51 is scaling out for the adult, scaling out on the paper account for the teen, and "taking some of your win off the table" for the eight-year-old. A family that starts together stays on the same idea for sixty days, and dinner-table conversation is *designed in* rather than hoped for.

This is the thing no competitor has. It is also the thing that makes authoring harder, and it is worth it.

**How it shows up in the product:**

- **Every day, all tracks:** the closing `real_world` rep targets the **same company** wherever the concept allows. If the adult is computing Costco's gross margin, the kid is working out what's left after Costco buys the thing it sells. One family watchlist, three depths, one ticker.
- **Checkpoint days (6 · 18 · 30 · 42 · 54):** the kid track's closing rep is an explicit *ask-a-grown-up*. The adult's checkpoint outro names the kid's question, so the grown-up is expecting it. Neither is required; both are one tap.
- **Boss days (12 · 24 · 36 · 48 · 60):** a **Family Table** moment. All three tracks answer one shared question that day — same prompt, register-adjusted wording — and the family surface reveals who answered what only after everyone has locked in. **This is the single most valuable new surface in the plan and it needs a design pass of its own. Owner decision #5.**

**Where the kid track legitimately diverges.** Nine adult concepts have no honest kid equivalent and are swapped rather than dumbed down — full table in OUTLINE-KIDS.md. The pattern: mechanics (custody, wash sales, capital gains) are replaced by the transferable habit underneath them; ratios (P/E) are replaced by the intuition without the arithmetic; statistics (correlation) are replaced by the same idea with no maths.

**Teens diverge from adults in three places** — Day 4 (custodial/UTMA accounts and the Roth), Day 55 ("the account you'll have at 18"), Day 56 (wash sale framed inside the paper account) — and otherwise run the adult concept in a peer register with paper-account reps. Full table in OUTLINE-TEENS.md.

---

## 9. Compliance rails — non-negotiable, and built into the authoring pipeline

These are not a review step. They are a **lint that fails the build.**

1. **Education, never advice.** No lesson, question, option, feedback line, or Kai line may instruct a purchase or sale of a specific security. Banned as an instruction: *buy, sell, short, get in, load up, take profits, add here.* Companies appear as **worked examples with historical, authored figures**, never as current recommendations.
2. **Verdict vocabulary is fixed:** **Strong / Solid / Mixed / Weak.** Any question asking for a judgment uses exactly these four words, in this order, every time in all three tracks. Never "good/bad", never "buy/avoid", never a star rating. A graduate should have this vocabulary reflexively — it is how the whole Club talks.
3. **Equities only.** No options, no futures, no margin, no leverage, no crypto, no forex — not as a lesson, not as an aside, not as a wrong answer, not as a "you'll learn this later" tease. In the kid and teen tracks the words do not appear at all.
4. **Paper money for all practice.** Every `paper_trade` rep is labelled paper in the step copy itself, not only in the destination screen.
5. **No performance promises.** No lesson may state or imply an expected return. Compounding is taught with explicitly labelled *illustrative* rates: "if this grew 7% a year — and nothing is guaranteed to —". Historical figures are dated and sourced in the authored JSON.
6. **Authored figures only.** Consistent with the existing `LessonSceneSpec` doctrine: every number in a lesson is hand-written and stable, never live-quoted. A lesson must read identically in five years.

**Lint spec** (`scripts/validate-lessons.ts`) — fails on: banned instruction verbs in any string; verdict words outside the fixed four; any of the excluded asset classes; any graded step missing `skill`; any wrong-answer path missing `explanation`; `duration_minutes` outside 4–9; step count outside 6–11 for adults and teens, **6–12 for kids** (the kid track deliberately runs more, shorter steps — see OUTLINE-KIDS.md); `xp !== 50`; a number in body copy that isn't in the lesson's declared `figures` block.

---

## 10. Production pipeline

The good news: **the draft → review → publish spine already exists.** Migration 176 added `lessons.steps_draft`, the `publish_lesson_draft(uuid)` / `unpublish_lesson_draft(uuid)` / `list_learn_drafts()` RPCs, and the `/admin/learn-drafts` surface. Migration 177 already used it for 34 lessons. Nothing here needs a new review mechanism — it needs a source of truth in the repo that feeds it, because right now the authored JSON only exists inside SQL string literals, which is unreviewable and undiffable at 180 lessons.

```
1  AUTHOR      content/curriculum/{track}/day-NN.lesson.json   (matches LessonJSON exactly)
                 ↓  one file per lesson, hand-written, in the register of the track.
                    THE FILE IS THE SOURCE OF TRUTH — not the migration. Diffable,
                    reviewable, and re-generatable into SQL at will.
2  LINT        scripts/validate-lessons.ts
                 ↓  schema + compliance + length + skill coverage + family-sync
                    (day-NN must exist in all three tracks with the same concept
                    id). Blocking, runs in CI.
3  BRIEF       scripts/extract-art-manifest.ts
                 ↓  pulls every [ILLUSTRATION:] / [ANIMATION:] annotation into
                    art-manifest.json — one row per asset, deduped across days
                    (the Day 14 receipt appears once, used by five lessons)
4  ILLUSTRATE  public/learn/art/{slug}.svg
                 ↓  flat vector, ink + volt + kai-blue, drawn hand
5  ANIMATE     declarative only: steps carry { art: { id, motion } } and the
                 ↓  engine maps `motion` to one of ~8 named behaviours
                    (draw-in, grow-bar, split-stack, wipe-band, converge,
                     count-up, cross-out, stack-up). No bespoke code per lesson.
6  GENERATE    scripts/lessons-to-sql.ts  →  one migration per block
                 ↓  writes lessons.steps_draft (NOT steps), plus est_minutes,
                    lesson_xp, node_kind ('lesson' | 'boss'), lesson_skills rows,
                    and quizzes rows for the 4 bosses
7  PREVIEW     /admin/learn-drafts   ← existing owner review gate
                 ↓  every lesson previewed in the real engine before it goes live
8  PUBLISH     publish_lesson_draft(uuid)  — per lesson, owner-triggered
                    copies steps_draft → steps and lifts xp / duration_minutes
```

**Notes on the pipeline:**

- **Step 1 is the change that matters.** Everything else already works. Authoring 180 lessons as SQL heredocs the way 177 did will not survive review; authoring them as linted JSON files that *generate* the migration will.
- Step 5 is the one that keeps this affordable. Eight named motions cover every animation in this document. A lesson author writes `"motion": "grow-bar"`, not a component.
- Step 3's dedupe is why the "one drawing per concept, reused across the phase" rule matters commercially: the real asset count is roughly **70 drawings**, not 180.
- `node_kind` is already an enum on `lessons` with a `'boss'` value — the four phase bosses use it, and the path UI can style them without new schema.
- Authoring order should be **all three tracks of a day together**, not a whole track at a time. The family-sync constraint is impossible to retrofit and trivial to hold if the three registers are written in the same sitting.
- Publishing is per-lesson, so the course can go live **block by block** (15 lessons at a time) while later blocks are still being written. Ship Phase 1 before Phase 2 exists.

---

## 10a. AUDIO-FIRST — the standing presentation rule (07-28)

The owner rejected the first pilot build on sight:

> *"it should be audio speaking the words with images or animations or interactions on screen not read like a book..again we are going for duolingo experience."*

That is not a note about one lesson. It changes what a lesson **is**, for all 180.

### The rule

**A lesson is spoken. The screen is a stage, not a page.**

At any moment the member sees, at most:

1. the drawing or animation for the beat being spoken,
2. **one** line of large type — a headline, a keyword or a figure,
3. the interaction, when the beat is a question.

Kai's voice carries the teaching. Paragraphs never appear on screen. The only
prose a member ever reads is a question (which has to stay visible while it is
answered) and the caption transcript, which is opt-in.

### Segmenting — how prose becomes beats

The authored copy is still written as paragraphs, because that is how the voice
is reviewed. It is then **split, never rewritten**:

- A beat is **1–3 sentences**, hard-capped at **420 characters**
  (`MAX_SEGMENT_CHARS`). The build script refuses to run on a violation — a beat
  longer than ~20 seconds is a paragraph being read aloud, which is the exact
  thing this rule replaces.
- Split points fall on **sentence boundaries inside a paragraph**. A four-sentence
  paragraph usually becomes two beats.
- Every beat's `say` must be a **verbatim slice of `body`**. The migration
  generator checks this and refuses to write otherwise, so the approved voice can
  be re-cut but never quietly reworded for the microphone.
- Every beat owns a **visual state**: which teaching object is on screen, in which
  mode, and whether its measurements are drawn yet. The figure is re-keyed only
  when the drawing genuinely changes, so a run of beats over one picture leaves it
  standing instead of rebuilding it under the voice.

### Sync

**Beat-level, not word-level.** Segment N starts → the visual authored on beat N
animates in. No karaoke, no timing tracks, nothing to re-time when a file is
regenerated. The engine advances on the audio element's own `ended` event, so a
regenerated file of a different length needs no other change.

Two syncs are worth copying to other lessons:

- The order book is drawn **without** its gold spread measure on the beat that
  says "two lines of people", and the measure arrives on the beat that names the
  bid and the ask (`showSpread: false`). The drawing must never answer ahead of
  the voice.
- The prediction reveal is a **walk-up**: headline, then one authored paragraph
  per segment, appearing as it is spoken, with the book being eaten on the
  segment that describes it being eaten.

### Captions and the silent path

- **Captions are the full narration text** (`AudioAsset.say`), so they cannot
  drift from the audio — they are the same string the file was rendered from.
- Default **off**. Forced on automatically when the member mutes, when playback
  is blocked, or before audio is armed. Accessibility requires they exist; the
  design requires they are not the default reading surface.
- **Muted is a complete path, not a degradation.** Beats stop auto-advancing,
  every screen grows a manual Next, and the whole lesson is completable in
  silence with the same writes and the same XP.
- On-screen feedback shows the author's **opening sentence** while the rest is
  spoken; with no voice available the full line is printed instead. Nothing is
  ever lost, only relocated.

### Voice, assets and cost

| | |
|---|---|
| Provider | **Voicebox — local** (owner's call, 07-28). `http://localhost:17493`, MLX/Metal, 1.7B model |
| Voice | Profile **`Kway`** — `2cd42fda-3482-4eb4-a79a-6abc64802e24`. The house voice; the same one the reels use |
| Other profiles on the box | `kyle` `c0f8d6e4-…` · `aiden` `b57345f6-…` · `vivian` `fd72dba9-…` · `ryan` `a0d76292-…` |
| Endpoint | `POST /generate {profile_id, text, language, seed, instruct}` → `{id, duration}`, then `GET /audio/{id}` → `audio/wav`. **No `/api` prefix.** wav → mp3 via ffmpeg (64k, 24 kHz, mono) |
| Direction | `VOICEBOX_INSTRUCT` — a short style note, 500-char cap, one constant for the whole curriculum. Fixed `seed: 7`, so an unchanged line re-renders as the same performance |
| Fallback | OpenAI `gpt-4o-mini-tts`, voice `ash` — `--provider openai`. Kept for a machine without the server |
| Assets | `public/lessons/audio/<lesson-slug>/<step-id>[-variant].mp3` — **committed**, they are static lesson assets |
| Manifest | `public/lessons/audio/<lesson-slug>/manifest.json` — url, measured `durationMs` (ffprobe), the exact script, and a content hash. Written after **every** segment, so a forty-minute job survives being interrupted |
| Runtime TTS | **Never.** Static files only |

**Pre-generated, always.** Cost is paid once for 180 lessons rather than once per
member per replay; latency is a CDN file rather than a model round-trip
mid-sentence; the lesson sounds identical for every member forever, which is the
same promise the hand-written prices make; and nothing a member hears was
invented at runtime — there is no LLM anywhere in this path.

**Cost is zero, and time is the real budget.** Voicebox runs on the machine, so
the curriculum's voice needs no vendor account and no per-replay billing. What it
costs instead is **wall-clock: roughly 50 seconds per segment**, so the Day 3
pilot (50 segments, ~7.6 min of audio, 7,590 characters of script) is about a
**forty-minute** job. Budget that per lesson and run it unattended — the manifest
is written after every segment and the generator is content-hashed, so an
interrupted run resumes and an edit re-renders only the lines that actually
changed. (For reference, the OpenAI fallback would put the same lesson at ~$0.001
of input text, or ~$0.11 by OpenAI's per-minute guide — single-digit dollars for
all 180 lessons. Cost was never the deciding factor; owning the voice was.)

**Regenerating a lesson's audio, end to end:**

```
node scripts/build-lesson-audio.mjs --lesson adult-d03 --sample   # resumable
node scripts/build-pilot-lesson.mjs --audio-migration             # folds in durations
```

Add `--force` to re-render lines whose text has not changed, and
`--provider openai` to fall back off the local box. `--sample` writes
`sample-kway.mp3` plus one alternate profile for an ear check before committing
180 lessons to one voice.

### What every line that reaches the ear is called

`src/lib/learn/narration.ts` is the **single enumeration**, shared by the build
script and the renderer, so the generator and the components cannot disagree
about what a file is called or where it hangs. Roles: `intro` · `outro` ·
`prompt` · `reinforce` · `explanation` · `reask` · `wrong:<optIdx>` ·
`reveal:<n>` · `guide:<value>` · `guide:correct` · `guide:wrong` · `success`,
plus one segment per explainer beat.

**Everything with a role gets a voice** — including per-option wrong-answer
feedback. The curriculum's rule that feedback must name *why that option was
tempting* means four different mistakes need four different spoken answers, not
one apologetic line.

### Where audio sits in the pipeline

Insert between §10 steps 6 and 7:

```
6a AUDIO   node scripts/build-lesson-audio.mjs --lesson <slug>
             ↓  enumerates the script, renders each segment, measures it,
                writes the manifest. Idempotent + content-hashed.
6b BIND    the SQL generator folds the manifest into the lesson JSON, so the
             ↓  migration always ships the durations of the files on disk
7  PREVIEW /admin/learn-drafts — reviewed WITH SOUND ON. A lesson that has not
                been heard has not been reviewed.
```

### Compliance

Unchanged, and now easier to hold: every spoken line is authored curriculum copy
plus a handful of engine chrome lines defined in `narration.ts`. Education, never
advice. Equities only. No performance claims. Hand-written, dated illustrative
prices, never a live quote — and now, never a live voice either.

---

## 10b. Two collisions with existing decisions, for the owner to settle

**a) The Five Worlds vs. the five phases.** `FIC-LEARNING-WORLD.md` already names five presentation worlds — Become an Owner, Follow the Money, Find Great Businesses, Build Your Portfolio, Think Like an Investor — with Higgsfield environments planned per world. This curriculum is also five phases, twelve days each, so the count now matches exactly. But the *cuts* don't: the Worlds are content-shaped, and the phases are decision-shaped.

Recommendation: **keep the five worlds as the visual/environment layer and rename them to the cycle stages.** The environments survive untouched; only the labels move.

| World (today) | Becomes | Environment (unchanged) |
|---|---|---|
| Become an Owner | **FIND** | Ownership city |
| Follow the Money | **EVALUATE** | Money District |
| Find Great Businesses | **DECIDE & SIZE** | Moat Island |
| Build Your Portfolio | **MANAGE** | Portfolio City |
| Think Like an Investor | **SELL** | Market Mountain |

The alternative — keeping the content-shaped names over decision-shaped phases — produces a member reading "Find Great Businesses" over a phase about position sizing. **Owner decision #6.**

**b) "Buy / Watch / Pass" vs. Strong / Solid / Mixed / Weak.** The Research Card — the signature kid/teen artifact in the learning-world doc — ends with a **Buy / Watch / Pass** verdict. The compliance rail for this curriculum is **Strong / Solid / Mixed / Weak**. These are different axes (quality vs. action), but "Buy" printed on an eight-year-old's research card is an action word on a child's screen, and it will be read as one. The curriculum teaches only the quality axis and never asks a learner to output an action. Recommendation: **retire "Buy/Watch/Pass" from the Research Card and replace it with the four verdict words**, keeping a separate, adult-only, paper-account-scoped action field if one is wanted. **Owner decision #7.**

**Estimated authoring volume:** 180 lessons × ~9 steps ≈ 1,600 authored steps. At the quality bar in the samples this is real work — plan it as **10 authoring passes of one block × three tracks (18 lessons per pass)**, each pass ending at a checkpoint or boss so a pass is always a shippable unit.

---

## 11. What the owner is being asked to decide

Ten decisions. Everything else in this document is a recommendation that follows from them.

| # | Decision | Recommendation | What breaks if it goes the other way |
|---:|---|---|---|
| 1 | **Block rhythm** — 6-day blocks (10 weeks at 6/week) vs. a strict 60-calendar-day run | 6-day blocks; checkpoints land on the same weekday | Nothing structural; the XP landing survives either way |
| 2 | **The two real-world actions to build** — `paper_trade` and `read_filing` | Build both; `paper_trade` unlocks the whole back half of the adult and teen tracks | Phases 3–5 fall back to watchlist reps, which is anti-pattern #4 and guts the end-state promise |
| 3 | **Flat 50 XP per lesson, `quizId` on the five bosses only** | Confirm | Any other split breaks the exact Day-60 Black Belt landing |
| 4 | **Streak repair** — one per phase, five across the course | Approve, and note it needs a real DB row; today streaks are derived client-side with no state | Members who miss one day in ten weeks lose a 60-day streak, which is the most common reason people quit a daily course |
| 5 | **The Family Table surface** — one shared question on every boss day, revealed only after all three tracks lock in | Build it; it is the FIC differentiator made concrete | Family sync stays a claim in a document rather than a thing on a screen |
| 6 | **Five Worlds → cycle-stage names** (Become an Owner → FIND, etc.), environments unchanged | Rename | A member reads "Find Great Businesses" over a phase about position sizing |
| 7 | **Retire "Buy / Watch / Pass"** from the Research Card in favour of Strong / Solid / Mixed / Weak | Retire it | "Buy" is an action word printed on an eight-year-old's screen, and it will be read as one |
| 8 | **New-interaction build order** — `checklist_card` + `calc_step` first, `scale_ladder` last | Confirm; Phase 1 (36 lessons) ships with **zero** engine work | Building in a different order stalls authoring, since Phase 2 cannot be written without the checklist card |
| 9 | **Illustration direction** — flat editorial vector, drawn hand, one object per concept reused across a block, ~70 drawings not 180; kid art = same drawings scaled up, never a separate style | Approve the direction before any asset is commissioned | Asset count triples and the kid track drifts into a different visual product |
| 10 | **Switch on the spaced-repetition engine** — the `pool` step type + a "Today's Review" surface reading `skill_mastery.next_review_at` | Approve as part of this curriculum's scope | Review days stay static and the SR engine remains a write-only log, which is where it has been since migration 166 |

**Two things that are not decisions, and should happen regardless of whether this curriculum is approved:**

- **Pull the four options lessons** from the live FIC adult and teen tracks (§0). Teaching calls and puts to minors is a standing compliance exposure that has nothing to do with this plan.
- **Move authored lessons out of SQL heredocs and into linted JSON files** (§10, step 1). Migration 177 put 34 lessons into string literals. At 180 lessons that is unreviewable, and it is the one pipeline change that everything else depends on.
