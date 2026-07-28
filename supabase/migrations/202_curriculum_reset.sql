-- 202 — CURRICULUM RESET + the first lesson of the new curriculum.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- PART 1 — RETIRE EVERYTHING THAT IS THERE NOW.
--
-- The audit: 36 live lessons are one 6-step template repeated 36 times, 65 more
-- are empty shells, and 4 teach options contracts to teenagers. The owner's
-- call is to remove all of it before the new curriculum lands.
--
-- NOTHING IS DELETED. lesson_progress and xp_events both reference lessons by
-- id; dropping rows would silently destroy every member's XP audit trail and
-- their completion history. So the old catalogue is HIDDEN, not destroyed:
--
--   • courses.published = false on every existing course. RLS on courses,
--     modules and lessons all key off that one flag (migration 039), so a
--     single write takes the whole old catalogue off every member surface at
--     once — no client can read past it even if a query forgets a filter.
--   • lessons.retired = true, a new per-lesson flag. It exists because
--     publication is COURSE-level and the new curriculum will need to retire
--     individual days inside a live course without unpublishing the course
--     around them. It is also the only defence available to the service-role
--     search path, which bypasses RLS entirely.
--   • The lessons RLS policy now excludes retired rows, so "retired" is
--     enforced by the database rather than by every caller remembering.
--
-- Flashcards, games and missions are untouched — they are not lessons.
-- Reversible in one line: set published = true / retired = false.
-- ═══════════════════════════════════════════════════════════════════════════

alter table lessons add column if not exists retired boolean not null default false;

comment on column lessons.retired is
  'Curriculum reset (202): the lesson is withdrawn from member surfaces but its rows are kept so lesson_progress / xp_events history stays intact. Enforced in the lessons RLS policy.';

create index if not exists idx_lessons_retired on lessons(retired) where retired = false;

-- Every lesson that exists at this moment is old-curriculum. The pilot below is
-- inserted AFTER this statement, so it is never caught by it.
update lessons set retired = true where retired = false;

-- And the courses they live in come off the shelf.
update courses set published = false, updated_at = now() where published = true;

-- Retirement is enforced by the database, not by callers remembering a filter.
drop policy if exists "Members read lessons of published courses" on public.lessons;
drop policy if exists "Members read live lessons of published courses" on public.lessons;
create policy "Members read live lessons of published courses" on public.lessons
  for select to authenticated
  using (
    retired = false
    and module_id in (
      select m.id from public.modules m
      join public.courses c on c.id = m.course_id
      where c.published = true
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- PART 2 — THE PILOT: Adults · Day 3, "Why the price moves at all".
--
-- Phase 1 · FIND, block 1. Eight steps, ~7 minutes, difficulty 2, flat 50 XP
-- de-duped by lesson id like every other lesson — there is no second XP path.
--
-- The step JSON below is GENERATED from src/lib/learn/curriculum/adult-d03.ts
-- by scripts/build-pilot-lesson.mjs. It is tsc-checked against schema.ts and
-- then re-validated by the generator (option/answer ranges, framing present in
-- its own question, scene points normalised, wrongFeedback parallel to options)
-- before this file is written. Do not hand-edit the JSON here — edit the typed
-- module and re-run the generator.
--
-- Compliance: education, never advice. No one is told to buy or sell anything.
-- Equities only. No performance claims. Every price is hand-written and dated
-- illustrative (NKE, 2025-Q3), never a live quote.
--
-- Idempotent: fixed uuids + on conflict do update, so re-running is a no-op.
-- ═══════════════════════════════════════════════════════════════════════════

insert into courses (id, slug, title, description, min_tier, program, sort_order, published)
values (
  'c0d3f1a0-0000-4000-8000-000000000001',
  'investing-explained-simply',
  'Investing, Explained Simply',
  'The decision cycle, one day at a time — find, evaluate, size, manage, sell. Plain language, no jargon, one concept a day.',
  'challenge',
  'fic',
  0,
  true
)
on conflict (id) do update set
  slug        = excluded.slug,
  title       = excluded.title,
  description = excluded.description,
  min_tier    = excluded.min_tier,
  program     = excluded.program,
  sort_order  = excluded.sort_order,
  published   = excluded.published,
  updated_at  = now();

-- track = 'adults' so LearnSurface's own-track filter and get_home_state's
-- (m.track is null or m.track = v_track) both resolve it for an adult member.
insert into modules (id, course_id, track, title, description, sort_order)
values (
  'c0d3f1a0-0000-4000-8000-000000000002',
  'c0d3f1a0-0000-4000-8000-000000000001',
  'adults',
  'Phase 1 · FIND',
  'Where do good picks come from, and how do you get from nothing to a shortlist?',
  0
)
on conflict (id) do update set
  course_id   = excluded.course_id,
  track       = excluded.track,
  title       = excluded.title,
  description = excluded.description,
  sort_order  = excluded.sort_order;

insert into lessons (
  id, module_id, title, description,
  drip_week, has_quiz, sort_order, is_free,
  node_kind, est_minutes, lesson_xp, retired, steps
)
values (
  'c0d3f1a0-0000-4000-8000-000000000003',
  'c0d3f1a0-0000-4000-8000-000000000002',
  'Why the price moves at all',
  'Nobody sets the price. It is two lines of people haggling — what buyers are offering, what sellers are asking, and whoever gave in last.',
  0,
  false,
  0,
  true,
  'lesson',
  7,
  50,
  false,
  $json$
{
  "schema": 1,
  "title": "Why the price moves at all",
  "skills": [
    "market_basics",
    "stock_ownership"
  ],
  "difficulty": 2,
  "audience": [
    "adult"
  ],
  "duration_minutes": 7,
  "xp": 50,
  "guide": {
    "intro": "Most people picture a stock price like a price tag — somebody decided it, printed it, done. That picture is wrong, and it quietly costs people money. Give me seven minutes and you'll never look at a quote the same way.",
    "outro": "You now know what's under every price move you'll ever see. Everything later in this course — where to put a stop, why a great quarter can tank a stock, what selling in pieces actually does — is just these two lines rearranging. Tomorrow we set up your workshop: which account to use, and why the answer depends on when you need the money, not what you're buying."
  },
  "steps": [
    {
      "id": "a-d03-warm",
      "type": "multiple_choice",
      "skill": "revenue",
      "question": "Yesterday: a company's revenue is just everything customers bought from it. So when Costco reports revenue for a quarter, whose money is that?",
      "options": [
        "Investors who bought Costco stock",
        "Shoppers who bought stuff at Costco",
        "Money Costco borrowed from a bank",
        "Money from Costco selling one of its buildings"
      ],
      "correctIndex": 1,
      "reinforce": "Yep. Revenue is customers, full stop. When investors buy shares, that money goes to whoever sold them — it never touches the company.",
      "explanation": "Revenue is customers, full stop — money from people at the register. Anything else the company takes in is something other than revenue.",
      "wrongFeedback": [
        {
          "kai": true,
          "text": "This one trips up almost everybody at first, so it's worth nailing down. When you buy a share, your money goes to the person who sold it to you. Another investor, somewhere. The company doesn't see a dime of it. Revenue is people at the register. Let's take that one again."
        },
        null,
        {
          "text": "Borrowed money isn't revenue — it's debt. Money you have to give back was never earned."
        },
        {
          "text": "Selling a building is a one-off. Revenue is what customers pay for what the company actually sells."
        }
      ]
    },
    {
      "id": "a-d03-x1",
      "type": "explainer",
      "skill": "market_basics",
      "heading": "Nobody actually sets the price",
      "body": [
        "You open your app, it says Nike is $74.20, and it's natural to assume somebody decided that. Someone at the company. Someone at the exchange. Someone in a suit.",
        "Nope. Nike has zero say in what its stock costs. Neither does the app. Neither does the exchange.",
        "What actually exists is two lines of people. On one side, everybody who wants to buy has said the most they'll pay. On the other, everybody willing to sell has said the least they'll take. The best offer from the buyers is called the bid. The best one from the sellers is the ask. They're never the same number, because nobody volunteers to pay more than they have to.",
        "Think of a garage sale where thirty people are haggling at once. That's it. That's the stock market.",
        "A trade happens the moment somebody gives in. A buyer who wants it now agrees to pay the ask. A seller who wants out now takes the bid. That's a trade, and the price it happened at is the number on your screen. The quote isn't a price. It's a receipt from the last person who stopped waiting."
      ],
      "figure": {
        "kind": "stat",
        "value": "$74.18 / $74.22",
        "caption": "bid / ask — the two lines, and the 4¢ between them"
      },
      "illustration": {
        "kind": "order_book",
        "mode": "ladder",
        "bids": [
          "74.18",
          "74.15",
          "74.11",
          "74.04"
        ],
        "asks": [
          "74.22",
          "74.26",
          "74.31",
          "74.40"
        ],
        "spreadLabel": "the spread",
        "caption": "NKE · illustrative levels, 2025-Q3 — not a live quote"
      }
    },
    {
      "id": "a-d03-pred",
      "type": "prediction",
      "skill": "market_basics",
      "question": "A fund manager decides to buy 500,000 shares of Nike, right now, at whatever it takes. The ask is $74.22 — but only 12,000 shares are being offered at that price. What happens?",
      "options": [
        {
          "label": "She gets all 500,000 at $74.22 — that's the price on the screen",
          "value": "at_ask"
        },
        {
          "label": "She takes the 12,000, then pays more and more as she works her way up the line",
          "value": "walks_up"
        },
        {
          "label": "The order gets rejected — there aren't enough shares",
          "value": "rejected"
        },
        {
          "label": "The price drops, because an order that big makes people nervous",
          "value": "falls"
        }
      ],
      "outcomeValue": "walks_up",
      "illustration": {
        "kind": "order_book",
        "mode": "walk_up",
        "bids": [
          "74.18",
          "74.15",
          "74.11",
          "74.04"
        ],
        "asks": [
          "74.22",
          "74.26",
          "74.31",
          "74.40"
        ],
        "spreadLabel": "the spread",
        "walkPrices": [
          "$74.22",
          "$74.26",
          "$74.31",
          "$74.40"
        ],
        "caption": "NKE · illustrative levels, 2025-Q3 — not a live quote"
      },
      "reveal": {
        "headline": "She works her way up the line — and pushes the price up doing it.",
        "body": "She takes the 12,000 at $74.22. Now the cheapest shares left are at $74.26, so she takes those. Then $74.31. Then $74.40. By the time she's got her 500,000 she's paid way more on average than she started at — and the price everybody else now sees is $74.40. She moved it.\n\nNow notice what didn't happen. No news. No announcement. Nothing about Nike's business changed between $74.22 and $74.40. The price went up because one buyer wanted more shares than anyone was selling at that price, and the only way to get them was to pay up.\n\nThat's the whole thing. Every price move you'll ever see is some version of this.",
        "scene": {
          "kind": "price_event",
          "caption": "the tape while she filled",
          "points": [
            0.16,
            0.13,
            0.19,
            0.15,
            0.2,
            0.44,
            0.66,
            1
          ],
          "eventIndex": 4,
          "eventLabel": "500K BUY",
          "endLabel": "$74.40"
        }
      },
      "guideOn": {
        "value": "falls",
        "line": "That's actually the smartest wrong answer, so it's worth a minute. Big orders do sometimes tell people something, and traders watch for exactly that. But before anyone gets around to reading into it, the buying has to physically get absorbed — and absorbing buying means paying up. The mechanics happen first. The meaning comes later."
      }
    },
    {
      "id": "a-d03-x2",
      "type": "explainer",
      "skill": "market_basics",
      "heading": "So where does news fit in?",
      "body": [
        "If prices move because of who's buying and selling at each price, what does news do? It doesn't move the price directly. It changes what people put in the two lines.",
        "Good news comes out. Buyers who were happy waiting at $74.18 now think it's worth more, so they cancel and come back at $75.40. Sellers who were fine letting go at $74.22 pull their offers — why sell at yesterday's price? The buying line goes up, the selling line thins out, and the next trade happens way higher.",
        "Nobody announced a new price. The two lines just rebuilt themselves around a new opinion.",
        "This is why people say news is “already priced in.” It's not a saying. It's just what happened while you were reading the headline. By the time you see it, the people who moved first have already rearranged both lines. You're not looking at the price before the news. You're looking at the price after a few thousand people finished arguing about it."
      ],
      "illustration": {
        "kind": "order_book",
        "mode": "before_after",
        "bids": [
          "74.18",
          "74.15",
          "74.11",
          "74.04"
        ],
        "asks": [
          "74.22",
          "74.26",
          "74.31",
          "74.40"
        ],
        "beforeLabel": "before",
        "spreadLabel": "the spread",
        "after": {
          "bids": [
            "75.40",
            "75.34",
            "75.28",
            "75.19"
          ],
          "asks": [
            "76.05",
            "76.60"
          ],
          "label": "after"
        },
        "caption": "The same drawing, one variable changed — sellers pulled."
      }
    },
    {
      "id": "a-d03-mc1",
      "type": "multiple_choice",
      "skill": "market_basics",
      "framing": "spread",
      "question": "The bid on a stock is $28.40 and the ask is $29.15. What's that spread telling you?",
      "options": [
        "The stock is about to drop 75 cents",
        "Buyers and sellers are 75 cents apart on what it's worth",
        "Someone charges 75 cents to trade it",
        "The stock went up 75 cents today"
      ],
      "correctIndex": 1,
      "reinforce": "That's it. A wide spread is two groups of people disagreeing out loud. It's also a cost — buy at $29.15, sell a second later at $28.40, and you're down 75 cents without doing anything wrong.",
      "explanation": "A spread is the distance between two live opinions, not a move that already happened.",
      "wrongFeedback": [
        {
          "kai": true,
          "text": "There's no direction in a spread. It's the distance between two opinions, not an arrow. A stock can sit with a 75-cent spread all day and close exactly where it opened. One more go."
        },
        null,
        {
          "text": "Fair guess, and there's something to it — the spread really is a cost you pay. But nobody's charging it. It's just the gap you jump across when you're the one in a hurry."
        },
        {
          "text": "That's a move, not a gap. The spread is two prices sitting side by side right now, not the distance the stock travelled today."
        }
      ]
    },
    {
      "id": "a-d03-tf",
      "type": "true_false",
      "skill": "market_basics",
      "trueLabel": "Fact",
      "falseLabel": "Myth",
      "statement": "“The price I see on my screen is the price my next order will get.”",
      "answer": false,
      "explanation": "That price is a record of a trade that already happened — maybe seconds ago, maybe minutes ago. Your order shows up and meets whatever line exists right then. If you're buying in a hurry, you pay the ask, which is higher. If you're selling in a hurry, you get the bid, which is lower. On a big, busy stock that's pennies. On a quiet one, it really isn't.",
      "reinforce": "Exactly — and here's the kicker. That big number on your screen is the least useful of the three. The bid and ask tell you what's actually available right now. The last trade only tells you what somebody already did."
    },
    {
      "id": "a-d03-mc2",
      "type": "multiple_choice",
      "skill": "market_basics",
      "question": "Two stocks cost about the same. One has a 2-cent spread. The other has a 40-cent spread. What's most likely going on?",
      "options": [
        "The second company is worse",
        "The second one is more expensive",
        "Way fewer people are trading the second one, so both lines are thin and far apart",
        "The second one moved more today"
      ],
      "correctIndex": 2,
      "reinforce": "Yes — a spread is basically a headcount. Thousands of people haggling over Apple squeeze the gap down to a penny. Forty people haggling over a small company leave a canyon. And that canyon costs real money to anyone who has to cross it fast.",
      "explanation": "A spread is measuring the crowd around a stock, not the price of it.",
      "wrongFeedback": [
        {
          "kai": true,
          "text": "Tempting, but the spread is measuring the crowd, not the company. There are great small companies with wide spreads and pretty mediocre giant ones with penny spreads. All a spread tells you is how many people are standing in line — nothing about what they're lining up for. One more time."
        },
        {
          "text": "Both stocks cost about the same — that was the setup. The gap between the two lines isn't the price of the share."
        },
        null,
        {
          "text": "Close, and the two do hang out together — jumpy stocks usually have wider spreads. But it runs the other way round: thin trading causes both. Crowd size is the thing underneath."
        }
      ]
    },
    {
      "id": "a-d03-rw",
      "type": "real_world",
      "skill": "market_basics",
      "action": "research_ticker",
      "ticker": "NKE",
      "company": "Nike",
      "prompt": "Go pull up a company you actually have an opinion about. Find the bid. Find the ask. Notice the gap. Then see where the last trade sits compared to both.",
      "cta": "Open the quote",
      "successText": "That gap is what it costs to be in a hurry. From now on, when someone says “the price”, you'll know which of those three numbers they mean — and whether it's the one you'd actually get."
    }
  ]
}
$json$::jsonb
)
on conflict (id) do update set
  module_id   = excluded.module_id,
  title       = excluded.title,
  description = excluded.description,
  drip_week   = excluded.drip_week,
  has_quiz    = excluded.has_quiz,
  sort_order  = excluded.sort_order,
  is_free     = excluded.is_free,
  node_kind   = excluded.node_kind,
  est_minutes = excluded.est_minutes,
  lesson_xp   = excluded.lesson_xp,
  retired     = false,
  steps       = excluded.steps;
