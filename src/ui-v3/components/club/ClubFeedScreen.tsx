import type { ClubFeedViewModel } from "@/ui-v3/club-data";
import AppShell from "@/ui-v3/components/AppShell";
import SectionEyebrow from "@/ui-v3/components/SectionEyebrow";
import ClubHeader, { ClubHeadActions } from "./ClubHeader";
import CircleBubble from "./CircleBubble";
import FeedComposerRow from "./FeedComposerRow";
import FeedPostCard from "./FeedPostCard";
import ChangedMindCard from "./ChangedMindCard";
import KaiInsightRow from "./KaiInsightRow";
import styles from "./ClubFeedScreen.module.css";

/**
 * "04 Club Feed", translated from the artboard.
 *
 * Pure presentation — every value arrives on the view model, so this same tree
 * renders live member data and the anonymous fixtures view unchanged.
 *
 * The artboard's "See all" beside HAPPENING NOW is styled --text-dim, not the
 * accent it takes on Home — SectionEyebrow's `actionTone="dim"`.
 */
export default function ClubFeedScreen({ model }: { model: ClubFeedViewModel }) {
  return (
    <AppShell>
      <ClubHeader active="feed" right={<ClubHeadActions />} />

      {model.circles.length > 0 ? (
        <>
          <div className={styles.eyebrowRow}>
            <SectionEyebrow
              actionLabel="See all"
              actionHref="/v3/club/circles"
              actionTone="dim"
            >
              Happening now
            </SectionEyebrow>
          </div>
          <div className={styles.strip}>
            {model.circles.map((c) => (
              <CircleBubble key={c.slug} circle={c} variant="feed" />
            ))}
          </div>
        </>
      ) : null}

      <FeedComposerRow initials={model.initials} />

      {model.posts.map((p) => (
        <FeedPostCard key={p.id} post={p} />
      ))}

      {model.changedMind ? <ChangedMindCard flip={model.changedMind} /> : null}

      {model.kai ? <KaiInsightRow kai={model.kai} /> : null}
    </AppShell>
  );
}
