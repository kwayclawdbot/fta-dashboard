/**
 * Free-class funnel — shared client model.
 *
 * The funnel is multi-page and resumable. A single `funnel_sessions` row (server
 * source of truth) carries the whole journey; its id lives in localStorage so a
 * refresh or a direct deep-link rehydrates. Every page logs step views/answers
 * through the thin API below; nothing here holds long-lived state itself.
 */

// ── Quiz definition (one question === one /q/[step] page) ────────────────────
export type QuizStep = {
  key: string;
  step: string; // canonical event step name: 'q1' | 'q2' | 'q3'
  question: string;
  hint?: string;
  options: { value: string; label: string; sub?: string }[];
};

export const QUIZ: QuizStep[] = [
  {
    key: "ages",
    step: "q1",
    question: "Who's learning with you?",
    hint: "We tailor the class to your family.",
    options: [
      { value: "young", label: "Younger kids", sub: "Ages 5–12" },
      { value: "teens", label: "Teens", sub: "Ages 13–17" },
      { value: "mixed", label: "A mix of ages", sub: "Little ones and teens" },
      { value: "adults", label: "Just us adults", sub: "No kids yet" },
    ],
  },
  {
    key: "goal",
    step: "q2",
    question: "What would make this worth it?",
    hint: "Pick what matters most right now.",
    options: [
      { value: "kids_money", label: "Raise money-smart kids", sub: "Investors, not spenders" },
      { value: "family_habit", label: "A weekly family money habit", sub: "Something we do together" },
      { value: "learn_myself", label: "Finally learn to invest myself", sub: "Start from the beginning" },
      { value: "all", label: "Honestly, all of it", sub: "The whole picture" },
    ],
  },
  {
    key: "experience",
    step: "q3",
    question: "Where's your family today?",
    hint: "There's a seat for every level.",
    options: [
      { value: "beginner", label: "Total beginners", sub: "We're starting fresh" },
      { value: "some", label: "We know a little", sub: "Heard the words, want the habit" },
      { value: "investing", label: "I already invest", sub: "Bringing the family in" },
    ],
  },
];

export const TOTAL_QUIZ_STEPS = QUIZ.length;

/** Ordered canonical steps for the progress bar (excludes landing + confirmed). */
export const FUNNEL_STEPS = ["q1", "q2", "q3", "save", "result", "register"] as const;

// ── Session type (mirrors the funnel_sessions columns the client reads) ──────
export interface FunnelState {
  id: string;
  answers: Record<string, string>;
  email: string | null;
  phone: string | null;
  sms_optin: boolean;
  status: "started" | "engaged" | "email_captured" | "registered" | "abandoned";
}

const LS_KEY = "fta_funnel_id";

export function getStoredFunnelId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(LS_KEY);
  } catch {
    return null;
  }
}

export function setStoredFunnelId(id: string): void {
  try {
    window.localStorage.setItem(LS_KEY, id);
  } catch {
    /* ignore */
  }
}

export function clearStoredFunnelId(): void {
  try {
    window.localStorage.removeItem(LS_KEY);
  } catch {
    /* ignore */
  }
}

// ── 5-Day Investing Challenge flag (Lane C7) ─────────────────────────────────
// Set on the landing view when the club-site CTA lands with ?challenge=1, read
// at the register step so the account is provisioned with a full-Club challenge
// pass (no card) instead of a free enrollment. Same-device localStorage carries
// it across the multi-page funnel, mirroring getStoredFunnelId.
const CHALLENGE_KEY = "fic_challenge";

export function setChallengeFlag(on: boolean): void {
  try {
    if (on) window.localStorage.setItem(CHALLENGE_KEY, "1");
    else window.localStorage.removeItem(CHALLENGE_KEY);
  } catch {
    /* ignore */
  }
}

export function getChallengeFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(CHALLENGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearChallengeFlag(): void {
  try {
    window.localStorage.removeItem(CHALLENGE_KEY);
  } catch {
    /* ignore */
  }
}

// ── UTM capture (read once on the landing view) ──────────────────────────────
export function captureUtm(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const p = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
    const v = p.get(k);
    if (v) utm[k] = v;
  }
  if (document.referrer) utm.referrer = document.referrer;
  utm.landing_at = new Date().toISOString();
  utm.landing_path = window.location.pathname + window.location.search;
  return utm;
}

// ── Thin API client ──────────────────────────────────────────────────────────
/** Create-or-resume a session. Returns the id; captures UTM on first create.
 *  De-duped via an in-flight promise on window so a double effect-invoke
 *  (React StrictMode remount) can never create two sessions for one visit. */
export async function startSession(existingId: string | null): Promise<FunnelState | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = (typeof window !== "undefined" ? window : {}) as any;
  if (w.__ftaFunnelStart) return w.__ftaFunnelStart as Promise<FunnelState | null>;

  const run = (async () => {
    try {
      const id = existingId || getStoredFunnelId();
      const res = await fetch("/api/free-class/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: id || undefined, utm: id ? undefined : captureUtm() }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as FunnelState;
      if (data?.id) setStoredFunnelId(data.id);
      return data;
    } catch {
      return null;
    }
  })();

  w.__ftaFunnelStart = run;
  return run;
}

/** Fetch current session state (rehydrate on a deep-link / refresh). */
export async function fetchSession(id: string): Promise<FunnelState | null> {
  try {
    const res = await fetch(`/api/free-class/session?id=${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    return (await res.json()) as FunnelState;
  } catch {
    return null;
  }
}

/** Log a step event (fire-and-forget). `answer` merges into the session. */
export function logEvent(
  id: string,
  step: string,
  event: "view" | "answer" | "submit" | "back" | "exit_intent",
  extra?: { answer?: { key: string; value: string }; meta?: Record<string, unknown> }
): void {
  if (!id) return;
  const body = JSON.stringify({ id, step, event, answer: extra?.answer, meta: extra?.meta });
  try {
    // keepalive so exit_intent / navigation events still flush
    fetch("/api/free-class/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

// ── Personalized result (computed from the accumulated answers) ──────────────
const AGES_BULLET: Record<string, string> = {
  young: "Your younger kids learn through money games and simple missions — zero jargon.",
  teens: "Built for teens, with real companies they already recognize.",
  mixed: "One class that lands for the little ones and the teens at the same time.",
  adults: "Adults-first — you start from zero, no kids required.",
};
const GOAL_BULLET: Record<string, string> = {
  kids_money: "A clear path to raising investors, not spenders.",
  family_habit: "A repeatable weekly money ritual you do together.",
  learn_myself: "You learn the fundamentals first, then bring the family in.",
  all: "The whole picture — your kids, the habit, and your own confidence.",
};
const EXP_BULLET: Record<string, string> = {
  beginner: "We start at the very beginning. Nothing is assumed.",
  some: "We turn what you've already heard into a habit that sticks.",
  investing: "Bring your family into what you already do every week.",
};

export interface PersonalizedResult {
  headline: string;
  subhead: string;
  bullets: string[];
}

/** Build the tailored result copy from answers + the class weekday label. */
export function personalizedResult(
  answers: Record<string, string>,
  classDay: string | null
): PersonalizedResult {
  const day = classDay || "this week's";
  // Solo (adults-only, no kids) attendees get an individual-toned result — the
  // funnel otherwise assumes "your family".
  const solo = answers.ages === "adults";
  const bullets = [
    AGES_BULLET[answers.ages],
    GOAL_BULLET[answers.goal],
    EXP_BULLET[answers.experience],
  ].filter(Boolean) as string[];

  if (solo) {
    return {
      headline: `Based on your answers, ${day}'s class was built for people starting exactly where you are.`,
      subhead:
        "Here's exactly what you'll take away — matched to what you told us matters most.",
      bullets: bullets.length
        ? bullets
        : [
            "A clear, beginner-friendly first step into investing — no experience needed.",
            "The weekly habit that turns spenders into investors.",
          ],
    };
  }

  return {
    headline: `Based on your answers, ${day}'s class was built for families like yours.`,
    subhead:
      "Here's exactly what you'll take away — matched to what you told us matters most.",
    bullets: bullets.length ? bullets : [
      "A clear, beginner-friendly first step into investing as a family.",
      "The weekly habit that turns spenders into investors.",
    ],
  };
}

/** Weekday name from an ISO time, e.g. "Wednesday". */
export function classDayName(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("en-US", { weekday: "long" });
  } catch {
    return null;
  }
}
