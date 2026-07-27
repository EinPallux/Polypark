import { money, type Money } from "@/shared/money";

/**
 * Composed buildings — the four GAME_DESIGN §10 buildings that no single pack
 * piece can be (Grill Garden, Sweet Scoop, Poly Bistro, Gift Kiosk).
 *
 * The kit-only law (ADR-16, GAME_DESIGN P7) says every game element is
 * assembled from the packs in /assets. There is no "restaurant" model anywhere
 * in the 50 packs, so a restaurant is built the way the M3 flat rides were:
 * a parts list referencing catalog pieces with local transforms. Shipping
 * these as reskinned snack stalls would have put four names on the menu with
 * one behaviour behind them, which is why they waited until now.
 *
 * Local frame matches the flat rides: origin at the footprint CENTRE, metres,
 * +z is the front — the side guests approach at rotation 0.
 *
 * Unlike a flat ride, nothing here animates, so the renderer expands parts into
 * instance transforms grouped by piece rather than cloning a scene graph per
 * building. Draw calls scale with the number of distinct part pieces, not with
 * how many restaurants the park has built.
 */

export const COMPOSED_BUILDING_IDS = [
  "composed/grill-garden",
  "composed/sweet-scoop",
  "composed/poly-bistro",
  "composed/gift-kiosk",
] as const;
export type ComposedBuildingId = (typeof COMPOSED_BUILDING_IDS)[number];

export interface BuildingPart {
  readonly pieceId: string;
  /** Metres, relative to the footprint centre at ground level. */
  readonly pos: readonly [number, number, number];
  readonly rotY?: number;
  readonly scale?: number | readonly [number, number, number];
}

export interface ComposedBuildingDef {
  /**
   * Also the placed-piece id, and the i18n key stem: the display name comes
   * from `shop.<id>` like every other shop rather than from a key of its own.
   * A composed building is a shop, and the palette, the inspector and the i18n
   * guard should not have to special-case it.
   */
  readonly id: ComposedBuildingId;
  /** Cells claimed at rotation 0 (cell = 2×2 m). */
  readonly footprint: { readonly w: number; readonly d: number };
  readonly buildCost: Money;
  /** Catalog piece whose thumbnail stands in for the composition in the palette. */
  readonly thumbPieceId: string;
  readonly parts: readonly BuildingPart[];
}

/**
 * KayKit RestaurantBits is authored on a 4 m module — walls are 4×4, floor
 * tiles 4×4 — against Polypark's 2 m cell. At 0.5 one module lands on exactly
 * one cell, which is why every structural part below shares this scale rather
 * than being nudged by eye. Measured from the pipeline's AABBs, not guessed.
 */
const RB = 0.5;

/** Kenney's Commercial awnings/parasols are authored much smaller than a façade. */
const AWNING = 2.5;
const PARASOL = 3.0;

const orderWindow = (x: number, z: number): BuildingPart => ({
  pieceId: "restaurantbits/wall-orderwindow",
  pos: [x, 0, z],
  scale: RB,
});

/** Awnings project forward from the wall face they hang on. */
const awning = (x: number, z: number, y = 1.0): BuildingPart => ({
  pieceId: "commercial/awning",
  pos: [x, y, z],
  scale: AWNING,
});

const chairAt = (x: number, z: number, y: number, rotY: number): BuildingPart => ({
  pieceId: "restaurantbits/chair",
  pos: [x, y, z],
  rotY,
  scale: RB,
});

/**
 * Tables run smaller than the structural scale. At ×0.5 a RestaurantBits round
 * top is 1.5 m across against a 0.38 m chair — a four-to-one banquet round that
 * read as a mushroom next to its own seating. ×0.4 puts it at 1.2 m, which is
 * the proportion the eye expects.
 */
const TABLE = 0.4;
const COVER_REACH = 0.85;

/** A laid table with four covers — the seats the Bistro's capacity counts. */
const tableForFour = (x: number, z: number, y: number): BuildingPart[] => [
  { pieceId: "restaurantbits/table-round", pos: [x, y, z], scale: TABLE },
  chairAt(x, z + COVER_REACH, y, Math.PI),
  chairAt(x, z - COVER_REACH, y, 0),
  chairAt(x + COVER_REACH, z, y, -Math.PI / 2),
  chairAt(x - COVER_REACH, z, y, Math.PI / 2),
];

export const COMPOSED_BUILDINGS: Readonly<Record<ComposedBuildingId, ComposedBuildingDef>> = {
  /**
   * Grill Garden — a two-window grill counter with a small garden terrace on
   * the third cell, which is what earns the name. Heavy hunger, and the salt
   * sends guests looking for a drink afterwards (GAME_BALANCE §6: Thirst −5).
   */
  "composed/grill-garden": {
    id: "composed/grill-garden",
    footprint: { w: 3, d: 2 },
    buildCost: money(5_500_00),
    thumbPieceId: "restaurantbits/stove",
    parts: [
      orderWindow(-2, 1.0),
      orderWindow(0, 1.0),
      awning(-2, 0.9),
      awning(0, 0.9),
      { pieceId: "restaurantbits/stove", pos: [-2, 0, -0.2], scale: RB },
      { pieceId: "restaurantbits/extractorhood", pos: [-2, 0, -0.2], scale: RB },
      { pieceId: "restaurantbits/counter", pos: [0, 0, -0.3], scale: RB },
      { pieceId: "restaurantbits/crate", pos: [-2.2, 0, -1.5], scale: RB },
      { pieceId: "restaurantbits/menu", pos: [-1, 0.95, 1.05], scale: 1.0 },
      // The garden: one shaded table on the spare cell column.
      { pieceId: "restaurantbits/table-round", pos: [2, 0, 0.4], scale: TABLE },
      chairAt(2, 0.4 + COVER_REACH, 0, Math.PI),
      chairAt(2, 0.4 - COVER_REACH, 0, 0),
      { pieceId: "commercial/parasol", pos: [2, 0, 0.4], scale: PARASOL },
    ],
  },

  /**
   * Sweet Scoop — a dessert counter with a chest freezer and a parasol table.
   * Light hunger plus a real Fun bump: a treat is a mood, not a meal.
   */
  "composed/sweet-scoop": {
    id: "composed/sweet-scoop",
    footprint: { w: 2, d: 2 },
    buildCost: money(4_200_00),
    thumbPieceId: "minimarket/freezer",
    parts: [
      orderWindow(-1, 1.0),
      awning(-1, 0.9),
      { pieceId: "minimarket/freezer", pos: [-1.3, 0, 0.2], scale: 1.7 },
      { pieceId: "restaurantbits/crate", pos: [-0.5, 0, 0.2], scale: RB },
      { pieceId: "restaurantbits/jar", pos: [-0.5, 0.4, 0.2], scale: 0.6 },
      { pieceId: "restaurantbits/table-small", pos: [1.1, 0, 0.4], scale: TABLE },
      { pieceId: "restaurantbits/stool", pos: [1.1, 0, 1.1], scale: RB },
      { pieceId: "restaurantbits/stool", pos: [1.1, 0, -0.3], scale: RB },
      { pieceId: "commercial/parasol", pos: [1.1, 0, 0.4], scale: PARASOL },
    ],
  },

  /**
   * Poly Bistro — the sit-down restaurant, and the park's only real source of
   * Energy. Built as an open-fronted pavilion rather than a closed box on
   * purpose: from the park camera a roofed 8×8 m building is a blank rectangle,
   * and the seats are the whole point of the building.
   */
  "composed/poly-bistro": {
    id: "composed/poly-bistro",
    footprint: { w: 4, d: 4 },
    buildCost: money(12_000_00),
    thumbPieceId: "restaurantbits/table-round",
    parts: [
      { pieceId: "restaurantbits/floor", pos: [0, 0, 0], scale: [2, 0.4, 2] },
      // Back wall: a doorway to the kitchen, one dressed segment, two windows.
      { pieceId: "restaurantbits/wall-window", pos: [-3, 0, -3.8], scale: RB },
      { pieceId: "restaurantbits/wall-doorway", pos: [-1, 0, -3.8], scale: RB },
      { pieceId: "restaurantbits/wall", pos: [1, 0, -3.8], scale: RB },
      { pieceId: "restaurantbits/wall-window", pos: [3, 0, -3.8], scale: RB },
      // Side walls stop halfway so the dining room stays open to the park.
      { pieceId: "restaurantbits/wall-window", pos: [-3.8, 0, -3], rotY: Math.PI / 2, scale: RB },
      { pieceId: "restaurantbits/wall-window", pos: [-3.8, 0, -1], rotY: Math.PI / 2, scale: RB },
      { pieceId: "restaurantbits/wall-window", pos: [3.8, 0, -3], rotY: Math.PI / 2, scale: RB },
      { pieceId: "restaurantbits/wall-window", pos: [3.8, 0, -1], rotY: Math.PI / 2, scale: RB },
      // Kitchen along the back wall.
      { pieceId: "restaurantbits/oven", pos: [-2.8, 0.2, -3.0], scale: RB },
      { pieceId: "restaurantbits/counter", pos: [-0.6, 0.2, -3.0], scale: RB },
      { pieceId: "restaurantbits/menu", pos: [1.6, 1.2, -3.6], scale: 1.2 },
      // Four laid tables — the dining room the seat count is about. No pillars
      // at the open front: with no roof over them they read as poles holding
      // nothing up.
      ...[-2.1, 2.1].flatMap((x) => [0.4, 2.7].flatMap((z) => tableForFour(x, z, 0.2))),
    ],
  },

  /**
   * Gift Kiosk — open-fronted retail under an awning. Sells Fun rather than
   * food, and the souvenir take scales with how much guests like the park.
   */
  "composed/gift-kiosk": {
    id: "composed/gift-kiosk",
    footprint: { w: 2, d: 2 },
    buildCost: money(4_800_00),
    thumbPieceId: "minimarket/shelf-bags",
    parts: [
      { pieceId: "restaurantbits/wall-window", pos: [-1, 0, -1.6], scale: RB },
      { pieceId: "restaurantbits/wall-window", pos: [1, 0, -1.6], scale: RB },
      { pieceId: "minimarket/shelf-bags", pos: [-1.2, 0, -1.0], scale: 1.5 },
      { pieceId: "minimarket/shelf-boxes", pos: [0.3, 0, -1.0], scale: 1.5 },
      { pieceId: "restaurantbits/counter", pos: [0, 0, 0.6], scale: RB },
      { pieceId: "minimarket/cash-register", pos: [0, 1.05, 0.5], scale: 0.9 },
      awning(-1, -0.9, 1.05),
      awning(1, -0.9, 1.05),
      { pieceId: "commercial/parasol", pos: [1.5, 0, 1.2], scale: PARASOL },
    ],
  },
};

export const COMPOSED_BUILDING_LIST: readonly ComposedBuildingDef[] =
  Object.values(COMPOSED_BUILDINGS);

const BY_ID: ReadonlyMap<string, ComposedBuildingDef> = new Map(
  COMPOSED_BUILDING_LIST.map((def) => [def.id as string, def]),
);

/** The composition for a placed piece id, or undefined for a plain catalog piece. */
export function composedBuilding(pieceId: string): ComposedBuildingDef | undefined {
  return BY_ID.get(pieceId);
}
