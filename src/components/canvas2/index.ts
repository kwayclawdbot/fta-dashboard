/**
 * CANVAS V2 FOUNDATION (lane L0) — the shared primitives every canvas-adoption
 * lane consumes. Import from here, not from the individual files, so the set
 * stays visible as a set.
 *
 * Backing CSS lives in src/app/globals.css under "CANVAS V2 — FOUNDATION":
 * .f0-tile-field, .f0-tile-empty, .f0-focus, .f0-seg-bar.
 *
 * COLOUR LAW, as it applies to these four:
 *   price delta ...... text-price-up / text-price-down   (TickerTile)
 *   community ........ lime                              (StanceControl, RespectAction)
 *   authoring action .. volt orange                      (PostTypeControl)
 *   tile ground ....... achromatic, both themes          (TickerTile)
 *
 * NOT BUILT, deliberately: no BUY badge (plan §0.1 — the app never renders a
 * directive verdict) and no radial gauge (plan §1.5 — the club score dial stays
 * the only one).
 */

export { default as TickerTile, TickerTileStrip } from "./TickerTile";
export type { TickerTileProps, TickerTileSize } from "./TickerTile";

export { default as SegmentedRail } from "./Segmented";
export type { SegmentedOption } from "./Segmented";

export { default as ScrollRow } from "./ScrollRow";
export type { ScrollRowProps } from "./ScrollRow";

export { default as StanceControl } from "./StanceControl";
export type { StanceControlProps } from "./StanceControl";

export {
  default as PostTypeControl,
  POST_TYPES,
  POST_TYPE_BY_KEY,
} from "./PostTypeControl";
export type { PostType, PostTypeDef, PostTypeControlProps } from "./PostTypeControl";

export { default as RespectAction } from "./RespectAction";
export type { RespectActionProps } from "./RespectAction";
