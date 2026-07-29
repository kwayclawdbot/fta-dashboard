# SAMPLE · KIDS · Day 20 — "A big price tag doesn't mean a big company"

**Track:** kids (7–11) · **Phase:** 2 · EVALUATE, Block 4 · **Recipe:** R12 (Compare-led, kid shape)
**The ONE concept:** the price of one piece tells you nothing on its own. You have to know how many pieces there are.
**Skills:** `valuation` (primary), `stock_ownership`
**Length:** 12 steps · 7 minutes · `difficulty: 2` · **XP: 50**
**Warm-up recalls:** Day 19 — why some companies are hard to copy

**Voice:** per CURRICULUM-OVERVIEW §1d. Warmth pass — the kid track was already simple, so nothing here got dumbed down further.

> **Title note:** matches OUTLINE-KIDS.md Day 20 ("A big price tag doesn't mean a big company"). The filename keeps its original slug so links don't break.

> **This is the market-cap lesson**, and a nine-year-old can absolutely handle it — as long as nobody says "market capitalisation" and nobody uses a number over twenty. The grown-up version of Day 20 asks *"what am I paying for what I'm getting?"* The kid version asks *"is that $3 slice off a big pizza or a small one?"* Same question. And the child does the cutting.

```json
{ "schema": 1, "title": "A big price tag doesn't mean a big company", "skills": ["valuation","stock_ownership"],
  "difficulty": 2, "audience": ["kid"], "duration_minutes": 7, "xp": 50 }
```

---

## `guide.intro`

[KAI]

> Here's a trick question that catches out loads of grown-ups. Which costs more — a $3 slice or a $1 slice? You already want to say the $3 one. Hold that thought.

---

## STEP 1 — Warm-up

`{ "id": "k-d20-warm", "type": "multiple_choice", "skill": "competitive_advantage" }`

**[INTERACTION: multiple_choice — 15-second retrieval from Day 19]**

> **Yesterday: why is Lego hard for another company to copy?**

- A. Nobody else knows how to make plastic
- B. People love the name, and every brick fits every other brick they already own ✓
- C. It's against the rules to make bricks
- D. Lego is the oldest toy company

**Right:** *"Yes. Other companies do make bricks. But if you've already got a big box of Lego at home, a brick that doesn't quite fit is annoying. So most people just buy more Lego."*

**Wrong (A) → [KAI]:** *"Loads of companies can make plastic bricks, and some of them do. The hard part isn't making one. It's making one that fits the bricks already in your bedroom. Have another go."*

---

## STEP 2 — Explainer · Two pizzas

`{ "id": "k-d20-x1", "type": "explainer", "skill": "valuation" }`

**Heading:** Two pizzas come out of the kitchen

> Both pizzas are exactly the same size. Same everything.
>
> One got cut into **4 big slices**. The other got cut into **20 little slices**.

> **[ILLUSTRATION: two identical circles side by side, drawn as pizzas from above with a hand-drawn wobble. Left one has two straight cuts making 4 big slices. Right one has cuts making 20 thin slices. Same outer circle, exactly the same size, drawn with the same stroke so the eye can verify they match. Ink outlines, one warm sand fill, volt-orange on the cut lines only. This is THE PIZZA and it is the controlling object of the kid track's EVALUATE phase — it comes back on Day 23 for dilution.]**

> **[ANIMATION: `split-stack`. Both circles appear whole. Then the cuts draw in: two cuts on the left (200ms each), then the cuts on the right, fast, 60ms apart. Watching the same circle get cut two different ways is the entire lesson, and it has to happen in front of the child rather than arriving finished. Reduced motion: both shown already cut.]**

---

## STEP 3 — Explainer · Put a price on a slice

`{ "id": "k-d20-x2", "type": "explainer", "skill": "valuation" }`

**Heading:** Now put a price on each slice

> A big slice off the 4-slice pizza costs **$3**.
>
> A little slice off the 20-slice pizza costs **$1**.
>
> So the $1 slice is cheaper. But hang on — cheaper slice doesn't mean smaller pizza.

**Figure:** `{ "kind": "stat", "value": "4 × $3   ·   20 × $1", "caption": "same pizzas, cut differently" }`

---

## STEP 4 — Work it out

`{ "id": "k-d20-calc1", "type": "calc_step", "skill": "valuation" }`

**[INTERACTION: NEW — `calc_step`. Number pad, no wiggle room. The facts stay pinned above the pad, so this checks whether you know what to do — not whether you remembered the numbers. Get it wrong and the working shows up one line at a time, when you tap.]**

**What you know (pinned to the screen):**
- Pizza A: **4 slices**, **$3** each
- Pizza B: **20 slices**, **$1** each

> **How much does the WHOLE of Pizza A cost?**

**Answer:** `12` (unit `$`, tolerance 0)

**The working:**
1. `4 slices × $3` → **$12**

**Reinforce:** *"$12 for the whole thing. Now do the other one."*

---

## STEP 5 — Work out the other one

`{ "id": "k-d20-calc2", "type": "calc_step", "skill": "valuation" }`

**[INTERACTION: `calc_step` — same kind of sum, different numbers. Doing it twice is what turns it from a sum into a habit.]**

> **And how much does the WHOLE of Pizza B cost?**

**Answer:** `20` (unit `$`, tolerance 0)

**The working:**
1. `20 slices × $1` → **$20**

**Reinforce:**
> Look at that. The pizza with the **cheap** $1 slices costs **$20** altogether. The one with the **expensive** $3 slices costs **$12**.
>
> The pricey-looking pizza was the cheaper pizza. And you only found that out by counting the slices.

> **[ANIMATION: `count-up`. As the solution line reveals, twenty little slice-shapes fly one at a time from the right-hand pizza into a stack beside the total, and the total counts 1, 2, 3… 20. It's slightly too many slices, on purpose — the child should feel that twenty is a lot. 40ms apart, 800ms total. Reduced motion: total shown.]**

---

## STEP 6 — Which one's worth more?

`{ "id": "k-d20-cmp", "type": "scene_compare", "skill": "valuation" }`

**[INTERACTION: NEW — `scene_compare`. Two pictures side by side, one question, one answer. Cheap to build: it's a multiple choice with two drawings instead of one.]**

> **Which pizza is worth more altogether?**

- **Pizza A** — 4 slices at $3
- **Pizza B** — 20 slices at $1 ✓
- They're worth the same
- You can't tell

**Right:** *"Pizza B, at $20. Even though every single slice was cheaper."*

**Wrong (Pizza A) → [KAI]:** *"That's the trap, and it gets almost everybody the first time. The $3 slice feels bigger and pricier, so Pizza A feels like the expensive one. But there are only four of them. Count them up again."*

**Wrong ("you can't tell") →** *"You can tell — you just did it. Slices, times the price of a slice. That's all it takes."*

---

## STEP 7 — Explainer · Companies get cut up too

`{ "id": "k-d20-x3", "type": "explainer", "skill": "stock_ownership" }`

**Heading:** Companies get cut into slices too

> A company gets cut into slices, just like a pizza. Each slice is called a **share**.
>
> Some companies are cut into a few slices. Some are cut into millions.

---

## STEP 8 — Explainer · So the price tag fibs

`{ "id": "k-d20-x4", "type": "explainer", "skill": "valuation" }`

**Heading:** So one slice's price barely tells you anything

> Somebody says *"this company costs $400 a share"* and *"that one costs $6 a share"*. You still have no idea which company is bigger.
>
> The $6 one might be cut into a hundred times more slices. **You have to ask how many slices there are.**
>
> Grown-ups have a name for slices times price. They call it the **size of the company**. It's the only number that actually compares two companies.

> **[ILLUSTRATION: the two pizzas again, now with a small company logo-shape stamped in the middle of each — one wearing a big price tag reading "$400 a slice" over 4 slices, the other "$6 a slice" over lots of slices. Beneath each, a hand-drawn total. Same drawing as Step 2, one thing changed. That reuse is what makes the leap from pizza to company feel like no leap at all.]**

---

## STEP 9 — Sort them out

`{ "id": "k-d20-sort", "type": "sort_buckets", "skill": "valuation" }`

**[INTERACTION: `sort_buckets` — two buckets, six cards. Cards stay where you put them until you hit Check, so you're checking a whole idea. Wrong ones pop back with their reason, one at a time.]**

> **Which of these tells you how big a company really is?**

**Buckets:** `TELLS YOU THE SIZE ✓` · `TELLS YOU NOTHING ✗`

| Card | Bucket | Reason |
|---|---|---|
| The price of one slice, times how many slices there are | TELLS YOU THE SIZE | That's the whole pizza. |
| The price of one slice | TELLS YOU NOTHING | Could be a big pizza cut small, or a small one cut big. |
| How many slices there are | TELLS YOU NOTHING | Loads of slices could still be a tiny pizza. |
| What the whole company would cost to buy | TELLS YOU THE SIZE | Same thing, said a different way. |
| Whether the price went up today | TELLS YOU NOTHING | That's about today, not about size. |
| One slice costing $500 | TELLS YOU NOTHING | Still one slice. Still no idea how many. |

**Reinforce:**
> Two of these tell you the size, and honestly they're the same one said twice. Everything else is a fact about **one slice** — and one slice never tells you about the pizza.

**If you get one wrong:**
> Ask yourself one thing about each card. *After reading this, could I still be wrong about the pizza?* If yes, it goes in "tells you nothing".

---

## STEP 10 — Multiple choice

`{ "id": "k-d20-mc1", "type": "multiple_choice", "skill": "valuation", "framing": "bigger" }`

**[INTERACTION: multiple_choice with `framing: "bigger"` — the drawn mark loops the word the question turns on.]**

> **Company A: 6 slices, $10 each. Company B: 30 slices, $3 each. Which is ~~bigger~~?**

- A. Company A, because each slice costs more
- B. Company B ✓
- C. They're the same
- D. Company A, because bigger slices are better

**Right:** *"Company B. Six times ten is sixty. Thirty times three is ninety. B is bigger, even though every slice is cheaper. Same as the pizzas."*

**Wrong (A) → [KAI]:** *"The pricier slice pulls you in every time. It did on the pizzas too. Do the two sums and let the numbers decide instead of the price tag."*

**Wrong (C) →** *"Try the two sums — 6 × $10, and 30 × $3. They're not the same."*

---

## STEP 11 — True or not true

`{ "id": "k-d20-tf", "type": "true_false", "skill": "valuation", "trueLabel": "True", "falseLabel": "Not true" }`

**[INTERACTION: true_false, rendered as the swipe]**

> **"A company with a $6 share price is a small company."**

**Answer: Not true.**

**If you swipe wrong:**
> $6 is the price of **one slice**. You still don't know how many slices there are. A $6 slice off a pizza cut into a million pieces is a massive pizza.

**If you swipe right:**
> Exactly. Cheap slice, giant company — that happens all the time, and loads of grown-ups get caught by it.

**Footer:** `+50 XP` beside Check — last graded step.

---

## STEP 12 — Go and check

`{ "id": "k-d20-rw", "type": "real_world", "action": "research_ticker", "skill": "valuation" }`

**[INTERACTION: `real_world` — `research_ticker` on two companies from the family watchlist. The rep is exactly today's skill: refusing to guess size from a price tag.]**

**Prompt:**
> Pick **two** companies off the family watchlist. Look at the price of one slice for each. Then find the size of the whole company.
>
> Guess which one's bigger from the slice price first. Then check. Were you right?

**CTA:** `Open our watchlist`

**Success text:**
> Now you know something loads of grown-ups don't. The slice price is almost never the answer. And if your guess was wrong — brilliant. You'll never trust a price tag again.

---

## `guide.outro`

[KAI]

> One slice is never the pizza. Remember that and you'll skip a mistake that costs people real money. Tomorrow: why the same thing can be worth loads to one person and nothing to another.

---

## Production summary

| | |
|---|---|
| **New interactions needed** | `calc_step` (×2), `scene_compare`, `sort_buckets`. All three are already on the build list for this phase. |
| **New illustrations** | 1 — **the pizza**, drawn three times with one thing changed each time (cut two ways → priced → stamped as companies). The controlling object of the kid EVALUATE phase; comes back Day 23 for dilution, where the child does the cutting. |
| **Animations** | 3 — `split-stack` (the two sets of cuts drawing in), `count-up` (twenty slices flying into a stack, deliberately feeling like too many), and the `sort_buckets` grab-and-snap. All resolve to end state under reduced motion. |
| **Kai lines** | 5 — intro, outro, and three wrong-answer lines that say why the wrong pick was tempting. |
| **XP** | 50, banked on Step 11. No quiz row. |
| **Step count** | **12 steps in 7 minutes** — the top of the kid band, and more than the grown-up version of this day. Needs the 12-step lint ceiling for kids (CURRICULUM-OVERVIEW §9). |
| **Compliance** | No stock-price guessing anywhere. Every number is pocket-money size — the biggest figure in the lesson is $90. "Market capitalisation" never appears; "the size of the company" does. No options, futures, margin or leverage. Nothing scary. |
| **Family sync** | The grown-up and teen Day 20 ask *"what am I paying for what I'm getting?"* and compare price against company size on two real companies. The kid does the same comparison, on the same two names, off the same family watchlist — with pizzas. A family can compare answers at dinner without anyone translating. |
| **Voice check** | Warmth pass only. Nothing simplified further. Contractions throughout. No exclamation marks, no "awesome", no baby spellings. |
