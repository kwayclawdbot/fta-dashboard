# SAMPLE · KIDS · Day 3 — "Nobody decides the price"

**Track:** kids (7–11) · **Phase:** 1 · FIND, Block 1 · **Recipe:** R5 (Predict-led, kid shape)
**The ONE concept:** a price is just two people agreeing. One wants it, one has it. Nobody up top decides.
**Skills:** `market_basics` (primary), `stock_ownership`
**Length:** 11 steps · 7 minutes · `difficulty: 1` · **XP: 50**
**Warm-up recalls:** Day 2 — your money goes to the company

**Voice:** per CURRICULUM-OVERVIEW §1d. This track was already simple — the pass here is **warmth, not more simplifying.** Talk to the child like a grown-up they like. Never talk down.

> **Read this next to the adult and teen Day 3 samples.** Same day, same idea, same thing happening. The adult gets an order book. The teen gets an order book and a $400 account. The kid gets a swap table and eleven short steps. **Nobody gets a different lesson.**

```json
{ "schema": 1, "title": "Nobody decides the price", "skills": ["market_basics","stock_ownership"],
  "difficulty": 1, "audience": ["kid"], "duration_minutes": 7, "xp": 50 }
```

---

## `guide.intro`

[KAI]

> Prices go up and down all day long. So somebody must be deciding, right? Nope. Let's go find out who really does it.

---

## STEP 1 — Warm-up

`{ "id": "k-d03-warm", "type": "multiple_choice", "skill": "revenue" }`

**[INTERACTION: multiple_choice — 15-second retrieval from Day 2]**

> **Yesterday: when you buy a Lego set, where does your money go?**

- A. To Lego, the company that made it ✓
- B. Nowhere. It just disappears
- C. To the person who invented Lego ages ago
- D. To the shop, and only the shop

**Right:** *"Yes. The shop keeps a little bit. But most of it goes back to Lego, so they can make more."*

**Wrong (D) → [KAI]:** *"The shop does keep a bit — that's how the shop stays open. But the shop had to buy that set from Lego first. So most of your money keeps going, all the way to Lego. Have another go."*

---

## STEP 2 — Explainer · The swap table

`{ "id": "k-d03-x1", "type": "explainer", "skill": "market_basics" }`

**Heading:** Picture a swap table

> There's a table in the playground. People bring stuff they want to swap. Everyone can see everything.
>
> Nobody stands at the front shouting what things are worth. People just walk up and make offers.

> **[ILLUSTRATION: a plain wooden swap table drawn from the side, one card sitting in the middle of it, and two hands reaching in from opposite edges of the frame — one hand offering coins, one hand holding the card back. Big, simple, flat vector. Ink and volt-orange only, plus one warm sand tone. The hands get no faces and no sleeves; the object with identity here is the TABLE. This table is the object for the whole of Phase 1 in the kid track and it comes back on Day 8 and Day 11.]**

---

## STEP 3 — Explainer · Two numbers

`{ "id": "k-d03-x2", "type": "explainer", "skill": "market_basics" }`

**Heading:** There are always two numbers

> One kid says: **"I'll give you $4 for that card."** That's the most they want to pay.
>
> The other kid says: **"I want $6."** That's the least they'll take.
>
> Two numbers. They're never the same. Nobody wants to pay more than they have to.

**Figure:** `{ "kind": "stat", "value": "$4 · $6", "caption": "what one will give · what one will take" }`

> **[ANIMATION: `converge`. The two numbers slide in from opposite edges of the frame and stop with a visible gap between them, 280ms, then a small gold bracket draws under the gap. They stop apart rather than meeting, because the whole point is that they don't meet yet. Reduced motion: both numbers and the bracket shown at rest.]**

---

## STEP 4 — Prediction

`{ "id": "k-d03-pred", "type": "prediction", "skill": "market_basics" }`

**[INTERACTION: prediction — pick first, then find out. Never punished. Note this predicts what PEOPLE DO, never what a stock price does — kid-track compliance rail.]**

> **There's one rare sticker on the table. Three kids want it. Only one kid has it. What happens next?**

- **They keep offering more and more until only one is left** → `value: "up"` ✓ *(outcome)*
- **The kid with the sticker drops the price to be fair** → `value: "down"`
- **They share it — a week each** → `value: "share"`
- **Nobody gets it, because there aren't enough** → `value: "none"`

**Reveal:**

**Headline:** *They keep offering more. That's how a price goes up.*

**Body:**
> The first kid says $4. The next one says $5. The next says $6. Now the first kid has to say $7 or walk away.
>
> Nobody made the price go up. **It went up because three people wanted one thing.**
>
> And here's the bit worth remembering: the sticker didn't change. It's the same sticker it was five minutes ago.

> **[ANIMATION: `stack-up`. Three small offer-cards rise one after another beside the sticker — $4, then $5, then $6 — each 240ms, 200ms apart, each sitting slightly higher than the last. Then a fourth card, $7, rises above all of them. The staircase of offers IS the concept. Reduced motion: all four cards shown as a staircase.]**

> **[KAI: only if the child picked "share".]** *"That's a kind answer, and at a real swap table it does happen sometimes. But when lots of people want one thing and nobody has to share, they usually start offering more instead. Watch the staircase again."*

---

## STEP 5 — Multiple choice

`{ "id": "k-d03-mc1", "type": "multiple_choice", "skill": "market_basics" }`

**[INTERACTION: multiple_choice]**

> **Now flip it. Ten kids have the same sticker. Only one kid wants one. What happens to the price?**

- A. It goes up
- B. It goes down ✓
- C. It stays the same forever
- D. The sticker breaks

**Right:** *"Yes. Now it's the sellers competing. Each one drops their price a bit, hoping they're the one who gets picked."*

**Wrong (A) → [KAI]:** *"It goes up when lots of people WANT it. Here it's the other way round — lots of people HAVE it, and only one person wants one. Flip it round in your head and try again."*

---

## STEP 6 — Explainer · Nobody up top

`{ "id": "k-d03-x3", "type": "explainer", "skill": "market_basics" }`

**Heading:** Nobody is in charge of the price

> The stock market is a swap table with millions of people at it.
>
> Nobody decides what a piece of Lego costs. Not Lego. Not the app. Nobody. **The price is just the last two people who agreed.**

> **[ILLUSTRATION: the same swap table from Step 2, but now with eight pairs of hands reaching in from all around the edges instead of two. Same table, same card, more hands. Reusing one drawing and changing one thing is what makes the change obvious.]**

---

## STEP 7 — Sort them out

`{ "id": "k-d03-sort", "type": "sort_buckets", "skill": "market_basics" }`

**[INTERACTION: NEW — `sort_buckets`. Two buckets, six cards, tap a card then tap a bucket. Cards stay where you put them until you hit Check, so the child is checking a whole idea and not one guess. Wrong ones pop back with their reason, one at a time.]**

> **Which way does the price go?**

**Buckets:** `PRICE GOES UP ↑` · `PRICE GOES DOWN ↓`

| Card | Bucket | Reason |
|---|---|---|
| Suddenly everyone at school wants this game | UP | Lots of people want it. Not many have it. |
| Loads of people are selling theirs at once | DOWN | Lots of people have it. Not many want it. |
| A new one comes out and nobody wants the old one | DOWN | The people who wanted it went somewhere else. |
| The shop runs out and people still want it | UP | Fewer to go round. Same number of people wanting one. |
| Three people are arguing over the last one | UP | They'll keep offering more until two of them stop. |
| Everyone already has one | DOWN | Nobody left who wants one. |

**Reinforce:**
> Every single one is the same question underneath. **Are there more people who want it, or more people who have it?** That's it. That's the whole thing.

**If you get one wrong:**
> Read each card and just count. More people wanting than having, the price goes up. More people having than wanting, it goes down. You don't need to know anything about the thing itself.

> **[ANIMATION: cards scale to 0.94 on grab and translate into the bucket in 220ms, and the bucket label pulses once. Wrong cards shake 4px twice and return in 260ms. Physical feedback matters more here than anywhere else in the three tracks.]**

---

## STEP 8 — Multiple choice · the gap

`{ "id": "k-d03-mc2", "type": "multiple_choice", "skill": "market_basics", "framing": "gap" }`

**[INTERACTION: multiple_choice with `framing: "gap"` — the drawn mark loops the word.]**

> **One kid will pay $4. The other wants $6. What is that ~~gap~~ of $2?**

- A. What the sticker is really worth
- B. How far apart the two kids are ✓
- C. Money you have to pay someone
- D. How much the price went up today

**Right:** *"Yes. It's the space between them. Somebody has to move — either the buyer goes up or the seller comes down — before anything happens at all."*

**Wrong (A) → [KAI]:** *"The gap isn't what it's worth. It's how far apart two people are. They could both be wrong about what it's worth. Have another go."*

---

## STEP 9 — True or not true

`{ "id": "k-d03-tf", "type": "true_false", "skill": "market_basics", "trueLabel": "True", "falseLabel": "Not true" }`

**[INTERACTION: true_false, rendered as the swipe]**

> **"For a price to change, something has to happen to the company."**

**Answer: Not true.**

**If you swipe wrong:**
> Think about the three kids and the sticker. Nothing happened to the sticker. It didn't get rarer, or shinier, or better. **The price moved because of the people, not the thing.**

**If you swipe right:**
> Spot on. News does move prices sometimes. But most of the time it moves because more people turned up wanting to buy, or more people turned up wanting to sell.

---

## STEP 10 — Explainer · What you'll see for real

`{ "id": "k-d03-x4", "type": "explainer", "skill": "market_basics" }`

**Heading:** Two numbers, on a real screen

> When a grown-up opens a real company on the app, there are two numbers sitting right next to each other. They've got proper names. The **bid** and the **ask**.
>
> The bid is what somebody will give. The ask is what somebody will take. Exactly like the swap table.

> **[ILLUSTRATION: the swap table one last time, with the two hands from Step 2 — but now each hand's number has a small label attached: "bid" on the offering hand, "ask" on the holding hand. The child learns the real words on the object they already understand, which is the whole point of building the object first.]**

---

## STEP 11 — Go and look

`{ "id": "k-d03-rw", "type": "real_world", "action": "research_ticker", "skill": "market_basics" }`

**[INTERACTION: `real_world` — `research_ticker` on the family watchlist. The rep is today's skill: find the two numbers, see how far apart they are.]**

**Ticker:** first company on the family watchlist (fallback: `MSFT` / Microsoft — because of Minecraft)

**Prompt:**
> Open the family watchlist and pick one company. Find the **two numbers** — the bid and the ask. Write down how far apart they are.
>
> If you can, do it with a grown-up. Ask them which number they'd get if they sold today.

**CTA:** `Open our watchlist`

**Success text:**
> You just read a real swap table. Those two numbers are two real people, right now, who haven't agreed yet.

---

## `guide.outro`

[KAI]

> Now you know the secret. Nobody decides a price. People do, by wanting things. Tomorrow: where your piece of a company actually lives, and who's holding the key.

---

## Production summary

| | |
|---|---|
| **New interactions needed** | `sort_buckets` (Step 7). Everything else already exists. |
| **New illustrations** | 1 — the **swap table**, drawn three times with one thing changed each time (two hands → eight hands → labelled hands). One object, three states, one asset family. Comes back Day 8 and Day 11. |
| **Animations** | 4 — `converge` (two numbers stopping apart), `stack-up` (the staircase of offers), the `sort_buckets` grab-and-snap, and the wrong-card shake. All under 300ms; all resolve to end state under reduced motion. |
| **Kai lines** | 5 — intro, outro, and three wrong-answer lines that say why the wrong pick was tempting. Never says "great job". |
| **XP** | 50, banked on Step 9 (last graded step). No quiz row. |
| **Step count** | **11 steps in 7 minutes** — more steps than the adult version of this day, each one shorter. This is anti-pattern #7 being deliberately flipped. |
| **Compliance** | The `prediction` predicts **what people do at a swap table**, never a stock price — kid-track rail. Every number is pocket-money size ($4, $6, $7). No options, futures, margin or leverage — the words don't appear. Nothing scary: no losing-your-money framing anywhere. |
| **Family sync** | Same idea, same day, same mechanism as the adult and teen samples. The last step points at the **same family watchlist** all three tracks use, and invites the grown-up in without requiring one. |
| **Voice check** | Warmth pass only — nothing was simplified further. Contractions throughout. No exclamation marks, no "awesome", no baby spellings. Kai talks like a grown-up the child likes. |
