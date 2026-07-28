/**
 * CURRICULUM · ADULTS · Day 3 — "Why the price moves at all"
 *
 * The pilot lesson. Transcribed from the approved sample
 * `.planning/curriculum/SAMPLES/ADULT-D03-why-the-price-moves.md` — the copy in
 * this file is FINAL and is not to be rewritten. Phase 1 · FIND, Block 1,
 * recipe R5 (predict-led). 8 steps, ~7 minutes, difficulty 2, flat 50 XP.
 *
 * This is the authoring format the overview asks for: a LINTED, TYPED module
 * that GENERATES the migration, rather than a hand-mangled SQL heredoc. `tsc`
 * checks every step against `schema.ts`, so a malformed step cannot reach a
 * migration file. `scripts/build-pilot-lesson.mjs` emits the JSON that
 * migration 202 embeds.
 *
 * COMPLIANCE: education, never advice. Nobody is told to buy or sell anything.
 * Equities only. No performance claims. Every price in here is HAND-WRITTEN and
 * dated illustrative (NKE, 2025-Q3) — never a live quote — so the lesson reads
 * identically in five years.
 */

import type { LessonJSON } from "@/lib/learn/schema";

/** The book, drawn once and reused — the same object on steps 2, 3 and 4. */
const BOOK_BIDS = ["74.18", "74.15", "74.11", "74.04"];
const BOOK_ASKS = ["74.22", "74.26", "74.31", "74.40"];
const PROVENANCE = "NKE · illustrative levels, 2025-Q3 — not a live quote";

export const ADULT_D03: LessonJSON = {
  schema: 1,
  title: "Why the price moves at all",
  skills: ["market_basics", "stock_ownership"],
  difficulty: 2,
  audience: ["adult"],
  duration_minutes: 7,
  xp: 50,
  guide: {
    intro:
      "Most people picture a stock price like a price tag — somebody decided it, printed it, done. That picture is wrong, and it quietly costs people money. Give me seven minutes and you'll never look at a quote the same way.",
    outro:
      "You now know what's under every price move you'll ever see. Everything later in this course — where to put a stop, why a great quarter can tank a stock, what selling in pieces actually does — is just these two lines rearranging. Tomorrow we set up your workshop: which account to use, and why the answer depends on when you need the money, not what you're buying.",
  },
  steps: [
    /* ── 1 · Warm-up — the daily 15-second retrieval, recalling Day 2 ─────── */
    {
      id: "a-d03-warm",
      type: "multiple_choice",
      skill: "revenue",
      question:
        "Yesterday: a company's revenue is just everything customers bought from it. So when Costco reports revenue for a quarter, whose money is that?",
      options: [
        "Investors who bought Costco stock",
        "Shoppers who bought stuff at Costco",
        "Money Costco borrowed from a bank",
        "Money from Costco selling one of its buildings",
      ],
      correctIndex: 1,
      reinforce:
        "Yep. Revenue is customers, full stop. When investors buy shares, that money goes to whoever sold them — it never touches the company.",
      explanation:
        "Revenue is customers, full stop — money from people at the register. Anything else the company takes in is something other than revenue.",
      wrongFeedback: [
        {
          kai: true,
          text: "This one trips up almost everybody at first, so it's worth nailing down. When you buy a share, your money goes to the person who sold it to you. Another investor, somewhere. The company doesn't see a dime of it. Revenue is people at the register. Let's take that one again.",
        },
        null,
        {
          text: "Borrowed money isn't revenue — it's debt. Money you have to give back was never earned.",
        },
        {
          text: "Selling a building is a one-off. Revenue is what customers pay for what the company actually sells.",
        },
      ],
    },

    /* ── 2 · Explainer — nobody sets the price ────────────────────────────── */
    {
      id: "a-d03-x1",
      type: "explainer",
      skill: "market_basics",
      heading: "Nobody actually sets the price",
      body: [
        "You open your app, it says Nike is $74.20, and it's natural to assume somebody decided that. Someone at the company. Someone at the exchange. Someone in a suit.",
        "Nope. Nike has zero say in what its stock costs. Neither does the app. Neither does the exchange.",
        "What actually exists is two lines of people. On one side, everybody who wants to buy has said the most they'll pay. On the other, everybody willing to sell has said the least they'll take. The best offer from the buyers is called the bid. The best one from the sellers is the ask. They're never the same number, because nobody volunteers to pay more than they have to.",
        "Think of a garage sale where thirty people are haggling at once. That's it. That's the stock market.",
        "A trade happens the moment somebody gives in. A buyer who wants it now agrees to pay the ask. A seller who wants out now takes the bid. That's a trade, and the price it happened at is the number on your screen. The quote isn't a price. It's a receipt from the last person who stopped waiting.",
      ],
      figure: {
        kind: "stat",
        value: "$74.18 / $74.22",
        caption: "bid / ask — the two lines, and the 4¢ between them",
      },
      illustration: {
        kind: "order_book",
        mode: "ladder",
        bids: BOOK_BIDS,
        asks: BOOK_ASKS,
        spreadLabel: "the spread",
        caption: PROVENANCE,
      },
    },

    /* ── 3 · Prediction — commit, then reveal. Never punished. ────────────── */
    {
      id: "a-d03-pred",
      type: "prediction",
      skill: "market_basics",
      question:
        "A fund manager decides to buy 500,000 shares of Nike, right now, at whatever it takes. The ask is $74.22 — but only 12,000 shares are being offered at that price. What happens?",
      options: [
        {
          label:
            "She gets all 500,000 at $74.22 — that's the price on the screen",
          value: "at_ask",
        },
        {
          label:
            "She takes the 12,000, then pays more and more as she works her way up the line",
          value: "walks_up",
        },
        {
          label: "The order gets rejected — there aren't enough shares",
          value: "rejected",
        },
        {
          label: "The price drops, because an order that big makes people nervous",
          value: "falls",
        },
      ],
      outcomeValue: "walks_up",
      illustration: {
        kind: "order_book",
        mode: "walk_up",
        bids: BOOK_BIDS,
        asks: BOOK_ASKS,
        spreadLabel: "the spread",
        walkPrices: ["$74.22", "$74.26", "$74.31", "$74.40"],
        caption: PROVENANCE,
      },
      reveal: {
        headline: "She works her way up the line — and pushes the price up doing it.",
        body: [
          "She takes the 12,000 at $74.22. Now the cheapest shares left are at $74.26, so she takes those. Then $74.31. Then $74.40. By the time she's got her 500,000 she's paid way more on average than she started at — and the price everybody else now sees is $74.40. She moved it.",
          "Now notice what didn't happen. No news. No announcement. Nothing about Nike's business changed between $74.22 and $74.40. The price went up because one buyer wanted more shares than anyone was selling at that price, and the only way to get them was to pay up.",
          "That's the whole thing. Every price move you'll ever see is some version of this.",
        ].join("\n\n"),
        scene: {
          kind: "price_event",
          caption: "the tape while she filled",
          points: [0.16, 0.13, 0.19, 0.15, 0.2, 0.44, 0.66, 1],
          eventIndex: 4,
          eventLabel: "500K BUY",
          endLabel: "$74.40",
        },
      },
      guideOn: {
        value: "falls",
        line: "That's actually the smartest wrong answer, so it's worth a minute. Big orders do sometimes tell people something, and traders watch for exactly that. But before anyone gets around to reading into it, the buying has to physically get absorbed — and absorbing buying means paying up. The mechanics happen first. The meaning comes later.",
      },
    },

    /* ── 4 · Explainer — so what does news actually do? ───────────────────── */
    {
      id: "a-d03-x2",
      type: "explainer",
      skill: "market_basics",
      heading: "So where does news fit in?",
      body: [
        "If prices move because of who's buying and selling at each price, what does news do? It doesn't move the price directly. It changes what people put in the two lines.",
        "Good news comes out. Buyers who were happy waiting at $74.18 now think it's worth more, so they cancel and come back at $75.40. Sellers who were fine letting go at $74.22 pull their offers — why sell at yesterday's price? The buying line goes up, the selling line thins out, and the next trade happens way higher.",
        "Nobody announced a new price. The two lines just rebuilt themselves around a new opinion.",
        "This is why people say news is “already priced in.” It's not a saying. It's just what happened while you were reading the headline. By the time you see it, the people who moved first have already rearranged both lines. You're not looking at the price before the news. You're looking at the price after a few thousand people finished arguing about it.",
      ],
      illustration: {
        kind: "order_book",
        mode: "before_after",
        bids: BOOK_BIDS,
        asks: BOOK_ASKS,
        beforeLabel: "before",
        spreadLabel: "the spread",
        after: {
          bids: ["75.40", "75.34", "75.28", "75.19"],
          asks: ["76.05", "76.60"],
          label: "after",
        },
        caption: "The same drawing, one variable changed — sellers pulled.",
      },
    },

    /* ── 5 · Multiple choice · the spread (the annotated word) ────────────── */
    {
      id: "a-d03-mc1",
      type: "multiple_choice",
      skill: "market_basics",
      framing: "spread",
      question:
        "The bid on a stock is $28.40 and the ask is $29.15. What's that spread telling you?",
      options: [
        "The stock is about to drop 75 cents",
        "Buyers and sellers are 75 cents apart on what it's worth",
        "Someone charges 75 cents to trade it",
        "The stock went up 75 cents today",
      ],
      correctIndex: 1,
      reinforce:
        "That's it. A wide spread is two groups of people disagreeing out loud. It's also a cost — buy at $29.15, sell a second later at $28.40, and you're down 75 cents without doing anything wrong.",
      explanation:
        "A spread is the distance between two live opinions, not a move that already happened.",
      wrongFeedback: [
        {
          kai: true,
          text: "There's no direction in a spread. It's the distance between two opinions, not an arrow. A stock can sit with a 75-cent spread all day and close exactly where it opened. One more go.",
        },
        null,
        {
          text: "Fair guess, and there's something to it — the spread really is a cost you pay. But nobody's charging it. It's just the gap you jump across when you're the one in a hurry.",
        },
        {
          text: "That's a move, not a gap. The spread is two prices sitting side by side right now, not the distance the stock travelled today.",
        },
      ],
    },

    /* ── 6 · True / false, relabelled Fact / Myth ─────────────────────────── */
    {
      id: "a-d03-tf",
      type: "true_false",
      skill: "market_basics",
      trueLabel: "Fact",
      falseLabel: "Myth",
      statement:
        "“The price I see on my screen is the price my next order will get.”",
      answer: false,
      explanation:
        "That price is a record of a trade that already happened — maybe seconds ago, maybe minutes ago. Your order shows up and meets whatever line exists right then. If you're buying in a hurry, you pay the ask, which is higher. If you're selling in a hurry, you get the bid, which is lower. On a big, busy stock that's pennies. On a quiet one, it really isn't.",
      reinforce:
        "Exactly — and here's the kicker. That big number on your screen is the least useful of the three. The bid and ask tell you what's actually available right now. The last trade only tells you what somebody already did.",
    },

    /* ── 7 · Multiple choice · using it (last graded step → carries the XP) ── */
    {
      id: "a-d03-mc2",
      type: "multiple_choice",
      skill: "market_basics",
      question:
        "Two stocks cost about the same. One has a 2-cent spread. The other has a 40-cent spread. What's most likely going on?",
      options: [
        "The second company is worse",
        "The second one is more expensive",
        "Way fewer people are trading the second one, so both lines are thin and far apart",
        "The second one moved more today",
      ],
      correctIndex: 2,
      reinforce:
        "Yes — a spread is basically a headcount. Thousands of people haggling over Apple squeeze the gap down to a penny. Forty people haggling over a small company leave a canyon. And that canyon costs real money to anyone who has to cross it fast.",
      explanation:
        "A spread is measuring the crowd around a stock, not the price of it.",
      wrongFeedback: [
        {
          kai: true,
          text: "Tempting, but the spread is measuring the crowd, not the company. There are great small companies with wide spreads and pretty mediocre giant ones with penny spreads. All a spread tells you is how many people are standing in line — nothing about what they're lining up for. One more time.",
        },
        {
          text: "Both stocks cost about the same — that was the setup. The gap between the two lines isn't the price of the share.",
        },
        null,
        {
          text: "Close, and the two do hang out together — jumpy stocks usually have wider spreads. But it runs the other way round: thin trading causes both. Crowd size is the thing underneath.",
        },
      ],
    },

    /* ── 8 · Go look for real — the rep IS the skill ──────────────────────── */
    {
      id: "a-d03-rw",
      type: "real_world",
      skill: "market_basics",
      action: "research_ticker",
      ticker: "NKE",
      company: "Nike",
      prompt:
        "Go pull up a company you actually have an opinion about. Find the bid. Find the ask. Notice the gap. Then see where the last trade sits compared to both.",
      cta: "Open the quote",
      successText:
        "That gap is what it costs to be in a hurry. From now on, when someone says “the price”, you'll know which of those three numbers they mean — and whether it's the one you'd actually get.",
    },
  ],
};

export default ADULT_D03;
