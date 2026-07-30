import type { StatTileVM } from "@/ui-v3/you-data";
import EmptyNote from "@/ui-v3/components/EmptyNote";
import styles from "./StatTiles.module.css";

/**
 * The counter row. The adapter supplies only the tiles it can actually back, so
 * a missing metric narrows the row rather than showing a zero it cannot defend.
 *
 * An EMPTY row means the participation read itself failed — which is an absence,
 * not a member with no activity (that member gets tiles reading 0). Saying the
 * counters could not be read is the honest version of a blank band.
 */
export default function StatTiles({ tiles }: { tiles: StatTileVM[] }) {
  if (tiles.length === 0) {
    return <EmptyNote>Your Club counters aren&rsquo;t available right now.</EmptyNote>;
  }

  return (
    <div className={styles.row}>
      {tiles.map((tile) => (
        <div key={tile.label} className={styles.tile}>
          <div className={styles.value} data-numeric>
            {tile.value}
          </div>
          <div className={styles.label}>{tile.label}</div>
        </div>
      ))}
    </div>
  );
}
