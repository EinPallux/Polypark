import { money, type Money } from "@/shared/money";

/**
 * Flat-ride roster v1 (GAME_DESIGN §9, numbers from GAME_BALANCE §5.1).
 * Every ride is a kit COMPOSITION (P7): parts reference catalog pieces with
 * local transforms; the renderer animates whole part-groups parametrically
 * (TECH §4.6 — "no physics"). Local frame: origin at footprint center,
 * meters, +z toward the ride's front (entrance side at rot 0).
 */

export type FlatRideId = "teacups" | "carousel" | "galleon" | "rocket" | "drop";

export type RideAnim =
  | { readonly kind: "spin"; readonly rpm: number; readonly counterRpm?: number }
  | {
      readonly kind: "carousel";
      readonly rpm: number;
      readonly bobHz: number;
      readonly bobAmp: number;
    }
  | {
      readonly kind: "swing";
      readonly periodS: number;
      readonly maxAngleDeg: number;
      readonly pivotY: number;
    }
  | {
      readonly kind: "drop";
      readonly riseS: number;
      readonly holdS: number;
      readonly dropS: number;
      readonly height: number;
    };

export interface RidePart {
  readonly pieceId: string;
  /** static = never moves · rotor = spins · swing = pendulum · lift = drop carriage. */
  readonly group: "static" | "rotor" | "swing" | "lift";
  readonly pos: readonly [number, number, number];
  readonly rotY?: number;
  readonly scale?: number | readonly [number, number, number];
  /** Carousel mounts bob up/down with this amplitude (m), offset by phase. */
  readonly bobAmp?: number;
  readonly phase?: number;
}

export interface FlatRideDef {
  readonly id: FlatRideId;
  readonly nameKey: string;
  readonly costCents: number;
  readonly ticketCents: number;
  readonly capacity: number;
  /** Full cycle in ticks (GAME_BALANCE cycle game-min × 5 ticks/min). */
  readonly cycleTicks: number;
  readonly eStat: number;
  readonly iStat: number;
  readonly nStat: number;
  readonly upkeepCents: number;
  readonly mtbfCycles: number;
  readonly footprint: { readonly w: number; readonly d: number };
  readonly anim: RideAnim;
  readonly parts: readonly RidePart[];
}

const pad = (
  size: number,
  y = 0,
): RidePart => ({
  pieceId: "miniarena/floor",
  group: "static",
  pos: [0, y, 0],
  scale: [size, 1, size],
});

const CUP_RADIUS = 2.8;
const CAROUSEL_MOUNTS = [
  "cubepets/bunny",
  "cubepets/chick",
  "cubepets/dog",
  "cubepets/deer",
  "cubepets/cow",
  "cubepets/cat",
  "cubepets/dog",
  "cubepets/chick",
] as const;

export const FLAT_RIDES: Readonly<Record<FlatRideId, FlatRideDef>> = {
  teacups: {
    id: "teacups",
    nameKey: "ride.teacups",
    costCents: 6_500_00,
    ticketCents: 3_00,
    capacity: 16,
    cycleTicks: 20,
    eStat: 3.2,
    iStat: 2.8,
    nStat: 4.5,
    upkeepCents: 220_00,
    mtbfCycles: 620,
    footprint: { w: 5, d: 5 },
    anim: { kind: "spin", rpm: 7, counterRpm: -16 },
    parts: [
      pad(9),
      { pieceId: "coasterkit/support-large", group: "static", pos: [0, 0, 0], scale: [1.4, 0.35, 1.4] },
      ...Array.from({ length: 6 }, (_, i): RidePart => {
        const a = (i / 6) * Math.PI * 2;
        return {
          pieceId: "foodkit/cup-tea-ride",
          group: "rotor",
          pos: [Math.cos(a) * CUP_RADIUS, 0.35, Math.sin(a) * CUP_RADIUS],
          rotY: -a,
          scale: 7,
          phase: a,
        };
      }),
    ],
  },
  carousel: {
    id: "carousel",
    nameKey: "ride.carousel",
    costCents: 5_200_00,
    ticketCents: 2_00,
    capacity: 20,
    cycleTicks: 25,
    eStat: 2.6,
    iStat: 1.4,
    nStat: 1.2,
    upkeepCents: 180_00,
    mtbfCycles: 800,
    footprint: { w: 5, d: 5 },
    anim: { kind: "carousel", rpm: 4.5, bobHz: 0.8, bobAmp: 0.25 },
    parts: [
      pad(8.5),
      { pieceId: "coasterkit/support-large", group: "static", pos: [0, 0, 0], scale: [1.2, 3.2, 1.2] },
      ...CAROUSEL_MOUNTS.map((pieceId, i): RidePart => {
        const a = (i / CAROUSEL_MOUNTS.length) * Math.PI * 2;
        return {
          pieceId,
          group: "rotor",
          pos: [Math.cos(a) * 2.7, 0.35, Math.sin(a) * 2.7],
          rotY: -a + Math.PI / 2,
          scale: 0.85,
          bobAmp: 0.25,
          phase: (i / CAROUSEL_MOUNTS.length) * Math.PI * 2,
        };
      }),
    ],
  },
  galleon: {
    id: "galleon",
    nameKey: "ride.galleon",
    costCents: 14_000_00,
    ticketCents: 4_00,
    capacity: 24,
    cycleTicks: 25,
    eStat: 5.4,
    iStat: 5.8,
    nStat: 5.0,
    upkeepCents: 420_00,
    mtbfCycles: 480,
    footprint: { w: 4, d: 9 },
    anim: { kind: "swing", periodS: 3.4, maxAngleDeg: 62, pivotY: 6.2 },
    parts: [
      pad(7.5),
      // A-frame legs, two columns each side of the swing plane.
      { pieceId: "coasterkit/support-large", group: "static", pos: [-2.6, 0, -1.4], scale: [1.4, 6.2, 1.4] },
      { pieceId: "coasterkit/support-large", group: "static", pos: [-2.6, 0, 1.4], scale: [1.4, 6.2, 1.4] },
      { pieceId: "coasterkit/support-large", group: "static", pos: [2.6, 0, -1.4], scale: [1.4, 6.2, 1.4] },
      { pieceId: "coasterkit/support-large", group: "static", pos: [2.6, 0, 1.4], scale: [1.4, 6.2, 1.4] },
      // Crossbeam at the pivot.
      { pieceId: "coasterkit/support-large", group: "static", pos: [-3.1, 6.0, 0], rotY: 0, scale: [6.4, 0.45, 0.45] },
      // The ship hangs from the swing group (pivot handled by the renderer).
      { pieceId: "piratekit/ship-pirate-small", group: "swing", pos: [0, -6.0, 0], rotY: Math.PI / 2, scale: 0.52 },
    ],
  },
  rocket: {
    id: "rocket",
    nameKey: "ride.rocket",
    costCents: 11_500_00,
    ticketCents: 4_00,
    capacity: 12,
    cycleTicks: 20,
    eStat: 4.8,
    iStat: 4.4,
    nStat: 3.6,
    upkeepCents: 360_00,
    mtbfCycles: 520,
    footprint: { w: 6, d: 6 },
    anim: { kind: "spin", rpm: 8 },
    parts: [
      pad(10),
      { pieceId: "coasterkit/support-large", group: "static", pos: [0, 0, 0], scale: [1.8, 4.4, 1.8] },
      ...Array.from({ length: 4 }, (_, i): RidePart[] => {
        const a = (i / 4) * Math.PI * 2;
        const x = Math.cos(a) * 3.9;
        const z = Math.sin(a) * 3.9;
        // rocket_baseA/topA origins sit off-center at ≈(2, 0, 1.5) — recentre.
        return [
          { pieceId: "coasterkit/support-large", group: "rotor", pos: [x * 0.5, 3.4, z * 0.5], rotY: -a, scale: [4.2, 0.3, 0.3] },
          { pieceId: "spacekit/rocket-base-a", group: "rotor", pos: [x - 2, 1.6, z - 1.5], rotY: -a, scale: 1, phase: a },
          { pieceId: "spacekit/rocket-top-a", group: "rotor", pos: [x - 2, 3.2, z - 1.5], rotY: -a, scale: 1, phase: a },
        ];
      }).flat(),
    ],
  },
  drop: {
    id: "drop",
    nameKey: "ride.drop",
    costCents: 18_500_00,
    ticketCents: 5_00,
    capacity: 12,
    cycleTicks: 15,
    eStat: 6.6,
    iStat: 7.2,
    nStat: 4.2,
    upkeepCents: 520_00,
    mtbfCycles: 430,
    footprint: { w: 4, d: 4 },
    anim: { kind: "drop", riseS: 5, holdS: 1.2, dropS: 0.7, height: 7.5 },
    parts: [
      pad(7),
      { pieceId: "coasterkit/support-large", group: "static", pos: [0, 0, 0], scale: [2.2, 9, 2.2] },
      ...Array.from({ length: 4 }, (_, i): RidePart => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return {
          pieceId: "spooktober/pumpkin-large",
          group: "lift",
          pos: [Math.cos(a) * 1.5, 0.9, Math.sin(a) * 1.5],
          rotY: -a,
          scale: 1.7,
          phase: a,
        };
      }),
    ],
  },
};

export const FLAT_RIDE_LIST: readonly FlatRideDef[] = Object.values(FLAT_RIDES);

export function flatRideCost(id: FlatRideId): Money {
  return money(FLAT_RIDES[id].costCents);
}

/** Refurbishment costs a quarter of what the ride cost to build (§4.1). */
export const REFURB_COST_RATE = 0.25;
