# SAMPLE · TEENS · Day 3 — "Nobody sets the price"

**Track:** teens (15–18) · **Phase:** 1 · FIND, Block 1 · **Recipe:** R5 (Predict-led)
**The ONE concept:** nobody decides the price. It's two lines of people haggling — what buyers offer, what sellers want, and whoever caved last.
**Skills:** `market_basics` (primary), `stock_ownership`
**Length:** 9 steps · 7 minutes · `difficulty: 2` · **XP: 50**
**Warm-up recalls:** Day 2 — how this company actually makes money

**Voice:** per CURRICULUM-OVERVIEW §1d. Teen register — a notch looser than adults, never a kids app.

> **Read this next to `SAMPLES/ADULT-D03-why-the-price-moves.md`.** Same day, same idea, same thing happening, same four-option prediction. What changes is the example, what we assume you're dealing with, and how long the sentences are. What does **not** change is a single real word — "bid", "ask" and "spread" all show up here exactly as themselves. This pair is the clearest proof of the family-sync design in the whole set. A parent and a sixteen-year-old can genuinely talk about Day 3 over dinner.

```json
{ "schema": 1, "title": "Nobody sets the price", "skills": ["market_basics","stock_ownership"],
  "difficulty": 2, "audience": ["teen"], "duration_minutes": 7, "xp": 50 }
```

---

## `guide.intro`

[KAI]

> You've seen stock prices your whole life and probably figured somebody, somewhere, decided them. Nobody did. Seven minutes and you'll know exactly where that number comes from — which is more than most adults could tell you.

---

## STEP 1 — Warm-up

`{ "id": "t-d03-warm", "type": "multiple_choice", "skill": "revenue" }`

**[INTERACTION: multiple_choice — 15-second retrieval from Day 2]**

> **Yesterday you wrote one sentence on how a company makes money. So when Spotify reports its revenue for a quarter, whose money is that?**

- A. People who bought Spotify stock
- B. Subscribers paying monthly, plus advertisers paying for ad slots ✓
- C. Money Spotify borrowed
- D. Money from Spotify selling an office building

**Right:** *"Right — subscribers and advertisers. That's the sentence you wrote yesterday. Nothing an investor pays for a share ever reaches the company."*

**Wrong (A) → [KAI]:** *"Worth getting exactly right, because loads of people never do. When you buy a share, your money goes to whoever sold it to you — some other investor. Spotify doesn't see a cent. Revenue is customers, full stop. Take it again."*

---

## STEP 2 — Explainer · Two lines of people

`{ "id": "t-d03-x1", "type": "explainer", "skill": "market_basics" }`

**Heading:** Nobody sets the price

> Your app says a share of Nike is $74.20, and it feels like that number came from somewhere official. It didn't. Nike doesn't decide what its stock costs. Neither does the app. Neither does the exchange.
>
> What actually exists is two lines of people. On one side, everyone who wants to buy has posted the most they'll pay. On the other, everyone willing to sell has posted the least they'll take. The best price on the buying side is the **bid**. The best on the selling side is the **ask**. They're never the same number, because nobody volunteers to pay more than they have to.
>
> It's a giant online haggle. That's the whole stock market.
>
> A trade happens the second one of them caves. Someone who wants the shares *now* pays the ask. Someone who wants out *now* takes the bid. That's a trade, and its price is the number on your screen. **The quote isn't a price anyone set. It's a record of the last person who stopped waiting.**

**Figure:** `{ "kind": "stat", "value": "$74.18 / $74.22", "caption": "bid / ask — and the 4¢ nobody wants to give up" }`

> **[ILLUSTRATION: the order-book object — two vertical stacks of short horizontal bars facing each other across a gap. Left stack (bids) descending: 74.18, 74.15, 74.11, 74.04. Right stack (asks) ascending: 74.22, 74.26, 74.31, 74.40. Best bid and best ask filled volt-orange; the gap between them measured with a gold hairline labelled "the spread". Identical drawing to the adult track — same object, same day, +15% scale. Flat vector, drawn hand, bars deliberately uneven.]**

> **[ANIMATION: `stack-up`. Both stacks build outward from the centre gap — the bid and ask appear first, then the worse prices stack away, 40ms stagger, 240ms each. It builds out from the spread because the spread is what matters and everything else is context. Gold measuring line draws last, 200ms. Reduced motion: fully built.]**

---

## STEP 3 — Prediction

`{ "id": "t-d03-pred", "type": "prediction", "skill": "market_basics" }`

**[INTERACTION: prediction — pick first, then find out. Never punished. All four are things a smart person genuinely believes; there's no throwaway.]**

> **A fund manager wants 500,000 shares of Nike, right now, at whatever it takes. The ask is $74.22 — but only 12,000 shares are actually up for sale there. What happens?**

- **She gets all 500,000 at $74.22 — that's the price on the screen** → `value: "at_ask"`
- **She takes the 12,000, then has to pay more and more as she works up the line** → `value: "walks_up"` ✓ *(outcome)*
- **The order gets rejected — not enough shares** → `value: "rejected"`
- **The price drops, because an order that big makes people suspicious** → `value: "falls"`

**Reveal:**

**Headline:** *She works up the line — and the price goes up because she did.*

**Body:**
> She takes the 12,000 at $74.22. Cheapest left is now $74.26, so she takes those. Then $74.31. Then $74.40. By the time she's got her shares she's paid way more on average than she started — and the price everyone else sees is now $74.40.
>
> Here's the bit worth noticing: **no news came out.** Nothing about Nike changed between $74.22 and $74.40. The price went up because one buyer wanted more shares than anyone was selling at that price, and the only way to get them was to pay up.
>
> That's the whole thing. Every price move you'll ever see is a version of this.

> **[ANIMATION: `converge`. An orange marker sweeps up the ask side, consuming each bar in turn — fills orange, dims to grey, 180ms each, 60ms apart. As each is eaten, the price label above counts up: 74.22 → 74.26 → 74.31 → 74.40. Watching the price rise with no news attached to it is the entire point of the motion. Reduced motion: all four greyed, final price shown.]**

> **[KAI: only if the learner picked "falls".]** *"That's the smartest wrong answer on the list, so it's worth a minute. Big orders do sometimes tell people something, and traders watch for exactly that. But before anyone gets to read into it, the buying has to physically get soaked up — and soaking up buying means paying more. The mechanics happen first. The meaning comes after."*

---

## STEP 4 — Explainer · So what does news do?

`{ "id": "t-d03-x2", "type": "explainer", "skill": "market_basics" }`

**Heading:** So where does news fit in?

> If prices move because of who's buying and selling at each level, what does news actually do? It doesn't move the price directly. It changes what people put in the two lines.
>
> Say a company reports something good. Buyers who were happy waiting at $74.18 now reckon it's worth more, cancel, and come back at $75.40. Sellers who were fine letting go at $74.22 pull their offers — why sell at yesterday's price? The buying line climbs, the selling line empties out, and the next trade happens way higher. Nobody announced anything. **The two lines just rebuilt themselves around a new opinion.**
>
> This is why people say something's "already priced in". It's not a saying. By the time a headline gets to you, the people who moved first have already rearranged both lines. You're not looking at the price before the news. You're looking at the price after a few thousand people finished arguing about it.

> **[ILLUSTRATION: the same order-book object drawn twice, side by side, labelled "before" and "after". In "after" the ladder has shifted up the frame, the ask side has visibly fewer bars (sellers pulled their offers), and the spread is wider. Same drawing, one variable changed — reusing the object is what makes the change readable.]**

> **[ANIMATION: `converge`. The "after" ladder morphs from "before" over 420ms — bid bars translate up, three ask bars fade to zero, the gold spread line stretches. One hero motion for the lesson. Reduced motion: "after" renders directly.]**

---

## STEP 5 — Multiple choice · the spread

`{ "id": "t-d03-mc1", "type": "multiple_choice", "skill": "market_basics", "framing": "spread" }`

**[INTERACTION: multiple_choice with `framing: "spread"` — the drawn mark loops the word being tested.]**

> **The bid on a stock is $28.40 and the ask is $29.15. What's that ~~spread~~ telling you?**

- A. The stock's about to drop 75 cents
- B. Buyers and sellers are 75 cents apart on what it's worth ✓
- C. The app charges 75 cents to trade it
- D. The stock is up 75 cents today

**Right:** *"Exactly. And it's not just a disagreement — it's a cost. Buy at $29.15, sell a second later at $28.40, and you're down 75 cents having done nothing wrong."*

**Wrong (A) → [KAI]:** *"There's no direction in a spread. It's the distance between two opinions, not an arrow pointing anywhere. A stock can sit with a 75-cent spread all day and close exactly where it opened. One more go."*

**Wrong (C) →** *"Close in spirit — the spread really is a cost you pay. But nobody's charging it. It's the gap you jump across when you're the one in a hurry."*

---

## STEP 6 — True / false

`{ "id": "t-d03-tf", "type": "true_false", "skill": "market_basics", "trueLabel": "Fact", "falseLabel": "Myth" }`

**[INTERACTION: true_false, relabelled Fact / Myth, rendered as the swipe]**

> **"The price on my screen is the price my next order gets."**

**Answer: Myth.**

**If you swipe wrong:**
> That price is a record of a trade that already happened — maybe seconds ago, maybe minutes. Your order meets whatever line exists *when it lands*. Buying in a hurry means paying the ask, which is higher. Selling in a hurry means taking the bid, which is lower. On a heavily traded stock that's pennies. On a barely traded one, it very much isn't.

**If you swipe right:**
> Right — which makes the big number on your screen the *least* useful of the three. The bid and ask tell you what's actually there. The last trade only tells you what somebody already did.

---

## STEP 7 — Multiple choice · using it

`{ "id": "t-d03-mc2", "type": "multiple_choice", "skill": "market_basics" }`

**[INTERACTION: multiple_choice — the application question, and the one that separates "I read it" from "I got it".]**

> **Two companies cost about the same per share. One has a 2-cent spread. The other has a 40-cent spread. What's most likely going on?**

- A. The second one is a worse company
- B. The second one is more expensive
- C. Way fewer people are trading the second one, so both lines are thin and far apart ✓
- D. The second one moved more today

**Right:**
> Yes — a spread is basically a headcount. Thousands of people haggling over Apple squeeze the gap to a penny. Forty people haggling over a small company leave a canyon. And that canyon costs real money to anyone crossing it in a hurry. Most adults would've picked A here.

**Wrong (A) → [KAI]:**
> *"Tempting, but the spread measures the crowd, not the company. There are great small companies with wide spreads and pretty average giant ones with penny spreads. All it tells you is how many people are standing in line — nothing about what they're lining up for. Go again."*

**Wrong (D) →**
> *"They do hang out together — jumpy stocks usually have wider spreads. But it runs the other way: thin trading causes both. Crowd size is the thing underneath."*

**Footer:** `+50 XP` beside Check — last graded step.

---

## STEP 8 — Explainer · Why this hits harder on a small account

`{ "id": "t-d03-x3", "type": "explainer", "skill": "market_basics" }`

**Heading:** Why this matters more when you're starting small

> One last thing, and it's the reason this lesson lands harder for you than for someone with a big account.
>
> A 40-cent spread on a $30 stock is about 1.3% of your money, gone the instant you buy. Putting $400 to work? That's roughly five bucks vanishing on the trade itself — before the company has done anything at all, good or bad. Do that a few times a month and the spread quietly becomes the biggest thing happening to your account.
>
> **This isn't an argument against buying stuff. It's an argument against trading a lot** — especially barely-traded companies, over and over. The fewer times you jump the gap, the less the gap matters.
>
> Honestly? Nothing else in this course will save you money as reliably as just not doing that.

---

## STEP 9 — Go look for real

`{ "id": "t-d03-rw", "type": "real_world", "action": "research_ticker", "skill": "market_basics" }`

**[INTERACTION: `real_world` — `research_ticker`. The rep is the skill: read a real two-sided quote and work out what crossing it would cost you.]**

**Ticker:** first company on the member's own watchlist (fallback: `SPOT` / Spotify)

**Prompt:**
> Open the quote for a company on your list. Find the bid. Find the ask. Work out the gap. Then work out what that gap is as a percentage of a $400 position — that's what it costs to go first.

**CTA:** `Open the quote`

**Success text:**
> That's the number hardly anyone checks. From now on, when someone says "the price", you'll know which of the three they mean and whether it's the one you'd actually get.

---

## `guide.outro`

[KAI]

> You now know something most people never find out: the price on the screen is a fact about the past, not an offer. Tomorrow we set up the workshop — whose name goes on the account, what changes when you turn 18, and the one thing a paycheck makes you eligible for.

---

## Production summary

| | |
|---|---|
| **New interactions needed** | None. Runs entirely on step types that already exist. |
| **New illustrations** | 0 new — reuses the **order book** object drawn for adult Day 3, at +15% scale. This is the illustration-dedupe rule paying for itself on day three. |
| **Animations** | 3 — `stack-up` (builds outward from the gap), `converge` ×2 (walking up the line on reveal, the before/after morph). Identical to adult Day 3. |
| **Kai lines** | 5 — intro, outro, and three wrong-answer lines that say why the wrong pick was tempting. |
| **XP** | 50, banked on Step 7. No quiz row. |
| **Compliance** | Nobody's told to buy or sell. All prices hand-written and dated in the JSON `figures` block. No options, futures, margin or leverage — this lesson replaces part of a live teen track that currently teaches calls and puts to minors. No performance promise. |
| **Voice check** | "Bid", "ask" and "spread" all appear as themselves and get explained properly — nothing watered down. Stakes are a $400 account, not a retirement. One earned "most adults would've picked A" in Step 7, where it's true. Step 8 only exists in the teen version: same mechanics, made to actually matter at their account size. One everyday framing — a giant online haggle. |
