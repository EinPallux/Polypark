import {
  TRACK_KINDS,
  TRACK_PHYSICS,
  type TrackFamilyId,
  type TrackKind,
} from "@/content/track";

/**
 * Track graph math (TECH §4.6): poses, piece chaining, occupancy footprints,
 * circuit validation, the piecewise energy model and E/I/N scoring
 * (GAME_BALANCE §5.3). Pure functions over plain data — the ride system and
 * the builder UI both consume this.
 *
 * Pose space: 1 m horizontal lattice (mx/mz in METERS, integers), 0.5 m
 * vertical levels, heading quarter-turns (0=+z · 1=+x · 2=−z · 3=−x).
 * Rail height above the ride's base ground = level × 0.5 + 0.3.
 */

export interface TrackPose {
  readonly mx: number;
  readonly mz: number;
  readonly level: number;
  readonly heading: 0 | 1 | 2 | 3;
}

export interface TrackPieceState {
  readonly kind: TrackKind;
  /** Attached by its exit end — runs backwards (right turns, drops). */
  readonly flipped: boolean;
}

/** Heading unit vectors in (x, z). */
const DIR: readonly (readonly [number, number])[] = [
  [0, 1],
  [1, 0],
  [0, -1],
  [-1, 0],
];

const rot = (heading: number, quarterTurns: number): 0 | 1 | 2 | 3 =>
  (((heading + quarterTurns) % 4) + 4) % 4 as 0 | 1 | 2 | 3;

/** Rotate a local-frame offset (right = +x, forward = +z) into world space. */
function rotateOffset(
  heading: number,
  dx: number,
  dz: number,
): { readonly x: number; readonly z: number } {
  const [fx, fz] = DIR[heading]!;
  const [rx, rz] = DIR[rot(heading, 1)]!;
  return { x: rx * dx + fx * dz, z: rz * dx + fz * dz };
}

/**
 * The pose delta a piece applies, honoring flip. Flipping mirrors the piece
 * through its exit: traversed backwards, a left turn becomes a right turn and
 * a climb becomes a drop. Derivation: if forward maps entry E→exit X with
 * lateral dx, forward dz, turn t, then backward maps X'→E' with
 * turn −t, forward dz' and lateral −dx rotated into the flipped frame.
 */
export function pieceDelta(piece: TrackPieceState): {
  readonly dx: number;
  readonly dz: number;
  readonly dLevel: number;
  readonly turn: number;
} {
  const def = TRACK_KINDS[piece.kind];
  if (!piece.flipped) {
    return { dx: def.exit.dx, dz: def.exit.dz, dLevel: def.exit.dLevel, turn: def.turn };
  }
  // Reverse traversal: rotate the negated exit offset by the inverse turn.
  const t = -def.turn;
  const local = rotateOffset(rot(0, -def.turn), -def.exit.dx, -def.exit.dz);
  // Entering the reversed piece heads along the piece's former exit direction
  // reversed; in ITS local frame the entry offset becomes:
  return { dx: -local.x, dz: -local.z, dLevel: -def.exit.dLevel, turn: t };
}

export function advancePose(pose: TrackPose, piece: TrackPieceState): TrackPose {
  const d = pieceDelta(piece);
  const off = rotateOffset(pose.heading, d.dx, d.dz);
  return {
    mx: pose.mx + off.x,
    mz: pose.mz + off.z,
    level: pose.level + d.dLevel,
    heading: rot(pose.heading, d.turn),
  };
}

export const samePose = (a: TrackPose, b: TrackPose): boolean =>
  a.mx === b.mx && a.mz === b.mz && a.level === b.level && a.heading === b.heading;

/** Entry poses for every piece in a run, starting from the station entry. */
export function pieceEntryPoses(start: TrackPose, pieces: readonly TrackPieceState[]): TrackPose[] {
  const poses: TrackPose[] = [];
  let pose = start;
  for (const piece of pieces) {
    poses.push(pose);
    pose = advancePose(pose, piece);
  }
  return poses;
}

export function openEndPose(start: TrackPose, pieces: readonly TrackPieceState[]): TrackPose {
  let pose = start;
  for (const piece of pieces) {
    pose = advancePose(pose, piece);
  }
  return pose;
}

/* ------------------------------------------------------------------ */
/* Occupancy                                                           */
/* ------------------------------------------------------------------ */

export interface TrackCellUse {
  readonly cellX: number;
  readonly cellZ: number;
  /** Rail height range above ride base, meters (for clearance checks). */
  readonly railLo: number;
  readonly railHi: number;
}

/** World-space cells (2 m grid) a piece's footprint rect overlaps. */
export function pieceCells(entry: TrackPose, piece: TrackPieceState): TrackCellUse[] {
  const def = TRACK_KINDS[piece.kind];
  // In flipped traversal the geometry occupies the same world rect, anchored
  // at the piece's forward-frame entry — recover that frame first.
  let frame = entry;
  if (piece.flipped) {
    // The forward-frame entry is this piece's exit pose, facing back at us.
    const exit = advancePose(entry, piece);
    frame = { ...exit, heading: rot(exit.heading, 2) };
  }
  const railBase = frame.level * 0.5 + 0.3;
  const corners = [
    rotateOffset(frame.heading, def.rect.x0, def.rect.z0),
    rotateOffset(frame.heading, def.rect.x1, def.rect.z0),
    rotateOffset(frame.heading, def.rect.x0, def.rect.z1),
    rotateOffset(frame.heading, def.rect.x1, def.rect.z1),
  ].map((o) => ({ x: frame.mx + o.x, z: frame.mz + o.z }));
  const minX = Math.min(...corners.map((c) => c.x));
  const maxX = Math.max(...corners.map((c) => c.x));
  const minZ = Math.min(...corners.map((c) => c.z));
  const maxZ = Math.max(...corners.map((c) => c.z));
  const cells: TrackCellUse[] = [];
  const lo = railBase - def.dip;
  const hi = railBase + Math.max(def.crest, Math.abs(pieceDelta(piece).dLevel) * 0.5);
  const EPS = 0.01; // a rect ending exactly on a cell edge doesn't claim the next cell
  for (let cx = Math.floor(minX / 2); cx * 2 < maxX - EPS; cx++) {
    for (let cz = Math.floor(minZ / 2); cz * 2 < maxZ - EPS; cz++) {
      cells.push({ cellX: cx, cellZ: cz, railLo: lo, railHi: hi });
    }
  }
  return cells;
}

/* ------------------------------------------------------------------ */
/* Energy model + stats                                                */
/* ------------------------------------------------------------------ */

export interface PieceRun {
  readonly kind: TrackKind;
  readonly flipped: boolean;
  /** Speed entering / leaving the piece, m/s. */
  readonly vIn: number;
  readonly vOut: number;
  readonly arcLen: number;
  /** Arc-length offset of the piece start from the station, meters. */
  readonly arcStart: number;
  /** Chain lift engaged (climb piece entered below chain speed). */
  readonly chained: boolean;
}

export interface TrackEvaluation {
  readonly valid: boolean;
  readonly reason?:
    | "no-pieces"
    | "not-closed"
    | "valleyed"
    | "too-fast"
    | "loop-too-slow";
  /** Piece index the failure occurred at (for builder feedback). */
  readonly failAt?: number;
  readonly runs: readonly PieceRun[];
  readonly totalArc: number;
  readonly eStat: number;
  readonly iStat: number;
  readonly nStat: number;
  readonly maxSpeed: number;
  readonly drops: number;
  readonly inversions: number;
  /** Full circuit duration in ticks at the modeled speeds. */
  readonly circuitTicks: number;
}

const P = TRACK_PHYSICS;

/**
 * Piecewise-constant energy walk (TECH §4.6): v² gains gravity on descents,
 * loses to friction along arc length; climb pieces engage the chain when the
 * train arrives below chain speed. Deterministic and cheap — validation and
 * the live builder preview both run it wholesale.
 */
export function energyWalk(pieces: readonly TrackPieceState[]): {
  runs: PieceRun[];
  fail?: { reason: "valleyed" | "too-fast" | "loop-too-slow"; at: number };
} {
  const runs: PieceRun[] = [];
  let v: number = P.launchSpeedMps;
  let arc = 0;
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i]!;
    const def = TRACK_KINDS[piece.kind];
    const d = pieceDelta(piece);
    const dh = d.dLevel * 0.5;
    if (piece.kind === "station") {
      v = P.launchSpeedMps;
    }
    if (def.tags.inversion && v < P.loopEntrySpeedMps) {
      return { runs, fail: { reason: "loop-too-slow", at: i } };
    }
    let v2 = v * v - 2 * P.gravity * dh - P.frictionPerMeter * def.arcLen;
    // The chain grabs an ascending train that would otherwise stall and
    // carries it at chain speed (fast trains coast over unchained).
    let chained = false;
    if (dh > 0 && def.tags.climb && v2 < P.chainSpeedMps * P.chainSpeedMps) {
      chained = true;
      v2 = P.chainSpeedMps * P.chainSpeedMps;
    }
    if (piece.kind === "station") {
      v2 = Math.min(v2, P.launchSpeedMps * P.launchSpeedMps);
    }
    // Mid-piece crest check for true humps (crest above the exit rail): can
    // the train carry over? Climbs skip this — their rise IS the exit height.
    if (!chained && def.crest > Math.abs(dh) + 1e-9) {
      const crestV2 = v * v - 2 * P.gravity * def.crest - P.frictionPerMeter * (def.arcLen / 2);
      if (crestV2 < P.minSpeedMps * P.minSpeedMps) {
        return { runs, fail: { reason: "valleyed", at: i } };
      }
    }
    if (v2 < P.minSpeedMps * P.minSpeedMps) {
      return { runs, fail: { reason: "valleyed", at: i } };
    }
    const vOut = Math.sqrt(v2);
    if (vOut > P.maxSpeedMps) {
      return { runs, fail: { reason: "too-fast", at: i } };
    }
    runs.push({
      kind: piece.kind,
      flipped: piece.flipped,
      vIn: v,
      vOut,
      arcLen: def.arcLen,
      arcStart: arc,
      chained,
    });
    arc += def.arcLen;
    v = vOut;
  }
  return { runs };
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

/** Corner radius proxy for lateral-G (small corners are 2 m, large 4 m). */
const CORNER_RADIUS: Partial<Record<TrackKind, number>> = {
  "corner-small": 2,
  "corner-small-ramp": 2,
  "corner-large": 4,
  "corner-large-ramp": 4,
  curve: 6,
};

/**
 * E/I/N from composition metrics per GAME_BALANCE §5.3 (v0 formula).
 * `sceneryProximity` ∈ 0..1 is sampled by the caller at build time.
 */
export function evaluateTrack(
  start: TrackPose,
  pieces: readonly TrackPieceState[],
  sceneryProximity: number,
): TrackEvaluation {
  const empty = {
    runs: [] as PieceRun[],
    totalArc: 0,
    eStat: 0,
    iStat: 0,
    nStat: 0,
    maxSpeed: 0,
    drops: 0,
    inversions: 0,
    circuitTicks: 0,
  };
  if (pieces.length === 0) {
    return { valid: false, reason: "no-pieces", ...empty };
  }
  const closed = samePose(openEndPose(start, pieces), start);
  const walk = energyWalk(pieces);
  if (walk.fail) {
    return {
      valid: false,
      reason: walk.fail.reason,
      failAt: walk.fail.at,
      ...empty,
      runs: walk.runs,
    };
  }
  if (!closed) {
    return { valid: false, reason: "not-closed", ...empty, runs: walk.runs };
  }

  const runs = walk.runs;
  const totalArc = runs.reduce((sum, r) => sum + r.arcLen, 0);
  const speeds = runs.map((r) => (r.vIn + r.vOut) / 2);
  const maxSpeed = Math.max(...runs.map((r) => r.vOut), P.launchSpeedMps);
  const mean = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  const variance = speeds.reduce((a, b) => a + (b - mean) ** 2, 0) / speeds.length;
  const speedVariance = clamp(Math.sqrt(variance) / 6, 0, 1.4);

  let drops = 0;
  let dropRun = 0;
  let dropMax = 0;
  let inversions = 0;
  let airtime = 0;
  let lateralSum = 0;
  let corners = 0;
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i]!;
    const piece = pieces[i]!;
    const d = pieceDelta(piece);
    if (d.dLevel < 0) {
      dropRun += -d.dLevel * 0.5;
      if (i + 1 >= runs.length || pieceDelta(pieces[i + 1]!).dLevel >= 0) {
        drops += 1;
        dropMax = Math.max(dropMax, dropRun);
        dropRun = 0;
      }
    } else {
      dropRun = 0;
    }
    if (TRACK_KINDS[piece.kind].tags.inversion) {
      inversions += 1;
    }
    if (TRACK_KINDS[piece.kind].tags.airtime) {
      airtime += 1;
    }
    const radius = CORNER_RADIUS[piece.kind];
    if (radius) {
      const vAvg = (run.vIn + run.vOut) / 2;
      lateralSum += (vAvg * vAvg) / radius / P.gravity; // in g
      corners += 1;
    }
  }
  const lateralG = corners > 0 ? clamp(lateralSum / corners / 2, 0, 1.6) : 0;
  const maxSpeedNorm = maxSpeed / P.maxSpeedMps;

  const eStat = clamp(
    1.2 +
      0.9 * Math.min(drops, 6) +
      1.4 * Math.min(inversions, 3) +
      2.2 * speedVariance +
      0.8 * Math.min(airtime, 4) * 0.5 +
      clamp(sceneryProximity, 0, 1) * 1.5,
    0,
    10,
  );
  const iStat = clamp(
    0.8 +
      1.1 * maxSpeedNorm * 4 +
      1.6 * Math.min(inversions, 3) +
      1.2 * lateralG +
      0.7 * Math.min(dropMax / 2, 3),
    0,
    10,
  );
  const nStat = clamp(
    0.4 + 1.8 * Math.min(inversions, 3) + 1.3 * lateralG * (maxSpeedNorm * 1.6),
    0,
    10,
  );

  // Circuit time from per-piece average speeds (ticks are 0.1 s of ride time —
  // rides run on watchable real-ish time like M2 serve loops).
  const seconds = runs.reduce((sum, r) => sum + r.arcLen / Math.max((r.vIn + r.vOut) / 2, 0.5), 0);
  const circuitTicks = Math.max(10, Math.round(seconds * 10));

  return {
    valid: true,
    runs,
    totalArc,
    eStat: Math.round(eStat * 10) / 10,
    iStat: Math.round(iStat * 10) / 10,
    nStat: Math.round(nStat * 10) / 10,
    maxSpeed,
    drops,
    inversions,
    circuitTicks,
  };
}

/**
 * The forward-frame pose a piece's MESH is anchored at. For unflipped pieces
 * that is the entry pose itself; a flipped piece renders the same geometry
 * anchored at its far end, facing back (mirrors pieceCells's recovery).
 */
export function pieceRenderFrame(entry: TrackPose, piece: TrackPieceState): TrackPose {
  if (!piece.flipped) {
    return entry;
  }
  const exit = advancePose(entry, piece);
  return { ...exit, heading: rot(exit.heading, 2) };
}

/**
 * Position/heading/pitch along the circuit at an arc offset — train playback
 * and the ride-along camera. Piecewise linear between port poses with vertical
 * flourishes: humps/dips arc sinusoidally and loops sweep a full vertical
 * circle (pitch rolls through 360°).
 */
export function poseAtArc(
  start: TrackPose,
  pieces: readonly TrackPieceState[],
  runs: readonly PieceRun[],
  arc: number,
): { x: number; z: number; y: number; headingRad: number; pitchRad: number } {
  const total = runs.reduce((s, r) => s + r.arcLen, 0);
  let a = ((arc % total) + total) % total;
  const poses = pieceEntryPoses(start, pieces);
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i]!;
    if (a <= run.arcLen + 1e-6) {
      const t = run.arcLen === 0 ? 0 : a / run.arcLen;
      const piece = pieces[i]!;
      const from = poses[i]!;
      const to = i + 1 < poses.length ? poses[i + 1]! : advancePose(from, piece);
      const x = from.mx + (to.mx - from.mx) * t;
      const z = from.mz + (to.mz - from.mz) * t;
      const level = from.level + (to.level - from.level) * t;
      const def = TRACK_KINDS[piece.kind];
      let y = level * 0.5 + 0.3;
      let pitch = 0;
      const risePerMeter = ((to.level - from.level) * 0.5) / Math.max(def.arcLen, 0.001);
      pitch = Math.atan(risePerMeter);
      if (def.tags.inversion) {
        // Vertical loop: approach (0–15%), circle (15–85%), exit (85–100%).
        if (t > 0.15 && t < 0.85) {
          const theta = ((t - 0.15) / 0.7) * Math.PI * 2;
          y += (1 - Math.cos(theta)) * 1.7;
          pitch = theta;
        }
      } else if (def.crest > 0 && def.exit.dLevel === 0) {
        y += Math.sin(t * Math.PI) * def.crest;
        pitch = Math.cos(t * Math.PI) * (def.crest / def.arcLen) * Math.PI;
      } else if (def.dip > 0) {
        y -= Math.sin(t * Math.PI) * def.dip;
        pitch = -Math.cos(t * Math.PI) * (def.dip / def.arcLen) * Math.PI;
      }
      const fromDir = DIR[from.heading]!;
      const toDir = DIR[to.heading]!;
      const hx = fromDir[0] + (toDir[0] - fromDir[0]) * t;
      const hz = fromDir[1] + (toDir[1] - fromDir[1]) * t;
      return { x, z, y, headingRad: Math.atan2(hx, hz), pitchRad: pitch };
    }
    a -= run.arcLen;
  }
  const last = poses[0]!;
  return { x: last.mx, z: last.mz, y: last.level * 0.5 + 0.3, headingRad: 0, pitchRad: 0 };
}

export type { TrackFamilyId, TrackKind };
