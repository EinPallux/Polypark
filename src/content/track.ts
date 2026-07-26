import { money, type Money } from "@/shared/money";

/**
 * The track vocabulary (GAME_DESIGN §8.2, TECH §4.6) — authored port metadata
 * for the CoasterKit piece library, measured from the GLBs themselves
 * (survey: M3 kickoff). Everything the builder, validator, physics and
 * renderer know about a piece lives here; adding track content = adding data.
 *
 * Geometry conventions:
 * - Poses live on a 1 m horizontal lattice (half of the 2 m build cell — the
 *   loop piece exits 1 m sideways) and 0.5 m vertical "levels".
 * - A piece is authored in its local frame: enter at the origin heading +z.
 *   `exit` is the exit port pose in that frame; `turn` is the heading change
 *   in quarter-turns (only left turns exist unflipped — a piece attached by
 *   its exit end runs backwards and becomes the right-hand/descending twin).
 * - The canonical port height is the RAIL TOP: railY = baseY + level × 0.5
 *   + 0.3, matching a ground-level station-track piece (rail +0.3 above
 *   ground). Family meshes hang `railToOrigin` above their rails.
 */

export type TrackFamilyId = "steel" | "mouse";

export type TrackKind =
  | "station"
  | "straight"
  | "corner-small"
  | "corner-large"
  | "curve"
  | "hill"
  | "hill-half"
  | "corner-small-ramp"
  | "corner-large-ramp"
  | "bump-up"
  | "bump-down"
  | "loop";

export interface TrackKindDef {
  readonly kind: TrackKind;
  /** Exit port in the local frame: meters sideways (+x right), meters forward, levels up. */
  readonly exit: { readonly dx: number; readonly dz: number; readonly dLevel: number };
  /** Heading change in quarter-turns, −1 = left. */
  readonly turn: -1 | 0;
  /** Rail arc length in meters (train kinematics + friction). */
  readonly arcLen: number;
  /** Local-frame footprint rect in meters (occupancy rasterization). */
  readonly rect: {
    readonly x0: number;
    readonly x1: number;
    readonly z0: number;
    readonly z1: number;
  };
  /** Extra rail height reached mid-piece above entry rail, in meters (clearance). */
  readonly crest: number;
  /** Rail dip below entry rail mid-piece, in meters (bump-down needs headroom). */
  readonly dip: number;
  readonly tags: {
    readonly station?: boolean;
    readonly climb?: boolean; // chain-lift engages when ascending
    readonly airtime?: boolean;
    readonly inversion?: boolean;
    readonly gentle?: boolean;
  };
  /** Cost multiplier over the family's per-piece average (GAME_BALANCE §5.2). */
  readonly costFactor: number;
}

export const TRACK_KINDS: Readonly<Record<TrackKind, TrackKindDef>> = {
  station: {
    kind: "station",
    exit: { dx: 0, dz: 4, dLevel: 0 },
    turn: 0,
    arcLen: 4,
    rect: { x0: -1, x1: 2.5, z0: 0, z1: 4 }, // includes the boarding platform
    crest: 0,
    dip: 0,
    tags: { station: true },
    costFactor: 0, // priced by the family's base cost instead
  },
  straight: {
    kind: "straight",
    exit: { dx: 0, dz: 4, dLevel: 0 },
    turn: 0,
    arcLen: 4,
    rect: { x0: -1, x1: 1, z0: 0, z1: 4 },
    crest: 0,
    dip: 0,
    tags: {},
    costFactor: 1,
  },
  "corner-small": {
    kind: "corner-small",
    exit: { dx: -2, dz: 2, dLevel: 0 },
    turn: -1,
    arcLen: Math.PI, // quarter circle r=2
    rect: { x0: -2, x1: 1, z0: 0, z1: 2.4 },
    crest: 0,
    dip: 0,
    tags: {},
    costFactor: 1,
  },
  "corner-large": {
    kind: "corner-large",
    exit: { dx: -4, dz: 4, dLevel: 0 },
    turn: -1,
    arcLen: 2 * Math.PI, // quarter circle r=4
    rect: { x0: -4, x1: 1, z0: 0, z1: 4.4 },
    crest: 0,
    dip: 0,
    tags: { gentle: true },
    costFactor: 1.8,
  },
  curve: {
    kind: "curve",
    exit: { dx: -2, dz: 4, dLevel: 0 },
    turn: 0,
    arcLen: 4.5, // lazy S, 2 m lateral over 4 m
    rect: { x0: -3, x1: 1, z0: 0, z1: 4 },
    crest: 0,
    dip: 0,
    tags: { gentle: true },
    costFactor: 1.2,
  },
  hill: {
    kind: "hill",
    exit: { dx: 0, dz: 4, dLevel: 2 },
    turn: 0,
    arcLen: 4.12, // hypotenuse of 4 m run, 1 m rise
    rect: { x0: -1, x1: 1, z0: 0, z1: 4 },
    crest: 1,
    dip: 0,
    tags: { climb: true },
    costFactor: 1.5,
  },
  "hill-half": {
    kind: "hill-half",
    exit: { dx: 0, dz: 4, dLevel: 1 },
    turn: 0,
    arcLen: 4.03,
    rect: { x0: -1, x1: 1, z0: 0, z1: 4 },
    crest: 0.5,
    dip: 0,
    tags: { climb: true },
    costFactor: 1.2,
  },
  "corner-small-ramp": {
    kind: "corner-small-ramp",
    exit: { dx: -2, dz: 2, dLevel: 2 },
    turn: -1,
    arcLen: 3.5,
    rect: { x0: -2, x1: 1, z0: 0, z1: 2.4 },
    crest: 1,
    dip: 0,
    tags: { climb: true },
    costFactor: 2,
  },
  "corner-large-ramp": {
    kind: "corner-large-ramp",
    exit: { dx: -4, dz: 4, dLevel: 2 },
    turn: -1,
    arcLen: 6.5,
    rect: { x0: -4, x1: 1, z0: 0, z1: 4.4 },
    crest: 1,
    dip: 0,
    tags: { climb: true, gentle: true },
    costFactor: 2.4,
  },
  "bump-up": {
    kind: "bump-up",
    exit: { dx: 0, dz: 4, dLevel: 0 },
    turn: 0,
    arcLen: 4.25,
    rect: { x0: -1, x1: 1, z0: 0, z1: 4 },
    crest: 0.5,
    dip: 0,
    tags: { airtime: true },
    costFactor: 1.3,
  },
  "bump-down": {
    kind: "bump-down",
    exit: { dx: 0, dz: 4, dLevel: 0 },
    turn: 0,
    arcLen: 4.25,
    rect: { x0: -1, x1: 1, z0: 0, z1: 4 },
    crest: 0,
    dip: 0.5,
    tags: { airtime: true },
    costFactor: 1.3,
  },
  loop: {
    kind: "loop",
    exit: { dx: -1, dz: 4, dLevel: 0 },
    turn: 0,
    arcLen: 13, // 2 m approach/exit + ~9 m loop circumference
    rect: { x0: -2, x1: 1, z0: 0, z1: 4 },
    crest: 3.7, // loop top rail ≈ +3.7 m over entry rail
    dip: 0,
    tags: { inversion: true },
    costFactor: 4,
  },
};

export const TRACK_KIND_LIST: readonly TrackKind[] = Object.keys(TRACK_KINDS) as TrackKind[];

export interface TrackFamilyDef {
  readonly family: TrackFamilyId;
  /** i18n key base, e.g. ride.steel → "Steelwind". */
  readonly nameKey: string;
  /** Station + base cost / per-piece average / train — GAME_BALANCE §5.2. */
  readonly baseCostCents: number;
  readonly pieceCostCents: number;
  readonly trainCostCents: number;
  readonly upkeepPerPieceCents: number;
  /** Mesh origin height above the rail top, measured from the GLBs. */
  readonly railToOrigin: number;
  readonly stationRailToOrigin: number;
  /** Catalog piece per kind (station renders the station-track mesh ×4). */
  readonly pieceIds: Readonly<Record<TrackKind, string>>;
  readonly trainPieceId: string;
  readonly cars: number;
  /** Car spacing along the rail, meters. */
  readonly carPitch: number;
  readonly seatsPerCar: number;
  /** Typical stat midpoints used for palette hints (GAME_BALANCE §5.2). */
  readonly minPieces: number;
  readonly breakdownMtbfCycles: number;
}

export const TRACK_FAMILIES: Readonly<Record<TrackFamilyId, TrackFamilyDef>> = {
  steel: {
    family: "steel",
    nameKey: "ride.family.steel",
    baseCostCents: 14_000_00,
    pieceCostCents: 340_00,
    trainCostCents: 3_600_00,
    upkeepPerPieceCents: 34_00,
    railToOrigin: 0.7,
    stationRailToOrigin: -0.3,
    pieceIds: {
      station: "coasterkit/steel-station-track",
      straight: "coasterkit/steel-straight",
      "corner-small": "coasterkit/steel-corner-small",
      "corner-large": "coasterkit/steel-corner-large",
      curve: "coasterkit/steel-curve",
      hill: "coasterkit/steel-hill-complete",
      "hill-half": "coasterkit/steel-hill-half",
      "corner-small-ramp": "coasterkit/steel-corner-small-ramp",
      "corner-large-ramp": "coasterkit/steel-corner-large-ramp",
      "bump-up": "coasterkit/steel-bump-up",
      "bump-down": "coasterkit/steel-bump-down",
      loop: "coasterkit/steel-looping",
    },
    trainPieceId: "coasterkit/train",
    cars: 4,
    carPitch: 1.45,
    seatsPerCar: 4,
    minPieces: 10,
    breakdownMtbfCycles: 380,
  },
  mouse: {
    family: "mouse",
    nameKey: "ride.family.mouse",
    baseCostCents: 9_000_00,
    pieceCostCents: 260_00,
    trainCostCents: 2_200_00,
    upkeepPerPieceCents: 30_00,
    railToOrigin: 0.9,
    stationRailToOrigin: -0.1,
    pieceIds: {
      station: "coasterkit/mouse-station-track",
      straight: "coasterkit/mouse-straight",
      "corner-small": "coasterkit/mouse-corner-small",
      "corner-large": "coasterkit/mouse-corner-large",
      curve: "coasterkit/mouse-curve",
      hill: "coasterkit/mouse-hill-complete",
      "hill-half": "coasterkit/mouse-hill-half",
      "corner-small-ramp": "coasterkit/mouse-corner-small-ramp",
      "corner-large-ramp": "coasterkit/mouse-corner-large-ramp",
      "bump-up": "coasterkit/mouse-bump-up",
      "bump-down": "coasterkit/mouse-bump-down",
      loop: "coasterkit/mouse-looping",
    },
    trainPieceId: "coasterkit/train",
    cars: 2,
    carPitch: 1.45,
    seatsPerCar: 4,
    minPieces: 8,
    breakdownMtbfCycles: 300,
  },
};

export function trackPieceCost(family: TrackFamilyId, kind: TrackKind): Money {
  const familyDef = TRACK_FAMILIES[family];
  const def = TRACK_KINDS[kind];
  return money(Math.round(familyDef.pieceCostCents * def.costFactor));
}

/**
 * Physics constants for the piecewise energy model (TECH §4.6). v² bookkeeping
 * in m²/s²; deterministic, no per-frame integration. Tuned so the golden
 * layouts in sim tests land inside their GAME_BALANCE §5.3 bands.
 */
export const TRACK_PHYSICS = {
  gravity: 9.81,
  /** v² lost per meter of rail to friction/drag. */
  frictionPerMeter: 0.55,
  /** Chain lift carries the train at this speed on climb pieces. */
  chainSpeedMps: 3.8,
  /** Station launch/dispatch speed. */
  launchSpeedMps: 4.2,
  /** Below this the train valleys — layout invalid. */
  minSpeedMps: 1.1,
  /** Above this the layout is rejected as unsafe (add hills, not brakes). */
  maxSpeedMps: 26,
  /** Loops need at least this entry speed to carry through the inversion. */
  loopEntrySpeedMps: 9,
} as const;

/** Support column pieces (auto-generated under elevated track). */
export const SUPPORT_PIECES = {
  small: "coasterkit/support-small",
  large: "coasterkit/support-large",
} as const;

export const STATION_PROP_PIECES = {
  platform: "coasterkit/station",
  gate: "coasterkit/station-gate",
} as const;
