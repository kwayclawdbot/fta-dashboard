# OUTLINE — KIDS · 60 days, ages 7–11

## The spine: the same decision cycle, in objects you can move

Same sixty days, same five phases, same day numbers as the adult track. A nine-year-old on Day 34 and a parent on Day 34 are thinking about the same thing on the same evening. That's the whole point of the shape.

```
FIND ──▶ EVALUATE ──▶ DECIDE & SIZE ──▶ MANAGE ──▶ SELL ──┐
  ▲                                                        │
  └────────────────────────────────────────────────────────┘
```

| Phase | Days | The question, in a kid's words |
|---|---|---|
| **1 · FIND** | 1–12 | *Which companies are even worth looking at, and where do I find them?* |
| **2 · EVALUATE** | 13–24 | *Is this a good company, and is the price sensible?* |
| **3 · DECIDE & SIZE** | 25–36 | *I like it. How much of my ten would I put here?* |
| **4 · MANAGE** | 37–48 | *It's mine now. What am I supposed to be doing?* |
| **5 · SELL** | 49–60 | *When do I let some of it go?* |

**The end state — this is the promise.** By Day 60 a kid who has shown up has:

- a **way of finding companies** — their own house, the family list, one rule that drops names — that they can run again without being asked;
- **three research cards** filled in, each ending in a Strong / Solid / Mixed / Weak verdict with two reasons;
- **a number written next to each name** — how many of their ten would go there — arrived at by counting, not by feeling;
- **a change-my-mind line** for each one, written before anything happened;
- and **one practised take-some-off-the-table decision**, made with drawn objects and a family vote.

They'll also sit at the Family Table on boss night and use the same four verdict words their parents use. Not a simpler version of the words. The words.

---

## The one rule this whole track runs on

**Kids get MORE steps than adults on the same day, not fewer.**

Right now the kid lessons are the shortest ones in the database. That's backwards, and it's anti-pattern #7 in CURRICULUM-OVERVIEW §1b. A nine-year-old isn't a slower adult. They're a new one. That's a different problem, and you fix it with objects and repetition — not with baby words and exclamation marks.

| | Adult | Kid |
|---|---|---|
| Steps | 6–11 | **9–12** |
| Minutes | 5–8 | **5–7** |
| One step is | three paragraphs | **two sentences and a thing to drag** |
| `explainer` | one, whole | **always split into two short ones** |

More steps, each much shorter. The idea arrives three times in three different sets of clothes. Nothing on screen is longer than a nine-year-old will actually read.

> **Lint note:** CURRICULUM-OVERVIEW §9 fails any lesson over 11 steps. That ceiling has to move to **12 for the kid track**, or this rule can't ship. Flagged for engineering.

### Four hard rules, no exceptions

1. **Every big idea gets an object the child moves.** Not a metaphor you mention in a paragraph — a drawn thing they drag, cut, sort or tap. Dilution is a pizza cut into more slices, *and the child does the cutting.* If an idea has no object yet, the day isn't written yet.
2. **Small numbers only.** 4 slices. 10 marbles. $6. Never millions, never billions, never a percentage of a number nobody can picture. If a kid can't hold the number in their head, it teaches them nothing. Pretend otherwise and you get a kid who can say "market cap" out loud and understand none of it.
3. **Real companies they know.** Lego, Nintendo, Roblox, Nike, Disney, McDonald's, Crocs, Costco, Minecraft (Microsoft), Hershey. Every worked example uses one of these. Any figure is written by us, dated, and shrunk to pocket-money size.
4. **Nothing scary.** No losing-your-savings talk. No "you'll need this when you're old." No sum bigger than a birthday present. **Risk is taught as "how sure are we?"** — never as fear. A kid who finishes this course scared of money has been taught the exact opposite of the thing.

---

## Register

Warm, direct, never babyish. Treat the kid as someone who hasn't seen this yet, not someone who can't think. No exclamation marks in body copy, no "let's dive in", no cartoon voice. `feedbackScale("kid")` gives 20 particles on a correct answer — the party happens in the motion, so the words never have to shout.

**Derived DOWN from the adult register.** Same drawings, 40% bigger, one extra warm tone, and — only here — the object gets eyes. The receipt gets eyes. The receipt doesn't get a hat, a catchphrase, or a name. If a drawing would embarrass a 42-year-old on a train, it doesn't ship in any track — this one included.

Kai is the same kai-blue spark, not a face. Three moments only: one intro line, one line after a wrong answer naming why the wrong one was tempting, one outro line. He never says "great job".

---

## Mechanics

**Structure:** 5 phases × 12 days. Each phase is two 6-day blocks: five teaching days then a retrieval day. The second retrieval day of each phase is the **FAMILY BOSS**.

```
Phase (12 days) = Block A: 5 teach + 1 CHECKPOINT
                  Block B: 5 teach + 1 FAMILY BOSS
Checkpoints: days 6, 18, 30, 42, 54   ← each ends with an ask-a-grown-up rep
Bosses:      days 12, 24, 36, 48, 60  ← node_kind: 'boss', carries quizId
```

**XP:** every lesson is exactly **50 XP**. The five bosses additionally carry a `quizId`: **+30 passed, +20 more for a perfect first-try run.** Nothing else inside a lesson awards XP. Same as the adult track — that's what keeps a whole family walking one belt ladder.

**The belt walk** is the same as the adult one, day for day: Yellow **Day 3** · Blue I **Day 8** · Blue II **Day 15** · Purple I **Day 26** · Purple II **Day 41** · **Black Belt crosses during the Day 60 Graduation Boss.** With five perfect bosses you go past the 3,200 Black Belt line partway through that lesson and finish the course on 3,250. Pass the bosses without perfect runs and you land on 3,150 — fifty short — and you earn the last of it in the Club, just like an adult does.

**Difficulty** ceiling is 3 (CURRICULUM-OVERVIEW §4). Phase 1 → 1 · Phase 2 → 1–2 · Phase 3 → 2 · Phase 4 → 2–3 · Phase 5 → 3.

**Length:** 9–12 steps, 5–7 minutes. Checkpoints 10 steps · 7 min. Bosses 12 steps · 8 min.

**Step recipes** — same R-codes as the adult track, so you can line a day up across the three files at a glance. The shape follows the idea; no recipe repeats more than three times in a phase.

| Code | Shape |
|---|---|
| **R1** Classic | warm-up · explainer · explainer · MC · true/false · MC · sort_buckets · rep |
| **R2** Scene-led | warm-up · explainer · scene-MC · tap_the_scene · explainer · tap_the_scene · MC · rep |
| **R3** Sort-led | warm-up · explainer · sort_buckets · explainer · sort_buckets · MC · rep |
| **R4** Dial-led | warm-up · explainer · estimate_dial · explainer · estimate_dial · MC · rep |
| **R5** Predict-led | warm-up · explainer · prediction · explainer · MC · true/false · rep |
| **R6** Build-led | warm-up · explainer · build_sentence · explainer · build_sentence · MC · rep |
| **R7** Order-led | warm-up · explainer · order_sequence · explainer · MC · order_sequence · rep |
| **R8** Checkpoint | 4 graded on the block · 2 `pool` (weakest due skills) · ask-a-grown-up rep. No explainers — this is retrieval, not re-teaching |
| **R9** Family Boss | 12 steps, cumulative across the phase, ending on the Family Table. Carries `quizId` |
| **R10** Apply | warm-up · explainer · explainer · extended real-world rep with a structured output |
| **R11** Allocate | warm-up · explainer · allocation_split · explainer · allocation_split · MC · rep |
| **R12** Compare | warm-up · explainer · scene_compare · explainer · estimate_dial · MC · rep |
| **R13** Card-run | warm-up · explainer · `checklist_card` fill · sort_buckets · MC · rep — the Phase 2 workhorse |
| **R14** Worked problem | warm-up · explainer · `calc_step` · explainer · `calc_step` · MC · rep — always with numbers under twenty |

**`sort_buckets` and `tap_the_scene` carry this track**, because they're the two you do with your hands. One is putting real things into real piles. The other is touching the thing you're being asked about. A seven-year-old sorting five items into two buckets is thinking harder than the same seven-year-old picking option C.

---

## Kids and the paper account

**Kids don't have order entry.** Anywhere the adult opens, sizes, trims or exits a paper position, the kid makes **the same decision on paper with a grown-up**, on two surfaces already in the plan:

- the **family watchlist** — one list, shared by all three tracks;
- the **family research card** — the kid's written artifact, structured inputs only, ending in a Strong / Solid / Mixed / Weak verdict.

Phase 5 — selling and scaling out — is done as **"taking some of your win off the table"** with drawn objects and a family vote. The idea survives whole; only the way you do it changes. A nine-year-old who has moved three marbles out of a jar of nine, at a step they picked in advance, has practised the hardest move in investing.

**Worked examples:** Lego, Nintendo, Roblox, Nike, Disney, McDonald's, Crocs, Costco, Minecraft/Microsoft, Hershey — real episodes, authored and dated figures, never live-quoted.

---

# PHASE 1 · FIND — Where good companies come from (Days 1–12)

*Difficulty 1. New interactions required: none.*

### Block 1 — Your workshop (Days 1–6)

| Day | Lesson | The ONE concept | Steps · min | Interactions | Warm-up recalls | Real-world rep |
|---:|---|---|---|---|---|---|
| 1 | **You already know a hundred companies** | A share is one small piece of a real company — and the companies are already all around you | 10 · 6 | R1 · MC ×2, true/false, sort_buckets (a real company / not a company). Object: a chocolate bar snapped into squares, one square is your piece | — (opens on the hook) | Add **one company you gave money to this month** to the family watchlist |
| 2 | **Somebody pays them. Who?** | Every company gets money from someone, for something. If you can't say who and what, you don't know the company yet | 10 · 6 | R6 · build_sentence ×2 ("___ pays ___ for ___"), MC. Object: a till, coins crossing the counter | Day 1 | Say the money sentence out loud for yesterday's company, then write it on the family research card |
| 3 | **Nobody decides the price** | A price is just two people agreeing. One wants it, one has it. Nobody up top decides | 11 · 7 | **← SAMPLE WRITTEN** · R5 · prediction (three kids want one sticker and one kid has it — what happens next?), MC ×2, true/false. Object: two hands over a swap table | Day 2 | Open the family watchlist and write down the **two numbers** next to one company, and how far apart they are |
| 4 | **Where your piece lives** | Your piece isn't a thing you hold. It's written down somewhere safe, and a grown-up holds the key until you're older. Money for soon and money for later live in different places | 12 · 7 | R3 · sort_buckets ×2 (things you hold / things written down · money for soon / money for later), order_sequence, MC. Object: a locked box, a key, two jars | Day 1 | Name one thing you're saving for **soon** and one for **later**, and say which jar each goes in |
| 5 | **One company, or a little bit of all of them** | You can own a piece of one company, or a tiny piece of hundreds at once. And if someone takes one sticker every round, look what's left | 12 · 7 | R4 · estimate_dial ×2 (10 stickers, one taken each round — how many after 6? · one whole cookie or a crumb of every cookie), MC, true/false. Object: **the little leak** — a sticker sheet losing one square a round | Day 4 | Add the family's **"a little bit of all of them"** name to the watchlist and label it *the one we compare against* |
| 6 | **CHECKPOINT · Your workshop** | Retrieval Days 1–5 + 2 pooled | 10 · 7 | R8 · MC ×2, sort_buckets, estimate_dial, pool ×2 | Days 1–5 | **Ask a grown-up:** which jar does the money for *this year* live in, and which jar is for later? Write their answer on the family card |

### Block 2 — The hunt (Days 7–12)

| Day | Lesson | The ONE concept | Steps · min | Interactions | Warm-up recalls | Real-world rep |
|---:|---|---|---|---|---|---|
| 7 | **Your house is full of companies** | You already know twenty companies because you use their stuff. That's a list nobody else has, and you understand it better than any list you could look up | 11 · 7 | R10 · sort_buckets ("I can explain how they get money" / "not really"), build_sentence, MC. Object: one room drawn flat, every product labelled | Day 2 | Walk **one room** and list every company in it. Keep only the ones you can explain in one sentence |
| 8 | **Take the name. Leave the answer** | When someone tells you about a company, take the *name* they noticed. Never take the *answer* they landed on — that part is yours to do | 11 · 7 | R3 · sort_buckets ×2 (a noticing / an already-decided), MC ×2. Object: a name card handed over, a sticky note with someone's verdict on it thrown away | Day 7 | Take one name off the family watchlist that **someone else added**, and write what *you* want to find out about it |
| 9 | **A colander doesn't find the good bits. It drops the rest** | A rule can't tell you which company is good. It can only throw out the ones that fail it. So picking the rule is the whole skill | 11 · 7 | R3 · sort_buckets ×2 (a rule that drops names / a rule that drops nothing), MC, estimate_dial. Object: a colander, pasta going through | Day 8 | Pick **one rule** and run it down the family list. Count how many names it dropped |
| 10 | **Two rules worth using** | Rule one: do they keep any of the money they take? Rule two: is the price sensible for what you get? Run both, on real names | 12 · 7 | R14 · calc_step ×2 (of every $10 McDonald's takes, how much stays? · same for Lego), sort_buckets, MC | Day 9 | Run **both rules** down the family list and write which names survived both |
| 11 | **No reason, no slot** | A name only gets onto your list when you can write one line saying why you want to watch it. No line, no slot | 11 · 7 | R6 · build_sentence ×2 ("I want to watch ___ because ___"), sort_buckets (a real reason / not a reason), MC | Day 10 | Cut your list down to **five names**, each with its one line |
| 12 | **🏆 FAMILY BOSS · FIND** | Cumulative Days 1–11 + Family Table. **Output: your hunting card** | 12 · 8 | R9 · order_sequence (the four steps of the hunt), sort_buckets ×2, MC ×4, estimate_dial, build_sentence, Family Table. **quizId** | Days 1–11 | Make and save the **Hunting Card**: where you look, your one rule, your slot rule, and the day of the week you do it |

---

# PHASE 2 · EVALUATE — Is this a good company? (Days 13–24)

*Difficulty 1–2. New interactions required: `checklist_card`, `sort_buckets`, `estimate_dial`, `calc_step`, `build_sentence`.*

**This whole phase is one object: the research card.** They see all of it on Day 13, then fill it in one question at a time across Days 14–23, and it comes back in every phase after this. A kid finishes this phase holding **three filled-in cards for three real companies** — the same four questions the adults answer, and the same four verdict words.

```
THE RESEARCH CARD
 1 · THE COMPANY   How do they get money — and are more people paying them?
 2 · THE MOAT      Why can't somebody else just do this?
 3 · THE PRICE     What do you pay, and what do you get?
 4 · MY REASON     Why this one — and what would change my mind?
 VERDICT           Strong · Solid · Mixed · Weak
```

### Block 3 — The company (Days 13–18)

| Day | Lesson | The ONE concept | Steps · min | Interactions | Warm-up recalls | Real-world rep |
|---:|---|---|---|---|---|---|
| 13 | **Four questions, and you ask them in this order** | Company → Moat → Price → My reason. In that order, because any one of them can end it — and you don't want to have done the other three for nothing | 11 · 7 | R13 · checklist_card (opened whole), order_sequence (the four questions), sort_buckets, MC | Day 11 | Open a research card for the first of your five names |
| 14 | **Most of the money comes from one part** | A company is often three things wearing one name, and usually only one of them earns the money | 12 · 7 | R3 · sort_buckets ×2 (which pile earns it — Nintendo: consoles / games / theme parks), estimate_dial, MC. Object: three coin piles of very different heights | Day 13 | Find which part of **your** company earns most of it, and write that part on the card |
| 15 | **More people, or just a higher price?** | Ten kids buying instead of eight is real growing. Eight kids paying more is a different thing, and it doesn't last the same way | 12 · 7 | R14 · calc_step ×2 (8 buyers → 10 buyers · 8 buyers at $5 → 8 at $6), sort_buckets (more people / higher price), MC | Day 14 | Work out which kind of growing **your** company is doing, and write which kind on the card |
| 16 | **Out of every ten dollars, how much do they keep?** | Two companies can take in the same money and keep completely different amounts. What they keep is what kind of company it is | 12 · 7 | R14 · calc_step ×2 (Crocs keeps $5 of every $10 · Costco keeps $1), estimate_dial (guess before the reveal), MC. Object: a $10 note cut into what's kept and what's spent | Day 15 | Find how much of every $10 your company keeps, and write it on the card |
| 17 | **Money you have vs. money you're promised** | Being owed $10 isn't the same as holding $10. You can't spend a promise. And there's what you own, and there's what you still owe | 12 · 7 | R3 · sort_buckets ×2 (in the jar / promised · things I own / things I owe), calc_step, MC. Object: a jar of coins beside a stack of IOU notes | Day 16 | Find **one thing someone owes you** and **one thing you owe someone**, and write both down |
| 18 | **CHECKPOINT · The company's story** | Four facts aren't a story. Retrieval Days 13–17 + 2 pooled | 10 · 7 | R8 · build_sentence (the whole company in one sentence), calc_step, sort_buckets, MC, pool ×2 | Days 13–17 | **Ask a grown-up:** which part of one family-list company do *they* think earns the money? Write it next to your answer and see if you match |

### Block 4 — Moat, price, reason (Days 19–24)

| Day | Lesson | The ONE concept | Steps · min | Interactions | Warm-up recalls | Real-world rep |
|---:|---|---|---|---|---|---|
| 19 | **Why can't somebody else just do this?** | Four reasons a company is hard to copy: everyone loves the name · everyone's already there · they can make it cheaper · switching is a pain. And one test — did they stay ahead when somebody actually tried? | 12 · 7 | R3 · sort_buckets ×2 (which of the four · really hard to copy / just had a good year), MC ×2. Object: a Lego brick beside a brick that nearly fits | Day 17 | Name the reason **your** company is hard to copy — or write "I can't find one", which is also an answer |
| 20 | **A big price tag doesn't mean a big company** | The price of one piece tells you nothing on its own. You have to know how many pieces there are | 12 · 7 | **← SAMPLE WRITTEN** · R12 · scene_compare (a pizza cut into 4 at $3 a slice / a pizza cut into 20 at $1 a slice), estimate_dial (which pizza cost more in total?), explainer ×2, MC | Day 19 | Take two names off the family list and work out which is actually the **bigger company** — not which has the bigger price |
| 21 | **Worth it to who?** | The same thing can be worth a lot to one person and nothing to another. So "expensive" is never a finished sentence — it always needs "compared to what?" | 12 · 7 | R4 · estimate_dial ×2 (what a goalkeeper would swap for the glove / what someone who doesn't play would), scene_compare, MC. Object: one glove, two kids, two very different offers | Day 20 | Write one thing **you'd** pay a lot for that a friend wouldn't, and say what makes the difference |
| 22 | **Paying for what hasn't happened yet** | Sometimes the price already includes the good thing everyone's expecting. Then the good thing happens — and nothing gets better, because you already paid for it | 12 · 7 | R5 · prediction (you paid $6 for the cake while it was still in the oven, and it comes out exactly as promised — how do you feel?), calc_step, MC ×2. Object: an oven with the receipt taped to the door | Day 21 | Find one company on the family list everyone expects big things from, and write **what actually has to happen** for the price to make sense |
| 23 | **Why this one, and what would change my mind** | A reason that nothing could ever undo isn't a reason. It's a feeling with a company's name on it | 12 · 7 | R6 · build_sentence ×2 ("I like ___ because ___" · "I'd change my mind if ___"), sort_buckets (could actually happen / could never happen), MC | Day 22 | Write **both lines** for your best name on its research card |
| 24 | **🏆 FAMILY BOSS · EVALUATE** | Cumulative Days 13–23 + Family Table. **Output: three finished research cards with verdicts** | 12 · 8 | R9 · checklist_card, calc_step ×2, sort_buckets ×2, MC ×4, build_sentence, Family Table. **quizId** | Days 13–23 | Finish all four questions on **three** cards and give each one a **Strong / Solid / Mixed / Weak** verdict with two reasons |

---

# PHASE 3 · DECIDE & SIZE — How much of your ten? (Days 25–36)

*Difficulty 2. New interactions required: `calc_step` (heavily), `tap_the_scene`, `allocation_split`.*

**The object for this whole phase is ten marbles and a row of jars.** Ten, because a kid can count ten, and can see at a glance that seven in one jar is a lot. Every sizing idea in the adult track has an honest version in ten marbles. And the sums are real sums — the child does them, we don't just show them.

### Block 5 — Deciding (Days 25–30)

| Day | Lesson | The ONE concept | Steps · min | Interactions | Warm-up recalls | Real-world rep |
|---:|---|---|---|---|---|---|
| 25 | **Write your number down before you look** | Decide what it's worth to you while the price tag is turned over. After that it isn't thinking any more — it's just sticking to it | 11 · 7 | R6 · build_sentence, prediction (what happens to your number once you've seen theirs?), MC ×2. Object: a sealed envelope with your number inside | Day 23 | Write your number for one family-list company on a card, **face down**, then turn the price over |
| 26 | **Where have people been happy to buy before?** | A price that keeps bouncing off the same line is a line where people have shown up before. That's all a line is — memory | 12 · 7 | R2 · tap_the_scene ×2 (tap where it bounced · tap the line it couldn't get above), scene-MC, explainer ×2 | Day 25 | Find a line **your** company has touched three or more times, and draw it on the research card |
| 27 | **The line where you'd say "I was wrong"** | You pick that line for a reason about the company, not because it's a comfortable distance away | 12 · 7 | R2 · tap_the_scene, scene-MC, sort_buckets (a real reason for the line / just a comfy distance), MC. Object: a line drawn on the floor, feet either side | Day 26 | Draw your line for one name, and write the sentence that says why it's **there** |
| 28 | **A few now, or all of it now?** | Put three marbles in now and keep seven, and you get something for it: you keep paying attention, and you only add the rest once you've been proved right | 12 · 7 | R7 · order_sequence ×2 (what happens after a small start / after all-in), MC ×2. Object: ten marbles, three going into a jar | Day 27 | Decide **3-now or 10-now** for your name, and write what would make you add the rest |
| 29 | **Same move, two very different reasons** | Adding because your plan said so, and adding because you hate being wrong, look identical from the outside. Only one of them was decided in advance | 12 · 7 | R3 · sort_buckets ×2 (planned / rescuing), prediction, MC. Object: two kids adding marbles, one holding a written plan | Day 28 | Find one time you added more of something after it went badly. Write honestly which of the two it was |
| 30 | **CHECKPOINT · Deciding** | Retrieval Days 25–29 + 2 pooled | 10 · 7 | R8 · tap_the_scene, sort_buckets, build_sentence, MC, pool ×2 | Days 25–29 | **Ask a grown-up:** what's one thing they decided the price of *before* they went shopping — and did they stick to it? |

### Block 6 — How much (Days 31–36)

| Day | Lesson | The ONE concept | Steps · min | Interactions | Warm-up recalls | Real-world rep |
|---:|---|---|---|---|---|---|
| 31 | **Ten marbles, three jars** | You do the counting: how many of your ten go into one jar. This is the day you do the sum three times, until it stops being a sum | 12 · 7 | R14 · calc_step ×3 (ten marbles, three names, no jar over four — how many each?), MC ×2. Object: ten marbles, three labelled jars | Day 27 | On the family research cards, **write the number of marbles** next to each of your three names |
| 32 | **When there's no line** | Some things you'd keep for years, and there's no line where you'd say you were wrong. Those get sized by a different question: how many would you still be fine with if it went nowhere for ages? | 11 · 7 | R11 · allocation_split, estimate_dial, MC ×2 | Day 31 | Size one no-line name and write the number that made you comfortable |
| 33 | **Nine in one jar** | Putting nearly everything in one place is where the big wins come from and where the big surprises come from. It's the same fact twice | 12 · 7 | R11 · allocation_split ×2 (nine in one jar, then the outcome reveal), calc_step, MC | Day 32 | Check that **no name has more than four** of your ten. Fix the one that does |
| 34 | **When everything breaks at once** | If all five of your things need the same one thing, they can all go wrong on the same day — and counting to five made you feel safe when you weren't | 12 · 7 | R3 · sort_buckets ×2 (needs the same battery / needs its own), allocation_split, MC. Object: five toys, one battery pack | Day 33 | Find the **two names on the family list** that would have a bad day for the same reason |
| 35 | **The marbles you don't put in any jar** | Marbles kept out have a job too — they're the ones you can use when something good turns up. And how would you feel if a jar got smaller for a while? | 12 · 7 | R11 · allocation_split with a "smaller for a while" reveal, calc_step (10 → 7), MC. Object: ten marbles with a small pile deliberately left outside the jars | Day 34 | Decide **how many of your ten stay out of every jar**, and write why that number |
| 36 | **🏆 FAMILY BOSS · DECIDE & SIZE** | Cumulative Days 25–35 + Family Table. **Output: three names, each with a number, a line and a reason** | 12 · 8 | R9 · calc_step ×3, tap_the_scene, allocation_split, sort_buckets, MC ×3, Family Table. **quizId** | Days 25–35 | Finish **three** research cards: how many marbles, where the line is, and one sentence of why — signed off with a grown-up |

---

# PHASE 4 · MANAGE — It's yours now (Days 37–48)

*Difficulty 2–3. New interactions required: `order_sequence`, `scene_compare`.*

### Block 7 — The owner's job (Days 37–42)

| Day | Lesson | The ONE concept | Steps · min | Interactions | Warm-up recalls | Real-world rep |
|---:|---|---|---|---|---|---|
| 37 | **The job changes the moment it's yours** | Before, you were looking for reasons to be interested. Now you're looking for reasons you might be wrong — and nobody makes that switch on their own | 11 · 7 | R5 · prediction (what will you go looking for tomorrow?), MC ×2, true/false | Day 31 | Read your own reason again and **mark the one line you'd argue with now** |
| 38 | **Write it down while you still remember why** | Write the decision *and* the reason, on the day you make it. A decision with no reason next to it teaches you nothing later | 12 · 7 | R7 · order_sequence ×2 (what goes in an entry, and in what order), build_sentence, MC. Object: a notebook page with four labelled lines | Day 37 | Write the full entry for your **oldest** pick from memory first — then check it against the card |
| 39 | **The day the company tells everyone how it went** | You're not checking whether the news was good. You're checking whether **your one reason** still happened | 12 · 7 | R5 · prediction (real, tempting wrong answers only), scene-MC ×2, sort_buckets (touches my reason / doesn't) | Day 38 | Before the news, write **the one thing you'd want to hear** about your company |
| 40 | **Great news and bad news on the same day** | What a company says about *next* time can matter more than how *this* time went — and it can break your reason while the headline still looks fine | 12 · 7 | R2 · scene-MC ×2, tap_the_scene, explainer ×2. Object: a report card with top marks and a note saying next term will be harder | Day 39 | Read the newest line about your company and mark it: **still true · wobbly · broken** |
| 41 | **The three questions, once a month** | Is the thing that makes them money still working · is it still hard to copy · am I any closer to changing my mind? Ten minutes, once a month | 11 · 7 | R13 · checklist_card (the review card), sort_buckets, MC | Day 40 | Run the three questions on **all three** of your names |
| 42 | **CHECKPOINT · The owner's job** | Retrieval Days 37–41 + 2 pooled | 10 · 7 | R8 · checklist_card, order_sequence, sort_buckets, MC, pool ×2 | Days 37–41 | **Ask a grown-up:** what's one thing they own that they'd change their mind about, and what would have to happen first? |

### Block 8 — Fiddling vs. deciding (Days 43–48)

| Day | Lesson | The ONE concept | Steps · min | Interactions | Warm-up recalls | Real-world rep |
|---:|---|---|---|---|---|---|
| 43 | **Add because it got better, not because it got cheaper** | Three good reasons to put another marble in, and three that only feel good. They're easy to tell apart on paper and very hard in the moment | 12 · 7 | R3 · sort_buckets ×2 (a good reason / a feeling), prediction, MC | Day 41 | Check whether **any** of your names has a real reason to add. Most days the answer is no, and writing "no" counts as doing it |
| 44 | **Taking some out for a reason that isn't "it went up"** | A jar can quietly become bigger than you ever decided it should be. Putting it back to its number is a decision, not giving up | 12 · 7 | R11 · allocation_split (drifted → put back), calc_step, MC. Object: one jar overflowing next to its written number | Day 43 | Count the marbles in each jar and find the one that **grew past its number** |
| 45 | **Did that change the company, or just how people feel?** | Most news changes the mood and not the company. The test is one question, and you can ask it in five seconds | 12 · 7 | R3 · sort_buckets ×2 (changes the company / changes the mood), scene_compare, MC | Day 44 | Sort **three real headlines** about a family-list company yourself, then check whether any of them changed your reason |
| 46 | **Your brain when the thing is yours** | Three things your head does once you own something: it remembers what you paid, it hates being wrong, and it counts what you've already put in. Knowing their names is most of the fix | 12 · 7 | R5 · prediction (what will *you* do?), MC ×2, true/false. Object: the price sticker still stuck to a toy | Day 45 | Write down the decision you think you'd most **regret** making about your biggest name |
| 47 | **The bet you never meant to make** | Look at all your jars at once. Sometimes the biggest bet in there is one that nobody ever decided to make | 12 · 7 | R11 · allocation_split, sort_buckets, calc_step, MC | Day 46 | Look across all your names and **name the bet you never decided to make** |
| 48 | **🏆 FAMILY BOSS · MANAGE** | Cumulative Days 37–47 + Family Table. **Output: a written review of every name you hold** | 12 · 8 | R9 · checklist_card, sort_buckets ×2, scene-MC, allocation_split, MC ×4, Family Table. **quizId** | Days 37–47 | For every name: is your reason still true, what's the verdict, and what would you do — **keep · add · take some out · let it go** — with the reason written |

---

# PHASE 5 · SELL — Taking some off the table (Days 49–60)

*Difficulty 3. New interactions required: `scale_ladder` (kid variant), `tap_the_scene`, `calc_step`.*

**This phase gets full weight in the kid track for the same reason it does in the adult track: nobody teaches letting go, so everybody makes it up as they go.** A kid who has practised taking three marbles out of nine, at a step they picked in advance, has done something most adults have never done deliberately.

**`scale_ladder`, kid variant.** Same interaction, same inputs (`entry`, `stop`, `path[]`, `tranches`, `reveal`) — but the learner places **marbles on a drawn ladder** rather than tranches on a price scale, and the reveal shows all three outcomes side by side as three rows of marbles: *took it all out at the first step · took some out at each step · left everything in.* That side-by-side is the whole lesson. The honest thing about taking some off the table is that it's **never the best answer afterwards and usually the right one beforehand** — and a nine-year-old only feels that by seeing all three at once. No win state. It's a reveal, not a grade.

### Block 9 — Letting go (Days 49–54)

| Day | Lesson | The ONE concept | Steps · min | Interactions | Warm-up recalls | Real-world rep |
|---:|---|---|---|---|---|---|
| 49 | **There are only two honest reasons to let something go** | Your reason stopped being true, or the marbles have a better job somewhere else. Everything else — bored, someone said something, a bad week — is one of those two in a costume, or it's nothing | 12 · 7 | R3 · sort_buckets ×2 (an honest reason / a costume), prediction, MC | Day 46 | Think of one thing you swapped or gave away. Which of the two reasons was it really? Nobody sees this one |
| 50 | **Write the change-my-mind line so it actually works** | "If it gets worse" never triggers, because nobody can tell when it happened. "If they stop making the game I bought it for" triggers | 12 · 7 | R6 · build_sentence ×2 (the change-my-mind frame), sort_buckets (I'd notice this / I'd never notice this), MC | Day 49 | Rewrite the change-my-mind line on **all three** cards so each one is a thing you'd actually notice |
| 51 | **Taking some off the table** | Take some out at the step you picked, move your line up behind the rest, and let the rest keep going. You'll never get the most — that's the price of never getting the least | 12 · 8 | R14 + `scale_ladder` ×2 (nine marbles, three steps, then the three-row reveal), calc_step, MC | Day 50 | With a grown-up, **make the take-some-out decision** on your best-doing name — write which step and how many, then hold the family vote |
| 52 | **Moving the line up behind it** | As it goes well, the line moves up behind it. Too close behind, and you get knocked out of something that was working | 12 · 7 | R2 · tap_the_scene ×2 (place the line · place it too close and watch), scene_compare, MC | Day 51 | Move the line up behind what's left from yesterday, and **write the rule you used** to decide how far behind |
| 53 | **Taking some out when nothing is wrong** | The jar grew past its number, your reason is fine, and you take some out anyway. This is the hardest one, and it isn't a punishment | 12 · 7 | R11 · allocation_split (drifted → put back), calc_step, MC ×2 | Day 52 | Put one jar back to its number **purely because of the number**, and write that that was the reason |
| 54 | **CHECKPOINT · Letting go** | Retrieval Days 49–53 + 2 pooled | 10 · 7 | R8 · scale_ladder, sort_buckets, calc_step, MC, pool ×2 | Days 49–53 | **Ask a grown-up:** what's something they let go of at the right time, and how did they know it was the right time? |

### Block 10 — Money's jobs, your head, the family's rules (Days 55–60)

| Day | Lesson | The ONE concept | Steps · min | Interactions | Warm-up recalls | Real-world rep |
|---:|---|---|---|---|---|---|
| 55 | **Money you keep, money you give, money you grow** | Money has jobs. The skill isn't picking the split — it's deciding the split **before** the money arrives, while nothing is tempting you | 12 · 7 | R11 · allocation_split ×2 (ten coins, three jars — split it, then split it again after the reveal), calc_step, MC. Object: three labelled jars and ten coins | Day 53 | Decide your three-way split for the **next** $10 you get, and write it down before you get it |
| 56 | **Changing your mind, then changing it back** | If you let something go on Monday and want it back on Tuesday, one of those two decisions wasn't real. Working out which one is the whole job | 12 · 7 | R7 · order_sequence ×2 (the swap, then the swap back — what actually changed in between?), sort_buckets (something changed / only I changed), MC | Day 55 | Find one time you gave something up and wanted it back. Write **which of the two decisions was the real one** |
| 57 | **Why you let go of the good ones too soon** | Your head remembers what you paid, and it wants to finish on a win. Both of those push you to let go of the ones that are working and keep the ones that aren't | 12 · 7 | R5 · prediction, MC ×2, true/false | Day 51 | Write the number at which you'd think "I should have let that go" — then notice that you just made that number up |
| 58 | **Decide now what you'll do later** | Written down while everything is calm, followed later when it isn't. What you'll do if it's worth less for a while, and what you'll do if it goes really well | 12 · 7 | R6 · build_sentence ×2 (the two lines), prediction, MC | Day 57 | Write the two lines for all three of your names and **put them on the family card**, dated |
| 59 | **Your family's rules, written down** | What your family will own, how much of any one thing, and what you'll all do when something has a bad month. Written by everyone, kept where everyone can see it | 12 · 7 | R6 · build_sentence ×2 (two rule clauses), sort_buckets (a rule / a wish), MC | Day 58 | Add **your two rules** to the family rules card, in your own words |
| 60 | **🏆 FAMILY BOSS · The whole loop** | One company, all five phases, in one run — found it, checked it, sized it, looked after it, let some go. Cumulative across all 60 days | 12 · 8 | R9 · checklist_card, calc_step ×2, scale_ladder, tap_the_scene, MC ×4, Family Table. **quizId** | Days 1–59 | Present **one company to your family**: where you found it, what the card says, how many marbles, what would change your mind, and when you'd take some off the table |

**Belt note:** the Day 60 boss is where lifetime XP crosses **3,200** — the Black Belt threshold — for a kid who has gone perfect on all five bosses. Same threshold, same day, same ceremony as the adults. Anything less lands at 3,150 and the last 50 XP is earned in the Club, alongside everyone else's.

---

## Where the kid track diverges — the full table

**Everything not listed here keeps the adult idea, just made concrete.** These are the nine days where the adult idea has no honest kid version, so we swap it rather than water it down. You only get to swap when the adult idea would need a huge number or a scary one to make the trip.

| Day | Adult concept | Kid concept | Why it had to change |
|---:|---|---|---|
| 4 | Brokerage, custody, and which wrapper holds which money | **Where your piece lives** — it's written down somewhere safe and a grown-up holds the key; money for soon and money for later live in different places | A kid can't open an account. The part they *can* own is that owning something is a record, not an object — and that *when you'll need it* decides where the money sits |
| 5 | Index funds, and fees as the benchmark you have to beat | **One company, or a little bit of all of them** + **the little leak** (one sticker taken every round — look what's left) | "Expense ratio over twenty years" is a compounding argument in numbers no kid can picture. One sticker a round is the same argument, and you can count it |
| 17 | Balance sheet, cash flow, net debt, interest cover | **Money you have vs. money you're promised** — you can't spend a promise; plus what you own and what you owe | The two ideas inside a balance sheet that actually change a decision, with the accounting taken out |
| 21 | P/E against its own history and its peers | **Worth it to who?** — the same thing is worth a lot to one person and nothing to another, so "expensive" always needs "compared to what?" | A ratio needs division, and a nine-year-old will do that division without any of it meaning anything. The bit that carries over is the instinct to compare, and that survives whole |
| 22 | The high-multiple / expectations trap | **Paying for what hasn't happened yet** | Same idea, no multiple. The cake is still in the oven and you already paid for it |
| 31 | `account × risk% ÷ (entry − stop) = shares` | **Ten marbles, three jars** — the same arithmetic, done by hand, with numbers under twenty | The formula is the skill. The size of the numbers isn't. Ten marbles keeps the sum and loses nothing |
| 34 | Correlation and the sector-cluster trap | **When everything breaks at once** — if all five of your things need the same one thing, they can all go wrong on the same day | Correlation as a word is unteachable at nine. Correlation as five toys and one battery pack is obvious at seven |
| 55 | Short-term vs. long-term capital gains | **Money you keep, money you give, money you grow** — money has jobs, and deciding the split ahead of time is the real skill | Tax law isn't a kids' topic, and a holding-period rule teaches a child nothing. The skill sitting underneath it — deciding where money goes before it turns up — fits their age, and honestly it's the more useful one |
| 56 | The wash-sale rule | **Changing your mind, then changing it back** — the honest version, about deciding twice | Same behaviour, stripped of the tax rule that makes it a rule. A kid who notices they decided twice has learned the thing the rule exists to punish |

---

## Family sync — the reason this track has this shape

A kid track running on its own timetable would be a second product. This one is built to pull a parent into the room on a schedule.

**Every single day.** The closing rep targets the **same family watchlist** the adults and teens use. One list, three depths. If the adult is reading Costco's gross margin on Day 16, the kid is working out how much of every $10 Costco keeps — same name, same evening.

**Every checkpoint — Days 6, 18, 30, 42, 54 — ends with an explicit ask-a-grown-up rep.** Not a suggestion in the outro. A step. The kid asks a real question, writes the grown-up's answer next to their own, and sees whether they match. The adult's checkpoint outro on the same day names the question the kid is about to ask, so the grown-up isn't ambushed.

**Every boss — Days 12, 24, 36, 48, 60 — is a Family Table.** All three tracks answer **one shared question** that day: same prompt, same four options, worded for each register. Nobody sees anyone's answer until everyone's locked in. The kid uses the same four verdict words as their parent, and that's what lets a nine-year-old sit at that table as a player instead of an audience.

**The timing is on purpose.** Roughly once a week a parent gets pulled in — often enough to become a ritual, rare enough that it never turns into a chore. Five checkpoints and five bosses across sixty days is ten scheduled family moments, and every one of them is one tap and under five minutes.

**Three things the kid track needs from the family surface:**

1. the shared family watchlist, writable by the kid — structured add, with a required reason line;
2. the family research card, which the kid can see and a grown-up can sign — Phase 3 and Phase 5 reps ask for a grown-up sign-off on a decision, so that has to be a real button, not a suggestion;
3. the Family Table lock-then-reveal, which is Owner decision #5 in CURRICULUM-OVERVIEW §8. Five days of this track can't ship without it.

---

## Compliance — kid track

Everything in CURRICULUM-OVERVIEW §9 still applies. These are the extra rails that exist because the learner is a child.

1. **No stock-price predictions, ever.** `prediction` steps in this track predict **behaviour and consequences**, never a price. *"What happens to your slice if the pizza gets cut again?"* is a prediction step. *"Where will this be next month?"* is not written — not as a question, not as an option, not as a Kai line.
2. **No options, futures, margin, leverage, crypto or forex.** Not as a lesson, not as an aside, not as a wrong answer, not as a "you'll learn this later" tease. **The words do not appear in this track at all.**
3. **Every money figure is pocket-money scale.** $6, $10, ten coins, four slices, nine marbles. No lesson here has a number a child can't count to. If a real company figure is needed, we shrink it and say out loud that we shrank it — *"if Costco were a lemonade stand taking $10…"*.
4. **Verdicts use exactly Strong / Solid / Mixed / Weak**, in that order, every time. No "good/bad", no "buy/avoid", no stars, no faces. This also settles the Buy/Watch/Pass clash flagged in CURRICULUM-OVERVIEW §10b(b): an action word doesn't belong on a child's research card, and rating the quality does everything the card needs.
5. **No telling anyone to buy or sell anything.** This track never asks a kid to do something with a real stock, and there's no order entry on it at all. Every decision gets written on a card and, where it matters, signed off by a grown-up.
6. **Free text is never open.** Research cards and Family Table answers are **structured inputs** — chips, frames, dropdowns, fixed sentence slots — per the kids-safety posture in `FIC-LEARNING-WORLD.md` §P8. When a rep says "write", it means filling in a frame. Never typing whatever you like into something other people can see.
7. **Nothing scary.** No losing-your-savings framing, no "you'll need this when you're older", no consequence bigger than a birthday present. **Risk is always taught as "how sure are we?"** Day 35 asks how you'd feel if a jar got smaller for a while and whether you could wait. It doesn't ask what you'd do if you lost your money, because that's a different lesson for a different person.
8. **Authored figures only**, dated in the JSON, never live-quoted. A lesson has to read the same way in five years. That matters even more here, because a child won't know to doubt it.

---

## How this track relates to the other two

**Adults are the source register.** Every day in this file comes down from the same day in OUTLINE-ADULTS.md, and the rule is: keep the idea, change the clothes. Where the idea couldn't survive the trip — the nine days listed above — we swapped it for the honest thing underneath, never for a smaller thing.

**Same day number = same concept, all three tracks.** Day 51 is scaling out for the adult, scaling out on the paper account for the teen, and nine marbles on a three-step ladder for the nine-year-old. Same evening, same idea, three depths.
