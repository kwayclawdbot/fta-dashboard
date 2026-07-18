-- 017 — Real Week-1 quizzes for the quiz-flagged W1 lessons
-- One quiz per quiz-flagged lesson (second lesson in each FIC pair + FTA drill).
-- Age-appropriate framing per track. Idempotent: fixed ids + conflict on the
-- unique lesson_id. Question shape matches QuizPanel: {question, options,
-- correctIndex, explanation}.

-- ADULTS — "What a Stock Is & How the Market Works" (textbook framing)
insert into quizzes (id, lesson_id, passing_score, questions) values
('a0000000-0001-0001-0002-000000000001', 'f1c00000-0001-0001-0002-000000000001', 70,
 '[
   {"question": "What does owning one share of a company actually represent?",
    "options": ["A loan you made to the company", "A small ownership stake in the company", "A guarantee of fixed monthly income", "A coupon for free products"],
    "correctIndex": 1,
    "explanation": "A share is a unit of equity — owning it makes you a part-owner entitled to a slice of the company''s success."},
   {"question": "What primarily makes a stock''s price move during the trading day?",
    "options": ["The CEO sets the price each morning", "Supply and demand from buyers and sellers", "The government fixes prices weekly", "The price cannot change until earnings"],
    "correctIndex": 1,
    "explanation": "Price is set by the market: when more people want to buy than sell, it rises; when sellers dominate, it falls."},
   {"question": "What is a stock market index like the S&P 500?",
    "options": ["A single company''s stock", "A basket that tracks many stocks together", "A type of savings account", "A tax charged on every trade"],
    "correctIndex": 1,
    "explanation": "An index measures a group of stocks so you can gauge how the overall market — or a segment of it — is performing."},
   {"question": "When you press \"buy\" in a broker app, what happens?",
    "options": ["Your order is matched with a seller on an exchange", "The company mails you a paper certificate that day", "A bank lends you the shares for free", "Nothing happens until the company approves you"],
    "correctIndex": 0,
    "explanation": "Your broker routes the order to an exchange, where it is matched with someone willing to sell at that price."}
 ]'::jsonb)
on conflict (lesson_id) do nothing;

-- TEENS — "How the Stock Market Actually Works" (teen framing)
insert into quizzes (id, lesson_id, passing_score, questions) values
('a0000000-0002-0001-0002-000000000001', 'f1c00000-0002-0001-0002-000000000001', 70,
 '[
   {"question": "Buying a share of a company is most like...",
    "options": ["Lending the company your lunch money to get back later", "Owning a tiny slice of the company so you win when it grows", "Betting on a single coin flip", "Paying a monthly subscription fee"],
    "correctIndex": 1,
    "explanation": "A share is a real piece of ownership. If the business grows, your slice becomes more valuable."},
   {"question": "Why does a stock''s price change throughout the day?",
    "options": ["A referee decides the price", "Buyers and sellers keep negotiating — more buyers pushes it up", "It moves completely at random", "It only moves on weekends"],
    "correctIndex": 1,
    "explanation": "Price is a live tug-of-war between buyers and sellers all day long."},
   {"question": "What is the point of an index like the S&P 500?",
    "options": ["It is one giant company", "It is a scoreboard for how a big group of companies is doing", "It is a video game", "It is the price of gold"],
    "correctIndex": 1,
    "explanation": "An index is basically a scoreboard tracking hundreds of companies at once."},
   {"question": "If a company does really well over many years, a shareholder generally...",
    "options": ["Loses their money automatically", "Can see the value of their shares grow", "Has to give the shares back", "Pays the company a penalty"],
    "correctIndex": 1,
    "explanation": "Owners share in the upside — as the company grows, so can the value of your shares."}
 ]'::jsonb)
on conflict (lesson_id) do nothing;

-- KIDS — "The Ways People Make Money" (simple, playful framing)
insert into quizzes (id, lesson_id, passing_score, questions) values
('a0000000-0003-0001-0002-000000000001', 'f1c00000-0003-0001-0002-000000000001', 70,
 '[
   {"question": "What are the main ways grown-ups make money?",
    "options": ["Only by finding it on the ground", "By working a job, running a business, or investing", "Only by winning games", "By wishing really hard"],
    "correctIndex": 1,
    "explanation": "People earn by working, building a business, or putting money to work through investing."},
   {"question": "What does it mean to \"invest\" your money?",
    "options": ["Hide it under your bed forever", "Put it to work so it can grow over time", "Spend it all today", "Give it away and forget it"],
    "correctIndex": 1,
    "explanation": "Investing means letting your money work and grow — like planting a seed and watching it become a tree."},
   {"question": "When you own a share of a company, you own...",
    "options": ["The whole building", "A tiny piece of that company", "Nothing at all", "A free toy"],
    "correctIndex": 1,
    "explanation": "A share is a tiny slice of a real company — that makes you a little owner!"},
   {"question": "Why is it smart to start saving and investing when you are young?",
    "options": ["Because your money has more time to grow", "Because it is a rule you must follow", "Because money disappears when you are old", "It is not smart at all"],
    "correctIndex": 0,
    "explanation": "The earlier you start, the more time your money has to grow. That is the magic of compounding!"}
 ]'::jsonb)
on conflict (lesson_id) do nothing;

-- FTA DRILL — "Map the Structure on 3 Charts" (market structure)
insert into quizzes (id, lesson_id, passing_score, questions) values
('a0000000-7a00-0001-0002-000000000001', 'f7a00000-0000-0001-0002-000000000001', 70,
 '[
   {"question": "In an uptrend, price prints a pattern of...",
    "options": ["Lower highs and lower lows", "Higher highs and higher lows", "Flat highs and flat lows", "Random spikes only"],
    "correctIndex": 1,
    "explanation": "An uptrend is defined by higher highs (HH) and higher lows (HL) — each push and pullback prints higher."},
   {"question": "\"Liquidity\" on a chart is best described as...",
    "options": ["The amount of water in the building", "Clusters of resting orders and stop-losses big players can target", "The speed of your internet", "A type of candlestick"],
    "correctIndex": 1,
    "explanation": "Liquidity is pools of orders (like stops) resting at obvious levels — the pool party big money aims for."},
   {"question": "Who realistically has the size to move price the most?",
    "options": ["A single retail trader with $500", "Large institutions and whales who need big orders filled", "The chart itself", "Nobody — price is fixed"],
    "correctIndex": 1,
    "explanation": "Big players need to fill large orders, so they hunt liquidity to get in and out. That is who moves price."},
   {"question": "Why does a whale often push price INTO an obvious level before reversing?",
    "options": ["To say hello", "To grab the liquidity (stops) resting there so they can fill their position", "Because the level is decoration", "It never happens"],
    "correctIndex": 1,
    "explanation": "Running the stops at an obvious high or low gives big players the orders they need — then price can reverse."}
 ]'::jsonb)
on conflict (lesson_id) do nothing;
