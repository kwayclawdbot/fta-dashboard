import type { StatTileVM } from "@/ui-v3/you-data";
import styles from "./StatTiles.module.css";

/**
 * The counter row. The adapter supplies only the tiles it can actually back, so
 * a missing metric narrows the row rather than showing a zero it cannot defend.
 */
export default function StatTiles({ tiles }: { tiles: StatTileVM[] }) {
  if (tiles.length === 0) return null;

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
