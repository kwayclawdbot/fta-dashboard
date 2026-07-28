"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { m as mm, AnimatePresence } from "@/lib/motion";
import { Check, ChevronRight, Volume2, VolumeX } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { awardXp, hasXpForRef } from "@/lib/xp";
import { beltCelebrateFields } from "@/lib/belts";
import MissionEmblem from "@/components/fic/MissionEmblem";
import { DisplayHead, Meter, EmptyLine } from "@/components/f0/parts";
import { BoardSection } from "@/components/clubhome/board";
import Celebrate, {
  useSoundOptIn,
  type CelebrateOptions,
  type Register,
} from "@/components/fic/Celebrate";
import { deriveRegister, celebrateRegister } from "@/lib/register";

/**
 * MISSIONS — the quest set, drawn in the BOARD's card language.
 *
 * FORM (board 01 + the streak/progress card on board 09's sheet): the surface is
 * a display masthead, ONE tinted accent object (`.club-b-warm`) carrying how far
 * through the set you are, then the missions themselves as white `.club-b-card`
 * rows — 14px radius, sand hairline, no shadow. Each row is a rank pip hung off
 * its top-left corner, the emblem as the identity tile, the ask, and the reward
 * in the right-hand mono column. The previous version built this page out of the
 * hairline ledger vocabulary (`f0-ledger`, `f0-section-rule`, `f0-frame`); that
 * was the earlier system and none of it survives here.
 *
 * DATA: everything on this surface is real. `get_missions_state` returns the
 * profile register, the `fic_missions` rows, this user's `mission_completions`,
 * the championed-companies count, and lifetime XP in one round trip. There is
 * no `club_missions` table on this branch and nothing here invents one — the
 * set renders exactly the missions the RPC hands back, and an empty payload
 * produces a stated empty rather than placeholder rows. There is no mission
 * STREAK in the payload, so the header card carries set progress and the two XP
 * totals it can actually prove, and never a fabricated day count.
 *
 * COLOUR LAW: completion is NOT green. Green and red are price colours and a
 * mission has no price, so a collected mission is marked by an accent check
 * glyph, its emblem's earned ring and a COLLECTED mark — never by turning green.
 * The accent (family gold / club orange / FTA metallic) carries the reward, the
 * progress bar and the start action: brand + action, by law.
 *
 * DARK: every colour is a semantic token, a `.club-b-*` board class or the gold
 * ramp, all of which flip at :root[data-theme="dark"]. No `dark:` variants.
 *
 * REGISTER: kid / teen / parent copy is derived from age_group first (a teen is
 * never handed the kid voice), and the sound opt-in only ever appears for kids.
 * The adult voice is the default and the kid voice is the derivation — the set
 * reads competitive, not cartoonish.
 *
 * NO RINGS HERE: Brand Detective's progress is a BAR and a numeral — the shared
 * `f0 Meter`, whose fill is `bg-accent`, so it is mode-correct with no override.
 * The board reserves its conic dial for a single bounded score; a five-step
 * mission counter is a bar.
 *
 * LOADING ≠ EMPTY: the skeleton is the card set's own shape, because "nothing
 * published" is a real state on this page and a spinner cannot be told from it.
 *
 * XP IS UNTOUCHED: both award paths (the deferred Brand Detective auto-complete
 * and the self-reported completion) still insert into `mission_completions`,
 * still guard with `hasXpForRef(..., "bonus", "mission:<id>")`, and still call
 * `awardXp` with the mission's own `xp_reward` under that same ref.
 */

interface Mission {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  kid_prompt: string | null;
  xp_reward: number;
  sort: number;
}

interface Completion {
  mission_id: string;
  evidence: string | null;
  completed_at: string;
}

const BRAND_DETECTIVE_GOAL = 5;
const EMBLEM_SRC: Record<string, string> = {
  "brand-detective": "/missions/brand-detective.webp",
  "snack-stock": "/missions/snack-stock.webp",
  "money-machine": "/missions/money-machine.webp",
  "stock-vs-product": "/missions/stock-vs-product.webp",
  "family-ceo": "/missions/family-ceo.webp",
};

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function MissionsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [isKid, setIsKid] = useState(false);
  const [register, setRegister] = useState<Register>("kid");
  const [missions, setMissions] = useState<Mission[]>([]);
  const [completions, setCompletions] = useState<Record<string, Completion>>({});
  const [championedCount, setChampionedCount] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);
  const [xp, setXp] = useState(0);
  const [queue, setQueue] = useState<CelebrateOptions[]>([]);
  const [soundOn, toggleSound] = useSoundOptIn();

  const enqueue = useCallback((o: CelebrateOptions) => setQueue((q) => [...q, o]), []);

  const load = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      setLoading(false);
      return;
    }
    setUserId(user.id);

    // One aggregate round trip: profile + missions + this user's completions +
    // championed count + lifetime XP (was 5 sequential queries).
    const { data: stateRaw } = await supabase.rpc("get_missions_state");
    const state = (stateRaw || {}) as {
      role?: string;
      age_group?: string;
      family_id?: string | null;
      xp?: number;
      championed?: number;
      missions?: Mission[];
      completions?: Completion[];
    };

    setFamilyId(state.family_id ?? null);
    // Single source of truth: age_group wins, role only disambiguates legacy
    // rows. A teen (age_group='teens') is never treated as a kid here, so the
    // kid copy + sound toggle never leak to teens.
    const reg = deriveRegister({ role: state.role, age_group: state.age_group });
    setIsKid(reg === "kid");
    setRegister(celebrateRegister(reg));

    const list = state.missions || [];
    setMissions(list);

    const compMap: Record<string, Completion> = {};
    for (const c of state.completions || []) compMap[c.mission_id] = c;
    setCompletions(compMap);

    const championed = state.championed || 0;
    setChampionedCount(championed);
    setXp(state.xp || 0);
    setLoading(false); // paint now — the initial data is one round trip in

    // Deferred (post-paint): auto-complete Brand Detective when the 5-add goal
    // is met. Rare write; must never block first content.
    const brand = list.find((m) => m.slug === "brand-detective");
    if (brand && championed >= BRAND_DETECTIVE_GOAL && !compMap[brand.id]) {
      const { error } = await supabase.from("mission_completions").insert({
        mission_id: brand.id,
        user_id: user.id,
        family_id: state.family_id ?? null,
        evidence: `Added ${championed} companies to the family watchlist.`,
      });
      if (!error) {
        const already = await hasXpForRef(
          supabase,
          user.id,
          "bonus",
          `mission:${brand.id}`
        );
        if (!already) {
          await awardXp(
            supabase,
            user.id,
            "bonus",
            brand.xp_reward,
            `mission:${brand.id}`
          );
        }
        setCompletions((prev) => ({
          ...prev,
          [brand.id]: {
            mission_id: brand.id,
            evidence: `Added ${championed} companies to the family watchlist.`,
            completed_at: new Date().toISOString(),
          },
        }));
      }
    }
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function completeMission(m: Mission) {
    if (busy || completions[m.id]) return;
    setBusy(true);
    const ev = evidence.trim();
    const { error } = await supabase.from("mission_completions").insert({
      mission_id: m.id,
      user_id: userId,
      family_id: familyId,
      evidence: ev || null,
    });
    if (!error) {
      const prevXp = xp;
      let newXp = xp;
      const already = await hasXpForRef(supabase, userId, "bonus", `mission:${m.id}`);
      if (!already) {
        await awardXp(supabase, userId, "bonus", m.xp_reward, `mission:${m.id}`);
        newXp = xp + m.xp_reward;
        setXp(newXp);
      }
      setCompletions((prev) => ({
        ...prev,
        [m.id]: {
          mission_id: m.id,
          evidence: ev || null,
          completed_at: new Date().toISOString(),
        },
      }));
      setOpenId(null);
      setEvidence("");

      // Register-correct celebration: emblem stamp + confetti + XP (kid sound opt-in).
      enqueue({
        variant: "mission",
        register,
        title: isKid ? "Nailed it!" : "Mission complete",
        subtitle: m.title,
        xp: already ? undefined : m.xp_reward,
        emblemSrc: EMBLEM_SRC[m.slug],
        sound: register === "kid" && soundOn,
      });

      // Belt ceremony if a level (= belt degree) was crossed.
      const belt = beltCelebrateFields(prevXp, newXp, isKid);
      if (belt) {
        enqueue({
          variant: "levelup",
          register,
          ...belt,
          sound: register === "kid" && soundOn,
        });
      }
    }
    setBusy(false);
  }

  const doneCount = Object.keys(completions).length;
  const earned = missions.reduce(
    (sum, m) => sum + (completions[m.id] ? m.xp_reward : 0),
    0
  );
  const outstanding = missions.reduce(
    (sum, m) => sum + (completions[m.id] ? 0 : m.xp_reward),
    0
  );
  const setPct =
    missions.length > 0 ? Math.round((doneCount / missions.length) * 100) : 0;

  /* LOADING ≠ EMPTY (§0.4). The old spinner was indistinguishable from "no
     missions published", which is a real state here. This is the card set's own
     shape — the warm progress object, then emblem / title / reward cards — so
     the page never lies about whether content is coming. */
  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-8" aria-busy="true">
        <div>
          <div className="h-3 w-24 animate-pulse rounded bg-sand" />
          <div className="mt-3 h-11 w-64 animate-pulse rounded bg-sand" />
          <div className="mt-4 h-4 w-full max-w-sm animate-pulse rounded bg-sand/60" />
        </div>
        <div className="club-b-warm px-5 py-5">
          <div className="h-2.5 w-28 animate-pulse rounded-full bg-ink/10" />
          <div className="mt-3 h-8 w-32 animate-pulse rounded bg-ink/10" />
          <div className="mt-4 h-1.5 w-full animate-pulse rounded-full bg-ink/10" />
        </div>
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="club-b-card flex items-center gap-4 px-4 py-4">
              <div className="h-[52px] w-[52px] shrink-0 animate-pulse rounded-full bg-sand/60" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-1/2 animate-pulse rounded bg-sand/60" />
                <div className="h-3 w-3/4 animate-pulse rounded bg-sand/40" />
              </div>
              <div className="h-6 w-10 shrink-0 animate-pulse rounded bg-sand/50" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const title =
    register === "kid" ? "My Missions" : register === "teen" ? "Missions" : "Family Missions";
  const titleParts = title.split(" ");
  const titleMark = titleParts[titleParts.length - 1];
  const titleLead = titleParts.slice(0, -1).join(" ");
  const lede =
    register === "kid"
      ? "Little quests that turn you into an investor. Collect every emblem in the set."
      : register === "teen"
        ? "Quests that earn XP and move your belt. Finish the set."
        : "Quests for your kids — run them together and they turn into real conversations.";

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Celebrate opts={queue[0] ?? null} onDone={() => setQueue((q) => q.slice(1))} />

      {/* Masthead — the shared display head, one annotated word. The marked
          word is the last one so the register reads the same for "My Missions",
          "Missions" and "Family Missions" without a special case. */}
      <mm.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <DisplayHead
          eyebrow="The set"
          title={titleLead}
          mark={titleMark}
          lede={lede}
          aside={
            isKid ? (
              <button
                onClick={toggleSound}
                aria-label={soundOn ? "Turn sound off" : "Turn sound on"}
                title={soundOn ? "Sound on" : "Sound off"}
                className="f0-chip f0-focus f0-press h-10 w-10 shrink-0 justify-center text-soft hover:text-ink"
              >
                {soundOn ? (
                  <Volume2 className="h-4 w-4" />
                ) : (
                  <VolumeX className="h-4 w-4" />
                )}
              </button>
            ) : undefined
          }
        />
      </mm.div>

      {/* THE ONE TINTED OBJECT — how far through the set you are. Every numeral
          is derived from what the RPC actually returned; there is no streak in
          the payload, so this card never claims one. */}
      {missions.length > 0 && (
        <section className="club-b-warm f0-grain px-5 py-5" aria-label="Set progress">
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink">
                Your progress
                <span className="text-accent"> through the set</span>
              </p>
              <p className="mt-2 font-display text-display-2 font-extrabold leading-none tabular-nums text-ink">
                {doneCount}
                <span className="text-soft">/{missions.length}</span>
              </p>
              <p className="mt-1.5 text-[12px] leading-snug text-soft">
                Emblems collected
              </p>
            </div>
            <p className="shrink-0 font-mono text-[22px] font-semibold leading-none tabular-nums text-accent">
              {setPct}%
            </p>
          </div>

          <Meter pct={setPct} className="mt-4" />

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="club-b-chip inline-flex items-baseline gap-1.5 px-2.5 py-1">
              <span className="font-mono text-[12px] font-semibold tabular-nums text-ink">
                {earned}
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-soft">
                XP banked
              </span>
            </span>
            <span className="club-b-chip inline-flex items-baseline gap-1.5 px-2.5 py-1">
              <span className="font-mono text-[12px] font-semibold tabular-nums text-ink">
                {outstanding}
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-soft">
                XP left
              </span>
            </span>
          </div>
        </section>
      )}

      {/* The set — white cards on the paper, one per mission. */}
      {missions.length === 0 ? (
        <EmptyLine
          title="No missions are published yet"
          body="The quest set lands here as soon as it is published. Nothing is hidden — there is simply nothing to run today."
        />
      ) : (
        <BoardSection
          id="missions-set"
          label="Missions"
          mark="in this set"
          sub="Finish one, collect its emblem, bank the XP."
        >
          <div className="f0-stagger mt-4 space-y-3">
            {missions.map((m, i) => {
              const completion = completions[m.id];
              const done = !!completion;
              const isBrand = m.slug === "brand-detective";
              const brandPct = Math.min(
                100,
                Math.round((championedCount / BRAND_DETECTIVE_GOAL) * 100)
              );
              const open = openId === m.id;

              return (
                <div
                  key={m.id}
                  style={{ "--i": Math.min(i, 12) } as React.CSSProperties}
                  className="relative"
                >
                  {/* The board hangs its rank pip half off the card's top-left
                      corner. Collected missions carry the lead (accent) pip. */}
                  <span
                    className={`club-b-pip ${done ? "club-b-pip-lead" : ""} absolute -left-[7px] -top-[7px] z-10`}
                    aria-hidden
                  >
                    {i + 1}
                  </span>

                  <div className="club-b-card px-4 py-4">
                    <div className="flex items-start gap-4">
                      <MissionEmblem
                        slug={m.slug}
                        title={m.title}
                        collected={done}
                        size={52}
                        className="self-start"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                          <h3 className="font-display text-[17px] font-extrabold tracking-tight text-ink">
                            {m.title}
                          </h3>
                          <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-soft">
                            Mission {i + 1}
                          </span>
                        </div>
                        <p className="mt-1 text-[14px] leading-relaxed text-soft">
                          {m.kid_prompt || m.description}
                        </p>
                        {/* Grown-up helper — parents only, never shown to teens. */}
                        {register === "parent" && m.description && m.kid_prompt && (
                          <p className="mt-1.5 text-[13px] leading-relaxed text-soft">
                            {m.description}
                          </p>
                        )}
                      </div>

                      <div className="shrink-0 text-right">
                        <p
                          className={`font-mono text-[15px] font-semibold tabular-nums ${
                            done ? "text-accent" : "text-ink"
                          }`}
                        >
                          {m.xp_reward}
                        </p>
                        <p className="mt-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-soft">
                          {done ? shortDate(completion.completed_at) : "XP"}
                        </p>
                      </div>
                    </div>

                    {/* Collected — an accent check and the emblem's earned ring
                        carry the state. No green: green is price. */}
                    {done && (
                      <div className="mt-3 border-t border-sand pt-3">
                        <p className="flex items-center gap-1.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-accent">
                          <Check className="h-3.5 w-3.5" />
                          Collected
                        </p>
                        {completion.evidence && (
                          <p className="mt-2 text-[14px] leading-relaxed text-ink">
                            {completion.evidence}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Brand Detective — auto-progress from real watchlist adds.
                        A tinted progress row with the percentage on the right,
                        exactly as the board draws its progress rows. */}
                    {isBrand && !done && (
                      <div className="mt-3 border-t border-sand pt-3">
                        <div className="mb-2 flex items-baseline justify-between gap-3">
                          <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-soft tabular-nums">
                            {championedCount} / {BRAND_DETECTIVE_GOAL} companies added
                          </span>
                          <span className="font-mono text-[13px] font-semibold tabular-nums text-accent">
                            {brandPct}%
                          </span>
                        </div>
                        {/* Shared meter: same geometry, same accent fill and the
                            same 700ms ease as every other progress bar in the app. */}
                        <Meter pct={brandPct} />
                        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[13px] leading-relaxed text-soft">
                            Auto-completes when {BRAND_DETECTIVE_GOAL} companies are on the
                            family watchlist.
                          </p>
                          <Link
                            href="/watchlist"
                            className="f0-focus f0-press shrink-0 font-display text-[13px] font-bold text-gold-700 transition-colors hover:text-gold-600"
                          >
                            Add companies →
                          </Link>
                        </div>
                      </div>
                    )}

                    {/* Action — everything except Brand Detective is self-reported. */}
                    {!done && !isBrand && (
                      <div className="mt-3 border-t border-sand pt-3">
                        <AnimatePresence initial={false}>
                          {open ? (
                            <mm.div
                              key="form"
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden"
                            >
                              <label
                                htmlFor={`evidence-${m.id}`}
                                className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-soft"
                              >
                                What did you find? (optional)
                              </label>
                              <textarea
                                id={`evidence-${m.id}`}
                                value={evidence}
                                onChange={(e) => setEvidence(e.target.value)}
                                rows={2}
                                placeholder="In your own words…"
                                className="f0-focus mt-2 w-full resize-none rounded-[10px] border border-sand bg-paper p-3 text-[14px] text-ink placeholder:text-soft focus:outline-none"
                              />
                              <div className="mt-3 flex items-center gap-4">
                                <button
                                  onClick={() => completeMission(m)}
                                  disabled={busy}
                                  className="f0-focus f0-press inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 font-display text-[13px] font-extrabold uppercase tracking-[0.06em] text-[color:var(--accent-on)] disabled:opacity-60"
                                >
                                  <Check className="h-4 w-4" />
                                  Mark complete · +{m.xp_reward} XP
                                </button>
                                <button
                                  onClick={() => {
                                    setOpenId(null);
                                    setEvidence("");
                                  }}
                                  className="f0-focus f0-press font-display text-[13px] font-bold text-soft transition-colors hover:text-ink"
                                >
                                  Cancel
                                </button>
                              </div>
                            </mm.div>
                          ) : (
                            <button
                              key="start"
                              onClick={() => {
                                setOpenId(m.id);
                                setEvidence("");
                              }}
                              className="f0-focus f0-press group inline-flex items-center gap-1 font-display text-[14px] font-bold text-gold-700 transition-colors hover:text-gold-600"
                            >
                              Start this mission
                              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />
                            </button>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </BoardSection>
      )}
    </div>
  );
}
