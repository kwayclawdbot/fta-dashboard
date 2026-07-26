-- 177 — Learning World P5: DRAFT content conversion of FIC Foundations (BULK)
--
-- Converts the remaining 34 FIC Foundations program lessons (11 Adult, 11 Teen,
-- 12 Kids) into native step sequences. Written to steps_draft (176), NOT the live
-- steps column — invisible to members until THE OWNER previews (?draft=1) and
-- publishes via publish_lesson_draft(). The 2 already-live exemplars (adult
-- "What a Stock Is", teen "How the Stock Market Actually Works", both in 167) and
-- all 12 FTA Trade Ready lessons are intentionally NOT touched here.
--
-- Quality bar (matches 167): 5–8 steps, ~4-min feel, >=4 distinct block types per
-- lesson, exactly ONE real_world action per lesson with a verified deep-link
-- (/watchlist or /research/{TICKER}), predictions with genuinely revealing
-- answers, wrong-answer explanations that TEACH. Register voice derives DOWN from
-- the premium adult editorial style (adult -> teen sharper -> kid vivid-simple).
-- KIDS COMPLIANCE FLOOR: no stock-price predictions — kid prediction blocks use
-- business outcomes only. Skill ids on each step align with lesson_skills (165).
-- ZERO LLM — every string is hand-authored here.

-- ═══════════════════════════════════════════════════════════════════════════
-- FIC ADULT FOUNDATIONS (register: adult — editorial, articulate-before-example)
-- ═══════════════════════════════════════════════════════════════════════════

-- A1 — Why Invest — The Power of Compounding
update lessons set steps_draft = $j$
{
  "schema": 1,
  "title": "Why Invest — The Power of Compounding",
  "skills": ["market_basics", "growth"],
  "difficulty": 1,
  "audience": ["adult"],
  "duration_minutes": 4,
  "xp": 50,
  "guide": {
    "intro": "Before any chart or ticker, one idea does more work than all the rest: compounding. Give it a few minutes here and the case for investing at all becomes obvious.",
    "outro": "You now understand why time is the investor's real edge. Every strategy in this program is a way of protecting and extending the runway you just learned about."
  },
  "steps": [
    {
      "id": "a1-explain",
      "type": "explainer",
      "skill": "growth",
      "heading": "Compounding is interest earning interest",
      "body": [
        "Investing works because the returns you earn start earning returns of their own. Put money into a growing business, and this year's gain becomes part of next year's larger base, so the following gain is bigger, and the one after that bigger still.",
        "That is compounding, and it is why the single most important variable is not how much you invest but how long you leave it working. A modest sum given decades quietly outruns a large sum given only a few years.",
        "So the first advantage in investing is almost never cleverness. It is time, and the discipline to start early and refuse to interrupt the process."
      ],
      "figure": { "kind": "stat", "value": "Time > timing", "caption": "the investor's real edge" }
    },
    {
      "id": "a1-mc",
      "type": "multiple_choice",
      "skill": "market_basics",
      "question": "Two people invest the same amount in the same fund. One starts at 25, the other at 40, and both stop adding money at 60. Who almost always ends up with more?",
      "options": [
        "The one who started at 40, because markets were higher later",
        "The one who started at 25, because their money compounded for 15 extra years",
        "They end up equal since they invested the same amount",
        "Impossible to tell without knowing the exact returns"
      ],
      "correctIndex": 1,
      "explanation": "The amount invested was identical, so the only real difference is time in the market. Fifteen extra years of compounding does the heavy lifting, which is exactly why starting early beats almost any other move.",
      "reinforce": "Right. The early starter's edge is time, not skill or luck."
    },
    {
      "id": "a1-tf",
      "type": "true_false",
      "skill": "growth",
      "statement": "Compounding grows your money in a straight line, adding the same dollar amount every year.",
      "answer": false,
      "explanation": "It grows on a curve, not a line. Because each year builds on a bigger base, the dollar gains get larger over time, so the growth accelerates rather than staying flat.",
      "reinforce": "Exactly. The curve steepens as the base grows, and that acceleration is the whole point."
    },
    {
      "id": "a1-match",
      "type": "match_pairs",
      "skill": "market_basics",
      "prompt": "Match each idea to what it means for a long-term investor.",
      "pairs": [
        { "left": "Principal", "right": "The original money you put in" },
        { "left": "Return", "right": "What your money earns over a period" },
        { "left": "Compounding", "right": "Returns that themselves start earning returns" },
        { "left": "Time horizon", "right": "How long you leave the money invested" }
      ],
      "explanation": "These four are the vocabulary of growth: you commit principal, it earns a return, that return compounds, and your time horizon decides how far the process runs.",
      "reinforce": "That is the core language of long-term investing."
    },
    {
      "id": "a1-predict",
      "type": "prediction",
      "skill": "growth",
      "question": "You invest in a steadily profitable company and reinvest every dividend for 20 years instead of spending it. Compared with taking the dividends as cash, where does reinvesting usually leave you?",
      "options": [
        { "label": "Well ahead — reinvested dividends compound too", "value": "ahead" },
        { "label": "About the same — dividends are too small to matter", "value": "same" },
        { "label": "Behind — you paid tax you could have avoided", "value": "behind" }
      ],
      "outcomeValue": "ahead",
      "reveal": {
        "headline": "Far ahead — reinvested dividends compound",
        "body": "When you reinvest a dividend it buys more shares, which pay more dividends, which buy still more shares. Over decades that feedback loop often accounts for a large share of an investor's total return, which is why 'just leave it working' is such powerful advice."
      }
    },
    {
      "id": "a1-real",
      "type": "real_world",
      "skill": "growth",
      "action": "save_watchlist",
      "ticker": "MSFT",
      "company": "Microsoft",
      "prompt": "Compounding needs a durable business to run on. Put Microsoft — a company that has grown and paid dividends for years — on your watchlist as your first long-term candidate to study.",
      "cta": "Open my watchlist",
      "successText": "Microsoft is on your watchlist. Now you have a real compounder to follow over time — watching one patiently is how the idea stops being theory."
    }
  ]
}
$j$::jsonb where id = 'f1c00000-0001-0001-0001-000000000001';

-- A3 — Candlestick Anatomy & Timeframes
update lessons set steps_draft = $j$
{
  "schema": 1,
  "title": "Candlestick Anatomy & Timeframes",
  "skills": ["technical_analysis"],
  "difficulty": 2,
  "audience": ["adult"],
  "duration_minutes": 4,
  "xp": 50,
  "guide": {
    "intro": "A chart can look like random noise until you can read a single candle. Learn that, and a wall of bars turns into a readable story of who is winning.",
    "outro": "You can now read a candle and know why the same move looks different across timeframes. That is the literacy every chart skill is built on."
  },
  "steps": [
    {
      "id": "a3-explain",
      "type": "explainer",
      "skill": "technical_analysis",
      "heading": "One candle is one battle between buyers and sellers",
      "body": [
        "A candlestick is a compact record of a single slice of time — a day, an hour, five minutes, whatever you choose. It marks four prices: where trading opened, the highest it reached, the lowest it fell to, and where it closed.",
        "The body of the candle runs between the open and the close, and its colour tells you who won. A green body means the close finished above the open, so buyers were in control; a red body means sellers pushed it down. The thin wicks above and below show how far price stretched before snapping back.",
        "Read that way, a chart is not noise. It is a sequence of small contests, each one telling you whether buyers or sellers had the upper hand in that window."
      ],
      "figure": { "kind": "stat", "value": "O H L C", "caption": "open · high · low · close" }
    },
    {
      "id": "a3-mc",
      "type": "multiple_choice",
      "skill": "technical_analysis",
      "question": "A daily candle is green with a long lower wick. What does that most likely tell you?",
      "options": [
        "Sellers controlled the day from start to finish",
        "Price dropped hard during the day but buyers pushed it back up to close higher",
        "Nothing happened — the stock was flat",
        "The company reported earnings"
      ],
      "correctIndex": 1,
      "explanation": "The long lower wick means price fell well below the open at some point, but the green body means it recovered to close above the open. Sellers tried, buyers answered, and that rejection of lower prices is exactly what the wick records.",
      "reinforce": "Exactly. A long lower wick on a green candle is buyers defending a level."
    },
    {
      "id": "a3-tf",
      "type": "true_false",
      "skill": "technical_analysis",
      "statement": "The same trading day looks identical on the daily chart and the 15-minute chart.",
      "answer": false,
      "explanation": "One trading day is a single candle on the daily chart but dozens of candles on the 15-minute chart. The timeframe you choose is your zoom level, and each one reveals a different layer of the same story.",
      "reinforce": "Right. Timeframe is your zoom, and each one shows a different part of the move."
    },
    {
      "id": "a3-match",
      "type": "match_pairs",
      "skill": "technical_analysis",
      "prompt": "Match each part of a candle to what it represents.",
      "pairs": [
        { "left": "Body", "right": "The range between open and close" },
        { "left": "Upper wick", "right": "The highest price before sellers pushed back" },
        { "left": "Lower wick", "right": "The lowest price before buyers pushed back" },
        { "left": "Colour", "right": "Whether buyers or sellers won the period" }
      ],
      "explanation": "Body for the net result, wicks for the extremes that got rejected, colour for the winner — that is everything a single candle encodes.",
      "reinforce": "That is the full anatomy of one candle."
    },
    {
      "id": "a3-predict",
      "type": "prediction",
      "skill": "technical_analysis",
      "question": "You are watching a strong uptrend on the daily chart. A single red candle appears after ten green ones. Based on the candles alone, what is the sound read?",
      "options": [
        { "label": "The trend is over — sell immediately", "value": "over" },
        { "label": "One red candle in a strong run is usually just a pause", "value": "pause" },
        { "label": "The chart is broken", "value": "broken" }
      ],
      "outcomeValue": "pause",
      "reveal": {
        "headline": "Usually a pause, not a reversal",
        "body": "A single down candle inside a healthy trend is normal — buyers rested and sellers had one session. Real reversals show up as a pattern of lower highs and lower lows over several candles, not one red bar. Reading candles in sequence rather than in isolation is what separates a signal from noise."
      }
    },
    {
      "id": "a3-real",
      "type": "real_world",
      "skill": "technical_analysis",
      "action": "research_ticker",
      "ticker": "AAPL",
      "company": "Apple",
      "prompt": "Time to read real candles. Open Apple's chart and switch between the daily and a shorter timeframe — watch how the same move looks different as you zoom.",
      "cta": "Open Apple's chart",
      "successText": "You just read live candles on a real chart. Every green and red bar there is a battle you can now interpret."
    }
  ]
}
$j$::jsonb where id = 'f1c00000-0001-0002-0001-000000000001';

-- A4 — Support, Resistance, Trend & Volume
update lessons set steps_draft = $j$
{
  "schema": 1,
  "title": "Support, Resistance, Trend & Volume",
  "skills": ["technical_analysis"],
  "difficulty": 2,
  "audience": ["adult"],
  "duration_minutes": 4,
  "xp": 50,
  "guide": {
    "intro": "Charts stop looking chaotic the moment you can name the levels price keeps fighting at. That is what this lesson gives you.",
    "outro": "You can now read a chart as a map of levels, direction, and conviction — the four things every technical decision leans on."
  },
  "steps": [
    {
      "id": "a4-explain",
      "type": "explainer",
      "skill": "technical_analysis",
      "heading": "Price has memory — the levels where it fights",
      "body": [
        "Support is a price level where buyers have repeatedly stepped in and stopped a decline, a floor the market has defended before. Resistance is the mirror image: a ceiling where sellers have repeatedly taken over and capped a rally.",
        "These levels matter because markets have memory. Traders remember where a stock bounced or stalled last time, place their orders around those prices, and in doing so make the level real again. The trend is simply which direction those levels are drifting — an uptrend makes higher floors and higher ceilings, a downtrend the opposite.",
        "Volume is the tell that confirms it. A move that happens on heavy volume has real participation behind it; the same move on thin volume is far easier to distrust."
      ],
      "figure": { "kind": "stat", "value": "Floor · Ceiling", "caption": "support holds, resistance caps" }
    },
    {
      "id": "a4-mc",
      "type": "multiple_choice",
      "skill": "technical_analysis",
      "question": "A stock has fallen to $100 and bounced three separate times over two months. What is $100 acting as?",
      "options": [
        "Resistance — a ceiling",
        "Support — a floor buyers keep defending",
        "A dividend",
        "A stop-loss"
      ],
      "correctIndex": 1,
      "explanation": "A price the stock keeps falling to and bouncing off is support — buyers reliably show up there. Each successful bounce makes the level more respected and more widely watched.",
      "reinforce": "Right. Repeated bounces off a level make it support."
    },
    {
      "id": "a4-tf",
      "type": "true_false",
      "skill": "technical_analysis",
      "statement": "A breakout on very low volume is just as trustworthy as one on very high volume.",
      "answer": false,
      "explanation": "Volume is conviction. When price breaks a key level on heavy volume, many participants are behind the move, so it is more likely to hold. A break on thin volume can easily be a false move that fades.",
      "reinforce": "Exactly. Volume is the confirmation that a breakout is real."
    },
    {
      "id": "a4-match",
      "type": "match_pairs",
      "skill": "technical_analysis",
      "prompt": "Match each term to what it describes.",
      "pairs": [
        { "left": "Support", "right": "A level where buyers repeatedly step in" },
        { "left": "Resistance", "right": "A level where sellers repeatedly take over" },
        { "left": "Uptrend", "right": "A series of higher highs and higher lows" },
        { "left": "Volume", "right": "How much traded — the conviction behind a move" }
      ],
      "explanation": "Support and resistance mark the levels, trend marks their direction, and volume tells you how much to trust the move.",
      "reinforce": "That is the reading toolkit for any chart."
    },
    {
      "id": "a4-predict",
      "type": "prediction",
      "skill": "technical_analysis",
      "question": "A stock approaches a resistance level it has failed to break twice before — but this time it arrives on unusually heavy volume. What is the more likely outcome?",
      "options": [
        { "label": "It breaks through — heavy volume shows real buying pressure", "value": "break" },
        { "label": "It fails again exactly like before", "value": "fail" },
        { "label": "It stops trading", "value": "halt" }
      ],
      "outcomeValue": "break",
      "reveal": {
        "headline": "Heavy volume tilts it toward a break",
        "body": "The two earlier failures happened without enough buying force behind them. When price returns with a surge of volume, it signals that far more buyers are committed this time, and that extra conviction is exactly what powers a level to finally give way. Nothing is guaranteed, but volume is the evidence that shifts the odds."
      }
    },
    {
      "id": "a4-real",
      "type": "real_world",
      "skill": "technical_analysis",
      "action": "research_ticker",
      "ticker": "NVDA",
      "company": "Nvidia",
      "prompt": "Open Nvidia's chart and try to spot one level it keeps bouncing off or stalling at. Naming a real support or resistance is the whole skill.",
      "cta": "Open Nvidia's chart",
      "successText": "You found a real level on a live chart. Support and resistance stop being jargon the moment you can point at one."
    }
  ]
}
$j$::jsonb where id = 'f1c00000-0001-0002-0002-000000000001';

-- A5 — Chart Patterns & Indicators
update lessons set steps_draft = $j$
{
  "schema": 1,
  "title": "Chart Patterns & Indicators",
  "skills": ["technical_analysis"],
  "difficulty": 2,
  "audience": ["adult"],
  "duration_minutes": 4,
  "xp": 50,
  "guide": {
    "intro": "Patterns and indicators get sold as magic. They are not — they are lenses on crowd behaviour, and used as lenses they are genuinely useful.",
    "outro": "You now know what a moving average, RSI, MACD, and a flag each actually tell you — and that they work best when they agree."
  },
  "steps": [
    {
      "id": "a5-explain",
      "type": "explainer",
      "skill": "technical_analysis",
      "heading": "Patterns and indicators are shorthand, not magic",
      "body": [
        "A chart pattern is just a recurring shape that tends to form when buyers and sellers repeat the same behaviour. A flag forms when a sharp move pauses to catch its breath before continuing; a double top forms when price tries and fails twice to break the same ceiling. The shape is a summary of crowd psychology, nothing more.",
        "Indicators do the same job with maths instead of shapes. A moving average smooths price into a single trend line so you can see direction without the day-to-day jitter. RSI measures how overstretched a move has become, and MACD tracks whether momentum is building or fading.",
        "None of these predict the future on their own. They are lenses that make what buyers and sellers are already doing easier to read, and they work best when several of them agree."
      ],
      "figure": { "kind": "stat", "value": "Signal, not spell", "caption": "confirm, don't obey" }
    },
    {
      "id": "a5-mc",
      "type": "multiple_choice",
      "skill": "technical_analysis",
      "question": "What does a moving average actually do?",
      "options": [
        "Guarantees the stock will rise",
        "Smooths price into a single line so the underlying trend is easier to see",
        "Reports the company's earnings",
        "Sets the stock's price"
      ],
      "correctIndex": 1,
      "explanation": "A moving average averages recent prices into one line, filtering out daily noise so the direction of the trend stands out. It describes what price is doing — it does not control it.",
      "reinforce": "Right. It is a smoothing lens on the trend."
    },
    {
      "id": "a5-tf",
      "type": "true_false",
      "skill": "technical_analysis",
      "statement": "A high RSI reading means you should always sell immediately.",
      "answer": false,
      "explanation": "A high RSI says a move is stretched, but strong trends can stay overbought for a long time while still climbing. It is a caution flag to weigh with everything else, not an automatic sell button.",
      "reinforce": "Exactly. Overbought is context, not a command."
    },
    {
      "id": "a5-match",
      "type": "match_pairs",
      "skill": "technical_analysis",
      "prompt": "Match each tool to what it tells you.",
      "pairs": [
        { "left": "Moving average", "right": "The smoothed direction of the trend" },
        { "left": "RSI", "right": "How overstretched a move has become" },
        { "left": "MACD", "right": "Whether momentum is building or fading" },
        { "left": "Flag pattern", "right": "A pause before a trend likely continues" }
      ],
      "explanation": "Trend, stretch, momentum, and continuation — each tool answers a different question about the same chart.",
      "reinforce": "Four lenses, four different questions answered."
    },
    {
      "id": "a5-predict",
      "type": "prediction",
      "skill": "technical_analysis",
      "question": "A stock in a strong uptrend forms a small flag pattern — a brief, orderly pause — while volume quietly dries up. What does this pattern usually suggest comes next?",
      "options": [
        { "label": "The uptrend resumes after the pause", "value": "resume" },
        { "label": "The company is about to go bankrupt", "value": "bankrupt" },
        { "label": "Price will trade sideways forever", "value": "sideways" }
      ],
      "outcomeValue": "resume",
      "reveal": {
        "headline": "A pause that usually resolves upward",
        "body": "A flag is a rest, not a reversal: buyers take a breather, volume fades because few are selling, and the prior trend often reasserts once the pause ends. It is one of the more reliable continuation patterns — though, like every signal, it is a probability, not a promise."
      }
    },
    {
      "id": "a5-real",
      "type": "real_world",
      "skill": "technical_analysis",
      "action": "research_ticker",
      "ticker": "TSLA",
      "company": "Tesla",
      "prompt": "Open Tesla's chart, add a moving average, and watch how the line tracks the trend beneath the noise. Seeing an indicator move on real price is how it clicks.",
      "cta": "Open Tesla's chart",
      "successText": "You put an indicator on a live chart. Now the tools are something you use, not something you take on faith."
    }
  ]
}
$j$::jsonb where id = 'f1c00000-0001-0003-0001-000000000001';

-- A6 — Fundamentals Lite: P/E, Earnings & Catalysts
update lessons set steps_draft = $j$
{
  "schema": 1,
  "title": "Fundamentals Lite: P/E, Earnings & Catalysts",
  "skills": ["financial_statements", "valuation"],
  "difficulty": 3,
  "audience": ["adult"],
  "duration_minutes": 4,
  "xp": 50,
  "guide": {
    "intro": "Charts show what price is doing. Fundamentals explain why. This lesson gives you just enough of the why to read the market like a business owner.",
    "outro": "You now know how earnings, the P/E ratio, and catalysts drive price — and why the market trades the surprise, not the raw number."
  },
  "steps": [
    {
      "id": "a6-explain",
      "type": "explainer",
      "skill": "financial_statements",
      "heading": "Why a stock moves — the business underneath",
      "body": [
        "Charts show you what price is doing; fundamentals explain why. At the centre of it is earnings — the company's profit. When a company earns more, owning a piece of it is worth more, and over time price tends to follow profit.",
        "The price-to-earnings ratio, or P/E, connects the two. It tells you how many dollars investors are paying today for each dollar of the company's annual profit. A high P/E means the market expects strong future growth; a low P/E means expectations are modest. Neither is automatically good or bad — it is a measure of what is priced in.",
        "Catalysts are the events that change those expectations: an earnings report, a new product, a change in the law. They are the moments when the story about a business updates, and price moves to catch up."
      ],
      "figure": { "kind": "stat", "value": "Price follows profit", "caption": "eventually" }
    },
    {
      "id": "a6-mc",
      "type": "multiple_choice",
      "skill": "valuation",
      "question": "A company's P/E ratio is high. What does that tell you?",
      "options": [
        "The stock is guaranteed to fall",
        "Investors are paying a lot per dollar of current profit, usually expecting strong growth",
        "The company has no customers",
        "The dividend is high"
      ],
      "correctIndex": 1,
      "explanation": "A high P/E means the market is willing to pay up today because it expects earnings to grow. That optimism can be justified or overdone, so the ratio tells you what is expected, not whether it will come true.",
      "reinforce": "Right. P/E measures the expectations baked into the price."
    },
    {
      "id": "a6-tf",
      "type": "true_false",
      "skill": "financial_statements",
      "statement": "A company can report record profits and still see its stock fall that day.",
      "answer": true,
      "explanation": "Price reflects expectations, not just results. If investors expected even better numbers than the record, the report disappoints relative to the bar that was set, and the stock can drop despite genuinely strong earnings.",
      "reinforce": "Exactly. The market trades the surprise versus expectations, not the raw number."
    },
    {
      "id": "a6-match",
      "type": "match_pairs",
      "skill": "financial_statements",
      "prompt": "Match each fundamental to what it means.",
      "pairs": [
        { "left": "Earnings", "right": "The company's profit" },
        { "left": "P/E ratio", "right": "Price paid per dollar of annual profit" },
        { "left": "Catalyst", "right": "An event that changes expectations" },
        { "left": "Revenue", "right": "The total money the company took in" }
      ],
      "explanation": "Revenue is the top line, earnings the profit beneath it, P/E the price on that profit, and catalysts the events that move it all.",
      "reinforce": "That is the fundamentals starter kit."
    },
    {
      "id": "a6-predict",
      "type": "prediction",
      "skill": "valuation",
      "question": "A popular company has run up sharply for weeks ahead of earnings. It then reports solid numbers, right in line with what everyone expected. What often happens to the price?",
      "options": [
        { "label": "It falls or stalls — the good news was already priced in", "value": "falls" },
        { "label": "It doubles instantly", "value": "doubles" },
        { "label": "Trading is halted permanently", "value": "halted" }
      ],
      "outcomeValue": "falls",
      "reveal": {
        "headline": "Often falls — the news was already in the price",
        "body": "When a stock climbs for weeks on expectations and then merely meets them, there is no fresh surprise to push it higher, and traders who bought the anticipation often sell the fact. This 'buy the rumour, sell the news' pattern is why great earnings can still be followed by a red day."
      }
    },
    {
      "id": "a6-real",
      "type": "real_world",
      "skill": "financial_statements",
      "action": "research_ticker",
      "ticker": "AMZN",
      "company": "Amazon",
      "prompt": "Open Amazon's research page and find its earnings and valuation. Reading real fundamentals is how the ratios stop being abstract.",
      "cta": "Open Amazon's research",
      "successText": "You looked at a real company's numbers. Fundamentals become intuitive the moment you attach them to a business you know."
    }
  ]
}
$j$::jsonb where id = 'f1c00000-0001-0003-0002-000000000001';

-- A7 — Calls, Puts & Premium (Greeks Lite)
update lessons set steps_draft = $j$
{
  "schema": 1,
  "title": "Calls, Puts & Premium (Greeks Lite)",
  "skills": ["risk"],
  "difficulty": 3,
  "audience": ["adult"],
  "duration_minutes": 4,
  "xp": 50,
  "guide": {
    "intro": "Options sound intimidating, but the core idea is simple: you are buying a right, not an obligation. Get that, and the rest is detail.",
    "outro": "You understand calls, puts, premium, and time decay. That base is enough to think clearly about any option before you ever place one."
  },
  "steps": [
    {
      "id": "a7-explain",
      "type": "explainer",
      "skill": "risk",
      "heading": "An option is a right, not an obligation",
      "body": [
        "An option is a contract that gives you the right — but not the requirement — to buy or sell a stock at a set price before a set date. A call is the right to buy; a put is the right to sell. You are paying for optionality, the ability to act only if it suits you.",
        "The price you pay for that right is the premium, and it is the most you can lose on a bought option. That is the appeal: your risk is capped at what you paid, while a favourable move can be worth far more than the premium.",
        "The catch is time. Every option has an expiry date, and its value erodes as that date approaches, so being right about direction is not enough — you have to be right before the clock runs out."
      ],
      "figure": { "kind": "stat", "value": "Right, not obligation", "caption": "premium = your max loss" }
    },
    {
      "id": "a7-mc",
      "type": "multiple_choice",
      "skill": "risk",
      "question": "You buy a call option for a $2 premium. What is the most you can lose?",
      "options": [
        "Unlimited",
        "The $2 premium you paid",
        "The full price of 100 shares",
        "Nothing — options are free"
      ],
      "correctIndex": 1,
      "explanation": "On a bought option, your maximum loss is the premium — the $2 you paid. If the trade goes against you the option can expire worthless, but you can never lose more than you put in.",
      "reinforce": "Right. A bought option caps your downside at the premium."
    },
    {
      "id": "a7-tf",
      "type": "true_false",
      "skill": "risk",
      "statement": "An option keeps its full value right up until its expiry date.",
      "answer": false,
      "explanation": "Options lose value as expiry approaches — this is time decay. All else equal, the same option is worth less next week than today, because there is less time left for the move you need to happen.",
      "reinforce": "Exactly. Time decay works against a bought option every day."
    },
    {
      "id": "a7-match",
      "type": "match_pairs",
      "skill": "risk",
      "prompt": "Match each option term to its meaning.",
      "pairs": [
        { "left": "Call", "right": "The right to buy at a set price" },
        { "left": "Put", "right": "The right to sell at a set price" },
        { "left": "Premium", "right": "What you pay for the option (your max loss)" },
        { "left": "Expiry", "right": "The date the right runs out" }
      ],
      "explanation": "Call to buy, put to sell, premium as the cost and the cap on your loss, expiry as the deadline — that is the whole frame.",
      "reinforce": "That is the vocabulary of every option trade."
    },
    {
      "id": "a7-predict",
      "type": "prediction",
      "skill": "risk",
      "question": "You buy a call expecting a jump. The stock rises slightly, but slowly, and two weeks pass with no big move. What most likely happened to your option's value?",
      "options": [
        { "label": "It fell — time decay ate the small gain", "value": "fell" },
        { "label": "It doubled", "value": "doubled" },
        { "label": "It is unchanged", "value": "unchanged" }
      ],
      "outcomeValue": "fell",
      "reveal": {
        "headline": "It likely lost value — time decay won",
        "body": "You were right about direction, but the move was too small and too slow. As the days passed, time decay chipped away at the premium faster than the modest rise added to it. With options, the size and the timing of the move matter as much as the direction — a slow drift in your favour can still lose money."
      }
    },
    {
      "id": "a7-real",
      "type": "real_world",
      "skill": "risk",
      "action": "save_watchlist",
      "ticker": "NKE",
      "company": "Nike",
      "prompt": "Options are always built on an underlying stock, and the discipline starts with studying that company. Put Nike on your watchlist as an underlying to learn the business first.",
      "cta": "Open my watchlist",
      "successText": "Nike is on your watchlist. Studying the underlying business first is exactly how disciplined option traders start."
    }
  ]
}
$j$::jsonb where id = 'f1c00000-0001-0004-0001-000000000001';

-- A8 — Buying Options on a Thesis — Without Blowing Up
update lessons set steps_draft = $j$
{
  "schema": 1,
  "title": "Buying Options on a Thesis — Without Blowing Up",
  "skills": ["risk", "market_psychology"],
  "difficulty": 4,
  "audience": ["adult"],
  "duration_minutes": 4,
  "xp": 50,
  "guide": {
    "intro": "Leverage is not the danger. Un-sized leverage is. This lesson is about the two habits that let you use options without ever risking the whole account.",
    "outro": "You now know the difference between a leveraged plan and a leveraged gamble: a written thesis and a small, pre-decided risk."
  },
  "steps": [
    {
      "id": "a8-explain",
      "type": "explainer",
      "skill": "risk",
      "heading": "Leverage rewards a plan and punishes a gamble",
      "body": [
        "Options give you leverage — a small premium can control a large position — and leverage is neutral. It amplifies whatever you bring to it. Bring a clear thesis and disciplined sizing, and it amplifies a good decision. Bring a hunch and your whole account, and it amplifies a mistake just as efficiently.",
        "The professionals' safeguard is simple: a trade starts with a thesis — a specific reason you expect a specific move by a specific time — and it risks only a small, pre-decided slice of the account. If the thesis is wrong, the loss is survivable and you are still in the game tomorrow.",
        "The blow-ups almost never come from being wrong once. They come from betting so large on a single idea that one wrong call ends the account. Size is what keeps leverage a tool instead of a trap."
      ],
      "figure": { "kind": "stat", "value": "Thesis first", "caption": "size so a wrong call survives" }
    },
    {
      "id": "a8-mc",
      "type": "multiple_choice",
      "skill": "risk",
      "question": "What is the safest way to think about position size on a leveraged options trade?",
      "options": [
        "Bet the whole account when you feel certain",
        "Risk only a small, pre-decided slice so a wrong call is survivable",
        "Never write down a plan",
        "Always double down after a loss"
      ],
      "correctIndex": 1,
      "explanation": "Certainty is a feeling, not a fact, and leverage magnifies every outcome. Risking a small, fixed slice means being wrong costs you a lesson, not your account, which is the only way to stay in long enough to be right.",
      "reinforce": "Right. Small, pre-decided risk is what keeps you in the game."
    },
    {
      "id": "a8-tf",
      "type": "true_false",
      "skill": "market_psychology",
      "statement": "If you have a strong feeling about a trade, it is fine to skip writing down why.",
      "answer": false,
      "explanation": "A written thesis forces the vague feeling into a testable claim — what you expect, why, and by when. Without it you cannot tell a disciplined trade from a gamble, and you cannot learn from the result.",
      "reinforce": "Exactly. If you cannot write the thesis, you do not have one yet."
    },
    {
      "id": "a8-match",
      "type": "match_pairs",
      "skill": "risk",
      "prompt": "Match each habit to why it protects you.",
      "pairs": [
        { "left": "Written thesis", "right": "Turns a hunch into a testable plan" },
        { "left": "Small position size", "right": "Makes a wrong call survivable" },
        { "left": "Leverage", "right": "Amplifies whatever decision you bring" },
        { "left": "Pre-set exit", "right": "Decides the loss before emotion does" }
      ],
      "explanation": "A thesis to justify the trade, small size to survive it, awareness that leverage cuts both ways, and an exit set in advance — together they turn options from a gamble into a craft.",
      "reinforce": "That is the discipline stack behind every serious options trader."
    },
    {
      "id": "a8-predict",
      "type": "prediction",
      "skill": "risk",
      "question": "Two traders buy the exact same call. One risks 2% of their account, the other risks 50%. The trade goes wrong and the option expires worthless. A month later, who is more likely to still be trading and recovering?",
      "options": [
        { "label": "The 2% trader — the loss was survivable", "value": "twopct" },
        { "label": "The 50% trader — bigger bets recover faster", "value": "fiftypct" },
        { "label": "Both are equally fine", "value": "both" }
      ],
      "outcomeValue": "twopct",
      "reveal": {
        "headline": "The 2% trader is still standing",
        "body": "Same trade, same wrong call — but the 2% trader lost a small, planned amount and has plenty of capital to keep learning. The 50% trader took a blow that a single normal loss should never deliver. Survival is the prerequisite for everything else in trading, and position size is what buys it."
      }
    },
    {
      "id": "a8-real",
      "type": "real_world",
      "skill": "market_psychology",
      "action": "research_ticker",
      "ticker": "DIS",
      "company": "Disney",
      "prompt": "Before any options trade, the thesis comes from the business. Open Disney's research page and try to state one clear reason it might move — that sentence is the start of a real thesis.",
      "cta": "Open Disney's research",
      "successText": "You started building a thesis from real research. That single 'why' is what separates a plan from a punt."
    }
  ]
}
$j$::jsonb where id = 'f1c00000-0001-0004-0002-000000000001';

-- A9 — Position Sizing, the 1-2% Rule, Stops & R:R
update lessons set steps_draft = $j$
{
  "schema": 1,
  "title": "Position Sizing, the 1-2% Rule, Stops & R:R",
  "skills": ["risk", "portfolio_construction"],
  "difficulty": 3,
  "audience": ["adult"],
  "duration_minutes": 4,
  "xp": 50,
  "guide": {
    "intro": "The professionals do not obsess over winning every trade. They obsess over never losing enough to matter. This lesson is that discipline, in four tools.",
    "outro": "You now hold the four levers of risk: the 1-2% rule, the stop, position size, and risk-reward. Master these and being wrong stops being dangerous."
  },
  "steps": [
    {
      "id": "a9-explain",
      "type": "explainer",
      "skill": "risk",
      "heading": "Protect the money first",
      "body": [
        "Before you think about profit, you decide how much you are willing to lose, because the only thing that ends a trading career is running out of money. The 1-2% rule is the classic guardrail: never risk more than one to two percent of your account on a single trade.",
        "You enforce that with a stop — a price where you have decided in advance to exit and accept the loss. Your position size then falls out of simple maths: how far away your stop is, and how much of your account that distance is allowed to cost. The stop and the size are set together, before you enter.",
        "Finally you weigh the reward against that risk. A trade that can make three dollars for every one at risk is a favourable ratio; you can be wrong more often than right and still come out ahead. Good sizing is not about winning every trade — it is about making sure the wins are worth more than the losses."
      ],
      "figure": { "kind": "stat", "value": "Risk 1-2%", "caption": "per trade, no exceptions" }
    },
    {
      "id": "a9-mc",
      "type": "multiple_choice",
      "skill": "risk",
      "question": "The 1-2% rule says never risk more than 1-2% of your account on a single trade. Why?",
      "options": [
        "Because bigger bets are illegal",
        "So no single loss can seriously damage your account",
        "Because small trades always win",
        "To pay less commission"
      ],
      "correctIndex": 1,
      "explanation": "Capping the loss at 1-2% means even a string of losing trades only dents the account, never destroys it. It keeps any one mistake small enough to survive and learn from.",
      "reinforce": "Right. The rule exists so one trade can never take you out."
    },
    {
      "id": "a9-tf",
      "type": "true_false",
      "skill": "risk",
      "statement": "A stop-loss should be decided after you are already in the trade and watching it move.",
      "answer": false,
      "explanation": "The stop is set before you enter, when you are calm and objective. Deciding it mid-trade lets fear and hope move the line — the exact emotions the stop exists to overrule.",
      "reinforce": "Exactly. The stop is a pre-commitment made before emotion shows up."
    },
    {
      "id": "a9-match",
      "type": "match_pairs",
      "skill": "portfolio_construction",
      "prompt": "Match each risk tool to its job.",
      "pairs": [
        { "left": "1-2% rule", "right": "Caps the loss on any single trade" },
        { "left": "Stop-loss", "right": "The pre-set price where you exit a loser" },
        { "left": "Position size", "right": "How many shares keep the risk within the rule" },
        { "left": "Risk-reward", "right": "How much you can make versus what you risk" }
      ],
      "explanation": "The rule sets the ceiling, the stop defines the exit, size keeps you under the ceiling, and risk-reward makes sure the math favours you over time.",
      "reinforce": "Together, these four are risk management."
    },
    {
      "id": "a9-predict",
      "type": "prediction",
      "skill": "risk",
      "question": "A trader wins only 40% of their trades — most are losers. But every winner makes three times what a loser costs, and they always risk the same small amount. Over a hundred trades, are they likely profitable?",
      "options": [
        { "label": "Yes — the winners are big enough to more than cover the losers", "value": "yes" },
        { "label": "No — you must win most trades to profit", "value": "no" },
        { "label": "It is impossible to say", "value": "unsure" }
      ],
      "outcomeValue": "yes",
      "reveal": {
        "headline": "Yes — the math wins even at 40%",
        "body": "Forty winners at three units each make 120 units; sixty losers at one unit each cost 60. That is a clear net gain despite losing most of the time. This is why professionals obsess over risk-reward and consistent sizing rather than win rate — a favourable ratio lets you be wrong often and still come out ahead."
      }
    },
    {
      "id": "a9-real",
      "type": "real_world",
      "skill": "portfolio_construction",
      "action": "save_watchlist",
      "ticker": "COST",
      "company": "Costco",
      "prompt": "Position sizing is easier to practise on a stable business you plan to hold. Put Costco on your watchlist as a name to size a real practice position around.",
      "cta": "Open my watchlist",
      "successText": "Costco is on your watchlist. A steady business is the right place to rehearse sizing before real money is on the line."
    }
  ]
}
$j$::jsonb where id = 'f1c00000-0001-0005-0001-000000000001';

-- A10 — Trading Psychology & the Trade Journal
update lessons set steps_draft = $j$
{
  "schema": 1,
  "title": "Trading Psychology & the Trade Journal",
  "skills": ["market_psychology"],
  "difficulty": 3,
  "audience": ["adult"],
  "duration_minutes": 4,
  "xp": 50,
  "guide": {
    "intro": "You can know every setup and still lose, because the hardest opponent in the market is your own reaction to it. This lesson is about winning that fight.",
    "outro": "You now know the emotions that sabotage a plan and the one habit — the journal — that turns experience into improvement."
  },
  "steps": [
    {
      "id": "a10-explain",
      "type": "explainer",
      "skill": "market_psychology",
      "heading": "Your plan's biggest enemy is you",
      "body": [
        "Markets are a machine for triggering emotion. Fear makes you sell a good position at the worst moment; greed makes you hold a winner until it becomes a loser; the fear of missing out makes you chase a move you never planned. None of these feelings care about your strategy, and left unchecked they overrule it.",
        "The defence is not to feel less. It is to decide in advance and then obey the plan when the feelings arrive. A rule set before the market opens — where you enter, where you exit, how much you risk — is your calmer self protecting you from your reactive self.",
        "The trade journal is how that discipline compounds. By writing down every trade — the thesis, the emotion, the outcome — you turn scattered experience into visible patterns, and you start correcting the specific mistakes you keep repeating."
      ],
      "figure": { "kind": "stat", "value": "Plans over feelings", "caption": "the journal proves it" }
    },
    {
      "id": "a10-mc",
      "type": "multiple_choice",
      "skill": "market_psychology",
      "question": "You planned to exit at a specific loss, but when price hits it you feel sure it will bounce, so you move your stop lower. This is...",
      "options": [
        "Smart flexibility",
        "Exactly the emotional mistake a pre-set plan exists to prevent",
        "Good risk management",
        "Required by the 1-2% rule"
      ],
      "correctIndex": 1,
      "explanation": "Moving a stop to avoid taking a planned loss is hope overriding the plan. It turns a small, decided loss into an open-ended one — the precise failure the pre-set stop was designed to stop.",
      "reinforce": "Right. The whole point of the plan is that you keep it when it is hard."
    },
    {
      "id": "a10-tf",
      "type": "true_false",
      "skill": "market_psychology",
      "statement": "Keeping a trade journal mainly helps by revealing the mistakes you repeat.",
      "answer": true,
      "explanation": "A journal makes patterns visible: the same setup that keeps failing, the same emotion that keeps costing you. You cannot fix a habit you cannot see, and the journal is what makes it seeable.",
      "reinforce": "Exactly. The journal turns invisible habits into fixable ones."
    },
    {
      "id": "a10-match",
      "type": "match_pairs",
      "skill": "market_psychology",
      "prompt": "Match each emotion to the mistake it drives.",
      "pairs": [
        { "left": "Fear", "right": "Selling a good position too early" },
        { "left": "Greed", "right": "Holding a winner until it reverses" },
        { "left": "FOMO", "right": "Chasing a move you never planned" },
        { "left": "Revenge", "right": "Forcing trades to win back a loss" }
      ],
      "explanation": "Each feeling pushes a specific error, and naming the feeling in the moment is the first step to not obeying it.",
      "reinforce": "Name the emotion, and you take back the decision."
    },
    {
      "id": "a10-predict",
      "type": "prediction",
      "skill": "market_psychology",
      "question": "A trader takes a painful loss, then immediately jumps into a second, unplanned trade to win the money back fast. How do these 'revenge trades' usually turn out over time?",
      "options": [
        { "label": "Badly — they are driven by emotion, not a plan", "value": "badly" },
        { "label": "Great — motivation improves results", "value": "great" },
        { "label": "Exactly break-even", "value": "even" }
      ],
      "outcomeValue": "badly",
      "reveal": {
        "headline": "Usually badly — emotion is driving",
        "body": "A revenge trade skips the thesis and the sizing because its real goal is to soothe a feeling, not to express an edge. That is why it so often deepens the hole instead of filling it. The disciplined response to a loss is to log it, step back, and only take the next trade when it meets your rules, not your mood."
      }
    },
    {
      "id": "a10-real",
      "type": "real_world",
      "skill": "market_psychology",
      "action": "save_watchlist",
      "ticker": "SBUX",
      "company": "Starbucks",
      "prompt": "Discipline is easier to build watching one calm name than chasing many. Put Starbucks on your watchlist and commit to only acting on it with a written plan.",
      "cta": "Open my watchlist",
      "successText": "Starbucks is on your watchlist. One name, watched patiently and traded only by plan, is how psychological discipline is built."
    }
  ]
}
$j$::jsonb where id = 'f1c00000-0001-0005-0002-000000000001';

-- A11 — Opening a Brokerage Account + Options Approval
update lessons set steps_draft = $j$
{
  "schema": 1,
  "title": "Opening a Brokerage Account + Options Approval",
  "skills": ["market_basics"],
  "difficulty": 2,
  "audience": ["adult"],
  "duration_minutes": 4,
  "xp": 50,
  "guide": {
    "intro": "The account is the door to the market, and opening one is more routine than it feels. Here is exactly what happens and why.",
    "outro": "You now know the four steps to a funded account and why options access is granted in levels. The paperwork should feel like a checkpoint, not a wall."
  },
  "steps": [
    {
      "id": "a11-explain",
      "type": "explainer",
      "skill": "market_basics",
      "heading": "The account is the door to the market",
      "body": [
        "A brokerage account is simply the account that lets you buy and sell investments — the modern equivalent of a seat at the exchange. You fund it from your bank, and from there you can own stocks, funds, and, once approved, options.",
        "Opening one is more routine than it sounds. You provide identification and some financial details, choose the account type, and connect a bank to fund it. The broker is legally required to verify who you are, which is why the questions feel formal.",
        "Options require an extra step called options approval. Because options carry more risk, brokers assign approval levels based on your experience and finances, and they unlock strategies gradually. Starting at the basic level — buying calls and puts — is the sensible on-ramp."
      ],
      "figure": { "kind": "stat", "value": "Verify · Fund · Trade", "caption": "the on-ramp to the market" }
    },
    {
      "id": "a11-mc",
      "type": "multiple_choice",
      "skill": "market_basics",
      "question": "Why do brokers ask for identification and financial details when you open an account?",
      "options": [
        "To make it harder on purpose",
        "Because they are legally required to verify who you are",
        "To sell your data",
        "There is no real reason"
      ],
      "correctIndex": 1,
      "explanation": "Brokers are regulated and must confirm your identity and suitability before letting you trade — it is a legal safeguard, not busywork. Knowing that makes the paperwork feel like a checkpoint rather than a hurdle.",
      "reinforce": "Right. The verification is a required safeguard, not a hoop for its own sake."
    },
    {
      "id": "a11-tf",
      "type": "true_false",
      "skill": "market_basics",
      "statement": "Every new account can trade any options strategy right away.",
      "answer": false,
      "explanation": "Options access is tiered. Brokers grant approval levels based on your experience and finances, unlocking riskier strategies only as you qualify — most people start with permission to simply buy calls and puts.",
      "reinforce": "Exactly. Options approval is granted in levels, not all at once."
    },
    {
      "id": "a11-match",
      "type": "match_pairs",
      "skill": "market_basics",
      "prompt": "Match each step to what it does.",
      "pairs": [
        { "left": "Identity check", "right": "Confirms who you are, as required by law" },
        { "left": "Funding", "right": "Moves money in from your bank" },
        { "left": "Account type", "right": "Chooses the tax and trading rules" },
        { "left": "Options approval", "right": "Unlocks options in graded levels" }
      ],
      "explanation": "Verify, fund, choose the account, and apply for options access — four steps and you are ready to place a real order.",
      "reinforce": "That is the full setup sequence."
    },
    {
      "id": "a11-predict",
      "type": "prediction",
      "skill": "market_basics",
      "question": "A brand-new trader applies for the highest options approval level so they can trade every advanced strategy immediately. What is the broker most likely to do?",
      "options": [
        { "label": "Approve only a basic level to match their experience", "value": "basic" },
        { "label": "Grant the top level instantly", "value": "top" },
        { "label": "Close the account", "value": "close" }
      ],
      "outcomeValue": "basic",
      "reveal": {
        "headline": "Likely a basic level to start",
        "body": "Approval levels are matched to demonstrated experience and financial capacity, so a first-time applicant is usually cleared for the entry tier — buying calls and puts — rather than the most complex strategies. That gating is a feature, not a snub: it keeps beginners from taking on risks they are not yet equipped to manage."
      }
    },
    {
      "id": "a11-real",
      "type": "real_world",
      "skill": "market_basics",
      "action": "research_ticker",
      "ticker": "AAPL",
      "company": "Apple",
      "prompt": "Before you fund an account, it helps to know your first candidate. Open Apple's research page and imagine it as the first stock you would buy once your account is live.",
      "cta": "Open Apple's research",
      "successText": "You scouted a real first buy. Walking into a funded account already knowing your first candidate is exactly the right order."
    }
  ]
}
$j$::jsonb where id = 'f1c00000-0001-0006-0001-000000000001';

-- A12 — Order Types & the First-Trade Checklist
update lessons set steps_draft = $j$
{
  "schema": 1,
  "title": "Order Types & the First-Trade Checklist",
  "skills": ["market_basics", "risk"],
  "difficulty": 3,
  "audience": ["adult"],
  "duration_minutes": 4,
  "xp": 50,
  "guide": {
    "intro": "How you enter a trade matters as much as what you buy. This lesson gives you the order types and the five-line checklist that turns a click into a decision.",
    "outro": "You can now choose the right order type and run the five-line checklist. That habit is what makes a first trade calm and reviewable instead of impulsive."
  },
  "steps": [
    {
      "id": "a12-explain",
      "type": "explainer",
      "skill": "market_basics",
      "heading": "How you enter matters as much as what you buy",
      "body": [
        "When you place a trade, the order type decides how it gets filled. A market order buys or sells immediately at whatever price is available right now — fast, but you take the going price. A limit order sets the exact price you are willing to accept and waits until the market meets it — more control, but it may never fill.",
        "A stop order sits dormant until price reaches a trigger, then activates — the mechanism behind a stop-loss. Choosing the right order type is how you control the trade-off between speed and price.",
        "Every first trade should also run through a checklist: the thesis, the entry, the stop, the size, and the exit. Writing those five down before you click turns an impulse into a decision you can review later, which is the entire habit this program is built to instill."
      ],
      "figure": { "kind": "stat", "value": "5-line checklist", "caption": "thesis · entry · stop · size · exit" }
    },
    {
      "id": "a12-mc",
      "type": "multiple_choice",
      "skill": "market_basics",
      "question": "You want to buy a stock but only if you can get it at $48 or better, and you are willing to wait. Which order type fits?",
      "options": [
        "Market order",
        "Limit order at $48",
        "Stop order",
        "No order type does this"
      ],
      "correctIndex": 1,
      "explanation": "A limit order lets you name your price and waits for the market to come to you. You give up the certainty of an instant fill in exchange for control over the price you pay.",
      "reinforce": "Right. A limit order trades speed for price control."
    },
    {
      "id": "a12-tf",
      "type": "true_false",
      "skill": "market_basics",
      "statement": "A market order guarantees you the exact price you saw on the screen.",
      "answer": false,
      "explanation": "A market order guarantees a fast fill, not a price. In fast-moving markets the actual fill can be a little different from the last quote you saw — that gap is called slippage.",
      "reinforce": "Exactly. Market orders guarantee execution, not the precise price."
    },
    {
      "id": "a12-match",
      "type": "match_pairs",
      "skill": "risk",
      "prompt": "Match each order type to what it does.",
      "pairs": [
        { "left": "Market order", "right": "Fills immediately at the going price" },
        { "left": "Limit order", "right": "Fills only at your price or better" },
        { "left": "Stop order", "right": "Activates when price hits a trigger" },
        { "left": "Checklist", "right": "The five lines every trade needs first" }
      ],
      "explanation": "Speed, price control, a trigger, and a plan — the right order type plus a written checklist is a complete, reviewable entry.",
      "reinforce": "That is everything you need to place a disciplined first trade."
    },
    {
      "id": "a12-predict",
      "type": "prediction",
      "skill": "risk",
      "question": "A first-time trader skips the checklist, buys on excitement with a market order, and sets no stop or exit. The trade drops 15%. What is the most likely reason it becomes a big loss?",
      "options": [
        { "label": "With no pre-set stop or exit, nothing tells them when to get out", "value": "nostop" },
        { "label": "Market orders always lose", "value": "marketorders" },
        { "label": "The stock was defective", "value": "defective" }
      ],
      "outcomeValue": "nostop",
      "reveal": {
        "headline": "No plan means no exit",
        "body": "Without a stop or a written exit, there is no pre-decided point to cut the loss, so hope takes over and the small loss is allowed to grow. The checklist is not bureaucracy — it is the thing that would have named the exit before emotion got a vote. A disciplined first trade is boring on purpose."
      }
    },
    {
      "id": "a12-real",
      "type": "real_world",
      "skill": "market_basics",
      "action": "save_watchlist",
      "ticker": "GOOGL",
      "company": "Alphabet",
      "prompt": "Your first real trade deserves a candidate you have studied. Put Alphabet on your watchlist and, when you are ready, build the five-line checklist around it before you ever click buy.",
      "cta": "Open my watchlist",
      "successText": "Alphabet is on your watchlist. A studied name plus a written checklist is the calm, professional way to place a first trade."
    }
  ]
}
$j$::jsonb where id = 'f1c00000-0001-0006-0002-000000000001';

-- ═══════════════════════════════════════════════════════════════════════════
-- FIC TEEN FOUNDATIONS (register: teen — sharper, direct, companies they know)
-- ═══════════════════════════════════════════════════════════════════════════

-- T1 — Compounding — Why Starting at 15 Beats 40
update lessons set steps_draft = $j$
{
  "schema": 1,
  "title": "Compounding — Why Starting at 15 Beats 40",
  "skills": ["market_basics", "growth"],
  "difficulty": 1,
  "audience": ["teen"],
  "duration_minutes": 4,
  "xp": 50,
  "guide": {
    "intro": "There is a cheat code nobody hands you at 15, and it is not a stock tip. It is compounding — and starting now is the whole advantage.",
    "outro": "You just proved to yourself why time beats money at your age. Every dollar you invest early gets the longest runway to grow. That is your edge."
  },
  "steps": [
    {
      "id": "t1-explain",
      "type": "explainer",
      "skill": "growth",
      "heading": "Your real superpower is time",
      "body": [
        "Here is the cheat code nobody tells you at 15: the earliest money you invest is worth the most, because it has the most time to grow. When you invest, your gains start making their own gains — that is compounding, a snowball that keeps rolling.",
        "A small amount invested at 15 can quietly beat a much bigger amount invested at 40, purely because it spent an extra 25 years compounding. Time does the heavy lifting, and time is the one thing you have way more of than almost any adult.",
        "So starting now is not about having a lot of money. It is about giving whatever you have the longest possible runway."
      ],
      "figure": { "kind": "stat", "value": "Time > money", "caption": "your unfair advantage" }
    },
    {
      "id": "t1-mc",
      "type": "multiple_choice",
      "skill": "market_basics",
      "question": "Jordan invests at 15, Alex invests the same amount at 40, and both stop at 60. Who ends up with way more?",
      "options": [
        "Alex — starting later is safer",
        "Jordan — 25 extra years of compounding",
        "They tie",
        "Depends on luck"
      ],
      "correctIndex": 1,
      "explanation": "Same money in, same fund — the only difference is Jordan's 25 extra years of compounding. That head start is almost impossible for a late starter to catch, no matter how the market moves.",
      "reinforce": "Yep. Jordan's edge is pure time, and time is unbeatable here."
    },
    {
      "id": "t1-tf",
      "type": "true_false",
      "skill": "growth",
      "statement": "Compounding adds the same dollar amount every year, like clockwork.",
      "answer": false,
      "explanation": "It grows on a curve, not a straight line. Each year builds on a bigger pile, so the gains get bigger over time — the snowball speeds up the longer it rolls.",
      "reinforce": "Right. It accelerates, which is exactly why the early years matter most."
    },
    {
      "id": "t1-match",
      "type": "match_pairs",
      "skill": "market_basics",
      "prompt": "Match each word to what it means.",
      "pairs": [
        { "left": "Principal", "right": "The money you put in" },
        { "left": "Return", "right": "What your money earns" },
        { "left": "Compounding", "right": "Gains that earn their own gains" },
        { "left": "Time horizon", "right": "How long you leave it growing" }
      ],
      "explanation": "You put in principal, it earns a return, that return compounds, and your time horizon decides how huge the snowball gets.",
      "reinforce": "That is the whole language of growing money."
    },
    {
      "id": "t1-predict",
      "type": "prediction",
      "skill": "growth",
      "question": "You invest in a solid company and reinvest every dividend for years instead of cashing it out. Compared with spending the dividends, where do you end up?",
      "options": [
        { "label": "Way ahead — reinvested dividends buy more shares", "value": "ahead" },
        { "label": "Behind", "value": "behind" },
        { "label": "Exactly the same", "value": "same" }
      ],
      "outcomeValue": "ahead",
      "reveal": {
        "headline": "Way ahead — the snowball feeds itself",
        "body": "Every reinvested dividend buys more shares, which pay more dividends, which buy even more shares. Over years that loop can become a huge chunk of your total gain. Reinvesting is basically compounding on easy mode."
      }
    },
    {
      "id": "t1-real",
      "type": "real_world",
      "skill": "growth",
      "action": "save_watchlist",
      "ticker": "NKE",
      "company": "Nike",
      "prompt": "Compounding needs a real company to grow on. Put Nike — a business you already know — on your watchlist as your first long-term hold to follow.",
      "cta": "Open my watchlist",
      "successText": "Nike is on your watchlist. Now you have a real company to watch compound over time, not just a theory."
    }
  ]
}
$j$::jsonb where id = 'f1c00000-0002-0001-0001-000000000001';

-- T3 — Candlesticks & Timeframes
update lessons set steps_draft = $j$
{
  "schema": 1,
  "title": "Candlesticks & Timeframes",
  "skills": ["technical_analysis"],
  "difficulty": 2,
  "audience": ["teen"],
  "duration_minutes": 4,
  "xp": 50,
  "guide": {
    "intro": "A chart looks like chaos until you can read one candle. Learn that and the whole wall of bars turns into a story you can follow.",
    "outro": "You can read a candle now, and you know why the same move looks different when you zoom in and out. That is the base every chart skill sits on."
  },
  "steps": [
    {
      "id": "t3-explain",
      "type": "explainer",
      "skill": "technical_analysis",
      "heading": "One candle = one battle",
      "body": [
        "A candlestick packs a whole slice of time into one shape. It shows four prices: where trading opened, the highest it hit, the lowest it dropped, and where it closed. The fat part — the body — runs from open to close.",
        "Colour tells you who won that round. Green means it closed higher than it opened, so buyers won. Red means it closed lower, so sellers won. The thin lines sticking out — the wicks — show how far price stretched before getting shoved back.",
        "String a bunch of candles together and you are literally watching a series of tug-of-wars, each one telling you who had the grip."
      ],
      "figure": { "kind": "stat", "value": "O H L C", "caption": "open · high · low · close" }
    },
    {
      "id": "t3-mc",
      "type": "multiple_choice",
      "skill": "technical_analysis",
      "question": "A daily candle is green with a long lower wick. What went down that day?",
      "options": [
        "Sellers dominated all day",
        "Price dropped hard, then buyers slammed it back up to close green",
        "Nothing moved",
        "The company got delisted"
      ],
      "correctIndex": 1,
      "explanation": "The long lower wick means price fell way below the open, but the green body means buyers dragged it back up to finish higher. Sellers swung, buyers answered harder.",
      "reinforce": "Exactly. That long lower wick is buyers defending the line."
    },
    {
      "id": "t3-tf",
      "type": "true_false",
      "skill": "technical_analysis",
      "statement": "The same day looks identical on a daily chart and a 5-minute chart.",
      "answer": false,
      "explanation": "One day is a single candle on the daily but dozens of candles on the 5-minute. Timeframe is your zoom — zoom in for detail, zoom out for the big picture.",
      "reinforce": "Right. Same action, totally different zoom."
    },
    {
      "id": "t3-match",
      "type": "match_pairs",
      "skill": "technical_analysis",
      "prompt": "Match each candle part to what it means.",
      "pairs": [
        { "left": "Body", "right": "Open-to-close range" },
        { "left": "Upper wick", "right": "Highest price before sellers pushed back" },
        { "left": "Lower wick", "right": "Lowest price before buyers pushed back" },
        { "left": "Colour", "right": "Who won — buyers or sellers" }
      ],
      "explanation": "Body for the result, wicks for the extremes, colour for the winner — one candle, fully decoded.",
      "reinforce": "That is a candle read top to bottom."
    },
    {
      "id": "t3-predict",
      "type": "prediction",
      "skill": "technical_analysis",
      "question": "A stock rips up for ten green candles, then prints one red one. Just from the candles, what is the smart read?",
      "options": [
        { "label": "One red after ten green is usually a pause, not the end", "value": "pause" },
        { "label": "The trend is dead, sell everything", "value": "dead" },
        { "label": "The chart glitched", "value": "glitch" }
      ],
      "outcomeValue": "pause",
      "reveal": {
        "headline": "Usually just a pause",
        "body": "One red candle inside a strong run is normal — sellers got one round. A real reversal shows up as a run of lower highs and lower lows over several candles, not a single red bar. Read candles in a sequence, not one at a time."
      }
    },
    {
      "id": "t3-real",
      "type": "real_world",
      "skill": "technical_analysis",
      "action": "research_ticker",
      "ticker": "AAPL",
      "company": "Apple",
      "prompt": "Go read real candles. Open Apple's chart and flip between the daily and a 5-minute view — watch the same move change shape as you zoom.",
      "cta": "Open Apple's chart",
      "successText": "You just read live candles. Every green and red bar is now a battle you can call."
    }
  ]
}
$j$::jsonb where id = 'f1c00000-0002-0002-0001-000000000001';

-- T4 — Support, Resistance & Trend
update lessons set steps_draft = $j$
{
  "schema": 1,
  "title": "Support, Resistance & Trend",
  "skills": ["technical_analysis"],
  "difficulty": 2,
  "audience": ["teen"],
  "duration_minutes": 4,
  "xp": 50,
  "guide": {
    "intro": "Price is not random. It remembers where it fought before. Once you can see those levels, a chart turns into a map.",
    "outro": "You can name a support, a resistance, and a trend now — and you know volume is what tells you whether to trust a move. That is chart-reading."
  },
  "steps": [
    {
      "id": "t4-explain",
      "type": "explainer",
      "skill": "technical_analysis",
      "heading": "Price remembers where it fought",
      "body": [
        "Support is a price floor — a level where buyers keep stepping in and stopping the fall. Resistance is the ceiling — a level where sellers keep taking over and capping the rise. These are not random; the market remembers them.",
        "Traders remember where a stock bounced or stalled last time and pile their orders around those prices, which makes the level real all over again. The trend is just which way those floors and ceilings are drifting: higher floors and higher ceilings mean an uptrend.",
        "Spot the levels, spot the trend, and a chart stops looking like chaos and starts looking like a map."
      ],
      "figure": { "kind": "stat", "value": "Floor · Ceiling", "caption": "support holds, resistance caps" }
    },
    {
      "id": "t4-mc",
      "type": "multiple_choice",
      "skill": "technical_analysis",
      "question": "A stock drops to $100 and bounces three times in two months. What is $100?",
      "options": [
        "Resistance",
        "Support — a floor buyers keep defending",
        "A dividend",
        "Random"
      ],
      "correctIndex": 1,
      "explanation": "A level price keeps dropping to and bouncing off is support — buyers show up there like clockwork. Every bounce makes it more respected.",
      "reinforce": "Right. Repeat bounces = support."
    },
    {
      "id": "t4-tf",
      "type": "true_false",
      "skill": "technical_analysis",
      "statement": "The trend is just which direction the highs and lows are drifting.",
      "answer": true,
      "explanation": "That is literally it. Higher highs and higher lows is an uptrend; lower highs and lower lows is a downtrend. Trend is direction, read straight off the levels.",
      "reinforce": "Exactly. Trend is the drift of the levels."
    },
    {
      "id": "t4-match",
      "type": "match_pairs",
      "skill": "technical_analysis",
      "prompt": "Match each term to what it means.",
      "pairs": [
        { "left": "Support", "right": "Floor where buyers step in" },
        { "left": "Resistance", "right": "Ceiling where sellers take over" },
        { "left": "Uptrend", "right": "Higher highs and higher lows" },
        { "left": "Volume", "right": "How much traded — the conviction behind a move" }
      ],
      "explanation": "Levels mark where price fights, trend marks the direction, volume tells you how much to trust it.",
      "reinforce": "That is a chart read in four words."
    },
    {
      "id": "t4-predict",
      "type": "prediction",
      "skill": "technical_analysis",
      "question": "A stock hits a resistance level it failed to break twice before — but this time it shows up on huge volume. More likely?",
      "options": [
        { "label": "It breaks through — big volume means real buying", "value": "break" },
        { "label": "It fails again", "value": "fail" },
        { "label": "It stops trading", "value": "halt" }
      ],
      "outcomeValue": "break",
      "reveal": {
        "headline": "Big volume tilts it toward a break",
        "body": "The first two tries fizzled because there was not enough buying behind them. Show up with a surge of volume and it means way more buyers are committed this time — that extra force is what finally cracks a level. Not guaranteed, but the odds shift."
      }
    },
    {
      "id": "t4-real",
      "type": "real_world",
      "skill": "technical_analysis",
      "action": "research_ticker",
      "ticker": "TSLA",
      "company": "Tesla",
      "prompt": "Open Tesla's chart and hunt for one level it keeps bouncing off or stalling at. Naming a real support or resistance is the whole skill.",
      "cta": "Open Tesla's chart",
      "successText": "You found a real level on a live chart. Now support and resistance are things you can point at."
    }
  ]
}
$j$::jsonb where id = 'f1c00000-0002-0002-0002-000000000001';

-- T5 — Chart Patterns & Indicators
update lessons set steps_draft = $j$
{
  "schema": 1,
  "title": "Chart Patterns & Indicators",
  "skills": ["technical_analysis"],
  "difficulty": 2,
  "audience": ["teen"],
  "duration_minutes": 4,
  "xp": 50,
  "guide": {
    "intro": "Patterns and indicators get hyped like cheat codes. They are not magic — they are lenses on what the crowd is doing. Used that way, they are actually useful.",
    "outro": "You know what a moving average, RSI, MACD, and a flag each tell you now — and that they are strongest when they agree, not when you obey one blindly."
  },
  "steps": [
    {
      "id": "t5-explain",
      "type": "explainer",
      "skill": "technical_analysis",
      "heading": "Patterns are crowd psychology in a shape",
      "body": [
        "A chart pattern is just a shape that keeps showing up because buyers and sellers keep repeating the same behaviour. A flag is a quick pause after a big move before it keeps going; a double top is price failing to break the same ceiling twice. The shape is the crowd's mood, drawn out.",
        "Indicators do the same thing with math. A moving average smooths price into one clean line so you can see the trend without the daily jitter. RSI tells you how stretched a move is, and MACD tells you if momentum is picking up or fading.",
        "None of them predict the future by themselves. They are lenses — and they are strongest when several of them agree."
      ],
      "figure": { "kind": "stat", "value": "Signal, not magic", "caption": "confirm, don't obey" }
    },
    {
      "id": "t5-mc",
      "type": "multiple_choice",
      "skill": "technical_analysis",
      "question": "What does a moving average actually do?",
      "options": [
        "Guarantees a pump",
        "Smooths price into one line so the trend is easy to see",
        "Reports earnings",
        "Sets the price"
      ],
      "correctIndex": 1,
      "explanation": "It averages recent prices into a single line so the trend stands out past the noise. It describes the trend — it does not control it.",
      "reinforce": "Right. It is a smoothing lens, not a crystal ball."
    },
    {
      "id": "t5-tf",
      "type": "true_false",
      "skill": "technical_analysis",
      "statement": "If RSI is high, you should always sell right now.",
      "answer": false,
      "explanation": "High RSI means a move is stretched, but strong trends can stay stretched for a long time while still climbing. It is a heads-up, not an auto-sell.",
      "reinforce": "Exactly. Overbought is a caution, not a command."
    },
    {
      "id": "t5-match",
      "type": "match_pairs",
      "skill": "technical_analysis",
      "prompt": "Match each tool to what it tells you.",
      "pairs": [
        { "left": "Moving average", "right": "The smoothed trend direction" },
        { "left": "RSI", "right": "How stretched a move is" },
        { "left": "MACD", "right": "Whether momentum is building or fading" },
        { "left": "Flag", "right": "A pause before the trend likely continues" }
      ],
      "explanation": "Trend, stretch, momentum, and continuation — four tools, four different questions answered.",
      "reinforce": "Four lenses, four answers."
    },
    {
      "id": "t5-predict",
      "type": "prediction",
      "skill": "technical_analysis",
      "question": "A stock in a strong uptrend prints a tidy little flag — a short pause — while volume dries up. What does the flag usually mean comes next?",
      "options": [
        { "label": "The uptrend resumes", "value": "resume" },
        { "label": "Bankruptcy", "value": "bankrupt" },
        { "label": "Sideways forever", "value": "sideways" }
      ],
      "outcomeValue": "resume",
      "reveal": {
        "headline": "Usually the trend resumes",
        "body": "A flag is a breather, not a reversal: buyers rest, volume fades because barely anyone is selling, and the original trend often kicks back in once the pause ends. Solid continuation pattern — still a probability, never a promise."
      }
    },
    {
      "id": "t5-real",
      "type": "real_world",
      "skill": "technical_analysis",
      "action": "research_ticker",
      "ticker": "NVDA",
      "company": "Nvidia",
      "prompt": "Open Nvidia's chart, add a moving average, and watch the line ride the trend under the noise. Seeing an indicator move on real price is how it clicks.",
      "cta": "Open Nvidia's chart",
      "successText": "You put an indicator on a live chart. Now the tools are yours to use, not just buzzwords."
    }
  ]
}
$j$::jsonb where id = 'f1c00000-0002-0003-0001-000000000001';

-- T6 — Earnings & Catalysts — Why Stocks Move
update lessons set steps_draft = $j$
{
  "schema": 1,
  "title": "Earnings & Catalysts — Why Stocks Move",
  "skills": ["financial_statements", "valuation"],
  "difficulty": 3,
  "audience": ["teen"],
  "duration_minutes": 4,
  "xp": 50,
  "guide": {
    "intro": "Charts show what price does. Earnings and news explain why. This is the part that makes a stock move make sense instead of feeling random.",
    "outro": "You get it now: price runs on expectations, not just results. That is why a company can post record numbers and still drop."
  },
  "steps": [
    {
      "id": "t6-explain",
      "type": "explainer",
      "skill": "financial_statements",
      "heading": "The news cycle behind the price",
      "body": [
        "Charts show what price is doing; earnings and news explain why. Earnings are just a company's profit, reported every three months, and over time price tends to follow profit — a company making more money is worth more.",
        "But price runs on expectations, not just results. The P/E ratio captures that: it is how many dollars investors will pay for each dollar of the company's yearly profit, and a high one means the crowd expects big growth ahead.",
        "Catalysts are the events that change the story — an earnings report, a viral product, a new law. They are the moments the market updates its opinion, and price jumps to catch up."
      ],
      "figure": { "kind": "stat", "value": "Price follows profit", "caption": "eventually" }
    },
    {
      "id": "t6-mc",
      "type": "multiple_choice",
      "skill": "financial_statements",
      "question": "A company posts record profits but the stock drops that day. How?",
      "options": [
        "The report was fake",
        "Investors expected even better, so 'record' still disappointed",
        "Records always drop stocks",
        "A glitch"
      ],
      "correctIndex": 1,
      "explanation": "Price trades the surprise, not the raw number. If everyone expected even bigger numbers, a merely-record result misses the bar the crowd already set — so it can fall on genuinely great earnings.",
      "reinforce": "Right. It is results versus expectations, every time."
    },
    {
      "id": "t6-tf",
      "type": "true_false",
      "skill": "valuation",
      "statement": "A high P/E ratio means investors expect the company to grow a lot.",
      "answer": true,
      "explanation": "A high P/E means people are paying up now for each dollar of current profit, and they only do that when they expect profits to climb. It measures the optimism baked into the price — which may or may not pay off.",
      "reinforce": "Exactly. P/E is expectations priced in."
    },
    {
      "id": "t6-match",
      "type": "match_pairs",
      "skill": "financial_statements",
      "prompt": "Match each term to its meaning.",
      "pairs": [
        { "left": "Earnings", "right": "The company's profit" },
        { "left": "P/E ratio", "right": "Price paid per dollar of yearly profit" },
        { "left": "Catalyst", "right": "An event that changes expectations" },
        { "left": "Revenue", "right": "Total money the company brought in" }
      ],
      "explanation": "Revenue up top, earnings the profit under it, P/E the price on that profit, catalysts the events that move it all.",
      "reinforce": "That is the fundamentals starter pack."
    },
    {
      "id": "t6-predict",
      "type": "prediction",
      "skill": "valuation",
      "question": "A hyped company has run up for weeks before earnings. It reports solid numbers — exactly what everyone expected. What often happens?",
      "options": [
        { "label": "It falls or stalls — the good news was already priced in", "value": "falls" },
        { "label": "It instantly doubles", "value": "doubles" },
        { "label": "It gets halted forever", "value": "halted" }
      ],
      "outcomeValue": "falls",
      "reveal": {
        "headline": "Often falls — already priced in",
        "body": "When a stock climbs for weeks on hype and then just meets expectations, there is no new surprise to push it higher, and people who bought the hype cash out. That is 'buy the rumour, sell the news' — why great earnings can still be a red day."
      }
    },
    {
      "id": "t6-real",
      "type": "real_world",
      "skill": "financial_statements",
      "action": "research_ticker",
      "ticker": "NFLX",
      "company": "Netflix",
      "prompt": "Open Netflix's research page and find its earnings and P/E. Reading real numbers is how the ratios stop being abstract.",
      "cta": "Open Netflix's research",
      "successText": "You looked at a real company's numbers. Fundamentals click fast when they are attached to a company you actually use."
    }
  ]
}
$j$::jsonb where id = 'f1c00000-0002-0003-0002-000000000001';

-- T7 — Calls & Puts Explained
update lessons set steps_draft = $j$
{
  "schema": 1,
  "title": "Calls & Puts Explained",
  "skills": ["risk"],
  "difficulty": 3,
  "audience": ["teen"],
  "duration_minutes": 4,
  "xp": 50,
  "guide": {
    "intro": "Options sound scary and complicated. The core idea is not: you are buying a right, not a must. Get that and the rest is just detail.",
    "outro": "Calls, puts, premium, time decay — you have the base now. That is enough to think clearly about any option before touching one."
  },
  "steps": [
    {
      "id": "t7-explain",
      "type": "explainer",
      "skill": "risk",
      "heading": "A right, not a must",
      "body": [
        "An option is a contract that gives you the right — not the obligation — to buy or sell a stock at a set price before a set date. A call is the right to buy; a put is the right to sell. You are buying choice: you only act if it works out.",
        "The price you pay for that right is the premium, and here is the key part — the premium is the most you can lose on a bought option. Your downside is capped at what you paid, while a good move can be worth a lot more.",
        "The catch is the clock. Every option expires, and its value drips away as expiry gets closer. So being right is not enough — you have to be right in time."
      ],
      "figure": { "kind": "stat", "value": "Right, not obligation", "caption": "premium = max loss" }
    },
    {
      "id": "t7-mc",
      "type": "multiple_choice",
      "skill": "risk",
      "question": "You buy a call for a $2 premium. Most you can lose?",
      "options": [
        "Unlimited",
        "The $2 premium",
        "The price of 100 shares",
        "Nothing"
      ],
      "correctIndex": 1,
      "explanation": "On a bought option your max loss is the premium — the $2. Worst case it expires worthless, but you can never lose more than you paid in.",
      "reinforce": "Right. A bought option caps your loss at the premium."
    },
    {
      "id": "t7-tf",
      "type": "true_false",
      "skill": "risk",
      "statement": "An option holds its full value right up to expiry day.",
      "answer": false,
      "explanation": "Options lose value as expiry nears — that is time decay. Same option, same everything, is worth less next week than today because there is less time for your move to happen.",
      "reinforce": "Exactly. The clock is always draining a bought option."
    },
    {
      "id": "t7-match",
      "type": "match_pairs",
      "skill": "risk",
      "prompt": "Match each option word to its meaning.",
      "pairs": [
        { "left": "Call", "right": "The right to buy" },
        { "left": "Put", "right": "The right to sell" },
        { "left": "Premium", "right": "What you pay (and your max loss)" },
        { "left": "Expiry", "right": "The date the right runs out" }
      ],
      "explanation": "Call to buy, put to sell, premium as the cost and the cap, expiry as the deadline — that is the whole frame.",
      "reinforce": "That is every option trade in four words."
    },
    {
      "id": "t7-predict",
      "type": "prediction",
      "skill": "risk",
      "question": "You buy a call expecting a jump. The stock rises — but slowly, and two weeks crawl by. What likely happened to your option?",
      "options": [
        { "label": "It lost value — time decay ate the small gain", "value": "fell" },
        { "label": "It doubled", "value": "doubled" },
        { "label": "Unchanged", "value": "unchanged" }
      ],
      "outcomeValue": "fell",
      "reveal": {
        "headline": "Probably lost value — time decay won",
        "body": "You nailed the direction but the move was too small and too slow. Day by day, time decay chewed the premium faster than the tiny rise added to it. With options, size and timing matter as much as direction — a slow drift your way can still lose."
      }
    },
    {
      "id": "t7-real",
      "type": "real_world",
      "skill": "risk",
      "action": "save_watchlist",
      "ticker": "SPOT",
      "company": "Spotify",
      "prompt": "Every option rides on a real stock. Put Spotify on your watchlist and study the business first — that is how smart option traders start.",
      "cta": "Open my watchlist",
      "successText": "Spotify is on your watchlist. Studying the underlying company first is exactly the right move."
    }
  ]
}
$j$::jsonb where id = 'f1c00000-0002-0004-0001-000000000001';

-- T8 — Why Options Can Grow (or Vaporize) Fast
update lessons set steps_draft = $j$
{
  "schema": 1,
  "title": "Why Options Can Grow (or Vaporize) Fast",
  "skills": ["risk", "market_psychology"],
  "difficulty": 4,
  "audience": ["teen"],
  "duration_minutes": 4,
  "xp": 50,
  "guide": {
    "intro": "The viral part of options is how fast they can multiply. The part nobody screenshots is how fast they vaporize. Both come from the same thing: leverage.",
    "outro": "You know the rule that keeps traders alive now — small, pre-decided bets so a wrong call is survivable. That is how leverage stays a tool, not a trap."
  },
  "steps": [
    {
      "id": "t8-explain",
      "type": "explainer",
      "skill": "risk",
      "heading": "Leverage cuts both ways",
      "body": [
        "Options give you leverage: a small premium can control a big chunk of stock, so a modest move can multiply your money fast. That is the part that goes viral. The part that does not go viral is that the same leverage can vaporize your premium just as fast.",
        "Leverage is neutral — it amplifies whatever you bring. Bring a clear reason and a small bet, and it magnifies a smart decision. Bring a hunch and your whole balance, and it magnifies a mistake at the exact same speed.",
        "The rule that keeps traders alive: risk only a small slice you have decided in advance, so a wrong call costs you a lesson, not your account."
      ],
      "figure": { "kind": "stat", "value": "Small bets", "caption": "so a wrong call survives" }
    },
    {
      "id": "t8-mc",
      "type": "multiple_choice",
      "skill": "risk",
      "question": "Safest way to size a leveraged options trade?",
      "options": [
        "Bet it all when you feel sure",
        "Risk only a small, pre-decided slice",
        "Never plan",
        "Double down after a loss"
      ],
      "correctIndex": 1,
      "explanation": "Feeling sure is not the same as being right, and leverage magnifies every outcome. A small fixed bet means a wrong call is survivable — and surviving is how you last long enough to win.",
      "reinforce": "Right. Small planned risk keeps you in the game."
    },
    {
      "id": "t8-tf",
      "type": "true_false",
      "skill": "market_psychology",
      "statement": "If you feel really confident, it is fine to skip writing down your reason.",
      "answer": false,
      "explanation": "Writing the reason turns a vibe into a testable plan — what you expect and why. Skip it and you cannot tell a smart trade from a gamble, or learn anything from how it ends.",
      "reinforce": "Exactly. No written reason means no real plan."
    },
    {
      "id": "t8-match",
      "type": "match_pairs",
      "skill": "risk",
      "prompt": "Match each habit to why it saves you.",
      "pairs": [
        { "left": "Written reason", "right": "Turns a hunch into a plan" },
        { "left": "Small bet size", "right": "Makes a wrong call survivable" },
        { "left": "Leverage", "right": "Amplifies your decision either way" },
        { "left": "Pre-set exit", "right": "Decides the loss before emotion does" }
      ],
      "explanation": "A reason to justify it, small size to survive it, respect for leverage, and an exit set in advance — that is the safety kit.",
      "reinforce": "That is how you use options without blowing up."
    },
    {
      "id": "t8-predict",
      "type": "prediction",
      "skill": "risk",
      "question": "Two traders buy the same call. One risks 2% of their account, one risks half. It expires worthless. A month later, who is still trading and recovering?",
      "options": [
        { "label": "The 2% trader — the loss was survivable", "value": "twopct" },
        { "label": "The 50% trader — big bets bounce back", "value": "fiftypct" },
        { "label": "Both fine", "value": "both" }
      ],
      "outcomeValue": "twopct",
      "reveal": {
        "headline": "The 2% trader is still standing",
        "body": "Same trade, same loss — but the 2% trader barely felt it and has plenty left to keep learning. The 50% trader took a hit no single normal trade should ever deliver. Staying alive is the whole game, and bet size is what buys survival."
      }
    },
    {
      "id": "t8-real",
      "type": "real_world",
      "skill": "market_psychology",
      "action": "research_ticker",
      "ticker": "AMD",
      "company": "AMD",
      "prompt": "Before any options trade, the reason comes from the business. Open AMD's research page and state one clear reason it might move. That sentence is your thesis.",
      "cta": "Open AMD's research",
      "successText": "You started a thesis from real research. That one clear 'why' is what turns a gamble into a plan."
    }
  ]
}
$j$::jsonb where id = 'f1c00000-0002-0004-0002-000000000001';

-- T9 — The 1-2% Rule & Position Sizing
update lessons set steps_draft = $j$
{
  "schema": 1,
  "title": "The 1-2% Rule & Position Sizing",
  "skills": ["risk", "portfolio_construction"],
  "difficulty": 3,
  "audience": ["teen"],
  "duration_minutes": 4,
  "xp": 50,
  "guide": {
    "intro": "The thing that separates a trader from a gambler is not picking winners. It is never losing enough to get knocked out. This lesson is that skill.",
    "outro": "You have the four risk tools now: the 1-2% rule, the stop, position size, and risk-reward. With these, being wrong stops being scary."
  },
  "steps": [
    {
      "id": "t9-explain",
      "type": "explainer",
      "skill": "risk",
      "heading": "Protect the money first",
      "body": [
        "Before you chase a profit, you decide how much you are willing to lose, because the only thing that ends a trader is running out of money. The 1-2% rule is the guardrail: never risk more than one or two percent of your account on a single trade.",
        "You enforce it with a stop — a price you have decided in advance to bail at. Your position size then comes straight from math: how far your stop is, and how much of your account that distance is allowed to cost. Stop and size get set together, before you click.",
        "Then you check the payoff: a trade that can make three for every one you risk is a good deal. With a ratio like that you can be wrong more than half the time and still come out ahead."
      ],
      "figure": { "kind": "stat", "value": "Risk 1-2%", "caption": "per trade, always" }
    },
    {
      "id": "t9-mc",
      "type": "multiple_choice",
      "skill": "risk",
      "question": "Why never risk more than 1-2% of your account on one trade?",
      "options": [
        "It is illegal",
        "So no single loss can seriously hurt your account",
        "Small trades always win",
        "Lower fees"
      ],
      "correctIndex": 1,
      "explanation": "Cap the loss at 1-2% and even a losing streak only dents you — never wipes you out. It keeps any one mistake small enough to survive and learn from.",
      "reinforce": "Right. The rule means one trade can never take you out."
    },
    {
      "id": "t9-tf",
      "type": "true_false",
      "skill": "risk",
      "statement": "You should set your stop-loss after you are already in and watching it move.",
      "answer": false,
      "explanation": "The stop is set before you enter, while you are calm. Deciding it mid-trade lets fear and hope drag the line — the exact emotions the stop exists to overrule.",
      "reinforce": "Exactly. The stop is a promise made before emotion shows up."
    },
    {
      "id": "t9-match",
      "type": "match_pairs",
      "skill": "portfolio_construction",
      "prompt": "Match each tool to its job.",
      "pairs": [
        { "left": "1-2% rule", "right": "Caps the loss on any one trade" },
        { "left": "Stop-loss", "right": "The pre-set exit price for a loser" },
        { "left": "Position size", "right": "How many shares keep risk within the rule" },
        { "left": "Risk-reward", "right": "What you can make versus what you risk" }
      ],
      "explanation": "The rule sets the ceiling, the stop sets the exit, size keeps you under it, and risk-reward makes the math work for you.",
      "reinforce": "That is risk management, four parts."
    },
    {
      "id": "t9-predict",
      "type": "prediction",
      "skill": "risk",
      "question": "A trader wins only 40% of the time — mostly losers. But each winner makes 3x what a loser costs, and they always risk the same small amount. Over 100 trades, profitable?",
      "options": [
        { "label": "Yes — the winners more than cover the losers", "value": "yes" },
        { "label": "No, you must win most trades", "value": "no" },
        { "label": "Impossible to say", "value": "unsure" }
      ],
      "outcomeValue": "yes",
      "reveal": {
        "headline": "Yes — the math wins at 40%",
        "body": "Forty winners at 3 units each make 120; sixty losers at 1 unit each cost 60. Clear profit while losing most of the time. That is why pros obsess over risk-reward and sizing, not win rate — a good ratio lets you be wrong a lot and still win."
      }
    },
    {
      "id": "t9-real",
      "type": "real_world",
      "skill": "portfolio_construction",
      "action": "save_watchlist",
      "ticker": "CMG",
      "company": "Chipotle",
      "prompt": "Sizing is easiest to practise on a steady business you would actually hold. Put Chipotle on your watchlist as a name to size a real practice position around.",
      "cta": "Open my watchlist",
      "successText": "Chipotle is on your watchlist. A stable business is the right place to rehearse sizing before real money."
    }
  ]
}
$j$::jsonb where id = 'f1c00000-0002-0005-0001-000000000001';

-- T10 — Psychology & the Journal
update lessons set steps_draft = $j$
{
  "schema": 1,
  "title": "Psychology & the Journal",
  "skills": ["market_psychology"],
  "difficulty": 3,
  "audience": ["teen"],
  "duration_minutes": 4,
  "xp": 50,
  "guide": {
    "intro": "You can know every setup and still lose, because your biggest opponent is your own reaction. This lesson is about beating that opponent.",
    "outro": "You know the emotions that wreck a plan and the one habit — the journal — that turns your mistakes into an actual edge."
  },
  "steps": [
    {
      "id": "t10-explain",
      "type": "explainer",
      "skill": "market_psychology",
      "heading": "Your biggest opponent is you",
      "body": [
        "The market is a machine for triggering emotions. Fear makes you dump a good position at the worst second. Greed makes you hold a winner till it flips to a loser. FOMO makes you chase a move you never planned. None of these care about your strategy — and if you let them, they run the show.",
        "The fix is not to feel nothing. It is to decide in advance and then follow the plan when the feelings hit. Rules you set before the market opens are your calm self protecting you from your reactive self.",
        "The trade journal is how that discipline levels up. Write down every trade — the reason, the emotion, the result — and hidden patterns become obvious, so you can fix the exact mistakes you keep repeating."
      ],
      "figure": { "kind": "stat", "value": "Plans over feelings", "caption": "the journal proves it" }
    },
    {
      "id": "t10-mc",
      "type": "multiple_choice",
      "skill": "market_psychology",
      "question": "You planned to exit at a set loss, but when it hits you feel sure it will bounce, so you move the stop lower. That is...",
      "options": [
        "Smart flexibility",
        "The exact emotional mistake the plan exists to stop",
        "Good risk management",
        "Required by the rules"
      ],
      "correctIndex": 1,
      "explanation": "Moving the stop to dodge a planned loss is hope overriding the plan — it turns a small decided loss into an open-ended one. That is the precise failure the pre-set stop was built to prevent.",
      "reinforce": "Right. The plan only works if you keep it when it is hard."
    },
    {
      "id": "t10-tf",
      "type": "true_false",
      "skill": "market_psychology",
      "statement": "A trade journal mostly helps by showing the mistakes you keep repeating.",
      "answer": true,
      "explanation": "A journal makes patterns visible — the setup that keeps failing, the emotion that keeps costing you. You cannot fix a habit you cannot see, and the journal is what lets you see it.",
      "reinforce": "Exactly. It turns invisible habits into fixable ones."
    },
    {
      "id": "t10-match",
      "type": "match_pairs",
      "skill": "market_psychology",
      "prompt": "Match each emotion to the mistake it drives.",
      "pairs": [
        { "left": "Fear", "right": "Selling a good position too early" },
        { "left": "Greed", "right": "Holding a winner until it reverses" },
        { "left": "FOMO", "right": "Chasing a move you never planned" },
        { "left": "Revenge", "right": "Forcing trades to win a loss back" }
      ],
      "explanation": "Each feeling pushes a specific error — and naming it in the moment is the first step to not obeying it.",
      "reinforce": "Name the feeling, take back the call."
    },
    {
      "id": "t10-predict",
      "type": "prediction",
      "skill": "market_psychology",
      "question": "You take a painful loss, then immediately jump into an unplanned trade to win it back fast. How do these revenge trades usually go?",
      "options": [
        { "label": "Badly — driven by emotion, not a plan", "value": "badly" },
        { "label": "Great — motivation helps", "value": "great" },
        { "label": "Exactly break-even", "value": "even" }
      ],
      "outcomeValue": "badly",
      "reveal": {
        "headline": "Usually badly — emotion is driving",
        "body": "A revenge trade skips the reason and the sizing because its real job is to soothe a feeling, not to express an edge — so it usually digs the hole deeper. The pro move after a loss is to log it, step back, and only take the next trade when it fits your rules, not your mood."
      }
    },
    {
      "id": "t10-real",
      "type": "real_world",
      "skill": "market_psychology",
      "action": "save_watchlist",
      "ticker": "DUOL",
      "company": "Duolingo",
      "prompt": "Discipline is easier building on one calm name than chasing ten. Put Duolingo on your watchlist and commit to only acting on it with a written plan.",
      "cta": "Open my watchlist",
      "successText": "Duolingo is on your watchlist. One name, watched patiently and traded only by plan, is how you build real discipline."
    }
  ]
}
$j$::jsonb where id = 'f1c00000-0002-0005-0002-000000000001';

-- T11 — Paper Trading Setup
update lessons set steps_draft = $j$
{
  "schema": 1,
  "title": "Paper Trading Setup",
  "skills": ["market_basics"],
  "difficulty": 2,
  "audience": ["teen"],
  "duration_minutes": 4,
  "xp": 50,
  "guide": {
    "intro": "You would not play your first game in the championship. Paper trading is the scrimmage — real prices, fake money, free mistakes.",
    "outro": "You know why paper trading works and why it only works if you take it seriously. Practise like it is real and the habits carry straight over."
  },
  "steps": [
    {
      "id": "t11-explain",
      "type": "explainer",
      "skill": "market_basics",
      "heading": "Practice with fake money, keep the real skills",
      "body": [
        "Paper trading means placing trades with pretend money in a simulator that uses real prices. Every entry, exit, and result is real except the cash — which makes it the perfect place to make your beginner mistakes for free.",
        "It matters because trading is a skill, and skills need reps. You would not play your first-ever game in the championship; paper trading is the scrimmage where you learn how orders fill, how it feels to watch a position move, and whether your plan actually holds up.",
        "Treat it seriously — real position sizes, a written plan for every trade — and the habits you build carry straight over when real money is on the line."
      ],
      "figure": { "kind": "stat", "value": "Real prices, fake cash", "caption": "free reps" }
    },
    {
      "id": "t11-mc",
      "type": "multiple_choice",
      "skill": "market_basics",
      "question": "What is the point of paper trading?",
      "options": [
        "To win pretend trophies",
        "To practise the full skill with real prices but no money at risk",
        "To guarantee real profits later",
        "Nothing, it is a waste"
      ],
      "correctIndex": 1,
      "explanation": "Paper trading lets you rehearse the entire process — orders, sizing, watching a position — using live prices so it feels real, but with zero money at risk. It is where you make your rookie mistakes for free.",
      "reinforce": "Right. It is the free scrimmage before the real game."
    },
    {
      "id": "t11-tf",
      "type": "true_false",
      "skill": "market_basics",
      "statement": "You should treat paper trades casually since the money is not real.",
      "answer": false,
      "explanation": "Casual paper trading builds casual habits. If you use real position sizes and a written plan every time, the discipline you build actually transfers — sloppy practice just teaches you to be sloppy.",
      "reinforce": "Exactly. Practise like it is real so the habits carry over."
    },
    {
      "id": "t11-match",
      "type": "match_pairs",
      "skill": "market_basics",
      "prompt": "Match each idea to what it means.",
      "pairs": [
        { "left": "Paper trade", "right": "A trade with pretend money and real prices" },
        { "left": "Simulator", "right": "The tool you practise in" },
        { "left": "Position size", "right": "How much you put in each practice trade" },
        { "left": "Written plan", "right": "The reason and exit you set before entering" }
      ],
      "explanation": "A simulator lets you place paper trades at real sizes with a real plan — the whole workflow, minus the money risk.",
      "reinforce": "That is the practice setup, start to finish."
    },
    {
      "id": "t11-predict",
      "type": "prediction",
      "skill": "market_basics",
      "question": "Someone paper trades for a month but bets wildly, no plan, no sizing — then goes live with real money. What likely happens?",
      "options": [
        { "label": "They repeat the same sloppy habits with real money", "value": "sloppy" },
        { "label": "They magically become disciplined", "value": "magic" },
        { "label": "Nothing changes at all", "value": "nothing" }
      ],
      "outcomeValue": "sloppy",
      "reveal": {
        "headline": "The bad habits come with them",
        "body": "Practice does not make perfect — it makes permanent. A month of reckless paper trades just rehearses reckless behaviour, and going live simply adds real money to the same habits. The value of paper trading is entirely in how seriously you take it."
      }
    },
    {
      "id": "t11-real",
      "type": "real_world",
      "skill": "market_basics",
      "action": "save_watchlist",
      "ticker": "AAPL",
      "company": "Apple",
      "prompt": "Your practice needs a real name to trade. Put Apple on your watchlist, then run your first serious paper trade on it — real size, written plan.",
      "cta": "Open my watchlist",
      "successText": "Apple is on your watchlist. Now you have a real stock to run disciplined practice trades on."
    }
  ]
}
$j$::jsonb where id = 'f1c00000-0002-0006-0001-000000000001';

-- T12 — The First-Trade Checklist
update lessons set steps_draft = $j$
{
  "schema": 1,
  "title": "The First-Trade Checklist",
  "skills": ["market_basics", "risk"],
  "difficulty": 3,
  "audience": ["teen"],
  "duration_minutes": 4,
  "xp": 50,
  "guide": {
    "intro": "The difference between a real decision and a random click is five lines written down first. This is the checklist every trade — practice or real — should pass.",
    "outro": "You have the five-line checklist now: thesis, entry, stop, size, exit. Pros are not calmer by nature; they just refuse to enter without it."
  },
  "steps": [
    {
      "id": "t12-explain",
      "type": "explainer",
      "skill": "market_basics",
      "heading": "Every trade gets a written plan",
      "body": [
        "A checklist is what turns a random click into a real decision. Before any trade — practice or real — you write down five things: your thesis (why you expect a move), your entry (where you get in), your stop (where you bail if wrong), your size (how much), and your exit (where you take the win).",
        "Those five lines do two jobs. They force you to actually have a reason before you risk anything, and they give you something to review afterward — so a losing trade becomes a lesson instead of just a bad feeling.",
        "Pros are not more emotional or less; they just refuse to enter without the plan. The checklist is the boring habit that makes everything else work."
      ],
      "figure": { "kind": "stat", "value": "5 lines", "caption": "thesis · entry · stop · size · exit" }
    },
    {
      "id": "t12-mc",
      "type": "multiple_choice",
      "skill": "market_basics",
      "question": "What does the first-trade checklist force you to do?",
      "options": [
        "Trade more often",
        "Have a written reason and an exit before you risk anything",
        "Beat every trade",
        "Skip the boring parts"
      ],
      "correctIndex": 1,
      "explanation": "Writing the thesis, stop, size, and exit before you click means you never enter on pure impulse — and you always have a pre-decided point to get out. That is what separates a plan from a gamble.",
      "reinforce": "Right. No plan on paper, no trade."
    },
    {
      "id": "t12-tf",
      "type": "true_false",
      "skill": "risk",
      "statement": "You can decide your exit later, once you see how the trade goes.",
      "answer": false,
      "explanation": "Deciding the exit after entering lets hope and fear move the line. The exit is set in the calm before the trade, when you can think clearly — that is the entire point of writing it down first.",
      "reinforce": "Exactly. The exit is decided before emotion gets a vote."
    },
    {
      "id": "t12-match",
      "type": "match_pairs",
      "skill": "risk",
      "prompt": "Match each checklist line to its job.",
      "pairs": [
        { "left": "Thesis", "right": "Why you expect the move" },
        { "left": "Entry", "right": "Where you get in" },
        { "left": "Stop", "right": "Where you exit if wrong" },
        { "left": "Exit", "right": "Where you take the win" }
      ],
      "explanation": "Reason, entry, protection, and payoff — four of the five lines, plus size, and you have a complete, reviewable trade.",
      "reinforce": "That is a disciplined entry on one card."
    },
    {
      "id": "t12-predict",
      "type": "prediction",
      "skill": "risk",
      "question": "A first-timer skips the checklist, buys on hype, no stop, no exit in mind. It drops 15%. Why does it usually become a big loss?",
      "options": [
        { "label": "With no pre-set stop or exit, nothing tells them when to get out", "value": "nostop" },
        { "label": "Hype trades are cursed", "value": "cursed" },
        { "label": "The stock was broken", "value": "broken" }
      ],
      "outcomeValue": "nostop",
      "reveal": {
        "headline": "No plan means no exit",
        "body": "With no stop and no written exit, there is no pre-decided point to cut it, so hope takes over and a small loss is allowed to grow. The checklist is not busywork — it is the thing that would have named the exit before emotion showed up. Boring on purpose."
      }
    },
    {
      "id": "t12-real",
      "type": "real_world",
      "skill": "market_basics",
      "action": "save_watchlist",
      "ticker": "NVDA",
      "company": "Nvidia",
      "prompt": "Your first real trade deserves a name you have studied. Put Nvidia on your watchlist and, when you are ready, build the five-line checklist around it before you ever buy.",
      "cta": "Open my watchlist",
      "successText": "Nvidia is on your watchlist. A studied name plus a written checklist is the calm way to place a first trade."
    }
  ]
}
$j$::jsonb where id = 'f1c00000-0002-0006-0002-000000000001';

-- ═══════════════════════════════════════════════════════════════════════════
-- FIC KIDS CORNER (register: kid — vivid, simple, warm; COMPLIANCE FLOOR:
-- NO stock-price predictions. Prediction blocks use BUSINESS outcomes only.)
-- ═══════════════════════════════════════════════════════════════════════════

-- K1 — What Is Money (and Why Prices Sneak Up)
update lessons set steps_draft = $j$
{
  "schema": 1,
  "title": "What Is Money (and Why Prices Sneak Up)",
  "skills": ["market_basics"],
  "difficulty": 1,
  "audience": ["kid"],
  "duration_minutes": 4,
  "xp": 50,
  "guide": {
    "intro": "Money is something you use every day — but it has a sneaky secret. Ready to find out what it is?",
    "outro": "You cracked the secret of money and inflation! Now you know why smart families help their money grow instead of letting it sit still."
  },
  "steps": [
    {
      "id": "k1-explain",
      "type": "explainer",
      "skill": "market_basics",
      "heading": "Money that sits still slowly shrinks",
      "body": [
        "Money is what we trade for the things we want — snacks, games, shoes. But here is a sneaky secret: money slowly loses a little bit of its power over time. A dollar today usually buys a tiny bit more than that same dollar will buy next year.",
        "That slow shrinking is called inflation. Prices creep up a little each year, so the same money buys a little less. It is like a very slow shrink ray pointed at your piggy bank.",
        "That is why smart families do not just let money sit still. They put some of it to work, so it can grow faster than the shrink ray shrinks it."
      ],
      "figure": { "kind": "stat", "value": "Prices creep up", "caption": "meet inflation" }
    },
    {
      "id": "k1-mc",
      "type": "multiple_choice",
      "skill": "market_basics",
      "question": "Your $10 sits in a jar for a few years. What does inflation do to it?",
      "options": [
        "Makes it buy MORE stuff",
        "Makes it buy a little LESS stuff over time",
        "Turns it into $20",
        "Nothing ever"
      ],
      "correctIndex": 1,
      "explanation": "Inflation means prices slowly go up, so the same $10 buys a little less as the years pass. Your money did not disappear — but its shopping power shrank.",
      "reinforce": "Yes! Money in a jar slowly loses shopping power. That is inflation."
    },
    {
      "id": "k1-tf",
      "type": "true_false",
      "skill": "market_basics",
      "statement": "Prices for things usually go UP a little bit every year.",
      "answer": true,
      "trueLabel": "True",
      "falseLabel": "False",
      "explanation": "Most years, things cost a little more than the year before — a candy bar, a movie ticket, a pair of shoes. That slow climb is inflation, and it is why money needs to grow.",
      "reinforce": "Right! Prices usually sneak up a little each year."
    },
    {
      "id": "k1-match",
      "type": "match_pairs",
      "skill": "market_basics",
      "prompt": "Match each money word to what it means.",
      "pairs": [
        { "left": "Money", "right": "What we trade for things we want" },
        { "left": "Inflation", "right": "When prices slowly go up over time" },
        { "left": "Saving", "right": "Keeping money for later" },
        { "left": "Investing", "right": "Putting money to work so it can grow" }
      ],
      "explanation": "You earn money, inflation makes prices climb, saving keeps money safe, and investing helps it grow faster than prices.",
      "reinforce": "Those are the four big money words!"
    },
    {
      "id": "k1-predict",
      "type": "prediction",
      "skill": "market_basics",
      "question": "A lemonade stand keeps ALL its money in a jar and never buys more lemons. Next summer, lemons cost more than before. Can the stand still make as much lemonade?",
      "options": [
        { "label": "No — the same money buys fewer lemons now", "value": "no" },
        { "label": "Yes — money never changes", "value": "yes" },
        { "label": "It makes twice as much", "value": "double" }
      ],
      "outcomeValue": "no",
      "reveal": {
        "headline": "Fewer lemons for the same money",
        "body": "Because prices sneaked up, the jar of money buys fewer lemons than it used to. The stand did not lose its money — but its money got a little weaker. That is exactly why letting money sit still is risky, and why we learn to grow it instead."
      }
    },
    {
      "id": "k1-real",
      "type": "real_world",
      "skill": "market_basics",
      "action": "save_watchlist",
      "ticker": "MCD",
      "company": "McDonald's",
      "prompt": "Money can grow when you own a piece of a strong company. Ask a grown-up to help you add McDonald's — a company your family probably knows — to your family watchlist.",
      "cta": "Open the watchlist",
      "successText": "McDonald's is on your family watchlist! Now you can watch a real company you know, together."
    }
  ]
}
$j$::jsonb where id = 'f1c00000-0003-0001-0001-000000000001';

-- K2 — The Ways People Make Money
update lessons set steps_draft = $j$
{
  "schema": 1,
  "title": "The Ways People Make Money",
  "skills": ["market_basics"],
  "difficulty": 1,
  "audience": ["kid"],
  "duration_minutes": 4,
  "xp": 50,
  "guide": {
    "intro": "There is more than one way to make money. Let's fill up four buckets and find out what they are!",
    "outro": "You know all four money buckets now — job, business, investing, and trading. That is a superpower most grown-ups never learn!"
  },
  "steps": [
    {
      "id": "k2-explain",
      "type": "explainer",
      "skill": "market_basics",
      "heading": "Four buckets money can come from",
      "body": [
        "There are a few different ways grown-ups make money, and they fit into four buckets. The first is a job — you work, and someone pays you for your time. The second is a business — you sell something people want, like a lemonade stand or a bakery.",
        "The third bucket is investing — you own a piece of a company, and if the company grows, your piece grows too. The fourth is trading — buying and selling to try to catch price moves, which is faster but trickier.",
        "Most families use more than one bucket. Understanding all four is the first step to filling your own buckets one day."
      ],
      "figure": { "kind": "stat", "value": "4 buckets", "caption": "job · business · investing · trading" }
    },
    {
      "id": "k2-mc",
      "type": "multiple_choice",
      "skill": "market_basics",
      "question": "You OWN a tiny piece of a big company, and the company grows. Which bucket is that?",
      "options": [
        "A job",
        "Investing",
        "Just luck",
        "A chore"
      ],
      "correctIndex": 1,
      "explanation": "Owning a piece of a company and letting it grow is investing. You are not trading your time like a job — you are letting your money work while the company gets bigger.",
      "reinforce": "Yes! Owning a piece and letting it grow is investing."
    },
    {
      "id": "k2-tf",
      "type": "true_false",
      "skill": "market_basics",
      "statement": "A job is the ONLY way people can make money.",
      "answer": false,
      "trueLabel": "True",
      "falseLabel": "False",
      "explanation": "A job is just one bucket. People also make money from businesses, from investing in companies, and from trading. Knowing all four gives you more ways to grow.",
      "reinforce": "Right — a job is only one of four buckets!"
    },
    {
      "id": "k2-match",
      "type": "match_pairs",
      "skill": "market_basics",
      "prompt": "Match each way to make money to what it is.",
      "pairs": [
        { "left": "Job", "right": "Getting paid for your time" },
        { "left": "Business", "right": "Selling something people want" },
        { "left": "Investing", "right": "Owning a piece of a company as it grows" },
        { "left": "Trading", "right": "Buying and selling to catch price moves" }
      ],
      "explanation": "Job for your time, business for your product, investing for your ownership, trading for your quick moves — four buckets.",
      "reinforce": "You know all four money buckets now!"
    },
    {
      "id": "k2-predict",
      "type": "prediction",
      "skill": "market_basics",
      "question": "Maya opens a cookie business and everyone in town LOVES her cookies, so more and more people buy them every week. What happens to her business?",
      "options": [
        { "label": "It grows — more happy customers means more sales", "value": "grows" },
        { "label": "It shrinks", "value": "shrinks" },
        { "label": "It disappears", "value": "disappears" }
      ],
      "outcomeValue": "grows",
      "reveal": {
        "headline": "More customers, bigger business",
        "body": "When lots of people love what you sell and keep coming back, your business grows — you sell more cookies and take in more money. That is the whole idea behind a strong business, and it is exactly what investors look for when they pick companies to own."
      }
    },
    {
      "id": "k2-real",
      "type": "real_world",
      "skill": "market_basics",
      "action": "save_watchlist",
      "ticker": "DIS",
      "company": "Disney",
      "prompt": "Investing means owning a piece of a company. Ask a grown-up to help you add Disney to your family watchlist — a company you could own a tiny piece of one day.",
      "cta": "Open the watchlist",
      "successText": "Disney is on your family watchlist! You just picked a real company to follow like a part-owner."
    }
  ]
}
$j$::jsonb where id = 'f1c00000-0003-0001-0002-000000000001';

-- K3 — Owning a Piece of Roblox & Nike
update lessons set steps_draft = $j$
{
  "schema": 1,
  "title": "Owning a Piece of Roblox & Nike",
  "skills": ["stock_ownership"],
  "difficulty": 1,
  "audience": ["kid"],
  "duration_minutes": 4,
  "xp": 50,
  "guide": {
    "intro": "What if you could own a tiny piece of Roblox or Nike? Guess what — you can! Let's find out how.",
    "outro": "You just learned the biggest secret of investing: a stock is a tiny slice of a real company. Now you can be a tiny owner, not just a fan!"
  },
  "steps": [
    {
      "id": "k3-explain",
      "type": "explainer",
      "skill": "stock_ownership",
      "heading": "A stock is a tiny slice of a real company",
      "body": [
        "Here is something amazing: you can own a tiny piece of the companies you already love. A stock is one little slice of a real company — like Roblox or Nike.",
        "Imagine a giant pizza cut into a million slices. If you have one slice, you own one-millionth of the whole pizza. A stock works the same way — one share is one slice of the whole company.",
        "So instead of only buying the shoes, you could own a tiny piece of the company that makes them. When the company does well, your little slice does well too."
      ],
      "figure": { "kind": "stat", "value": "1 share = 1 slice", "caption": "of a real company" }
    },
    {
      "id": "k3-mc",
      "type": "multiple_choice",
      "skill": "stock_ownership",
      "question": "You own one share of Roblox. What do you really own?",
      "options": [
        "Free Robux forever",
        "A tiny piece of the actual company",
        "A new game",
        "Nothing"
      ],
      "correctIndex": 1,
      "explanation": "A share is a real slice of the company itself — not free stuff. If Roblox the company grows, your little slice grows with it.",
      "reinforce": "Yes! One share is a tiny piece of the real company."
    },
    {
      "id": "k3-tf",
      "type": "true_false",
      "skill": "stock_ownership",
      "statement": "Owning a stock means you own a tiny piece of a real company.",
      "answer": true,
      "trueLabel": "True",
      "falseLabel": "False",
      "explanation": "Exactly right. A stock is a slice of a real business — its buildings, its brand, its future. Own a share and you are a tiny owner.",
      "reinforce": "True! A stock makes you a tiny owner."
    },
    {
      "id": "k3-match",
      "type": "match_pairs",
      "skill": "stock_ownership",
      "prompt": "Match each word to what it means.",
      "pairs": [
        { "left": "Stock", "right": "A tiny slice of a company" },
        { "left": "Share", "right": "One piece you can own" },
        { "left": "Owner", "right": "Someone who holds a slice" },
        { "left": "Company", "right": "The whole business, like Nike" }
      ],
      "explanation": "A company is the whole pizza, a share is one slice, a stock is that slice, and owning one makes you an owner.",
      "reinforce": "You know what it means to own a slice now!"
    },
    {
      "id": "k3-real",
      "type": "real_world",
      "skill": "stock_ownership",
      "action": "save_watchlist",
      "ticker": "NKE",
      "company": "Nike",
      "prompt": "Time to pick your first slice! Ask a grown-up to help you add Nike to your family watchlist — a company you can start following like a tiny owner.",
      "cta": "Open the watchlist",
      "successText": "Nike is on your family watchlist! You just picked your first company to follow like an owner, not just a shopper."
    }
  ]
}
$j$::jsonb where id = 'f1c00000-0003-0002-0001-000000000001';

-- K4 — The Stock Market — Where Everyone Trades
update lessons set steps_draft = $j$
{
  "schema": 1,
  "title": "The Stock Market — Where Everyone Trades",
  "skills": ["stock_ownership", "market_basics"],
  "difficulty": 1,
  "audience": ["kid"],
  "duration_minutes": 4,
  "xp": 50,
  "guide": {
    "intro": "If a stock is a slice of a company, where do people buy and sell those slices? Let's visit the giant store!",
    "outro": "Now you know what the stock market really is — a giant store where buyers and sellers agree on prices all day long."
  },
  "steps": [
    {
      "id": "k4-explain",
      "type": "explainer",
      "skill": "stock_ownership",
      "heading": "The giant store for company slices",
      "body": [
        "If a stock is a slice of a company, where do you buy and sell those slices? At the stock market. Think of it as a giant, busy store — but instead of toys, people are trading tiny pieces of companies all day long.",
        "In this store, some people want to buy slices and some want to sell them. When a buyer and a seller agree on a price, a trade happens. That is going on thousands of times every second.",
        "Nobody is in charge of the prices. They come from all those buyers and sellers agreeing, over and over, all day."
      ],
      "figure": { "kind": "stat", "value": "A giant store", "caption": "for company slices" }
    },
    {
      "id": "k4-mc",
      "type": "multiple_choice",
      "skill": "stock_ownership",
      "question": "What is the stock market?",
      "options": [
        "A place that sells groceries",
        "A giant place where people buy and sell pieces of companies",
        "A video game",
        "A bank vault"
      ],
      "correctIndex": 1,
      "explanation": "The stock market is like a huge store where people trade tiny pieces of companies all day. Buyers and sellers meet there and agree on prices.",
      "reinforce": "Yes! It is the giant store for buying and selling company slices."
    },
    {
      "id": "k4-tf",
      "type": "true_false",
      "skill": "market_basics",
      "statement": "One important person decides all the stock prices.",
      "answer": false,
      "trueLabel": "True",
      "falseLabel": "False",
      "explanation": "Nobody is the boss of prices! A price is just where a buyer and a seller agree to trade right now. It changes all day as different people agree on different prices.",
      "reinforce": "Right — no one person decides. Buyers and sellers agree together!"
    },
    {
      "id": "k4-match",
      "type": "match_pairs",
      "skill": "market_basics",
      "prompt": "Match each word to what it means.",
      "pairs": [
        { "left": "Stock market", "right": "Where company slices are traded" },
        { "left": "Buyer", "right": "Someone who wants to buy a slice" },
        { "left": "Seller", "right": "Someone who wants to sell a slice" },
        { "left": "Price", "right": "What a buyer and seller agree on" }
      ],
      "explanation": "Buyers and sellers meet at the stock market and agree on a price — that is a trade!",
      "reinforce": "You know how the giant store works now!"
    },
    {
      "id": "k4-predict",
      "type": "prediction",
      "skill": "stock_ownership",
      "question": "A toy company makes a new toy that EVERY kid wants, and stores keep selling out. Do you think MORE people or FEWER people want to own a piece of that company?",
      "options": [
        { "label": "More people — everyone can see it is doing great", "value": "more" },
        { "label": "Fewer people", "value": "fewer" },
        { "label": "Nobody cares", "value": "nobody" }
      ],
      "outcomeValue": "more",
      "reveal": {
        "headline": "More people want in",
        "body": "When a company is clearly doing great, more people want to own a piece of it — just like more kids want the toy everyone is talking about. Lots of people wanting the same thing is a big part of what makes a company popular to own."
      }
    },
    {
      "id": "k4-real",
      "type": "real_world",
      "skill": "stock_ownership",
      "action": "save_watchlist",
      "ticker": "AAPL",
      "company": "Apple",
      "prompt": "Now visit the giant store yourself! Ask a grown-up to help you add Apple to your family watchlist so you can follow it in the market.",
      "cta": "Open the watchlist",
      "successText": "Apple is on your family watchlist! Now you can watch a real company in the giant store, together."
    }
  ]
}
$j$::jsonb where id = 'f1c00000-0003-0002-0002-000000000001';

-- K5 — Candles: Green Teams vs Red Teams
update lessons set steps_draft = $j$
{
  "schema": 1,
  "title": "Candles: Green Teams vs Red Teams",
  "skills": ["technical_analysis"],
  "difficulty": 1,
  "audience": ["kid"],
  "duration_minutes": 4,
  "xp": 50,
  "guide": {
    "intro": "Those little shapes on a stock chart are called candles — and each one is a tug-of-war between two teams! Let's meet them.",
    "outro": "You can read the tug-of-war now! Green means buyers won, red means sellers won. You are reading charts like a pro."
  },
  "steps": [
    {
      "id": "k5-explain",
      "type": "explainer",
      "skill": "technical_analysis",
      "heading": "Every candle is a tug-of-war",
      "body": [
        "On a stock chart, each little shape is called a candle, and every candle is a tug-of-war between two teams. The green team is the buyers, who want the price to go up. The red team is the sellers, who want it to go down.",
        "If the candle is green, the buyers won that round and the price finished higher. If the candle is red, the sellers won and the price finished lower. It is that simple.",
        "So a chart full of candles is really a chart full of tiny tug-of-war battles, one after another. Once you know the teams, you can read who is winning."
      ],
      "figure": { "kind": "stat", "value": "Green = buyers win", "caption": "red = sellers win" }
    },
    {
      "id": "k5-mc",
      "type": "multiple_choice",
      "skill": "technical_analysis",
      "question": "A candle on the chart is GREEN. Who won that tug-of-war?",
      "options": [
        "The sellers",
        "The buyers — the price finished higher",
        "Nobody",
        "The referee"
      ],
      "correctIndex": 1,
      "explanation": "Green means the buyers won that round and pulled the price up. Red would mean the sellers won and pushed it down.",
      "reinforce": "Yes! Green candle = buyers won that round."
    },
    {
      "id": "k5-tf",
      "type": "true_false",
      "skill": "technical_analysis",
      "statement": "A red candle means the SELLERS won that tug-of-war.",
      "answer": true,
      "trueLabel": "True",
      "falseLabel": "False",
      "explanation": "Right! Red means the sellers pulled harder and the price finished lower. Green means the buyers won. Each candle shows you who won one round.",
      "reinforce": "True! The red team (sellers) won that one."
    },
    {
      "id": "k5-match",
      "type": "match_pairs",
      "skill": "technical_analysis",
      "prompt": "Match each part to what it means.",
      "pairs": [
        { "left": "Green candle", "right": "Buyers won, price went up" },
        { "left": "Red candle", "right": "Sellers won, price went down" },
        { "left": "Buyers", "right": "The team that wants prices up" },
        { "left": "Sellers", "right": "The team that wants prices down" }
      ],
      "explanation": "Buyers are the green team pulling up, sellers are the red team pulling down, and the candle's colour shows who won.",
      "reinforce": "You can read the tug-of-war teams now!"
    },
    {
      "id": "k5-real",
      "type": "real_world",
      "skill": "technical_analysis",
      "action": "save_watchlist",
      "ticker": "NFLX",
      "company": "Netflix",
      "prompt": "Let's watch a real tug-of-war! Ask a grown-up to add Netflix to your family watchlist so you can peek at its green and red candles.",
      "cta": "Open the watchlist",
      "successText": "Netflix is on your family watchlist! Now you can watch real green and red tug-of-wars whenever you want."
    }
  ]
}
$j$::jsonb where id = 'f1c00000-0003-0003-0001-000000000001';

-- K6 — Climbing or Falling? Spotting the Trend
update lessons set steps_draft = $j$
{
  "schema": 1,
  "title": "Climbing or Falling? Spotting the Trend",
  "skills": ["technical_analysis"],
  "difficulty": 2,
  "audience": ["kid"],
  "duration_minutes": 4,
  "xp": 50,
  "guide": {
    "intro": "One candle shows one battle. But zoom out and look at LOTS of candles, and you can see who is winning the whole war!",
    "outro": "You can spot a trend now — steps going up is an uptrend, steps going down is a downtrend. You are seeing the whole game, not just one play!"
  },
  "steps": [
    {
      "id": "k6-explain",
      "type": "explainer",
      "skill": "technical_analysis",
      "heading": "Look at the battles in a row",
      "body": [
        "One candle shows one tug-of-war. But if you step back and look at LOTS of candles in a row, you can see something bigger: which team has been winning the whole war.",
        "If the candles keep climbing higher and higher, like steps going up, the buyers have been winning a lot — that is called an uptrend. If they keep sliding lower and lower, like steps going down, the sellers have been winning — that is a downtrend.",
        "Spotting the trend is like watching a whole game instead of just one play. It tells you which team has the momentum."
      ],
      "figure": { "kind": "stat", "value": "Steps up = uptrend", "caption": "steps down = downtrend" }
    },
    {
      "id": "k6-mc",
      "type": "multiple_choice",
      "skill": "technical_analysis",
      "question": "The candles on a chart keep climbing higher, like steps going up. What is that called?",
      "options": [
        "A downtrend",
        "An uptrend — buyers have been winning",
        "A tie",
        "A candle"
      ],
      "correctIndex": 1,
      "explanation": "Candles climbing higher and higher means the buyers keep winning — that is an uptrend, like steps going up. Sliding lower would be a downtrend.",
      "reinforce": "Yes! Steps going up = an uptrend."
    },
    {
      "id": "k6-tf",
      "type": "true_false",
      "skill": "technical_analysis",
      "statement": "You can spot the trend by looking at MANY candles in a row, not just one.",
      "answer": true,
      "trueLabel": "True",
      "falseLabel": "False",
      "explanation": "Exactly! One candle is one battle. To see the trend — the whole war — you look at a bunch of candles together and notice if they are climbing or falling.",
      "reinforce": "True! The trend shows up when you zoom out and look at many candles."
    },
    {
      "id": "k6-match",
      "type": "match_pairs",
      "skill": "technical_analysis",
      "prompt": "Match each idea to what it means.",
      "pairs": [
        { "left": "Uptrend", "right": "Candles climbing higher like steps up" },
        { "left": "Downtrend", "right": "Candles sliding lower like steps down" },
        { "left": "Trend", "right": "Which team is winning the whole war" },
        { "left": "Momentum", "right": "Which way the price is pushing" }
      ],
      "explanation": "Look at many candles: climbing is an uptrend, falling is a downtrend, and the direction is the trend.",
      "reinforce": "You can spot a trend now!"
    },
    {
      "id": "k6-real",
      "type": "real_world",
      "skill": "technical_analysis",
      "action": "save_watchlist",
      "ticker": "HAS",
      "company": "Hasbro",
      "prompt": "Let's find a real trend! Ask a grown-up to add Hasbro — a toy company — to your family watchlist, then look at whether its candles are climbing or falling.",
      "cta": "Open the watchlist",
      "successText": "Hasbro is on your family watchlist! Now you can look for real uptrends and downtrends yourself."
    }
  ]
}
$j$::jsonb where id = 'f1c00000-0003-0003-0002-000000000001';

-- K7 — Picking Companies Your Family Uses
update lessons set steps_draft = $j$
{
  "schema": 1,
  "title": "Picking Companies Your Family Uses",
  "skills": ["competitive_advantage"],
  "difficulty": 1,
  "audience": ["kid"],
  "duration_minutes": 4,
  "xp": 50,
  "guide": {
    "intro": "You do not need to be a grown-up expert to spot a great company. Some of the best ones are right in your house! Let's go find them.",
    "outro": "You learned the smartest place to start — at home, with the companies your family already loves. That is how great investors think!"
  },
  "steps": [
    {
      "id": "k7-explain",
      "type": "explainer",
      "skill": "competitive_advantage",
      "heading": "Your watchlist starts at home",
      "body": [
        "You do not need to be a grown-up expert to spot a good company. Some of the best ones are right in your house! Look around: what does your family buy again and again, play with all the time, or wear every day?",
        "A company that lots of families keep coming back to is doing something right. If your family loves it and your friends' families love it too, that company has lots of happy customers — and happy customers are a great sign.",
        "That is why the smartest place to start your watchlist is at home, with the brands you already know and trust."
      ],
      "figure": { "kind": "stat", "value": "Look around home", "caption": "for great companies" }
    },
    {
      "id": "k7-mc",
      "type": "multiple_choice",
      "skill": "competitive_advantage",
      "question": "What is a great CLUE that a company might be strong?",
      "options": [
        "Nobody has heard of it",
        "Your family and lots of others keep buying from it again and again",
        "It has a scary name",
        "It is brand new today"
      ],
      "correctIndex": 1,
      "explanation": "When lots of families keep coming back to a company again and again, it means the company has many happy customers — a really good sign of strength.",
      "reinforce": "Yes! Lots of happy, repeat customers is a great clue."
    },
    {
      "id": "k7-tf",
      "type": "true_false",
      "skill": "competitive_advantage",
      "statement": "Some great companies to invest in are ones your family already uses at home.",
      "answer": true,
      "trueLabel": "True",
      "falseLabel": "False",
      "explanation": "Totally true! The shoes you wear, the games you play, the snacks you love — those are made by real companies you could own a piece of. Home is a great place to start looking.",
      "reinforce": "True! Great companies are hiding in plain sight at home."
    },
    {
      "id": "k7-match",
      "type": "match_pairs",
      "skill": "competitive_advantage",
      "prompt": "Match each clue to what it tells you.",
      "pairs": [
        { "left": "Repeat customers", "right": "People keep coming back" },
        { "left": "Loved product", "right": "People really like what it makes" },
        { "left": "Lots of fans", "right": "Many people use it" },
        { "left": "Trusted brand", "right": "People believe in the company" }
      ],
      "explanation": "Repeat customers, a loved product, lots of fans, and trust — those clues all point to a strong company.",
      "reinforce": "You know how to spot the clues now!"
    },
    {
      "id": "k7-predict",
      "type": "prediction",
      "skill": "competitive_advantage",
      "question": "Your favorite sneaker company comes out with new shoes that everyone at school wants, and more and more kids keep buying them. What happens to the company?",
      "options": [
        { "label": "It grows — more happy customers buying more shoes", "value": "grows" },
        { "label": "It shrinks", "value": "shrinks" },
        { "label": "It closes", "value": "closes" }
      ],
      "outcomeValue": "grows",
      "reveal": {
        "headline": "More fans, bigger company",
        "body": "When more and more people love and buy what a company makes, the company grows — it sells more and gets bigger and stronger. Finding companies that lots of people keep coming back to is exactly how great investors pick what to own."
      }
    },
    {
      "id": "k7-real",
      "type": "real_world",
      "skill": "competitive_advantage",
      "action": "save_watchlist",
      "ticker": "CROX",
      "company": "Crocs",
      "prompt": "Your turn! Ask a grown-up to help you add one company your family really uses — like Crocs — to your family watchlist.",
      "cta": "Open the watchlist",
      "successText": "Crocs is on your family watchlist! You picked a company your family knows and loves — a great first choice."
    }
  ]
}
$j$::jsonb where id = 'f1c00000-0003-0004-0001-000000000001';

-- K8 — What Makes a Company Strong?
update lessons set steps_draft = $j$
{
  "schema": 1,
  "title": "What Makes a Company Strong?",
  "skills": ["competitive_advantage", "growth"],
  "difficulty": 2,
  "audience": ["kid"],
  "duration_minutes": 4,
  "xp": 50,
  "guide": {
    "intro": "How can you tell if a company is strong? There are three big signs to look for. Let's learn them like a detective!",
    "outro": "You know the three signs of a strong company now — lots of customers, growing sales, and products people love. You are a real business detective!"
  },
  "steps": [
    {
      "id": "k8-explain",
      "type": "explainer",
      "skill": "competitive_advantage",
      "heading": "Three signs of a strong company",
      "body": [
        "How do you tell if a company is strong? There are three big signs to look for. First, LOTS of customers — many people buying what it sells. Second, growing sales — the company selling more this year than last year.",
        "Third, products people truly love — things customers are excited about and tell their friends about. When a company has all three, it is in great shape.",
        "A strong company is a bit like a strong tree: deep roots (loyal customers), new branches every year (growing sales), and fruit everyone wants (loved products)."
      ],
      "figure": { "kind": "stat", "value": "Customers · Growth · Love", "caption": "three signs of strength" }
    },
    {
      "id": "k8-mc",
      "type": "multiple_choice",
      "skill": "competitive_advantage",
      "question": "Which of these is a sign of a STRONG company?",
      "options": [
        "It is losing customers every year",
        "It has lots of customers and its sales keep growing",
        "Nobody likes its products",
        "It never sells anything"
      ],
      "correctIndex": 1,
      "explanation": "Lots of customers PLUS growing sales is a powerful sign of strength. It means people love the company and more of them keep buying.",
      "reinforce": "Yes! Many customers and growing sales means strong."
    },
    {
      "id": "k8-tf",
      "type": "true_false",
      "skill": "growth",
      "statement": "A company that sells MORE this year than last year is growing.",
      "answer": true,
      "trueLabel": "True",
      "falseLabel": "False",
      "explanation": "Right! Selling more than the year before means the company is growing — one of the best signs that it is doing well and getting stronger.",
      "reinforce": "True! More sales than last year = growing."
    },
    {
      "id": "k8-match",
      "type": "match_pairs",
      "skill": "competitive_advantage",
      "prompt": "Match each sign to what it means.",
      "pairs": [
        { "left": "Lots of customers", "right": "Many people buy from it" },
        { "left": "Growing sales", "right": "It sells more each year" },
        { "left": "Loved products", "right": "People are excited about it" },
        { "left": "Strong company", "right": "Has all three signs" }
      ],
      "explanation": "Lots of customers, growing sales, and loved products — a company with all three is strong.",
      "reinforce": "You know the three signs of strength!"
    },
    {
      "id": "k8-predict",
      "type": "prediction",
      "skill": "growth",
      "question": "A pizza company opens 100 brand-new restaurants in new towns, and the food is a big hit everywhere. What most likely happens to how much pizza they sell?",
      "options": [
        { "label": "Sales grow — more restaurants and happy customers", "value": "grows" },
        { "label": "Sales shrink", "value": "shrinks" },
        { "label": "They sell no pizza", "value": "none" }
      ],
      "outcomeValue": "grows",
      "reveal": {
        "headline": "More restaurants, more sales",
        "body": "Opening new restaurants that people love means the company reaches more customers and sells more pizza — its sales grow. Growing sales is one of the biggest signs of a strong, healthy company, and it is exactly what investors get excited about."
      }
    },
    {
      "id": "k8-real",
      "type": "real_world",
      "skill": "competitive_advantage",
      "action": "save_watchlist",
      "ticker": "SBUX",
      "company": "Starbucks",
      "prompt": "Let's follow a strong company! Ask a grown-up to add Starbucks to your family watchlist and watch for its three signs of strength.",
      "cta": "Open the watchlist",
      "successText": "Starbucks is on your family watchlist! Now you can watch a real company and look for its signs of strength."
    }
  ]
}
$j$::jsonb where id = 'f1c00000-0003-0004-0002-000000000001';

-- K9 — The House Rules of Money
update lessons set steps_draft = $j$
{
  "schema": 1,
  "title": "The House Rules of Money",
  "skills": ["risk"],
  "difficulty": 1,
  "audience": ["kid"],
  "duration_minutes": 4,
  "xp": 50,
  "guide": {
    "intro": "Every family has house rules — and money has house rules too! They are simple, but they keep you safe. Let's learn all three.",
    "outro": "You know the three house rules of money now — protect first, plans over feelings, and practice before you play. That is how money stops being scary!"
  },
  "steps": [
    {
      "id": "k9-explain",
      "type": "explainer",
      "skill": "risk",
      "heading": "Three rules that keep your money safe",
      "body": [
        "Every family has house rules — and money has house rules too. They are simple, but they keep you safe. Rule one: protect the money first. Before you try to grow it, make sure you will not lose it all — never risk everything on one thing.",
        "Rule two: plans over feelings. Money can make you excited or scared, but you make your best choices with a calm plan you decided ahead of time, not with big feelings in the moment.",
        "Rule three: practice before you play. Try things with pretend money first, so your mistakes are free. Follow these three, and money becomes a lot less scary."
      ],
      "figure": { "kind": "stat", "value": "3 house rules", "caption": "protect · plan · practice" }
    },
    {
      "id": "k9-mc",
      "type": "multiple_choice",
      "skill": "risk",
      "question": "What does the house rule 'protect the money first' mean?",
      "options": [
        "Spend it all fast",
        "Do not risk everything on one thing — keep your money safe",
        "Hide it forever",
        "Give it away"
      ],
      "correctIndex": 1,
      "explanation": "Protecting the money first means never betting everything on one thing, so a mistake can never wipe you out. Keep your money safe before you try to grow it.",
      "reinforce": "Yes! Protect it first means never risk it all at once."
    },
    {
      "id": "k9-tf",
      "type": "true_false",
      "skill": "risk",
      "statement": "It is smarter to make money choices with a calm PLAN than with big feelings.",
      "answer": true,
      "trueLabel": "True",
      "falseLabel": "False",
      "explanation": "So true! Big feelings like excitement or fear lead to messy choices. A calm plan you made ahead of time keeps you making smart, steady moves.",
      "reinforce": "True! Plans beat big feelings every time."
    },
    {
      "id": "k9-match",
      "type": "match_pairs",
      "skill": "risk",
      "prompt": "Match each house rule to what it means.",
      "pairs": [
        { "left": "Protect first", "right": "Never risk everything on one thing" },
        { "left": "Plans over feelings", "right": "Decide calmly, ahead of time" },
        { "left": "Practice first", "right": "Try with pretend money before real" },
        { "left": "Stay safe", "right": "Follow the rules to keep your money" }
      ],
      "explanation": "Protect first, use a plan, practice before you play, and stay safe — the three house rules of money.",
      "reinforce": "You know the house rules now!"
    },
    {
      "id": "k9-real",
      "type": "real_world",
      "skill": "risk",
      "action": "save_watchlist",
      "ticker": "TGT",
      "company": "Target",
      "prompt": "Practice a house rule! Ask a grown-up to add just ONE company — like Target — to your family watchlist. Starting with one, calmly, is 'plans over feelings' in action.",
      "cta": "Open the watchlist",
      "successText": "Target is on your family watchlist! Adding one company calmly is exactly what following the house rules looks like."
    }
  ]
}
$j$::jsonb where id = 'f1c00000-0003-0005-0001-000000000001';

-- K10 — Small Losses Are Wins
update lessons set steps_draft = $j$
{
  "schema": 1,
  "title": "Small Losses Are Wins",
  "skills": ["risk", "market_psychology"],
  "difficulty": 2,
  "audience": ["kid"],
  "duration_minutes": 4,
  "xp": 50,
  "guide": {
    "intro": "Here is a tricky one: sometimes losing a LITTLE on purpose is actually a smart WIN. Let's find out why!",
    "outro": "Now you get one of the smartest money ideas of all — a small loss on purpose keeps your big pile of money safe. Clever!"
  },
  "steps": [
    {
      "id": "k10-explain",
      "type": "explainer",
      "skill": "risk",
      "heading": "Losing a little on purpose",
      "body": [
        "This one sounds strange but it is one of the smartest ideas in money: sometimes losing a little on purpose is actually a win. Here is why. Imagine you are climbing a tree and one branch feels wobbly. Climbing back down a little is not losing — it is staying safe so you can climb again tomorrow.",
        "Money works the same way. If something is not going well, letting go of a little bit early keeps you from losing a LOT later. A small loss you chose is much better than a giant loss that surprises you.",
        "Smart investors are not sad about small losses. They know a small loss on purpose is what protects the big pile."
      ],
      "figure": { "kind": "stat", "value": "Small loss = safe", "caption": "big loss = trouble" }
    },
    {
      "id": "k10-mc",
      "type": "multiple_choice",
      "skill": "risk",
      "question": "Why can a SMALL loss on purpose actually be a smart move?",
      "options": [
        "It never happens",
        "It keeps you from losing a LOT more later",
        "Losing is always bad",
        "It doubles your money"
      ],
      "correctIndex": 1,
      "explanation": "Choosing a small loss early is like climbing down from a wobbly branch — it keeps you safe from a much bigger fall later. Small on purpose beats big by surprise.",
      "reinforce": "Yes! A small loss on purpose protects you from a big one."
    },
    {
      "id": "k10-tf",
      "type": "true_false",
      "skill": "risk",
      "statement": "A small loss you CHOSE is better than a giant loss that surprises you.",
      "answer": true,
      "trueLabel": "True",
      "falseLabel": "False",
      "explanation": "Absolutely! Picking a small loss early keeps your big pile of money safe. Being surprised by a giant loss is the thing smart investors work hard to avoid.",
      "reinforce": "True! Small-on-purpose beats big-by-surprise."
    },
    {
      "id": "k10-match",
      "type": "match_pairs",
      "skill": "market_psychology",
      "prompt": "Match each idea to what it means.",
      "pairs": [
        { "left": "Small loss", "right": "Letting go of a little early" },
        { "left": "Big loss", "right": "A giant surprise you did not plan for" },
        { "left": "Staying safe", "right": "Protecting your big pile of money" },
        { "left": "Smart choice", "right": "Picking the small loss on purpose" }
      ],
      "explanation": "A small planned loss keeps you safe from a big surprise loss — that is the smart, calm choice.",
      "reinforce": "You understand why small losses can be wins!"
    },
    {
      "id": "k10-real",
      "type": "real_world",
      "skill": "risk",
      "action": "save_watchlist",
      "ticker": "MAT",
      "company": "Mattel",
      "prompt": "Watching one company teaches you to stay calm. Ask a grown-up to add Mattel — the toy company behind Hot Wheels and Barbie — to your family watchlist, and just watch it calmly.",
      "cta": "Open the watchlist",
      "successText": "Mattel is on your family watchlist! Watching one company calmly is great practice for staying safe and smart."
    }
  ]
}
$j$::jsonb where id = 'f1c00000-0003-0005-0002-000000000001';

-- K11 — Paper Trading — Practice Before We Play
update lessons set steps_draft = $j$
{
  "schema": 1,
  "title": "Paper Trading — Practice Before We Play",
  "skills": ["market_basics"],
  "difficulty": 1,
  "audience": ["kid"],
  "duration_minutes": 4,
  "xp": 50,
  "guide": {
    "intro": "Before a big game, you practice. Money is the same — you practice with PRETEND money first! It is called paper trading.",
    "outro": "You know what paper trading is now — real prices, pretend money, and totally free mistakes. That is how everyone learns to invest!"
  },
  "steps": [
    {
      "id": "k11-explain",
      "type": "explainer",
      "skill": "market_basics",
      "heading": "Practice with pretend money",
      "body": [
        "Before a big game, you practice. Before a school play, you rehearse. Money is the same: before using real money, you practice with pretend money. That is called paper trading.",
        "In paper trading, you make pretend buys and sells using REAL prices from the real market. Everything feels real except the money — which means if you make a mistake, it costs you nothing. It is the perfect place to learn!",
        "The trick is to take it seriously, just like a real practice. The good habits you build with pretend money will stick with you when it is finally time to play for real."
      ],
      "figure": { "kind": "stat", "value": "Real prices", "caption": "pretend money" }
    },
    {
      "id": "k11-mc",
      "type": "multiple_choice",
      "skill": "market_basics",
      "question": "What is paper trading?",
      "options": [
        "Trading actual paper",
        "Practicing with pretend money and real prices",
        "A type of homework",
        "Selling drawings"
      ],
      "correctIndex": 1,
      "explanation": "Paper trading means making pretend buys and sells using real market prices — so you learn the whole game with zero money at risk. Practice before you play!",
      "reinforce": "Yes! Pretend money, real prices — that is paper trading."
    },
    {
      "id": "k11-tf",
      "type": "true_false",
      "skill": "market_basics",
      "statement": "In paper trading, your mistakes cost you real money.",
      "answer": false,
      "trueLabel": "True",
      "falseLabel": "False",
      "explanation": "Nope — that is the best part! Paper trading uses pretend money, so mistakes are totally free. You get to learn and practice without any risk.",
      "reinforce": "Right — pretend money means mistakes are free!"
    },
    {
      "id": "k11-match",
      "type": "match_pairs",
      "skill": "market_basics",
      "prompt": "Match each idea to what it means.",
      "pairs": [
        { "left": "Paper trade", "right": "A pretend buy or sell" },
        { "left": "Real prices", "right": "The actual market prices you practice with" },
        { "left": "Pretend money", "right": "Fake money, so mistakes are free" },
        { "left": "Practice", "right": "Getting good before you play for real" }
      ],
      "explanation": "You make pretend trades at real prices with pretend money — all the practice, none of the risk.",
      "reinforce": "You know how practice trading works!"
    },
    {
      "id": "k11-real",
      "type": "real_world",
      "skill": "market_basics",
      "action": "save_watchlist",
      "ticker": "RBLX",
      "company": "Roblox",
      "prompt": "Practice needs a company to follow. Ask a grown-up to add Roblox to your family watchlist, then practice watching it before any pretend trade.",
      "cta": "Open the watchlist",
      "successText": "Roblox is on your family watchlist! Now you have a real company to practice watching, just like real investors do."
    }
  ]
}
$j$::jsonb where id = 'f1c00000-0003-0006-0001-000000000001';

-- K12 — My Family Trade Plan
update lessons set steps_draft = $j$
{
  "schema": 1,
  "title": "My Family Trade Plan",
  "skills": ["thesis_building"],
  "difficulty": 2,
  "audience": ["kid"],
  "duration_minutes": 4,
  "xp": 50,
  "guide": {
    "intro": "The last step before any trade — even a pretend one — is making a plan. And the best plans are made together, as a family!",
    "outro": "You built a real family trade plan — a company, a why, and a choice. That is exactly how a family invests together. Amazing work!"
  },
  "steps": [
    {
      "id": "k12-explain",
      "type": "explainer",
      "skill": "thesis_building",
      "heading": "Make a plan together",
      "body": [
        "The last step before any trade — even a pretend one — is making a plan. And the best plans are made together, as a family. A trade plan answers three simple questions in plain words.",
        "One: which company do we like? Two: why do we like it — what does it do that is great? Three: what is our choice — do we want to buy a piece, just watch it, or pass for now? That is it.",
        "Writing your plan down and talking about it together turns a guess into a real decision. It is exactly what grown-up investors do, just with your whole family helping."
      ],
      "figure": { "kind": "stat", "value": "Company · Why · Choice", "caption": "your 3-part plan" }
    },
    {
      "id": "k12-mc",
      "type": "multiple_choice",
      "skill": "thesis_building",
      "question": "What are the three questions in a family trade plan?",
      "options": [
        "Which color, which size, which day",
        "Which company, why we like it, and our choice",
        "How rich, how fast, how lucky",
        "None of these"
      ],
      "correctIndex": 1,
      "explanation": "A good plan names the company, says WHY you like it, and makes a choice — buy a piece, watch it, or pass. Three simple questions, one solid plan.",
      "reinforce": "Yes! Company, why, and your choice — that is the plan."
    },
    {
      "id": "k12-tf",
      "type": "true_false",
      "skill": "thesis_building",
      "statement": "Writing down WHY you like a company is an important part of your plan.",
      "answer": true,
      "trueLabel": "True",
      "falseLabel": "False",
      "explanation": "Super important! The 'why' is the heart of the plan. If you can explain why a company is great, you have a real reason — not just a guess.",
      "reinforce": "True! The 'why' turns a guess into a real reason."
    },
    {
      "id": "k12-match",
      "type": "match_pairs",
      "skill": "thesis_building",
      "prompt": "Match each plan part to its question.",
      "pairs": [
        { "left": "Company", "right": "Which one do we like?" },
        { "left": "Why", "right": "What makes it great?" },
        { "left": "Choice", "right": "Buy, watch, or pass?" },
        { "left": "Together", "right": "Who makes the plan?" }
      ],
      "explanation": "Name the company, say why, make your choice — together. That is a family trade plan.",
      "reinforce": "You can build a family trade plan now!"
    },
    {
      "id": "k12-predict",
      "type": "prediction",
      "skill": "thesis_building",
      "question": "Your family picks a company because everyone agrees its product is great and MORE people keep buying it. Is that a strong reason or a weak reason for your plan?",
      "options": [
        { "label": "A strong reason — lots of happy customers is a great sign", "value": "strong" },
        { "label": "A weak reason", "value": "weak" },
        { "label": "No reason at all", "value": "none" }
      ],
      "outcomeValue": "strong",
      "reveal": {
        "headline": "A strong reason!",
        "body": "A company that lots of people love and keep buying from is showing real strength — that is one of the best reasons to put it on your plan. Great investors always start with a clear 'why,' and 'lots of happy customers' is a wonderful why."
      }
    },
    {
      "id": "k12-real",
      "type": "real_world",
      "skill": "thesis_building",
      "action": "save_watchlist",
      "ticker": "NKE",
      "company": "Nike",
      "prompt": "Finish your plan for real! Ask a grown-up to add your plan's company — like Nike — to your family watchlist. That is your family's first real pick.",
      "cta": "Open the watchlist",
      "successText": "Nike is on your family watchlist! You made a plan together and picked a real company — that is exactly how a family invests."
    }
  ]
}
$j$::jsonb where id = 'f1c00000-0003-0006-0002-000000000001';
