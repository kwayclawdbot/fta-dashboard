/* eslint-disable @next/next/no-img-element */
import type { CSSProperties } from "react";
import Link from "next/link";
import type { ProfileHeaderVM } from "@/ui-v3/you-data";
import { beltToneVar } from "./belt-tone";
import ScoreRing from "./ScoreRing";
import styles from "./ProfileHeader.module.css";

/**
 * Board "07 You Profile" — screen title, avatar, belt line, and the dial.
 *
 * Every optional element (avatar photo, the ★, the standing line, the dial) is
 * omitted when its view-model field is null rather than filled with a stand-in.
 */
export default function ProfileHeader({ vm }: { vm: ProfileHeaderVM }) {
  return (
    <>
      <div className={styles.titleRow}>
        <div className={styles.title}>you</div>
        {/* The artboard draws the gear as a glyph with no destination, and no v3
            settings screen has been translated yet — so it stays inert here
            rather than inventing a route. */}
        <span className={styles.settings} aria-hidden="true">
          ⚙
        </span>
      </div>

      <div className={styles.identity}>
        <div className={styles.avatarRing}>
          <div className={styles.avatar}>
            {vm.avatarUrl ? (
              <img className={styles.avatarImage} src={vm.avatarUrl} alt="" />
            ) : (
              vm.initials
            )}
          </div>
        </div>

        <div className={styles.who}>
          <div className={styles.name}>{vm.displayName}</div>
          <Link
            href="/v3/you/belts"
            className={styles.beltRow}
            style={{ "--belt-tone": beltToneVar(vm.beltTone) } as CSSProperties}
          >
            <span className={styles.beltSwatch} />
            <span className={styles.beltLabel}>{vm.beltLabel}</span>
            {vm.isApex ? <span className={styles.star}>★</span> : null}
          </Link>
          {vm.standing ? <div className={styles.rank}>{vm.standing}</div> : null}
        </div>

        {vm.ring ? (
          <ScoreRing pct={vm.ring.pct} value={vm.ring.value} label={vm.ring.label} />
        ) : null}
      </div>
    </>
  );
}
