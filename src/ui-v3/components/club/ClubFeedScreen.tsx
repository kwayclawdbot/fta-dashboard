import type { ClubFeedViewModel } from "@/ui-v3/club-data";
import AppShell from "@/ui-v3/components/AppShell";
import SectionEyebrow from "@/ui-v3/components/SectionEyebrow";
import EmptyNote from "@/ui-v3/components/EmptyNote";
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
      <ClubHeader
        active="feed"
        right={<ClubHeadActions canPost={!model.viewer || model.viewer.canPost} />}
      />

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

      <FeedComposerRow initials={model.initials} viewer={model.viewer} />

      {model.posts.map((p) => (
        <FeedPostCard key={p.id} post={p} viewer={model.viewer} />
      ))}

      {model.changedMind ? (
        <ChangedMindCard flip={model.changedMind} viewer={model.viewer} />
      ) : null}

      {/*
        A feed with nothing in it is the one empty state on these screens that is
        empty because NOBODY HAS SPOKEN YET — which makes it an invitation rather
        than a status. The Kai row and the Circle strip are excluded from the
        test on purpose: they are not conversation, and a screen holding a Kai
        insight but no member posts is still a room where nobody has said
        anything.

        The kid register gets the same sentence without the action, because the
        action leads to a composer that register is not allowed to open.
      */}
      {model.posts.length === 0 && !model.changedMind ? (
        <EmptyNote
          action={
            model.viewer && !model.viewer.canPost
              ? undefined
              : { label: "Start the first conversation", href: "/v3/club/compose" }
          }
        >
          No one has posted yet. The Club&rsquo;s feed is whatever its members bring to it —
          a thesis, a chart, or the question you can&rsquo;t answer on your own.
        </EmptyNote>
      ) : null}

      {model.kai ? <KaiInsightRow kai={model.kai} /> : null}
    </AppShell>
  );
}
