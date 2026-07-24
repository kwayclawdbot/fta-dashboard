import type { SupabaseClient } from "@supabase/supabase-js";
import { isSoloHousehold } from "@/lib/register";

/**
 * Profile-building onboarding — the data model + the logic that makes the
 * answers immediately DO something (personalized welcome + dashboard
 * "recommended next" card). One source of truth for both surfaces so the
 * welcome screen and the home card can never drift apart.
 *
 * Backing table: family_profiles (migration 075). Every field optional; the
 * flow writes partial data as the parent goes and stamps completed_at only when
 * they finish. Nothing here blocks claiming a paid membership.
 */

// ── Vocab ────────────────────────────────────────────────────────────────────

export type Experience = "none" | "beginner" | "some" | "active";
/** Which side of the market the family cares about (migration 108, Lane 8A). */
export type MarketInterest = "investing" | "trading" | "both" | "unsure";
export type Goal =
  | "teach_kids"
  | "family_habit"
  | "build_wealth"
  | "learn_trading"
  | "prep_college"
  | "other";
export type KidAgeRange = "under5" | "5-8" | "9-12" | "13-17";
export type HearAbout =
  | "friend"
  | "social"
  | "search"
  | "podcast"
  | "event"
  | "other";

export interface Household {
  adults: number;
  kids: number;
  kid_age_ranges: KidAgeRange[];
}

export interface FamilyProfile {
  family_id: string;
  household: Household;
  experience: Experience | null;
  market_interest: MarketInterest | null;
  goals: Goal[];
  goals_other: string | null;
  hear_about: HearAbout | null;
  motivation: string | null;
  completed_at: string | null;
  updated_at?: string;
}

/** What the onboarding steps collect before we write. Partial by design. */
export interface ProfileDraft {
  household: Household;
  experience: Experience | null;
  market_interest: MarketInterest | null;
  goals: Goal[];
  goals_other: string;
  hear_about: HearAbout | null;
  motivation: string;
}

export function emptyDraft(): ProfileDraft {
  return {
    household: { adults: 1, kids: 0, kid_age_ranges: [] },
    experience: null,
    market_interest: null,
    goals: [],
    goals_other: "",
    hear_about: null,
    motivation: "",
  };
}

// ── Copy for the step UIs (kept here so both routes read the same options) ───

export const EXPERIENCE_OPTIONS: {
  value: Experience;
  label: string;
  sub: string;
}[] = [
  {
    value: "none",
    label: "Brand new to all of this",
    sub: "Brand new is exactly who we built this for.",
  },
  {
    value: "beginner",
    label: "I know the words, not the habit",
    sub: "You've heard the terms — let's make it stick.",
  },
  {
    value: "some",
    label: "I've dabbled a bit",
    sub: "A few trades or a long-held fund. Ready for structure.",
  },
  {
    value: "active",
    label: "I already invest actively",
    sub: "You trade — now bring the whole family in.",
  },
];

export const GOAL_OPTIONS: { value: Goal; label: string; sub: string }[] = [
  { value: "teach_kids", label: "Raise money-smart kids", sub: "Investors, not spenders" },
  { value: "family_habit", label: "A weekly family money habit", sub: "Something we do together" },
  { value: "build_wealth", label: "Build long-term family wealth", sub: "Play the long game" },
  { value: "learn_trading", label: "Finally learn to invest myself", sub: "Start from the beginning" },
  { value: "prep_college", label: "Prepare for college / a first job", sub: "Real-world money skills" },
  { value: "other", label: "Something else", sub: "Tell us in your words" },
];

export const MARKET_INTEREST_OPTIONS: {
  value: MarketInterest;
  label: string;
  sub: string;
}[] = [
  {
    value: "investing",
    label: "Long-term investing",
    sub: "Buy good companies and hold for years.",
  },
  {
    value: "trading",
    label: "Active trading",
    sub: "Shorter-term moves and chart setups.",
  },
  {
    value: "both",
    label: "A bit of both",
    sub: "Invest for the long game, learn to trade too.",
  },
  {
    value: "unsure",
    label: "Not sure yet",
    sub: "We'll help you figure out what fits.",
  },
];

export const KID_AGE_OPTIONS: { value: KidAgeRange; label: string }[] = [
  { value: "under5", label: "Under 5" },
  { value: "5-8", label: "5 – 8" },
  { value: "9-12", label: "9 – 12" },
  { value: "13-17", label: "13 – 17" },
];

export const HEAR_ABOUT_OPTIONS: { value: HearAbout; label: string }[] = [
  { value: "friend", label: "A friend or family member" },
  { value: "social", label: "Social media" },
  { value: "search", label: "Google / search" },
  { value: "podcast", label: "A podcast" },
  { value: "event", label: "An event or class" },
  { value: "other", label: "Somewhere else" },
];

// ── Prefill from the free-class funnel quiz (migration 060) ──────────────────
// Funnel users already answered ages / goal / experience — never re-ask what we
// know. Returns a partial draft to merge over emptyDraft().

interface FreeClassQuiz {
  ages?: string; // young | teens | mixed | adults
  goal?: string; // kids_money | family_habit | learn_myself | all
  experience?: string; // beginner | some | investing
  [k: string]: unknown;
}

export function draftFromQuiz(quiz: FreeClassQuiz | null | undefined): Partial<ProfileDraft> {
  if (!quiz) return {};
  const out: Partial<ProfileDraft> = {};

  // experience: quiz beginner|some|investing → none/beginner | some | active
  if (quiz.experience === "beginner") out.experience = "beginner";
  else if (quiz.experience === "some") out.experience = "some";
  else if (quiz.experience === "investing") out.experience = "active";

  // goal → goals[]
  const goalMap: Record<string, Goal[]> = {
    kids_money: ["teach_kids"],
    family_habit: ["family_habit"],
    learn_myself: ["learn_trading"],
    all: ["teach_kids", "family_habit", "build_wealth"],
  };
  if (quiz.goal && goalMap[quiz.goal]) out.goals = goalMap[quiz.goal];

  // ages → household kid age ranges (best-effort; counts stay for them to confirm)
  const ageMap: Record<string, { kids: number; ranges: KidAgeRange[] }> = {
    young: { kids: 1, ranges: ["5-8", "9-12"] },
    teens: { kids: 1, ranges: ["13-17"] },
    mixed: { kids: 2, ranges: ["5-8", "13-17"] },
    adults: { kids: 0, ranges: [] },
  };
  if (quiz.ages && ageMap[quiz.ages]) {
    const m = ageMap[quiz.ages];
    out.household = { adults: 2, kids: m.kids, kid_age_ranges: m.ranges };
  }

  return out;
}

// ── The payload we persist ───────────────────────────────────────────────────

export function draftToRow(draft: ProfileDraft, familyId: string, complete: boolean) {
  return {
    family_id: familyId,
    household: draft.household,
    experience: draft.experience,
    market_interest: draft.market_interest,
    goals: draft.goals,
    goals_other: draft.goals_other.trim() || null,
    hear_about: draft.hear_about,
    motivation: draft.motivation.trim() || null,
    ...(complete ? { completed_at: new Date().toISOString() } : {}),
    updated_at: new Date().toISOString(),
  };
}

// ── The payoff: recommendations derived from the answers ─────────────────────
// Pure + deterministic so the welcome screen and the dashboard card render the
// SAME picks. Ordered most-personal-first; capped at three.

export interface Recommendation {
  key: string;
  title: string;
  sub: string;
  href: string;
  /** lucide icon name — resolved by the rendering component. */
  icon: string;
}

export function deriveRecommendations(
  p: Pick<FamilyProfile, "household" | "experience" | "goals"> &
    Partial<Pick<FamilyProfile, "market_interest">>
): Recommendation[] {
  const recs: Recommendation[] = [];
  const kids = p.household?.kids ?? 0;
  const hasKids = kids > 0 || (p.household?.kid_age_ranges?.length ?? 0) > 0;
  // Solo (individual) members: never surface kid/parent framing, and speak to
  // "you", not "your family". A solo household is one adult, no kids.
  const solo = isSoloHousehold(p.household);
  const exp = p.experience;
  const goals = p.goals ?? [];
  const interest = p.market_interest ?? null;
  const push = (r: Recommendation) => {
    if (!recs.some((x) => x.href === r.href)) recs.push(r);
  };

  // 1. Kids in the house → the together-play surfaces.
  if (hasKids) {
    push({
      key: "missions",
      title: "Kid Missions",
      sub: "Hands-on money quests your kids do with you",
      href: "/missions",
      icon: "Target",
    });
  }

  // 2. Meet them at their experience level.
  if (exp === "none" || exp === "beginner") {
    push({
      key: "start-here",
      title: "Start Here — Lesson 1",
      sub: "Begin at the very beginning. No prior knowledge needed.",
      href: "/start-here",
      icon: "Compass",
    });
  } else if (exp === "active" || exp === "some") {
    push({
      key: "watchlist",
      title: "Build your Watchlist",
      sub: "Track the companies your family is watching",
      href: "/watchlist",
      icon: "Star",
    });
    push({
      key: "practice",
      title: "Practice Chart",
      sub: "Test ideas with pretend money in the simulator",
      href: "/simulator",
      icon: "LineChart",
    });
  }

  // 3. Trading interest → the practice surfaces (deduped against experience).
  if (interest === "trading" || interest === "both") {
    push({
      key: "practice",
      title: "Practice Chart",
      sub: "Test trade ideas with pretend money in the simulator",
      href: "/simulator",
      icon: "LineChart",
    });
  }

  // 4. Goal-driven picks.
  if (goals.includes("teach_kids")) {
    push({
      key: "parent-corner",
      title: "Parent Corner",
      sub: "This week's dinner-table money questions",
      href: "/parent-corner",
      icon: "Users",
    });
  }
  if (hasKids || goals.includes("family_habit")) {
    push(
      solo
        ? {
            key: "this-week",
            title: "This Week in FIC",
            sub: "One concept, one company, one weekly habit",
            href: "/dashboard?tab=this-week",
            icon: "CalendarDays",
          }
        : {
            key: "this-week",
            title: "This Week in FIC — together",
            sub: "One concept, one company, one family habit",
            href: "/dashboard?tab=this-week",
            icon: "CalendarDays",
          }
    );
  }

  // Fallback so the card is never empty.
  if (recs.length === 0) {
    push({
      key: "courses",
      title: "Browse the courses",
      sub: "Foundations and the live program",
      href: "/courses",
      icon: "BookOpen",
    });
  }

  return recs.slice(0, 3);
}

// ── Personalized welcome headline + lines ────────────────────────────────────

export function familyShortLabel(familyName: string | null | undefined): string {
  if (!familyName) return "Your family";
  // "The Johnson Family" → "The Johnson family"; "Osei's Family" → "The Osei family"
  const cleaned = familyName.trim();
  if (/family/i.test(cleaned)) return cleaned.replace(/family/i, "family");
  return `The ${cleaned} family`;
}

export function composeWelcome(
  p: Pick<FamilyProfile, "household" | "experience" | "goals">,
  familyName: string | null | undefined,
  displayName?: string | null
): { title: string; lines: string[] } {
  const kids = p.household?.kids ?? 0;
  const hasKids = kids > 0 || (p.household?.kid_age_ranges?.length ?? 0) > 0;
  const solo = isSoloHousehold(p.household);
  const lines: string[] = [];

  if (hasKids) {
    const n = kids > 0 ? kids : p.household?.kid_age_ranges?.length ?? 1;
    lines.push(`${n} kid${n === 1 ? "" : "s"} learning alongside you`);
  }

  switch (p.experience) {
    case "none":
      lines.push("Starting from the very beginning — perfect.");
      break;
    case "beginner":
      lines.push("You know the words — we'll build the habit.");
      break;
    case "some":
      lines.push("You've dabbled — let's give it structure.");
      break;
    case "active":
      lines.push("You already invest — let's bring the family in.");
      break;
  }

  if (p.goals?.includes("teach_kids"))
    lines.push("Here to raise money-smart kids.");
  else if (p.goals?.includes("build_wealth"))
    lines.push(
      solo
        ? "Here to build long-term wealth."
        : "Here to build long-term family wealth."
    );

  // Solo members get a "just you" welcome — no "family" label, addressed by
  // their own name, with an individual-toned fallback line.
  if (solo) {
    const first = (displayName || "").trim().split(" ")[0];
    return {
      title: first ? `Welcome, ${first}` : "Welcome",
      lines: lines.length ? lines : ["Your investing home is ready."],
    };
  }

  return {
    title: `Welcome, ${familyShortLabel(familyName)}`,
    lines: lines.length ? lines : ["Your family's investing home is ready."],
  };
}

// ── Fetch / save ─────────────────────────────────────────────────────────────

export async function fetchFamilyProfile(
  supabase: SupabaseClient,
  familyId: string
): Promise<FamilyProfile | null> {
  const { data } = await supabase
    .from("family_profiles")
    .select("*")
    .eq("family_id", familyId)
    .maybeSingle();
  if (!data) return null;
  return normalizeProfile(data);
}

export function normalizeProfile(row: Record<string, unknown>): FamilyProfile {
  const h = (row.household as Partial<Household>) || {};
  return {
    family_id: row.family_id as string,
    household: {
      adults: typeof h.adults === "number" ? h.adults : 1,
      kids: typeof h.kids === "number" ? h.kids : 0,
      kid_age_ranges: Array.isArray(h.kid_age_ranges)
        ? (h.kid_age_ranges as KidAgeRange[])
        : [],
    },
    experience: (row.experience as Experience) ?? null,
    market_interest: (row.market_interest as MarketInterest) ?? null,
    goals: Array.isArray(row.goals) ? (row.goals as Goal[]) : [],
    goals_other: (row.goals_other as string) ?? null,
    hear_about: (row.hear_about as HearAbout) ?? null,
    motivation: (row.motivation as string) ?? null,
    completed_at: (row.completed_at as string) ?? null,
    updated_at: (row.updated_at as string) ?? undefined,
  };
}

export function profileToDraft(p: FamilyProfile): ProfileDraft {
  return {
    household: p.household,
    experience: p.experience,
    market_interest: p.market_interest,
    goals: p.goals,
    goals_other: p.goals_other ?? "",
    hear_about: p.hear_about,
    motivation: p.motivation ?? "",
  };
}

/** Upsert partial or complete profile data. Best-effort; returns success. */
export async function saveFamilyProfile(
  supabase: SupabaseClient,
  familyId: string,
  draft: ProfileDraft,
  complete: boolean
): Promise<boolean> {
  const { error } = await supabase
    .from("family_profiles")
    .upsert(draftToRow(draft, familyId, complete), { onConflict: "family_id" });
  return !error;
}

/** Is the "recommended next" card still fresh (first week)? */
export function isRecommendationsFresh(completedAt: string | null): boolean {
  if (!completedAt) return false;
  const age = Date.now() - new Date(completedAt).getTime();
  return age >= 0 && age < 7 * 24 * 60 * 60 * 1000;
}
