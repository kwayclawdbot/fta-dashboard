"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles, Loader2 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AiCoachPanelProps {
  lessonTitle: string;
  courseTitle?: string;
}

const SUGGESTED_PROMPTS = [
  "Explain this concept simply",
  "Give me a real-world example",
  "What are common mistakes?",
  "Quiz me on this topic",
];

export default function AiCoachPanel({
  lessonTitle,
  courseTitle,
}: AiCoachPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Hey! I'm your AI trading coach. I'm here to help you understand **${lessonTitle}**. Ask me anything about this lesson — I can explain concepts, give examples, or quiz you.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(text?: string) {
    const msg = text || input.trim();
    if (!msg || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setLoading(true);

    // Simulated AI response — replace with real API call later
    setTimeout(() => {
      const responses: Record<string, string> = {
        "Explain this concept simply": `Great question! **${lessonTitle}** is all about understanding the basics before you risk real money. Think of it like learning to drive — you start in an empty parking lot, not on the highway.\n\nThe key takeaway: master the fundamentals first, and the profits will follow.`,
        "Give me a real-world example": `Here's a real example: Say you notice a stock like AAPL has bounced off $170 three times in the past month. That $170 level is what we call **support** — buyers keep stepping in at that price.\n\nKnowing this, you might set a buy order near $170 with a stop loss just below it. That's using what you learn in this lesson in practice.`,
        "What are common mistakes?": `The #1 mistake beginners make with **${lessonTitle}**:\n\n1. **Skipping the basics** — jumping to advanced strategies too soon\n2. **Not practicing** — theory without paper trading is incomplete\n3. **Ignoring risk management** — even a great setup fails without proper stops\n4. **Emotional trading** — letting fear or greed override your plan`,
        "Quiz me on this topic": `Let's test your knowledge! 🧠\n\n**Question:** What's the most important thing to establish before placing your first trade?\n\nA) Finding the hottest stock tip\nB) A clear trading plan with risk rules\nC) Maximizing your position size\nD) Following social media traders\n\nThink about it and send me your answer!`,
      };

      const reply =
        responses[msg] ||
        `That's a great question about **${lessonTitle}**! Here's what you need to know:\n\nThis concept is fundamental to building a solid trading foundation. The key is to practice consistently and never risk more than you can afford to lose.\n\nWant me to break it down further or give you a specific example?`;

      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      setLoading(false);
    }, 1200);
  }

  function renderMarkdown(text: string) {
    return text.split("\n").map((line, i) => {
      const formatted = line
        .replace(/\*\*(.*?)\*\*/g, '<strong class="text-midnight-100">$1</strong>')
        .replace(/`(.*?)`/g, '<code class="text-gold-400 bg-midnight-800 px-1 rounded text-xs">$1</code>');
      return (
        <span
          key={i}
          dangerouslySetInnerHTML={{ __html: formatted || "&nbsp;" }}
          className="block"
        />
      );
    });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 min-h-0">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                msg.role === "assistant"
                  ? "bg-gold-400/15"
                  : "bg-midnight-700"
              }`}
            >
              {msg.role === "assistant" ? (
                <Bot className="w-3.5 h-3.5 text-gold-400" />
              ) : (
                <User className="w-3.5 h-3.5 text-midnight-300" />
              )}
            </div>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm font-body leading-relaxed ${
                msg.role === "assistant"
                  ? "bg-midnight-800/50 text-midnight-300"
                  : "bg-gold-400/10 text-midnight-200"
              }`}
            >
              {renderMarkdown(msg.content)}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2.5">
            <div className="w-6 h-6 rounded-full bg-gold-400/15 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5 text-gold-400" />
            </div>
            <div className="bg-midnight-800/50 rounded-lg px-3 py-2">
              <Loader2 className="w-4 h-4 text-gold-400 animate-spin" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 2 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => handleSend(prompt)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-midnight-800 border border-midnight-700 text-xs text-midnight-400 hover:text-midnight-200 hover:border-midnight-600 transition-colors font-body"
            >
              <Sparkles className="w-3 h-3" />
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-midnight-800">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask your coach..."
            className="flex-1 px-3 py-2 rounded-lg bg-midnight-800 border border-midnight-700 text-sm text-midnight-200 placeholder:text-midnight-600 focus:outline-none focus:border-gold-400/40 font-body"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-2 rounded-lg bg-gold-400/15 text-gold-400 hover:bg-gold-400/25 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
