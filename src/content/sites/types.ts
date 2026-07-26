/**
 * Site descriptors (GAME_DESIGN §5, TECH §4.7): a Site is authored as data —
 * hand-placed landform primitives + a low-amplitude seeded noise layer —
 * evaluated deterministically at load into the cell height/slope grids and
 * the render heightfield. Landforms-as-code replaced the original PNG-map
 * idea (ADR-19): diffable, deterministic, and no binary authoring tools.
 */

export interface SiteLandform {
  readonly kind: "hill" | "basin";
  /** Center in cell coordinates (may sit outside the buildable grid). */
  readonly x: number;
  readonly z: number;
  /** Falloff radius in cells. */
  readonly radius: number;
  /** Peak height in meters (positive for hill; basin uses positive depth). */
  readonly height: number;
}

export interface ScatterGroup {
  /** Catalog piece ids to mix (uniform pick). */
  readonly pieces: readonly string[];
  /** Where it grows: outside the buildable rect ("rim") or inside ("interior"). */
  readonly region: "rim" | "interior";
  /** Attempts per cell of the region (fractional = probability). */
  readonly density: number;
  readonly minScale: number;
  readonly maxScale: number;
  /** Skip placements on slopes steeper than this class. */
  readonly maxSlope: "flat" | "gentle" | "steep";
}

export interface SiteDescriptor {
  readonly id: string;
  readonly name: string;
  /** Buildable grid size in cells (cell = 2×2 m, GAME_DESIGN §5). */
  readonly cells: { readonly w: number; readonly d: number };
  /** Decorative terrain ring beyond the buildable rect, in cells per side. */
  readonly surroundCells: number;
  /** Seed for the site's noise + scatter (independent of the park seed). */
  readonly seed: number;
  readonly landforms: readonly SiteLandform[];
  readonly noise: { readonly amplitude: number; readonly scale: number };
  /** Water fills terrain below this height (meters); cells become unbuildable. */
  readonly waterLevel: number;
  /** Gate cell on the site edge (guest spawn from M2). */
  readonly gate: { readonly x: number; readonly z: number };
  readonly scatter: readonly ScatterGroup[];
}
