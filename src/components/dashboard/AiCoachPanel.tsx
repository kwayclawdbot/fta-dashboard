"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles, Loader2, Mic, MicOff, Volume2 } from "lucide-react";
// Auth handled by Next.js API routes (cookie-based)

interface Message {
  role: "user" | "assistant";
  content: string;
  audioUrl?: string;
}

interface AiCoachPanelProps {
  lessonTitle: string;
  lessonId?: string;
  courseTitle?: string;
  sectionContent?: string;
}

const SUGGESTED_PROMPTS = [
  "Explain this concept simply",
  "Give me a real-world example",
  "What are common mistakes?",
  "Quiz me on this topic",
];

// Uses Next.js API routes (same domain, no CORS)

export default function AiCoachPanel({
  lessonTitle,
  lessonId,
  courseTitle,
  sectionContent,
}: AiCoachPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Hey! I'm your AI trading coach. Ask me anything about **${lessonTitle}** — I'll answer with voice.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Prime audio on mount
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.volume = 0.9;
  }, []);

  // Init speech recognition
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) {
      const recognition = new SR();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognitionRef.current = recognition;
    }
  }, []);

  async function handleSend(text?: string) {
    const msg = text || input.trim();
    if (!msg || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setLoading(true);

    // Prime audio on user gesture
    if (audioRef.current) {
      try {
        audioRef.current.src = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAABhvz/xwAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
        await audioRef.current.play();
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch {}
    }

    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ask",
          lesson_id: lessonId || "",
          section_content: sectionContent || "",
          question: msg,
          conversation_history: messages.slice(-6).map((m) => ({
            role: m.role === "user" ? "student" : "coach",
            content: m.content,
          })),
          audio: true,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.text, audioUrl: data.audio_url },
      ]);

      // Auto-play voice response
      if (data.audio_url && audioRef.current) {
        audioRef.current.src = data.audio_url;
        audioRef.current.onended = () => setIsPlaying(false);
        setIsPlaying(true);
        try {
          await audioRef.current.play();
        } catch {
          setIsPlaying(false);
        }
      }
    } catch (err) {
      console.error("[Coach]", err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I had trouble connecting. Try again." },
      ]);
    }

    setLoading(false);
  }

  function toggleRecording() {
    if (!recognitionRef.current) return;

    if (isRecording) {
      // Stop — process what we have
      recognitionRef.current.stop();
      setIsRecording(false);
      return;
    }

    // Start
    let finalText = "";
    setIsRecording(true);

    recognitionRef.current.onresult = (event: any) => {
      finalText = "";
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += t;
        else interim += t;
      }
      setInput(finalText || interim);
    };

    recognitionRef.current.onend = () => {
      setIsRecording(false);
      if (finalText.trim()) {
        handleSend(finalText.trim());
      }
    };

    recognitionRef.current.onerror = (e: any) => {
      console.warn("[Coach] Speech error:", e.error);
      setIsRecording(false);
    };

    // Request mic permission first
    navigator.mediaDevices?.getUserMedia({ audio: true })
      .then((stream) => {
        stream.getTracks().forEach((t) => t.stop());
        try {
          recognitionRef.current.start();
        } catch (e) {
          console.error("[Coach] Start error:", e);
          setIsRecording(false);
        }
      })
      .catch(() => {
        setIsRecording(false);
      });
  }

  function playAudio(url: string) {
    if (!audioRef.current) return;
    audioRef.current.src = url;
    audioRef.current.onended = () => setIsPlaying(false);
    setIsPlaying(true);
    audioRef.current.play().catch(() => setIsPlaying(false));
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
                msg.role === "assistant" ? "bg-gold-400/15" : "bg-midnight-700"
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
              {msg.audioUrl && msg.role === "assistant" && (
                <button
                  onClick={() => playAudio(msg.audioUrl!)}
                  className="mt-1.5 flex items-center gap-1 text-xs text-gold-400/60 hover:text-gold-400 transition-colors"
                >
                  <Volume2 className="w-3 h-3" />
                  Play audio
                </button>
              )}
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
          {recognitionRef.current && (
            <button
              type="button"
              onClick={toggleRecording}
              className={`p-2 rounded-lg transition-colors ${
                isRecording
                  ? "bg-red-500/20 text-red-400 animate-pulse"
                  : "bg-midnight-800 text-midnight-400 hover:text-midnight-200"
              }`}
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isRecording ? "Listening..." : "Ask your coach..."}
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
