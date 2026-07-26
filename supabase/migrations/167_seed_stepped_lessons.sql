-- 167 — Learning World P2: hand-authored stepped lessons (Week-1 seed)
--
-- Converts two real FIC Foundations lessons into native step sequences to prove
-- the engine end-to-end (proposal §6 priority: FIC Week-1, adult + teen
-- registers). ~6 steps each, ~4-minute feel, SIX distinct block types (explainer
-- · multiple_choice · true_false · match_pairs · prediction · real_world) — this
-- clears the binding block-diversity gate (not "three quizzes in costume").
--
-- Ships on the REAL lesson slugs (additive: only sets `steps`, `lesson_xp`,
-- `est_minutes`, `node_kind`). The adult lesson is is_free (085) so the free
-- sampler + a zero-residue temp user can complete it end-to-end. ZERO LLM — every
-- string is authored here.

-- ── ADULT: "What a Stock Is & How the Market Works" (is_free, register=adult) ──
update lessons set
  est_minutes = 4,
  lesson_xp = 50,
  node_kind = 'lesson',
  steps = $json$
{
  "schema": 1,
  "title": "What a Stock Is & How the Market Works",
  "skills": ["stock_ownership", "market_basics"],
  "difficulty": 2,
  "audience": ["adult"],
  "duration_minutes": 4,
  "xp": 50,
  "guide": {
    "intro": "Forget the ticker noise for a minute. A stock is a simpler idea than the screens make it look — and once it clicks, everything else in this program stands on it.",
    "outro": "You now own the core idea: a share is a slice of a real business, and price is a live vote on it. Everything else builds on this."
  },
  "steps": [
    {
      "id": "adult-stock-intro",
      "type": "explainer",
      "skill": "stock_ownership",
      "heading": "A share is a slice of a business",
      "body": [
        "A share of stock is a small ownership stake in a real company. Own one share of a company that has issued a million, and you own one-millionth of it — its factories, its brand, its future profits.",
        "That is the whole idea. Everything traders layer on top — charts, valuations, options — is just a way of pricing that ownership. The ownership is the thing.",
        "So the first question is never 'is the chart going up?' It is 'is this a business I would want to own a piece of?'"
      ],
      "figure": { "kind": "stat", "value": "1 share = 1 slice", "caption": "of the whole company" }
    },
    {
      "id": "adult-own-what",
      "type": "multiple_choice",
      "skill": "stock_ownership",
      "question": "You buy one share of Apple. What do you actually own?",
      "options": [
        "A loan you made to Apple that they pay back with interest",
        "A small ownership stake in the company itself",
        "A coupon for Apple products",
        "A bet with the brokerage on the price"
      ],
      "correctIndex": 1,
      "explanation": "A share is ownership, not a loan. Lending to a company is a bond. Owning a piece of it — with a claim on its profits and growth — is a stock.",
      "reinforce": "Exactly. You are a part-owner, however small — that mindset is the whole game."
    },
    {
      "id": "adult-price-source",
      "type": "true_false",
      "skill": "market_basics",
      "statement": "A stock's price is set by the company's CEO.",
      "answer": false,
      "trueLabel": "True",
      "falseLabel": "False",
      "explanation": "No one sets the price by decree. Price is where a buyer and a seller agree to trade right now — it moves as demand and supply shift, second by second.",
      "reinforce": "Right. Price is a live negotiation between everyone in the market, not a number anyone dictates."
    },
    {
      "id": "adult-terms-match",
      "type": "match_pairs",
      "skill": "market_basics",
      "prompt": "Match each term to what it means.",
      "pairs": [
        { "left": "Ticker", "right": "The short symbol that identifies a stock" },
        { "left": "Share", "right": "One unit of ownership in a company" },
        { "left": "Dividend", "right": "Cash a company pays out to its owners" },
        { "left": "Index", "right": "A basket that tracks many stocks at once" }
      ],
      "explanation": "These four cover most of the vocabulary you will see on any brokerage screen. A ticker names it, a share is the unit, a dividend is your cut of profits, an index measures a whole market.",
      "reinforce": "That is the core vocabulary — you will see these four everywhere from here on."
    },
    {
      "id": "adult-price-move",
      "type": "prediction",
      "skill": "market_basics",
      "question": "You own one share you bought at $50. The company keeps doing well and more investors decide they want in. What usually happens to the share price?",
      "options": [
        { "label": "It rises — more buyers than sellers", "value": "up" },
        { "label": "It falls — success scares people off", "value": "down" },
        { "label": "It stays exactly at $50", "value": "flat" }
      ],
      "outcomeValue": "up",
      "reveal": {
        "headline": "Price rose — demand outran supply",
        "body": "When more people want to buy a limited number of shares than want to sell, buyers bid the price up to win them. That tug-of-war between demand and supply is what moves every price you will ever see."
      }
    },
    {
      "id": "adult-real-watchlist",
      "type": "real_world",
      "skill": "stock_ownership",
      "action": "save_watchlist",
      "ticker": "AAPL",
      "company": "Apple",
      "prompt": "Now make it real. Put Apple on your watchlist — the first company you are choosing to own the idea of and follow.",
      "cta": "Open my watchlist",
      "successText": "Apple is on your watchlist. That is your first act as an owner, not a spectator — this is how a lesson becomes a habit."
    }
  ]
}
$json$::jsonb
where id = 'f1c00000-0001-0001-0002-000000000001';

-- ── TEEN: "How the Stock Market Actually Works" (register=teen) ──
update lessons set
  est_minutes = 4,
  lesson_xp = 50,
  node_kind = 'lesson',
  steps = $json$
{
  "schema": 1,
  "title": "How the Stock Market Actually Works",
  "skills": ["stock_ownership", "market_basics"],
  "difficulty": 2,
  "audience": ["teen"],
  "duration_minutes": 4,
  "xp": 50,
  "guide": {
    "intro": "You already know these companies — Roblox, Nike, Apple. This lesson flips you from a customer into an owner. Same companies, totally different lens.",
    "outro": "You just went from customer to owner in your head. A share is a real slice of a real company, and price is everyone voting at once. That is the whole foundation."
  },
  "steps": [
    {
      "id": "teen-stock-intro",
      "type": "explainer",
      "skill": "stock_ownership",
      "heading": "Own the company, not just the app",
      "body": [
        "Here is the plot twist: you can own a piece of the companies you already use. A share of stock is a tiny slice of a real business — Roblox, Nike, whatever.",
        "One share of a company that has millions of shares means you own one of those millions of pieces. Small, but real. If the company grows, your slice is worth more.",
        "So instead of just buying the sneakers, you can own a piece of the company that makes them."
      ],
      "figure": { "kind": "stat", "value": "1 share = 1 slice", "caption": "of the real company" }
    },
    {
      "id": "teen-own-what",
      "type": "multiple_choice",
      "skill": "stock_ownership",
      "question": "You buy one share of Roblox. What do you actually own?",
      "options": [
        "Free Robux every month",
        "A tiny piece of the actual company",
        "Early access to new games",
        "Nothing — it is just a number"
      ],
      "correctIndex": 1,
      "explanation": "A share is a real piece of the company itself — not perks, not a coupon. If Roblox the business grows, the piece you own grows with it.",
      "reinforce": "Yes. You own a slice of the real company — that is what makes you an owner, not just a player."
    },
    {
      "id": "teen-price-source",
      "type": "true_false",
      "skill": "market_basics",
      "statement": "The price of a stock is decided by the company's boss.",
      "answer": false,
      "trueLabel": "True",
      "falseLabel": "False",
      "explanation": "Nope. No single person sets it. The price is just where a buyer and a seller agree to trade right now — and it changes every time that agreement shifts.",
      "reinforce": "Exactly. The price is everyone in the market negotiating at once, not one person's call."
    },
    {
      "id": "teen-terms-match",
      "type": "match_pairs",
      "skill": "market_basics",
      "prompt": "Match each word to what it really means.",
      "pairs": [
        { "left": "Ticker", "right": "The short code for a stock (like RBLX)" },
        { "left": "Share", "right": "One piece of ownership in a company" },
        { "left": "Dividend", "right": "Cash the company pays its owners" },
        { "left": "Index", "right": "A group of many stocks tracked together" }
      ],
      "explanation": "These four show up on every stock screen. Ticker names it, share is the piece, dividend is your cut, index tracks a whole bunch at once.",
      "reinforce": "That is the starter vocab unlocked — you will spot these everywhere now."
    },
    {
      "id": "teen-price-move",
      "type": "prediction",
      "skill": "market_basics",
      "question": "A Roblox game blows up and suddenly everyone wants to buy Roblox stock. There are only so many shares. What happens to the price?",
      "options": [
        { "label": "It goes up — everyone is competing to buy", "value": "up" },
        { "label": "It goes down — too many owners", "value": "down" },
        { "label": "It freezes and stops moving", "value": "flat" }
      ],
      "outcomeValue": "up",
      "reveal": {
        "headline": "Price goes UP — buyers outnumber sellers",
        "body": "When way more people want to buy than sell, buyers have to offer more to win the limited shares. More demand than supply pushes the price up. That is the tug-of-war behind every price move."
      }
    },
    {
      "id": "teen-real-watchlist",
      "type": "real_world",
      "skill": "stock_ownership",
      "action": "save_watchlist",
      "ticker": "RBLX",
      "company": "Roblox",
      "prompt": "Your move: put Roblox on your watchlist. Pick the first company you want to follow like an owner.",
      "cta": "Open my watchlist",
      "successText": "Roblox is on your watchlist. You just made your first owner move — now you are following it, not just playing it."
    }
  ]
}
$json$::jsonb
where id = 'f1c00000-0002-0001-0002-000000000001';
