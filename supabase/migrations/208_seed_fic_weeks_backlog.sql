-- 208_seed_fic_weeks_backlog.sql
-- FIC weekly-loop content supply (Lane A). Authors a STAGED backlog of
-- Company-of-the-Week rows so "This Week in FIC", Parent Corner coaching,
-- Family Night, and the kid challenge stop rendering empty every week.
--
-- STAGING RULES (deliberate):
--   * The live Apple week (2026-07-20) is the ONLY is_current row and is NOT
--     touched here. Every new row is published=true, is_current=false.
--   * week_start values are a forward run of future Mondays, so the rollover
--     cron (/api/cron/fic-week-rollover) can advance is_current on schedule.
--   * getCurrentFicWeek() prefers the is_current flag, so Apple stays live until
--     a rollover flips the flag forward. Nothing goes live from this file.
--   * Idempotent: ON CONFLICT (week_start) DO NOTHING. Re-running never clobbers
--     Apple or an already-seeded week.
--
-- Voice: concept-first, plain, no hype, no price prediction. Every row teaches a
-- business model, never "buy the stock." parent_what_child_learned starts with
-- "Your child learned ..." and contains a "We used ..." clause so the Parent
-- Corner look-ahead rewrite (asLookaheadVoice) reads correctly before any child
-- activity exists.

insert into fic_weeks (
  week_start, class_title, company_name, company_ticker,
  cotw_what_they_do, cotw_how_they_make_money, cotw_why_customers_love,
  cotw_why_investors_watch, cotw_what_could_go_wrong,
  cotw_discussion_question, cotw_watchlist_assignment,
  family_assignment, parent_prompt, kid_challenge,
  parent_what_child_learned, parent_dinner_questions, parent_explain_simply,
  parent_what_not_to_do, parent_risk_talk, parent_patience,
  published, is_current
) values

-- ── Week: Nike (NKE) ────────────────────────────────────────────────────────
(
  '2026-08-10', 'How Nike Actually Makes Money', 'Nike', 'NKE',
  $$Nike designs shoes and sportswear. It does not own most of the factories that make them. It owns the design, the brand, and the marketing, and pays other companies to do the manufacturing.$$,
  $$Nike sells to you two ways: through other stores like Foot Locker, and straight to you through its own app and nike.com. Selling direct earns them more per shoe because there is no middleman taking a cut.$$,
  $$The brand and the athletes. People pay more for the swoosh than they would for the same shoe with no logo. That willingness to pay extra is the whole business.$$,
  $$Whether Nike is selling more DIRECT (higher profit) versus through other stores, and whether people in big markets like China are buying. Those two numbers move the story.$$,
  $$Fashion changes. A rival brand, or a viral one, can get cool fast, and a warehouse full of last year's style has to be sold cheap. Shoes can also pile up unsold if the company guesses demand wrong.$$,
  $$Would you pay $40 more for a shoe just because of the logo? What is that logo actually worth to you?$$,
  $$Add Nike to the Family Watchlist and, on its research card, write in one sentence: how does Nike make money?$$,
  $$Everyone names their favorite Nike (or rival) product and says whether they bought it for the shoe or for the brand.$$,
  $$Use Nike to introduce the idea of a "brand premium", the extra people pay for a name. Ask your kids where else they see it: phones, snacks, backpacks.$$,
  $$Find three things in your house with a logo people pay extra for. Bring them to family night.$$,
  $$Your child learned that a company can be valuable because of its brand and design, not because it owns big factories. We used Nike because its real asset is the swoosh and what it stands for, not the machines that stitch the shoes.$$,
  $$• What is a brand you would pay more for, and why?
• What would make you stop trusting a brand you love?
• If you started a shoe company tomorrow, how would you get people to care?
• Would you rather Nike sell more through stores or straight to you, and why?$$,
  $$Say: "Nike is a design-and-brand company that pays other people to build its shoes. You are really paying for the name and the feeling, and that is on purpose."$$,
  $$Do not turn this into "should we buy the stock." The lesson is understanding the business, not making a trade. No real money is involved.$$,
  $$Even a huge brand can stumble if it guesses fashion wrong and gets stuck with shoes nobody wants. Big and safe are not the same thing.$$,
  $$Nike has had bad years and good years for decades. The point of studying it is judgment over time, not this week's price.$$,
  true, false
),

-- ── Week: Costco (COST) ─────────────────────────────────────────────────────
(
  '2026-08-17', 'Why People Pay to Shop at Costco', 'Costco', 'COST',
  $$Costco runs giant warehouse stores that sell food, household goods, and just about everything else in bulk. You have to be a paying member to shop there, and each store keeps only a small number of products so every one sells in huge volume.$$,
  $$Here is the surprise. Costco barely makes money on the groceries themselves; it sells them at close to what it pays. The real profit comes from the yearly membership fee families pay just to walk in the door. Millions of members times that fee is the engine.$$,
  $$Prices are low because Costco buys in enormous quantities and passes most of the savings on. Members feel like they get a deal every trip, so they renew year after year.$$,
  $$Whether members keep renewing (the renewal rate) and how many new members sign up. Because the profit is the fee, steady renewals matter more than any single busy shopping day.$$,
  $$If shopping habits change or a cheaper option shows up, members might not renew. Costco also runs on thin margins, so a jump in the cost of the goods it stocks can squeeze it.$$,
  $$Would your family pay a yearly fee just to shop somewhere? What would that store have to give you to make the fee worth it?$$,
  $$Add Costco to your Family Watchlist and write one sentence on its research card: where does Costco's profit actually come from?$$,
  $$List three things your family buys in bulk. For each, guess whether buying more at once really saves money, then talk about why stores like selling that way.$$,
  $$Use Costco to introduce the membership idea, paying up front for access. Ask your kids what else the family pays for that way: streaming, a gym, a game pass.$$,
  $$Find a membership card at home (Costco, a library, a game app). Ask a grown-up what the family gets for it, and whether it is worth the price.$$,
  $$Your child learned that a business can make its money from a membership fee rather than from the products on the shelf. We used Costco because it turns the usual store model on its head: the cheap groceries get you in, the yearly fee is the profit.$$,
  $$• What do we pay a regular fee for, and is it worth it?
• Why would a store sell food at almost no profit?
• What would make you cancel a membership you have?
• If you ran a club, what would you charge to join, and why?$$,
  $$Say: "Costco is like a club. You pay once a year to be a member, and inside, everything is cheap. The company barely earns on the cheap stuff. The club fee is how it really makes money."$$,
  $$Do not turn this into "we should buy Costco stock." The point is the membership model, not a trade. No real money is involved.$$,
  $$Even a beloved store has risks: members can stop renewing, or the things it sells can get more expensive to stock. Popular and safe are not the same thing.$$,
  $$Costco built its membership base over decades, one renewal at a time. We study it to learn how a slow, loyal model works, not to guess this week's price.$$,
  true, false
),

-- ── Week: Disney (DIS) ──────────────────────────────────────────────────────
(
  '2026-08-24', 'The Disney Money Machine', 'Disney', 'DIS',
  $$Disney makes movies and shows, runs theme parks, sells toys and merchandise, and streams entertainment on Disney+. It owns a huge library of characters and stories, from Mickey Mouse to Marvel and Star Wars.$$,
  $$One idea travels a long way. A single movie can earn at the box office, then again from toys and clothes, then again as a ride at the parks, then again as a show on Disney+. The same characters get sold to you in many forms.$$,
  $$The stories and characters feel like part of childhood. Families plan whole trips around the parks and pay for the streaming to watch the movies again. That attachment is rare and hard to copy.$$,
  $$How many people subscribe to Disney+, how busy the parks are, and whether the newest movies connect with audiences. Those three engines rise and fall at different times.$$,
  $$Movies are expensive and not every one is a hit. Parks cost a fortune to run and empty out when families cut back on travel. Streaming is a crowded fight for attention.$$,
  $$Think of one Disney character your family loves. How many different ways has that one character shown up in your life: a movie, a toy, a ride, a shirt?$$,
  $$Add Disney to your Family Watchlist and write one sentence: name one story Disney owns and three ways it makes money from it.$$,
  $$Pick one Disney or Pixar character. As a family, list every place you have seen that character: screen, store, park, anywhere. Count the ways one idea earned money.$$,
  $$Use Disney to show how one creative idea can be sold many times. Ask your kids which part of Disney they would want to own if they could pick one: the movies, the parks, or the streaming.$$,
  $$Draw your favorite Disney character in the middle of a page. Around it, draw three ways Disney sells that character: a movie, a toy, a ride. You just mapped a money machine.$$,
  $$Your child learned that a company can earn from one idea many times over, as a film, a toy, a ride, and a streaming show. We used Disney because its characters are a library that keeps paying, year after year.$$,
  $$• What Disney story do we love, and how many ways have we paid for it?
• Why is owning a famous character so valuable?
• What happens to Disney if a big movie flops?
• If you owned one character, how would you make money from it?$$,
  $$Say: "Disney makes one story and then sells it to you again and again, as a movie, a toy, a ride, and a show. Owning the characters is like owning a well that keeps giving water."$$,
  $$Do not drift into "is Disney a good buy right now." We are learning how one idea earns many ways, not making a trade.$$,
  $$Even Disney has risky parts: costly movies that miss, expensive parks that empty out when families travel less. Big and magical does not mean guaranteed.$$,
  $$Disney has had golden years and rough ones for a century. We study it to understand a business, not to react to this quarter.$$,
  true, false
),

-- ── Week: McDonald's (MCD) ──────────────────────────────────────────────────
(
  '2026-08-31', 'McDonald''s Is Secretly About Real Estate', 'McDonald''s', 'MCD',
  $$McDonald's sells burgers, fries, and drinks at thousands of restaurants around the world. But most of those restaurants are not run by McDonald's itself. They are run by local owners called franchisees who pay to use the name and system.$$,
  $$Two ways that surprise people. Franchisees, the local owners, pay McDonald's a fee plus a share of their sales to use the name and the system. On top of that, McDonald's often owns the land and building and rents it to the franchisee. Much of its money is really fees and rent, not the food.$$,
  $$It is fast, cheap, familiar, and the same everywhere. A family knows exactly what they will get, whether at home or on a road trip. That reliability keeps people coming back.$$,
  $$How many people visit each restaurant, whether McDonald's is opening new locations, and how its owned real estate is doing. Because so much income is fees and rent, it can be steadier than food sales alone.$$,
  $$Tastes change, and health trends or new rivals can pull customers away. Rising costs for food and workers squeeze the franchisees, and unhappy franchisees are a real problem.$$,
  $$When your family goes to McDonald's, who do you think actually owns that restaurant, the company or a local person? Does it change how you think about the business?$$,
  $$Add McDonald's to your Family Watchlist and write one sentence: name two ways McDonald's makes money besides selling burgers.$$,
  $$As a family, think of three businesses near you that have the same name in many towns. Talk about whether one big company owns them all, or local owners run them under one name.$$,
  $$Use McDonald's to introduce franchising, paying to run a business under a proven brand, and the idea that a company can earn from rent and fees, not just its product. Ask your kids what brand they would want to franchise.$$,
  $$Next time you pass a McDonald's, notice it sits on a busy corner. Ask a grown-up: why would owning the LAND be a smart part of the business?$$,
  $$Your child learned that a company can make its money from fees and rent, not only from the thing it sells. We used McDonald's because behind the burgers is a franchise-and-real-estate business most people never notice.$$,
  $$• Who really owns your local McDonald's?
• Why would a burger company want to own land?
• What is a franchise, in your own words?
• If you could franchise any brand, which one and why?$$,
  $$Say: "McDonald's lets local owners run its restaurants for a fee, and it often owns the land underneath. So a lot of its money is rent and fees. The burgers get people in; the business is bigger than the food."$$,
  $$Do not turn it into "should we buy McDonald's." We are learning the franchise-and-property model, not chasing a trade.$$,
  $$Even McDonald's has risks: changing tastes, tough competition, and costs that squeeze the local owners it depends on. Everywhere is not the same as forever.$$,
  $$McDonald's grew one restaurant and one lease at a time over generations. We study it for the model, not this week's move.$$,
  true, false
),

-- ── Week: Netflix (NFLX) ────────────────────────────────────────────────────
(
  '2026-09-07', 'Netflix and the Subscription Idea', 'Netflix', 'NFLX',
  $$Netflix streams movies and TV shows over the internet, and it also makes many of its own. You pay a monthly price and watch as much as you want.$$,
  $$One simple, powerful idea: a monthly subscription. Millions of households each pay every month, which gives Netflix money it can roughly count on. It spends a big chunk of that making new shows to keep people watching.$$,
  $$A huge library, no ads on some plans, and shows you cannot get anywhere else. When a series everyone is talking about is only on Netflix, people subscribe just for it.$$,
  $$How many new subscribers join, and how many quit. Quitting is called churn. Because the business is monthly payments, keeping people from leaving matters as much as signing them up.$$,
  $$Making shows is expensive, and not every one lands. Rivals keep launching their own streaming services, and if people feel they are paying for too many, Netflix can be the one they cut.$$,
  $$How many streaming services does your family pay for each month? If you had to cancel all but one, which would you keep, and why that one?$$,
  $$Add Netflix to your Family Watchlist and write one sentence: what does the word "churn" mean, and why does Netflix care about it?$$,
  $$As a family, add up every monthly subscription you pay for. Talk about which ones you would keep, which you would cut, and what makes one worth keeping.$$,
  $$Use Netflix to teach recurring revenue, money that comes in every month, and why a subscription business fights so hard to keep you. Ask your kids what makes a subscription worth keeping.$$,
  $$Count the subscriptions in your house: streaming, games, apps. Circle the one your family would never cancel and tell everyone why it wins.$$,
  $$Your child learned that some companies earn a little every month from many people, and that keeping those people is the whole game. We used Netflix because a subscription is something your family already understands from the inside.$$,
  $$• Which subscription would we never cancel, and why?
• Why does a company love being paid every month?
• What is churn, and why does it hurt?
• If you started a subscription, what would people happily pay for monthly?$$,
  $$Say: "Netflix charges a little every month, from millions of homes. That steady money is why subscriptions are so valuable, and why the company works so hard to make sure you do not cancel."$$,
  $$Do not slide into "is Netflix stock a buy." We are learning the subscription model, not making a trade.$$,
  $$Even Netflix has risks: costly shows that miss, and rivals that make families rethink how many services they pay for. Popular this year is not safe forever.$$,
  $$Netflix went from mailing DVDs to streaming worldwide over many years. We study the model, not this month's subscriber number.$$,
  true, false
),

-- ── Week: Chipotle (CMG) ────────────────────────────────────────────────────
(
  '2026-09-14', 'Why Chipotle Can Charge More', 'Chipotle', 'CMG',
  $$Chipotle sells burritos, bowls, and tacos made in front of you from a short list of fresh ingredients. The menu is small on purpose, so the line moves fast and the food stays consistent.$$,
  $$It sells a lot of meals at a price a bit higher than fast food usually charges, and it keeps the menu simple so each restaurant runs efficiently. Selling more bowls per hour from a tight menu is the heart of it.$$,
  $$People trust the ingredients and like building their own meal. Many are willing to pay a little more for food they feel good about, and that willingness is exactly what makes the business strong.$$,
  $$Whether the same restaurants are selling more than they did a year ago (called same-store sales), and whether Chipotle can raise prices without customers walking away. That ability to charge more is called pricing power.$$,
  $$Food costs can jump, and any worry about food safety hits a restaurant brand hard and fast. Rivals copy the build-your-own idea, and customers can trade down when money is tight.$$,
  $$Would your family pay a bit more for a meal you trust over a cheaper one you do not? What makes a food brand worth the extra?$$,
  $$Add Chipotle to your Family Watchlist and write one sentence: what is pricing power, and why does Chipotle have some?$$,
  $$As a family, pick a food you buy often. Talk about whether you would still buy it if the price went up a little, and what would make you switch to something cheaper.$$,
  $$Use Chipotle to introduce pricing power, the ability to charge more without losing customers, and how a simple menu keeps a business efficient. Ask your kids which brands they would pay extra for.$$,
  $$Design a tiny menu for a pretend food stand with only four items. Tell the family why keeping it small would make your stand faster and better.$$,
  $$Your child learned that a company is stronger when customers will pay a little more without leaving, and that a simple menu can make a business run better. We used Chipotle because "would you still buy it if it cost more" is a question kids can actually answer.$$,
  $$• What food would we still buy if it got more expensive?
• What is pricing power, in your own words?
• Why might a small menu be smarter than a huge one?
• What would make you switch to a cheaper option?$$,
  $$Say: "Chipotle keeps its menu small and its ingredients trusted, so people happily pay a bit more. Being able to charge more without losing customers is a real strength. It is called pricing power."$$,
  $$Do not turn it into "let's buy Chipotle." We are learning pricing power, not making a trade.$$,
  $$Even a strong brand has risks: rising food costs, tough rivals, and how quickly a food-safety scare can shake trust. Loved does not mean guaranteed.$$,
  $$Chipotle earned its pricing power over many years of consistency. We study the idea, not this quarter's price.$$,
  true, false
),

-- ── Week: Roblox (RBLX) ─────────────────────────────────────────────────────
(
  '2026-09-21', 'How Roblox Makes Money From Play', 'Roblox', 'RBLX',
  $$Roblox is not one game. It is a place where millions of people play games that other people, many of them young, build themselves. Roblox provides the tools and the world; the players and creators fill it.$$,
  $$Players buy a virtual currency called Robux and spend it inside games on items and upgrades. Roblox keeps a share of that spending and passes some to the creators who made the games. It earns when the people on it spend and create.$$,
  $$There is always something new to play because a huge community keeps building it. Friends hang out, play together, and make their own worlds, which keeps them coming back.$$,
  $$How many people use Roblox each day, how much time they spend, and how much they spend on Robux. A platform is worth watching by how alive and active its community is.$$,
  $$Its audience is young, so keeping them safe and keeping parents comfortable really matters. Tastes in games shift fast, and Roblox spends heavily to keep the platform running and growing.$$,
  $$On Roblox, regular people build the games. Why might a company that lets others create for it be powerful, and what does it owe those creators?$$,
  $$Add Roblox to your Family Watchlist and write one sentence: what is a "platform," and how does Roblox earn when others create?$$,
  $$As a family, name three things where the users make most of the content: a video app, a game, a photo app. Talk about why the company gets stronger when its users create more.$$,
  $$Use Roblox to introduce the platform idea, a business that grows when other people build and spend on it. Ask your kids what they would build if they made a Roblox game, and how it might earn.$$,
  $$Sketch an idea for a game you would build on a platform like Roblox. Tell the family one thing players might happily spend on inside it.$$,
  $$Your child learned that some companies do not make the product themselves. They build a platform and earn when others create and spend on it. We used Roblox because your kids likely understand it better than most grown-ups do.$$,
  $$• What apps do we use where the users make the content?
• Why is a platform strong when its community is active?
• What does Roblox owe the people who build its games?
• If you built a game, what would people spend on?$$,
  $$Say: "Roblox does not make most of the games. It gives people the tools to build them, and it earns a share when players spend. It is a platform, and it grows when its community grows."$$,
  $$Do not turn it into "should we buy Roblox." Keep the focus on the business model, not on spending more Robux. This is a conversation, not a purchase.$$,
  $$A platform built around young players carries real responsibilities, safety and trust above all, plus fast-changing tastes and heavy running costs. Fun and busy does not mean guaranteed.$$,
  $$Roblox grew its community over many years. We study how a platform works, not this week's price.$$,
  true, false
),

-- ── Week: Coca-Cola (KO) ────────────────────────────────────────────────────
(
  '2026-09-28', 'The Company That Sells Happiness (and Syrup)', 'Coca-Cola', 'KO',
  $$Coca-Cola makes the concentrate and syrups for Coke and dozens of other drinks. Here is the twist: it often does not bottle and deliver the drinks itself. It sells the concentrate to bottling partners who do that part.$$,
  $$It sells its secret concentrate to bottlers around the world, who add the water and fizz, package it, and get it into stores. Coca-Cola earns on the concentrate and on the brand, and lets partners handle the heavy, low-profit work of bottling and shipping.$$,
  $$The taste and the brand. Coke is familiar and consistent everywhere on earth, and people reach for it out of habit and feeling. That worldwide recognition is one of the strongest brands ever built.$$,
  $$How much of its drinks the world buys, how the brand holds up against rivals and healthier trends, and the fact that it has paid its owners a steady share of profits for decades. Consistency is the story.$$,
  $$Tastes are shifting toward less sugar, and rivals and store brands compete hard. Selling in every country also means world events and money-exchange swings affect the results.$$,
  $$Coca-Cola mostly sells the syrup, not the finished bottle. Why might it be smart to let someone else do the heavy work of bottling and shipping?$$,
  $$Add Coca-Cola to your Family Watchlist and write one sentence: what does Coca-Cola actually sell to its bottling partners, and why is its brand so valuable?$$,
  $$As a family, do a label check: how many drinks in your kitchen are made by Coca-Cola? Talk about why one company owns so many brands.$$,
  $$Use Coca-Cola to introduce a brand moat, a name so trusted it protects the business, and the idea of selling the core ingredient while partners handle the rest. Ask your kids what makes a brand impossible to forget.$$,
  $$Find three drinks in your house and check who makes them. See how many trace back to one big company. Bring your list to family night.$$,
  $$Your child learned that a powerful brand can be a company's strongest asset, and that a business can sell the core ingredient while partners do the heavy lifting. We used Coca-Cola because it is a name every family already knows by heart.$$,
  $$• Why do people reach for a brand they know without thinking?
• What does Coca-Cola actually sell to its bottlers?
• What could make a famous brand lose its shine?
• If you built a drink brand, how would you make people remember it?$$,
  $$Say: "Coca-Cola mostly sells the secret syrup and the famous name. Other companies add the water, bottle it, and ship it. The brand is the treasure. People all over the world already trust it."$$,
  $$Do not drift into "is Coke a good buy." We are learning about brand strength and the concentrate model, not making a trade.$$,
  $$Even the most famous brand has risks: health trends moving away from sugar, tough rivals, and the ups and downs of selling everywhere on earth. Famous is not the same as safe.$$,
  $$Coca-Cola built its brand over more than a century. We study why a brand is valuable, not this week's price.$$,
  true, false
),

-- ── Week: Mattel (MAT) ──────────────────────────────────────────────────────
(
  '2026-10-05', 'What Makes a Toy Company Strong', 'Mattel', 'MAT',
  $$Mattel makes toys and owns some of the most famous ones in the world, including Barbie and Hot Wheels. It designs the toys, licenses its characters, and sells them through stores and online.$$,
  $$It sells toys, of course, but its real strength is owning brands kids ask for by name. It also earns by licensing those characters, putting Barbie or Hot Wheels on clothes, games, and even movies, and from families buying more sets and pieces over time.$$,
  $$Kids know the characters and want the newest set, and parents trust the familiar names. A strong toy brand becomes part of play for years, and one toy often leads to buying more that go with it.$$,
  $$Whether its big brands stay popular, how the holiday season goes (a huge part of toy sales), and whether it can turn its characters into movies and shows the way other brands have.$$,
  $$Toy tastes change fast, and screens compete for kids' attention. Toy sales lean heavily on the holidays, so a weak season hurts, and a rival's hot toy can steal the spotlight.$$,
  $$Think of a toy brand you loved that made you want MORE of the same set. Why is owning a brand kids ask for by name so valuable to a toy company?$$,
  $$Add Mattel to your Family Watchlist and write one sentence: name one Mattel brand and one way the company earns beyond just selling the toy. Then name a rival toy company.$$,
  $$As a family, pick two toy brands that compete. Talk about which one you would rather own a slice of, and the single reason that decides it.$$,
  $$Use Mattel to bring together brand strength, repeat buying, and comparing rivals. Ask your kids which toy brand they would bet on for the next ten years, and why.$$,
  $$Pick your favorite toy brand and its biggest rival. Tell the family which one you would own and the ONE reason that made you choose it.$$,
  $$Your child learned that a toy company's real asset is the brands kids ask for by name, and that comparing two rivals is the start of real analysis. We used Mattel because its brands, like Barbie and Hot Wheels, are ones your family already recognizes.$$,
  $$• Which toy brand would we bet on for ten years, and why?
• Why is a name kids ask for so valuable?
• How does a toy company earn beyond selling the toy?
• Between two rival brands, which wins, and what decided it?$$,
  $$Say: "Mattel owns toy brands kids already want, like Barbie and Hot Wheels. It earns by selling them, by putting the characters on other things, and by families buying more of the set. The brand is the prize."$$,
  $$Do not turn it into "should we buy Mattel." We are practicing brand thinking and comparing rivals, not making a trade.$$,
  $$Even a famous toymaker has risks: fast-changing tastes, screens pulling kids away, and a business that leans hard on the holidays. A hit today can fade fast.$$,
  $$Mattel's brands have lasted generations, through good years and bad. We study why a brand endures, not this week's price.$$,
  true, false
)

on conflict (week_start) do nothing;
