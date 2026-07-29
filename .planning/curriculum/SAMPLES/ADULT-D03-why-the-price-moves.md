# SAMPLE · ADULTS · Day 3 — "Why the price moves at all"

**Track:** adults · **Phase:** 1 · FIND, Block 1 · **Recipe:** R5 (Predict-led)
**The ONE concept:** nobody sets the price. It's two lines of people haggling — what buyers are offering, what sellers are asking, and whoever gave in last.
**Skills:** `market_basics` (primary), `stock_ownership`
**Length:** 8 steps · 7 minutes · `difficulty: 2` · **XP: 50** (flat, de-duped by lesson id)
**Warm-up recalls:** Day 2 — "How does this company actually make money?"

**Voice:** per CURRICULUM-OVERVIEW §1d. Friendly and plain, never childish. Read every line out loud.

```json
{ "schema": 1, "title": "Why the price moves at all", "skills": ["market_basics", "stock_ownership"],
  "difficulty": 2, "audience": ["adult"], "duration_minutes": 7, "xp": 50 }
```

---

## `guide.intro`

[KAI: shown once, above step 1]

> Most people picture a stock price like a price tag — somebody decided it, printed it, done. That picture is wrong, and it quietly costs people money. Give me seven minutes and you'll never look at a quote the same way.

---

## STEP 1 — Warm-up

`{ "id": "a-d03-warm", "type": "multiple_choice", "skill": "revenue" }`

**[INTERACTION: multiple_choice — the daily 15-second retrieval, recalling Day 2]**

> **Yesterday: a company's revenue is just everything customers bought from it. So when Costco reports revenue for a quarter, whose money is that?**

- A. Investors who bought Costco stock
- B. Shoppers who bought stuff at Costco ✓
- C. Money Costco borrowed from a bank
- D. Money from Costco selling one of its buildings

**Right:** *"Yep. Revenue is customers, full stop. When investors buy shares, that money goes to whoever sold them — it never touches the company."*

**Wrong (A) → [KAI]:** *"This one trips up almost everybody at first, so it's worth nailing down. When you buy a share, your money goes to the person who sold it to you. Another investor, somewhere. The company doesn't see a dime of it. Revenue is people at the register. Let's take that one again."*

**Wrong (C) →** *"Borrowed money isn't revenue — it's debt. Money you have to give back was never earned."*

**[ILLUSTRATION: none — warm-ups are text only, and that consistency is what makes them feel like a warm-up rather than a lesson.]**

---

## STEP 2 — Explainer · Nobody sets the price

`{ "id": "a-d03-x1", "type": "explainer", "skill": "market_basics" }`

**Heading:** Nobody actually sets the price

> You open your app, it says Nike is $74.20, and it's natural to assume somebody decided that. Someone at the company. Someone at the exchange. Someone in a suit.
>
> Nope. Nike has zero say in what its stock costs. Neither does the app. Neither does the exchange.
>
> What actually exists is two lines of people. On one side, everybody who wants to buy has said the most they'll pay. On the other, everybody willing to sell has said the least they'll take. The best offer from the buyers is called the **bid**. The best one from the sellers is the **ask**. They're never the same number, because nobody volunteers to pay more than they have to.
>
> Think of a garage sale where thirty people are haggling at once. That's it. That's the stock market.
>
> A trade happens the moment somebody gives in. A buyer who wants it *now* agrees to pay the ask. A seller who wants out *now* takes the bid. That's a trade, and the price it happened at is the number on your screen. **The quote isn't a price. It's a receipt from the last person who stopped waiting.**

**Figure:** `{ "kind": "stat", "value": "$74.18 / $74.22", "caption": "bid / ask — the two lines, and the 4¢ between them" }`

> **[ILLUSTRATION: two vertical stacks of small horizontal bars facing each other across a narrow gap, like a ladder split down the middle. Left stack (bids) in ink, descending prices going down: 74.18, 74.15, 74.11, 74.04. Right stack (asks) in ink, ascending going up: 74.22, 74.26, 74.31, 74.40. The top bar of each stack is filled volt-orange — those are the bid and the ask. The gap between them is left empty, with a thin gold hairline measuring it and the label "the spread". Drawn hand: bars slightly uneven in length, honest and hand-ruled, not a data grid. This is the "order book" object and it returns on Day 9 (what a screener filter actually removes) and Day 27 (where the stop goes).]**

> **[ANIMATION: `stack-up`. On step entry, the two stacks build outward from the centre gap — best bid and best ask appear first, then the worse prices stack away from the gap, 40ms stagger, 240ms each. It builds outward from the spread because the spread is the thing that matters and everything else is context. The gold measuring line draws last, left to right, 200ms. Reduced motion: fully built, no build.]**

---

## STEP 3 — Prediction

`{ "id": "a-d03-pred", "type": "prediction", "skill": "market_basics" }`

**[INTERACTION: prediction — commit, then reveal. Never punished. All four options are things a smart beginner genuinely believes; there's no throwaway here.]**

> **A fund manager decides to buy 500,000 shares of Nike, right now, at whatever it takes. The ask is $74.22 — but only 12,000 shares are being offered at that price. What happens?**

- **She gets all 500,000 at $74.22 — that's the price on the screen** → `value: "at_ask"`
- **She takes the 12,000, then pays more and more as she works her way up the line** → `value: "walks_up"` ✓ *(outcome)*
- **The order gets rejected — there aren't enough shares** → `value: "rejected"`
- **The price drops, because an order that big makes people nervous** → `value: "falls"`

**Reveal:**

**Headline:** *She works her way up the line — and pushes the price up doing it.*

**Body:**
> She takes the 12,000 at $74.22. Now the cheapest shares left are at $74.26, so she takes those. Then $74.31. Then $74.40. By the time she's got her 500,000 she's paid way more on average than she started at — and the price everybody else now sees is $74.40. **She moved it.**
>
> Now notice what *didn't* happen. No news. No announcement. Nothing about Nike's business changed between $74.22 and $74.40. The price went up because one buyer wanted more shares than anyone was selling at that price, and the only way to get them was to pay up.
>
> That's the whole thing. Every price move you'll ever see is some version of this.

> **[ANIMATION: `converge` then `stack-up`. On reveal, an orange marker sweeps up the ask side of the order-book illustration, consuming each bar in turn — bar fills orange, then dims to grey, 180ms each, 60ms apart, four bars. As each is consumed the "current price" label above the figure counts up: 74.22 → 74.26 → 74.31 → 74.40. The count-up is the point of the whole animation: the learner watches the price rise with no news attached to it. Reduced motion: all four bars greyed, final price shown.]**

> **[KAI: only if the learner picked "falls" — this one deserves a word.]** *"That's actually the smartest wrong answer, so it's worth a minute. Big orders do sometimes tell people something, and traders watch for exactly that. But before anyone gets around to reading into it, the buying has to physically get absorbed — and absorbing buying means paying up. The mechanics happen first. The meaning comes later."*

---

## STEP 4 — Explainer · So what does news actually do?

`{ "id": "a-d03-x2", "type": "explainer", "skill": "market_basics" }`

**Heading:** So where does news fit in?

> If prices move because of who's buying and selling at each price, what does news do? It doesn't move the price directly. It changes what people put in the two lines.
>
> Good news comes out. Buyers who were happy waiting at $74.18 now think it's worth more, so they cancel and come back at $75.40. Sellers who were fine letting go at $74.22 pull their offers — why sell at yesterday's price? The buying line goes up, the selling line thins out, and the next trade happens way higher.
>
> Nobody announced a new price. The two lines just rebuilt themselves around a new opinion.
>
> This is why people say news is "already priced in." It's not a saying. It's just what happened while you were reading the headline. By the time you see it, the people who moved first have already rearranged both lines. **You're not looking at the price before the news. You're looking at the price after a few thousand people finished arguing about it.**

> **[ILLUSTRATION: the same order-book object from Step 2, drawn twice, side by side, labelled "before" and "after". In the "after" version the whole ladder has shifted up the frame, the ask side has visibly fewer bars (sellers pulled), and the spread is wider. Same drawing, one variable changed — reusing the object is what makes the change legible.]**

> **[ANIMATION: `converge`. The "after" ladder is not drawn statically — it morphs from the "before" state over 420ms: bid bars translate up, three ask bars fade out to 0 opacity, and the gold spread line stretches. One hero motion for the lesson. Reduced motion: the "after" state renders directly.]**

---

## STEP 5 — Multiple choice · the spread

`{ "id": "a-d03-mc1", "type": "multiple_choice", "skill": "market_basics", "framing": "spread" }`

**[INTERACTION: multiple_choice with `framing: "spread"` — the drawn annotation mark loops the word "spread", so the term being tested is visually singled out.]**

> **The bid on a stock is $28.40 and the ask is $29.15. What's that ~~spread~~ telling you?**

- A. The stock is about to drop 75 cents
- B. Buyers and sellers are 75 cents apart on what it's worth ✓
- C. Someone charges 75 cents to trade it
- D. The stock went up 75 cents today

**Right:** *"That's it. A wide spread is two groups of people disagreeing out loud. It's also a cost — buy at $29.15, sell a second later at $28.40, and you're down 75 cents without doing anything wrong."*

**Wrong (A) → [KAI]:** *"There's no direction in a spread. It's the distance between two opinions, not an arrow. A stock can sit with a 75-cent spread all day and close exactly where it opened. One more go."*

**Wrong (C) →** *"Fair guess, and there's something to it — the spread really is a cost you pay. But nobody's charging it. It's just the gap you jump across when you're the one in a hurry."*

---

## STEP 6 — True / false

`{ "id": "a-d03-tf", "type": "true_false", "skill": "market_basics", "trueLabel": "Fact", "falseLabel": "Myth" }`

**[INTERACTION: true_false, relabelled Fact / Myth, rendered as the swipe decision]**

> **"The price I see on my screen is the price my next order will get."**

**Answer: Myth.**

**If you swipe wrong:**
> That price is a record of a trade that already happened — maybe seconds ago, maybe minutes ago. Your order shows up and meets whatever line exists *right then*. If you're buying in a hurry, you pay the ask, which is higher. If you're selling in a hurry, you get the bid, which is lower. On a big, busy stock that's pennies. On a quiet one, it really isn't.

**If you swipe right:**
> Exactly — and here's the kicker. That big number on your screen is the *least* useful of the three. The bid and ask tell you what's actually available right now. The last trade only tells you what somebody already did.

---

## STEP 7 — Multiple choice · using it

`{ "id": "a-d03-mc2", "type": "multiple_choice", "skill": "market_basics" }`

**[INTERACTION: multiple_choice — the application question. This is the one that separates "I read it" from "I got it", and it's deliberately last so it also carries the `xpNote`.]**

> **Two stocks cost about the same. One has a 2-cent spread. The other has a 40-cent spread. What's most likely going on?**

- A. The second company is worse
- B. The second one is more expensive
- C. Way fewer people are trading the second one, so both lines are thin and far apart ✓
- D. The second one moved more today

**Right:** *"Yes — a spread is basically a headcount. Thousands of people haggling over Apple squeeze the gap down to a penny. Forty people haggling over a small company leave a canyon. And that canyon costs real money to anyone who has to cross it fast."*

**Wrong (A) → [KAI]:** *"Tempting, but the spread is measuring the crowd, not the company. There are great small companies with wide spreads and pretty mediocre giant ones with penny spreads. All a spread tells you is how many people are standing in line — nothing about what they're lining up for. One more time."*

**Wrong (D) →** *"Close, and the two do hang out together — jumpy stocks usually have wider spreads. But it runs the other way round: thin trading causes both. Crowd size is the thing underneath."*

**Footer:** `+50 XP` beside Check — this is the last graded step, so `LessonEngine` prints the XP note here.

---

## STEP 8 — Go look for real

`{ "id": "a-d03-rw", "type": "real_world", "action": "research_ticker", "skill": "market_basics" }`

**[INTERACTION: real_world — `research_ticker`. The rep is the skill: reading a real two-sided quote, which is the whole point of this lesson.]**

**Ticker:** the first company on the member's own watchlist (authored fallback: `NKE` / Nike)

**Prompt:**
> Go pull up a company you actually have an opinion about. Find the bid. Find the ask. Notice the gap. Then see where the last trade sits compared to both.

**CTA:** `Open the quote`

**Success text:**
> That gap is what it costs to be in a hurry. From now on, when someone says "the price", you'll know which of those three numbers they mean — and whether it's the one you'd actually get.

**[KAI, shown beside the rep while it's open]:** *"Doing beats watching — this is how a lesson becomes a habit."* (engine default, unchanged)

---

## `guide.outro`

[KAI: shown on the completion screen]

> You now know what's under every price move you'll ever see. Everything later in this course — where to put a stop, why a great quarter can tank a stock, what selling in pieces actually does — is just these two lines rearranging. Tomorrow we set up your workshop: which account to use, and why the answer depends on *when you need the money*, not what you're buying.

---

## Production summary

| | |
|---|---|
| **New interactions needed** | None. Runs entirely on step types that already exist. |
| **New illustrations** | 1 — the **order book** object (two facing ladders + the gap measured). Reused Day 9 and Day 27. |
| **Animations** | 3 — `stack-up` (builds outward from the gap), `converge` ×2 (walking up the line on reveal; the before/after morph). All 180–420ms, `EASE_OUT`, all resolve to end state under reduced motion. |
| **Kai lines** | 4 — intro, outro, and two wrong-answer lines that say why the wrong pick was tempting. Kai sounds like a friend, not a professor. |
| **XP** | 50, banked on the last graded step (Step 7). No quiz row. |
| **Compliance** | Nobody is told to buy or sell anything. No performance figures. Stocks only. All prices are hand-written and dated in the JSON (`figures` block: NKE, illustrative, 2025-Q3). |
| **Voice check** | Read aloud end to end. Contractions throughout. "Bid", "ask" and "spread" each get plain speech in the same breath they first appear. One everyday analogy — a garage sale with thirty people haggling. One "say the quiet part" line: *"Nope. Nike has zero say in what its stock costs."* |
