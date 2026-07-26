/** One logical cell is 2×2 m projected onto the site terrain (GAME_DESIGN §5). */
export const CELL_SIZE_METERS = 2;

export interface CellCoord {
  readonly x: number;
  readonly z: number;
}

/** Placement rules per terrain steepness (GAME_DESIGN §5; authored per site). */
export type SlopeClass = "flat" | "gentle" | "steep";

export interface Footprint {
  /** Cells along local X before rotation. */
  readonly w: number;
  /** Cells along local Z before rotation. */
  readonly d: number;
}
