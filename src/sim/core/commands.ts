import { addMoney, money, scaleMoney, subMoney } from "@/shared/money";
import { SHOP_DEFS, SHOP_PRICE_CEILING_CENTS } from "@/content/shops";
import { isUnlocked } from "../progression/unlocks";
import { FLAT_RIDES, REFURB_COST_RATE, type FlatRideId } from "@/content/rides";
import {
  TRACK_FAMILIES,
  trackPieceCost,
  type TrackFamilyId,
  type TrackKind,
} from "@/content/track";
import { sceneryProximityOf, type SimState } from "../state";
import { invalidatePathCache } from "../guests/guests";
import { dismissGoal } from "../goals/goals";
import {
  evaluateTrack,
  openEndPose,
  pieceCells,
  type TrackPieceState,
  type TrackPose,
} from "../rides/trackGraph";
import { LOAN_PRODUCTS, type LoanProductId } from "@/content/loans";
import { MARKETING_CAMPAIGNS, type MarketingCampaignId } from "@/content/marketing";
import {
  offerBlockedReason,
  openLoan,
  payLoan as applyLoanPayment,
  payoffCents,
  receivershipSpendDenial,
  totalArrears,
} from "../economy/finance";
import { startCampaign } from "../economy/marketing";
import { campaignIsLive } from "../economy/marketing";
import {
  flatRideEntranceCell,
  MAX_TRACK_PIECES,
  MECHANIC_HIRE_FEE_CENTS,
  RIDE_STATE,
  stationEntranceCell,
  trackedRideCells,
  type TrackedRide,
} from "../rides/rides";
import {
  cellIndex,
  checkPaintPath,
  checkPlace,
  footprintCells,
  PATH_OCCUPANT,
  RIDE_OCCUPANT,
  type PlaceDenial,
  type Rotation,
} from "../world/world";

/**
 * Every mutation of sim state flows through a command (TECH §4.3). Successful
 * handlers return the exact inverse command, which powers the undo/redo stacks
 * (GAME_DESIGN §8.1) and keeps money deltas perfectly symmetric.
 */
export type Command =
  | { readonly type: "park/rename"; readonly name: string }
  | {
      readonly type: "build/place";
      readonly pieceId: string;
      readonly x: number;
      readonly z: number;
      readonly rot: Rotation;
      /** Internal (undo/restore): reuse an instance id. */
      readonly forceId?: number;
      /** Internal: charge this instead of list price (exact-inverse money). */
      readonly forceCostCents?: number;
      /** Internal: record this as the piece's paid amount. */
      readonly forcePaidCents?: number;
      readonly forcePriceCents?: number;
      readonly forcePlacedAtTick?: number;
    }
  | {
      readonly type: "build/remove";
      readonly id: number;
      /** "bulldoze" applies the refund policy; "exact" refunds paidCents (undo). */
      readonly refund: "bulldoze" | "exact";
    }
  | {
      readonly type: "build/paintPath";
      readonly cells: readonly { readonly x: number; readonly z: number }[];
      readonly forceCostCentsPerCell?: number;
    }
  | {
      readonly type: "build/erasePath";
      readonly cells: readonly { readonly x: number; readonly z: number }[];
      readonly refundCentsPerCell?: number;
    }
  | { readonly type: "park/setOpen"; readonly open: boolean }
  | { readonly type: "park/setEntryFee"; readonly cents: number }
  | { readonly type: "staff/hireJanitor" }
  | { readonly type: "staff/fireJanitor" }
  | { readonly type: "staff/hireMechanic" }
  | { readonly type: "staff/fireMechanic" }
  | { readonly type: "goal/dismiss"; readonly cardId: string }
  | {
      readonly type: "finance/takeLoan";
      readonly product: LoanProductId;
      readonly forceId?: number;
      readonly forceAprBps?: number;
      readonly forceMinPaymentCents?: number;
      readonly forceOpenedMonth?: number;
    }
  | {
      readonly type: "finance/payLoan";
      readonly loanId: number;
      /** Integer cents, or "payoff" for balance + arrears. */
      readonly amount: number | "payoff";
    }
  | {
      readonly type: "marketing/start";
      readonly campaign: MarketingCampaignId;
      readonly forceStartTick?: number;
    }
  | {
      readonly type: "ride/startTrack";
      readonly family: TrackFamilyId;
      readonly mx: number;
      readonly mz: number;
      readonly heading: 0 | 1 | 2 | 3;
      readonly forceId?: number;
      readonly forceCostCents?: number;
      readonly forceCreatedAtTick?: number;
    }
  | {
      readonly type: "ride/appendPiece";
      readonly rideId: number;
      readonly kind: TrackKind;
      readonly flipped: boolean;
      readonly forceCostCents?: number;
    }
  | {
      readonly type: "ride/popPiece";
      readonly rideId: number;
      /** Internal (inverse bookkeeping): refund this exact amount. */
      readonly refundCents?: number;
      /** Internal: restore the pre-append tested flag on undo. */
      readonly restoreTested?: boolean;
    }
  | { readonly type: "ride/demolish"; readonly rideId: number }
  | {
      readonly type: "ride/setState";
      readonly rideId: number;
      readonly to: "closed" | "testing" | "open";
    }
  | { readonly type: "ride/setPrice"; readonly rideId: number; readonly cents: number }
  | {
      readonly type: "ride/refurbish";
      readonly rideId: number;
      /** Internal (replay): pin the charge so redo reproduces it exactly. */
      readonly forceCostCents?: number;
    }
  | {
      readonly type: "shop/setPrice";
      /** Placed-piece instance id — prices are per shop, not per shop type. */
      readonly placedId: number;
      readonly cents: number;
    }
  | {
      readonly type: "build/placeFlatRide";
      readonly defId: FlatRideId;
      readonly x: number;
      readonly z: number;
      readonly rot: 0 | 1 | 2 | 3;
      readonly forceId?: number;
      readonly forceCostCents?: number;
      readonly forcePlacedAtTick?: number;
    }
  | {
      readonly type: "build/removeFlatRide";
      readonly id: number;
      readonly refund: "bulldoze" | "exact";
    }
  | { readonly type: "debug/noop" };

export type CommandFailure =
  | PlaceDenial
  | "invalid"
  | "nothing-to-do"
  /** Receivership caps discretionary construction (GAME_DESIGN §14.3). */
  | "receivership-limited"
  /** The ride's trains are held by collections until arrears clear. */
  | "repossessed"
  /** Not yet on the Park Level track — a "not yet", never a "you failed to". */
  | "locked";

export type CommandResult =
  | {
      readonly ok: true;
      readonly inverse?: Command;
      /**
       * Canonical form for redo: pins ids/amounts decided during application so
       * replaying reproduces the identical state (undo-fuzz invariant).
       */
      readonly replay?: Command;
    }
  | { readonly ok: false; readonly reason: CommandFailure };

/** Bulldoze refund policy (GAME_BALANCE §3.2): 70%, or 100% within 300 ticks. */
const BULLDOZE_REFUND_RATE = 0.7;
const FULL_REFUND_TICKS = 300;
const PATH_LIST_COST_CENTS = 40_00;

/** Elevated track may cross ground stuff once rails clear head height. */
const TRACK_CLEARANCE_M = 2.5;
/** Two tracks over the same cell need this much rail separation. */
const TRACK_STACK_GAP_M = 2;

/**
 * Validate the world cells a new track piece would sweep: bounds, terrain
 * (rails never dip underground), ground conflicts below clearance, and
 * vertical separation against every other ride's rails.
 */
function checkTrackCells(
  state: SimState,
  baseHeight: number,
  cells: readonly { cellX: number; cellZ: number; railLo: number; railHi: number }[],
  excludeRideId: number,
): PlaceDenial | null {
  const terrain = state.world.terrain;
  for (const cell of cells) {
    if (!terrain.inBounds(cell.cellX, cell.cellZ)) {
      return "out-of-bounds";
    }
    const ground = terrain.cellHeight(cell.cellX, cell.cellZ);
    const railLoAbs = baseHeight + cell.railLo;
    if (railLoAbs < ground - 0.05) {
      return "too-steep"; // rails would tunnel into the hillside
    }
    if (terrain.isWater(cell.cellX, cell.cellZ) && railLoAbs < ground + 1) {
      return "water";
    }
    if (railLoAbs - ground < TRACK_CLEARANCE_M) {
      const idx = cellIndex(state.world, cell.cellX, cell.cellZ);
      if (state.world.occupancy[idx] !== 0) {
        return "occupied";
      }
    }
  }
  for (const ride of state.rides.tracked.values()) {
    if (ride.id === excludeRideId) {
      continue;
    }
    for (const mine of cells) {
      for (const theirs of trackedRideCells(ride)) {
        if (mine.cellX !== theirs.cellX || mine.cellZ !== theirs.cellZ) {
          continue;
        }
        const loA = baseHeight + mine.railLo;
        const hiA = baseHeight + mine.railHi;
        const loB = ride.baseHeight + theirs.railLo;
        const hiB = ride.baseHeight + theirs.railHi;
        if (loA < hiB + TRACK_STACK_GAP_M && loB < hiA + TRACK_STACK_GAP_M) {
          return "occupied";
        }
      }
    }
  }
  return null;
}

/** Ground cells under a station run (level 0) — claimed exclusively. */
function stationGroundCells(anchor: TrackPose): { x: number; z: number }[] {
  const station: TrackPieceState = { kind: "station", flipped: false };
  return pieceCells(anchor, station).map((c) => ({ x: c.cellX, z: c.cellZ }));
}

function editableRide(state: SimState, rideId: number): TrackedRide | null {
  const ride = state.rides.tracked.get(rideId);
  if (!ride || ride.state !== RIDE_STATE.closed || ride.riders.length > 0) {
    return null;
  }
  return ride;
}

/** Dry-run of ride/startTrack for the builder ghost (no mutation). */
export function checkStartTrack(
  state: SimState,
  family: TrackFamilyId,
  mx: number,
  mz: number,
  heading: 0 | 1 | 2 | 3,
): CommandFailure | null {
  const anchor: TrackPose = { mx, mz, level: 0, heading };
  const terrain = state.world.terrain;
  for (const cell of stationGroundCells(anchor)) {
    if (!terrain.inBounds(cell.x, cell.z)) {
      return "out-of-bounds";
    }
    if (terrain.isWater(cell.x, cell.z)) {
      return "water";
    }
    if (terrain.slopeClassAt(cell.x, cell.z) !== "flat") {
      return "too-steep";
    }
    if (state.world.occupancy[cellIndex(state.world, cell.x, cell.z)] !== 0) {
      return "occupied";
    }
  }
  const familyDef = TRACK_FAMILIES[family];
  if (state.money < familyDef.baseCostCents + familyDef.trainCostCents) {
    return "not-enough-money";
  }
  return null;
}

/** Dry-run of ride/appendPiece: denial reason + the would-be evaluation. */
export function checkAppendPiece(
  state: SimState,
  rideId: number,
  kind: TrackKind,
  flipped: boolean,
): { reason: CommandFailure | null; preview: ReturnType<typeof evaluateTrack> | null } {
  const ride = editableRide(state, rideId);
  if (!ride || kind === "station" || ride.pieces.length >= MAX_TRACK_PIECES) {
    return { reason: "invalid", preview: null };
  }
  const piece: TrackPieceState = { kind, flipped };
  const entry = openEndPose(ride.anchor, ride.pieces);
  const denial = checkTrackCells(state, ride.baseHeight, pieceCells(entry, piece), ride.id);
  if (denial) {
    return { reason: denial, preview: null };
  }
  if (state.money < trackPieceCost(ride.family, kind)) {
    return { reason: "not-enough-money", preview: null };
  }
  const pieces = [...ride.pieces, piece];
  return {
    reason: null,
    preview: evaluateTrack(
      ride.anchor,
      pieces,
      sceneryProximityOf(state.world, ride.anchor, pieces),
    ),
  };
}

function reevaluate(state: SimState, ride: TrackedRide): void {
  ride.evaln = evaluateTrack(
    ride.anchor,
    ride.pieces,
    sceneryProximityOf(state.world, ride.anchor, ride.pieces),
  );
  ride.tested = false;
  ride.trainArc = 0;
  ride.trainPrevArc = 0;
  ride.trainPhase = "dwell";
  ride.dwellTicks = 0;
}

type Handler<C extends Command> = (state: SimState, command: C) => CommandResult;

type HandlerMap = { [T in Command["type"]]: Handler<Extract<Command, { type: T }>> };

const handlers: HandlerMap = {
  "park/rename": (state, command) => {
    const name = command.name.trim();
    if (name.length === 0 || name.length > 60) {
      return { ok: false, reason: "invalid" };
    }
    const previous = state.parkName;
    state.parkName = name;
    return { ok: true, inverse: { type: "park/rename", name: previous } };
  },

  "build/place": (state, command) => {
    // Internal replays (undo/redo restoring a piece) bypass the gate: the park
    // legitimately built it, and re-checking would make undo fail after a
    // level-down that cannot happen anyway.
    if (command.forceId === undefined && !isUnlocked(state, command.pieceId)) {
      return { ok: false, reason: "locked" };
    }
    const check = checkPlace(state.world, command.pieceId, command.x, command.z, command.rot);
    if (!check.ok) {
      return { ok: false, reason: check.reason ?? "invalid" };
    }
    const def = state.world.pieces.get(command.pieceId);
    if (!def) {
      return { ok: false, reason: "unknown-piece" };
    }
    const cost = money(command.forceCostCents ?? def.cost);
    const capped = receivershipSpendDenial(state, cost, command.forceCostCents === undefined);
    if (capped) {
      return { ok: false, reason: capped };
    }
    if (state.money < cost) {
      return { ok: false, reason: "not-enough-money" };
    }
    const id = command.forceId ?? state.world.nextInstanceId;
    if (command.forceId === undefined) {
      state.world.nextInstanceId += 1;
    } else {
      state.world.nextInstanceId = Math.max(state.world.nextInstanceId, id + 1);
    }
    const piece = {
      id,
      pieceId: command.pieceId,
      x: command.x,
      z: command.z,
      rot: command.rot,
      placedAtTick: command.forcePlacedAtTick ?? state.tick,
      paidCents: command.forcePaidCents ?? def.cost,
      // Undo of a demolish restores the price the player had set, not the
      // default they would have had to dial back in.
      priceCents:
        command.forcePriceCents ?? SHOP_DEFS[command.pieceId]?.defaultPriceCents ?? 0,
    };
    state.world.placed.set(id, piece);
    for (const cell of footprintCells(def, command.x, command.z, command.rot)) {
      state.world.occupancy[cellIndex(state.world, cell.x, cell.z)] = id;
    }
    state.money = subMoney(state.money, cost);
    state.ledger.expense.construction += cost;
    if (command.forceId === undefined) {
      if (SHOP_DEFS[command.pieceId]) {
        state.stats.shopsBuilt += 1;
      } else if (def.category === "scenery" || def.category === "prop") {
        state.stats.sceneryPlaced += 1;
      }
    }
    return {
      ok: true,
      inverse: { type: "build/remove", id, refund: "exact" },
      replay: { ...command, forceId: id, forcePaidCents: piece.paidCents, forcePlacedAtTick: piece.placedAtTick },
    };
  },

  "build/remove": (state, command) => {
    const piece = state.world.placed.get(command.id);
    if (!piece) {
      return { ok: false, reason: "nothing-to-do" };
    }
    const def = state.world.pieces.get(piece.pieceId);
    const paid = money(piece.paidCents);
    const refund =
      command.refund === "exact"
        ? paid
        : state.tick - piece.placedAtTick <= FULL_REFUND_TICKS
          ? paid
          : scaleMoney(paid, BULLDOZE_REFUND_RATE);
    state.world.placed.delete(command.id);
    if (def) {
      for (const cell of footprintCells(def, piece.x, piece.z, piece.rot)) {
        state.world.occupancy[cellIndex(state.world, cell.x, cell.z)] = 0;
      }
    }
    state.money = addMoney(state.money, refund);
    state.ledger.expense.construction -= refund;
    return {
      ok: true,
      inverse: {
        type: "build/place",
        pieceId: piece.pieceId,
        x: piece.x,
        z: piece.z,
        rot: piece.rot,
        forceId: piece.id,
        forceCostCents: refund, // undoing re-charges exactly what was refunded…
        forcePaidCents: piece.paidCents, // …while restoring the original paid record
        forcePlacedAtTick: piece.placedAtTick,
        forcePriceCents: piece.priceCents,
      },
    };
  },

  "build/paintPath": (state, command) => {
    const applied: { x: number; z: number }[] = [];
    const seen = new Set<number>();
    for (const cell of command.cells) {
      const index = cellIndex(state.world, cell.x, cell.z);
      if (seen.has(index)) {
        continue;
      }
      if (checkPaintPath(state.world, cell.x, cell.z).ok) {
        seen.add(index);
        applied.push({ x: cell.x, z: cell.z });
      }
    }
    if (applied.length === 0) {
      return { ok: false, reason: "nothing-to-do" };
    }
    const perCell = money(command.forceCostCentsPerCell ?? PATH_LIST_COST_CENTS);
    const total = money(perCell * applied.length);
    const cappedPath = receivershipSpendDenial(
      state,
      total,
      command.forceCostCentsPerCell === undefined,
    );
    if (cappedPath) {
      return { ok: false, reason: cappedPath };
    }
    if (state.money < total) {
      return { ok: false, reason: "not-enough-money" };
    }
    for (const cell of applied) {
      const index = cellIndex(state.world, cell.x, cell.z);
      state.world.pathCells[index] = 1;
      state.world.occupancy[index] = PATH_OCCUPANT;
    }
    state.money = subMoney(state.money, total);
    state.ledger.expense.construction += total;
    if (command.forceCostCentsPerCell === undefined) {
      state.stats.pathCellsBuilt += applied.length;
    }
    invalidatePathCache();
    return {
      ok: true,
      inverse: { type: "build/erasePath", cells: applied, refundCentsPerCell: perCell },
      // Pin the per-cell cost so redo charges identically AND skips the
      // monotonic stat counters (they must not double-count on redo).
      replay: { ...command, cells: applied, forceCostCentsPerCell: perCell },
    };
  },

  "build/erasePath": (state, command) => {
    const applied: { x: number; z: number }[] = [];
    for (const cell of command.cells) {
      if (!state.world.terrain.inBounds(cell.x, cell.z)) {
        continue;
      }
      const index = cellIndex(state.world, cell.x, cell.z);
      if (state.world.pathCells[index] === 1) {
        applied.push({ x: cell.x, z: cell.z });
      }
    }
    if (applied.length === 0) {
      return { ok: false, reason: "nothing-to-do" };
    }
    const refundPerCell = money(
      command.refundCentsPerCell ?? Math.round(PATH_LIST_COST_CENTS * BULLDOZE_REFUND_RATE),
    );
    for (const cell of applied) {
      const index = cellIndex(state.world, cell.x, cell.z);
      state.world.pathCells[index] = 0;
      state.world.occupancy[index] = 0;
    }
    state.money = addMoney(state.money, money(refundPerCell * applied.length));
    state.ledger.expense.construction -= refundPerCell * applied.length;
    invalidatePathCache();
    return {
      ok: true,
      inverse: {
        type: "build/paintPath",
        cells: applied,
        forceCostCentsPerCell: refundPerCell,
      },
      replay: { ...command, cells: applied },
    };
  },

  // Session/management commands are deliberately NOT undoable (no inverse):
  // Ctrl+Z is for construction, not for un-closing your park.
  "park/setOpen": (state, command) => {
    state.parkOpen = command.open;
    return { ok: true };
  },
  "park/setEntryFee": (state, command) => {
    if (!Number.isInteger(command.cents) || command.cents < 0 || command.cents > 100_00) {
      return { ok: false, reason: "invalid" };
    }
    state.entryFeeCents = command.cents;
    return { ok: true };
  },
  "staff/hireJanitor": (state) => {
    const HIRE_FEE = money(150_00); // GAME_BALANCE §7
    if (state.money < HIRE_FEE) {
      return { ok: false, reason: "not-enough-money" };
    }
    state.money = subMoney(state.money, HIRE_FEE);
    state.ledger.expense.wages += HIRE_FEE;
    const gate = state.world.terrain.site.gate;
    state.janitors.push({
      id: state.nextJanitorId,
      x: (gate.x + 0.5) * 2,
      z: (gate.z + 0.5) * 2,
      path: [],
      targetLitterId: -1,
      cleanTicks: 0,
    });
    state.nextJanitorId += 1;
    state.stats.janitorsHired += 1;
    return { ok: true };
  },
  "staff/fireJanitor": (state) => {
    if (state.janitors.length === 0) {
      return { ok: false, reason: "nothing-to-do" };
    }
    state.janitors.pop();
    return { ok: true };
  },
  "goal/dismiss": (state, command) => {
    return dismissGoal(state, command.cardId)
      ? { ok: true }
      : { ok: false, reason: "nothing-to-do" };
  },

  "finance/takeLoan": (state, command) => {
    const product = LOAN_PRODUCTS[command.product] as (typeof LOAN_PRODUCTS)[LoanProductId] | undefined;
    if (!product) {
      return { ok: false, reason: "invalid" };
    }
    // Internal replays skip the gate: the loan already happened once.
    if (command.forceId === undefined && offerBlockedReason(state, command.product) !== null) {
      return { ok: false, reason: "invalid" };
    }
    const { loan } = openLoan(state, command.product, {
      ...(command.forceId !== undefined ? { forceId: command.forceId } : {}),
      ...(command.forceAprBps !== undefined ? { forceAprBps: command.forceAprBps } : {}),
      ...(command.forceMinPaymentCents !== undefined
        ? { forceMinPaymentCents: command.forceMinPaymentCents }
        : {}),
      ...(command.forceOpenedMonth !== undefined
        ? { forceOpenedMonth: command.forceOpenedMonth }
        : {}),
    });
    if (command.forceId === undefined) {
      state.stats.loansTaken += 1;
    }
    return {
      ok: true,
      replay: {
        type: "finance/takeLoan",
        product: command.product,
        forceId: loan.id,
        forceAprBps: loan.aprBpsLocked,
        forceMinPaymentCents: loan.minPaymentCents,
        forceOpenedMonth: loan.openedMonth,
      },
    };
  },

  "finance/payLoan": (state, command) => {
    const loan = state.finance.loans.find((l) => l.id === command.loanId);
    if (!loan) {
      return { ok: false, reason: "nothing-to-do" };
    }
    const requested =
      command.amount === "payoff" ? payoffCents(loan) : Math.floor(command.amount);
    if (!Number.isSafeInteger(requested) || requested <= 0) {
      return { ok: false, reason: "invalid" };
    }
    if (state.money < Math.min(requested, payoffCents(loan))) {
      return { ok: false, reason: "not-enough-money" };
    }
    applyLoanPayment(state, loan, requested);
    if (loan.balanceCents <= 0 && loan.arrearsCents <= 0) {
      state.finance.loans = state.finance.loans.filter((l) => l.id !== loan.id);
      state.stats.loansPaidOff += 1;
    }
    // Paying off arrears releases repossessed trains immediately — never make
    // the player wait a month for the fix they just bought.
    if (state.finance.repossessedRideKey !== 0 && totalArrears(state) === 0) {
      state.finance.repossessedRideKey = 0;
    }
    return { ok: true };
  },

  "marketing/start": (state, command) => {
    const def = MARKETING_CAMPAIGNS[command.campaign] as
      | (typeof MARKETING_CAMPAIGNS)[MarketingCampaignId]
      | undefined;
    if (!def || state.finance.receivership.active || campaignIsLive(state)) {
      return { ok: false, reason: "invalid" };
    }
    if (state.money < def.costCents) {
      return { ok: false, reason: "not-enough-money" };
    }
    state.money = subMoney(state.money, money(def.costCents));
    state.ledger.expense.marketing += def.costCents;
    const startTick = command.forceStartTick ?? state.tick;
    startCampaign(state, command.campaign, startTick);
    return {
      ok: true,
      replay: { type: "marketing/start", campaign: command.campaign, forceStartTick: startTick },
    };
  },

  "staff/hireMechanic": (state) => {
    const fee = money(MECHANIC_HIRE_FEE_CENTS);
    if (state.money < fee) {
      return { ok: false, reason: "not-enough-money" };
    }
    state.money = subMoney(state.money, fee);
    state.ledger.expense.wages += fee;
    const gate = state.world.terrain.site.gate;
    state.mechanics.push({
      id: state.nextMechanicId,
      x: gate.x,
      z: gate.z,
      targetRide: 0,
      repairTicks: 0,
    });
    state.nextMechanicId += 1;
    state.stats.mechanicsHired += 1;
    return { ok: true };
  },

  "staff/fireMechanic": (state) => {
    if (state.mechanics.length === 0) {
      return { ok: false, reason: "nothing-to-do" };
    }
    const mech = state.mechanics.pop()!;
    const ride = mech.targetRide > 0
      ? state.rides.tracked.get(mech.targetRide)
      : state.rides.flat.get(-mech.targetRide);
    if (ride) {
      ride.mechanicId = 0;
    }
    return { ok: true };
  },

  "ride/startTrack": (state, command) => {
    if (command.forceId === undefined && !isUnlocked(state, command.family)) {
      return { ok: false, reason: "locked" };
    }
    const family = TRACK_FAMILIES[command.family];
    const anchor: TrackPose = {
      mx: command.mx,
      mz: command.mz,
      level: 0,
      heading: command.heading,
    };
    const groundCells = stationGroundCells(anchor);
    const terrain = state.world.terrain;
    for (const cell of groundCells) {
      if (!terrain.inBounds(cell.x, cell.z)) {
        return { ok: false, reason: "out-of-bounds" };
      }
      if (terrain.isWater(cell.x, cell.z)) {
        return { ok: false, reason: "water" };
      }
      if (terrain.slopeClassAt(cell.x, cell.z) !== "flat") {
        return { ok: false, reason: "too-steep" };
      }
      if (state.world.occupancy[cellIndex(state.world, cell.x, cell.z)] !== 0) {
        return { ok: false, reason: "occupied" };
      }
    }
    const cost = money(command.forceCostCents ?? family.baseCostCents + family.trainCostCents);
    const cappedTrack = receivershipSpendDenial(
      state,
      cost,
      command.forceCostCents === undefined,
    );
    if (cappedTrack) {
      return { ok: false, reason: cappedTrack };
    }
    if (state.money < cost) {
      return { ok: false, reason: "not-enough-money" };
    }
    state.money = subMoney(state.money, cost);
    state.ledger.expense.construction += cost;
    const id = command.forceId ?? state.rides.nextId;
    state.rides.nextId = Math.max(state.rides.nextId, id + 1);
    const baseHeight = terrain.cellHeight(groundCells[0]!.x, groundCells[0]!.z);
    const pieces: TrackPieceState[] = [{ kind: "station", flipped: false }];
    const entrance = stationEntranceCell(anchor);
    const ride: TrackedRide = {
      id,
      family: command.family,
      anchor,
      baseHeight,
      pieces,
      state: RIDE_STATE.closed,
      priceCents: family.family === "steel" ? 4_00 : 3_00, // GAME_BALANCE §5.2 defaults
      evaln: evaluateTrack(anchor, pieces, 0),
      tested: false,
      trainArc: 0,
      trainPrevArc: 0,
      trainPhase: "dwell",
      dwellTicks: 0,
      riders: [],
      queue: [],
      cycleCount: 0,
      totalSpentCents: cost,
      entranceX: entrance.x,
      entranceZ: entrance.z,
      breakdownTicks: 0,
      mechanicId: 0,
      everOpened: false,
      createdAtTick: command.forceCreatedAtTick ?? state.tick,
      refurbishedAtTick: command.forceCreatedAtTick ?? state.tick,
    };
    state.rides.tracked.set(id, ride);
    for (const cell of groundCells) {
      state.world.occupancy[cellIndex(state.world, cell.x, cell.z)] = RIDE_OCCUPANT;
    }
    if (command.forceId === undefined) {
      state.stats.coastersBuilt += 1;
    }
    invalidatePathCache();
    return {
      ok: true,
      inverse: { type: "ride/demolish", rideId: id },
      replay: { ...command, forceId: id, forceCostCents: cost, forceCreatedAtTick: ride.createdAtTick },
    };
  },

  "ride/appendPiece": (state, command) => {
    const ride = editableRide(state, command.rideId);
    if (!ride) {
      return { ok: false, reason: "invalid" };
    }
    if (command.kind === "station" || ride.pieces.length >= MAX_TRACK_PIECES) {
      return { ok: false, reason: "invalid" };
    }
    const piece: TrackPieceState = { kind: command.kind, flipped: command.flipped };
    const entry = openEndPose(ride.anchor, ride.pieces);
    const cells = pieceCells(entry, piece);
    const denial = checkTrackCells(state, ride.baseHeight, cells, ride.id);
    if (denial) {
      return { ok: false, reason: denial };
    }
    // Below-clearance non-station pieces still must not sit on claimed ground.
    const cost = money(command.forceCostCents ?? trackPieceCost(ride.family, command.kind));
    const cappedPiece = receivershipSpendDenial(
      state,
      cost,
      command.forceCostCents === undefined,
    );
    if (cappedPiece) {
      return { ok: false, reason: cappedPiece };
    }
    if (state.money < cost) {
      return { ok: false, reason: "not-enough-money" };
    }
    const wasTested = ride.tested;
    state.money = subMoney(state.money, cost);
    state.ledger.expense.construction += cost;
    ride.pieces.push(piece);
    ride.totalSpentCents += cost;
    reevaluate(state, ride);
    return {
      ok: true,
      inverse: {
        type: "ride/popPiece",
        rideId: ride.id,
        refundCents: cost,
        restoreTested: wasTested,
      },
      replay: { ...command, forceCostCents: cost },
    };
  },

  "ride/popPiece": (state, command) => {
    const ride = editableRide(state, command.rideId);
    if (!ride || ride.pieces.length <= 1) {
      return { ok: false, reason: "nothing-to-do" };
    }
    const removed = ride.pieces.pop()!;
    const refund = command.refundCents ?? trackPieceCost(ride.family, removed.kind);
    state.money = addMoney(state.money, money(refund));
    state.ledger.expense.construction -= refund;
    ride.totalSpentCents -= refund;
    reevaluate(state, ride);
    if (command.restoreTested) {
      ride.tested = true;
    }
    return {
      ok: true,
      inverse: {
        type: "ride/appendPiece",
        rideId: ride.id,
        kind: removed.kind,
        flipped: removed.flipped,
        forceCostCents: refund,
      },
      replay: { ...command, refundCents: refund },
    };
  },

  "ride/demolish": (state, command) => {
    const ride = state.rides.tracked.get(command.rideId);
    if (!ride) {
      return { ok: false, reason: "nothing-to-do" };
    }
    // Send queued/riding guests back to the paths first.
    for (const slot of [...ride.queue, ...ride.riders]) {
      if (state.guests.state[slot] !== 0 && state.guests.rideId[slot] === ride.id) {
        state.guests.state[slot] = 2;
        state.guests.rideId[slot] = 0;
      }
    }
    for (const cell of stationGroundCells(ride.anchor)) {
      const idx = cellIndex(state.world, cell.x, cell.z);
      if (state.world.occupancy[idx] === RIDE_OCCUPANT) {
        state.world.occupancy[idx] = 0;
      }
    }
    const mech = state.mechanics.find((m) => m.targetRide === ride.id);
    if (mech) {
      mech.targetRide = 0;
    }
    // Fresh builds refund in full (undo path); established rides at 70%.
    const rate = state.tick - ride.createdAtTick <= FULL_REFUND_TICKS ? 1 : BULLDOZE_REFUND_RATE;
    const refund = scaleMoney(money(ride.totalSpentCents), rate);
    state.money = addMoney(state.money, refund);
    state.ledger.expense.construction -= refund;
    state.rides.tracked.delete(ride.id);
    invalidatePathCache();
    return { ok: true };
  },

  "ride/setState": (state, command) => {
    const ride =
      state.rides.tracked.get(command.rideId) ?? state.rides.flat.get(-command.rideId);
    if (!ride || ride.state === RIDE_STATE.broken) {
      return { ok: false, reason: "invalid" };
    }
    const isTracked = "trainPhase" in ride;
    if (
      (command.to === "testing" || command.to === "open") &&
      state.finance.repossessedRideKey === command.rideId
    ) {
      return { ok: false, reason: "repossessed" };
    }
    if (command.to === "testing" || command.to === "open") {
      if (isTracked && !(ride).evaln.valid) {
        return { ok: false, reason: "invalid" };
      }
      if (command.to === "open" && !ride.tested) {
        return { ok: false, reason: "invalid" }; // test before opening (§8.2)
      }
    }
    if (command.to === "closed") {
      // Unload everyone safely, dissolve the queue.
      const key = isTracked ? ride.id : -ride.id;
      for (const slot of [...ride.queue, ...ride.riders]) {
        if (state.guests.state[slot] !== 0 && state.guests.rideId[slot] === key) {
          state.guests.state[slot] = 2;
          state.guests.rideId[slot] = 0;
        }
      }
      ride.queue.length = 0;
      ride.riders.length = 0;
      if (isTracked) {
        const tracked = ride;
        tracked.trainArc = 0;
        tracked.trainPrevArc = 0;
        tracked.trainPhase = "dwell";
        tracked.dwellTicks = 0;
      } else {
        ride.phase = "loading";
        ride.phaseTicks = 0;
      }
      ride.state = RIDE_STATE.closed;
      return { ok: true };
    }
    if (command.to === "testing") {
      ride.state = RIDE_STATE.testing;
      if (isTracked) {
        const tracked = ride;
        tracked.trainPhase = "dwell";
        tracked.dwellTicks = 10;
        tracked.trainArc = 0;
        tracked.trainPrevArc = 0;
        tracked.cycleCount = 0;
      } else {
        ride.phase = "running";
        ride.phaseTicks = FLAT_RIDES[(ride as { defId: FlatRideId }).defId].cycleTicks;
      }
      return { ok: true };
    }
    ride.state = RIDE_STATE.open;
    if (!ride.everOpened) {
      ride.everOpened = true;
      state.stats.ridesOpened += 1;
    }
    if (isTracked) {
      const tracked = ride;
      tracked.trainPhase = "dwell";
      tracked.dwellTicks = 20;
    } else {
      ride.phase = "loading";
      ride.phaseTicks = 25;
    }
    return { ok: true };
  },

  /**
   * Refurbish a ride: 25% of what it cost to build, in exchange for novelty
   * and reliability. GAME_BALANCE §4.1 — "refurb restores novelty to ×1.15".
   *
   * It deliberately does NOT restore book value. Depreciation bottoms out at
   * 45% of build cost, so letting a refurb reset the age would turn a 25%
   * spend into a 55% valuation gain — and park value sets borrowing headroom,
   * which makes that an infinite-credit loop. The player buys appeal and
   * reliability here, never balance sheet.
   *
   * Operational, not undoable: the wear it clears is real work done.
   */
  "ride/refurbish": (state, command) => {
    const tracked = state.rides.tracked.get(command.rideId);
    const flat = state.rides.flat.get(-command.rideId);
    const ride = tracked ?? flat;
    if (!ride) {
      return { ok: false, reason: "invalid" };
    }
    const buildCents = tracked ? tracked.totalSpentCents : FLAT_RIDES[flat!.defId].costCents;
    const cost = money(command.forceCostCents ?? Math.round(buildCents * REFURB_COST_RATE));
    // Player-originated when there is no internal pin — a replayed refurb must
    // not be blocked, or redo would diverge from the run it is reproducing.
    const denial = receivershipSpendDenial(state, cost, command.forceCostCents === undefined);
    if (denial) {
      return { ok: false, reason: denial };
    }
    if (state.money < cost) {
      return { ok: false, reason: "not-enough-money" };
    }
    state.money = subMoney(state.money, cost);
    state.ledger.expense.upkeep += cost;
    ride.refurbishedAtTick = state.tick;
    // Wear resets with the refit. The rating's per-ride cycle mirror has to
    // move with it or the next tick differences against a larger number and
    // reports a negative throughput.
    const key = tracked ? tracked.id : -flat!.id;
    const perf = state.rating.perRide[String(key)];
    if (perf) {
      perf.lastCycleCount = 0;
    }
    ride.cycleCount = 0;
    return {
      ok: true,
      replay: { type: "ride/refurbish", rideId: command.rideId, forceCostCents: cost },
    };
  },

  "shop/setPrice": (state, command) => {
    const piece = state.world.placed.get(command.placedId);
    const def = piece ? SHOP_DEFS[piece.pieceId] : undefined;
    if (!piece || !def) {
      return { ok: false, reason: "invalid" };
    }
    // A free facility stays free — charging for the toilets is exactly the
    // kind of thing GAME_DESIGN §24 keeps out of this game.
    if (def.defaultPriceCents === 0) {
      return { ok: false, reason: "invalid" };
    }
    const cents = Math.round(command.cents);
    if (cents < 0 || cents > SHOP_PRICE_CEILING_CENTS) {
      return { ok: false, reason: "invalid" };
    }
    const previous = piece.priceCents;
    if (cents === previous) {
      return { ok: false, reason: "invalid" };
    }
    piece.priceCents = cents;
    return {
      ok: true,
      inverse: { type: "shop/setPrice", placedId: command.placedId, cents: previous },
    };
  },
  "ride/setPrice": (state, command) => {
    const ride =
      state.rides.tracked.get(command.rideId) ?? state.rides.flat.get(-command.rideId);
    if (!ride || command.cents < 0 || command.cents > 20_00) {
      return { ok: false, reason: "invalid" };
    }
    ride.priceCents = command.cents;
    return { ok: true };
  },

  "build/placeFlatRide": (state, command) => {
    if (command.forceId === undefined && !isUnlocked(state, command.defId)) {
      return { ok: false, reason: "locked" };
    }
    const def = FLAT_RIDES[command.defId];
    const w = command.rot % 2 === 0 ? def.footprint.w : def.footprint.d;
    const d = command.rot % 2 === 0 ? def.footprint.d : def.footprint.w;
    const terrain = state.world.terrain;
    for (let dz = 0; dz < d; dz++) {
      for (let dx = 0; dx < w; dx++) {
        const x = command.x + dx;
        const z = command.z + dz;
        if (!terrain.inBounds(x, z)) {
          return { ok: false, reason: "out-of-bounds" };
        }
        if (terrain.isWater(x, z)) {
          return { ok: false, reason: "water" };
        }
        if (terrain.slopeClassAt(x, z) !== "flat") {
          return { ok: false, reason: "too-steep" };
        }
        if (state.world.occupancy[cellIndex(state.world, x, z)] !== 0) {
          return { ok: false, reason: "occupied" };
        }
      }
    }
    const cost = money(command.forceCostCents ?? def.costCents);
    const cappedFlat = receivershipSpendDenial(
      state,
      cost,
      command.forceCostCents === undefined,
    );
    if (cappedFlat) {
      return { ok: false, reason: cappedFlat };
    }
    if (state.money < cost) {
      return { ok: false, reason: "not-enough-money" };
    }
    state.money = subMoney(state.money, cost);
    state.ledger.expense.construction += cost;
    const id = command.forceId ?? state.rides.nextId;
    state.rides.nextId = Math.max(state.rides.nextId, id + 1);
    const ride = {
      id,
      defId: command.defId,
      x: command.x,
      z: command.z,
      rot: command.rot,
      state: RIDE_STATE.closed,
      priceCents: def.ticketCents,
      phaseTicks: 0,
      phase: "loading" as const,
      riders: [],
      queue: [],
      cycleCount: 0,
      tested: false,
      breakdownTicks: 0,
      mechanicId: 0,
      entranceX: 0,
      entranceZ: 0,
      placedAtTick: command.forcePlacedAtTick ?? state.tick,
      refurbishedAtTick: command.forcePlacedAtTick ?? state.tick,
      everOpened: false,
    };
    const entrance = flatRideEntranceCell(ride);
    ride.entranceX = entrance.x;
    ride.entranceZ = entrance.z;
    state.rides.flat.set(id, ride);
    for (let dz = 0; dz < d; dz++) {
      for (let dx = 0; dx < w; dx++) {
        state.world.occupancy[cellIndex(state.world, command.x + dx, command.z + dz)] =
          RIDE_OCCUPANT;
      }
    }
    if (command.forceId === undefined) {
      state.stats.flatRidesBuilt += 1;
    }
    invalidatePathCache();
    return {
      ok: true,
      inverse: { type: "build/removeFlatRide", id, refund: "exact" },
      replay: {
        ...command,
        forceId: id,
        forceCostCents: cost,
        forcePlacedAtTick: ride.placedAtTick,
      },
    };
  },

  "build/removeFlatRide": (state, command) => {
    const ride = state.rides.flat.get(command.id);
    if (!ride) {
      return { ok: false, reason: "nothing-to-do" };
    }
    for (const slot of [...ride.queue, ...ride.riders]) {
      if (state.guests.state[slot] !== 0 && state.guests.rideId[slot] === -ride.id) {
        state.guests.state[slot] = 2;
        state.guests.rideId[slot] = 0;
      }
    }
    const mech = state.mechanics.find((m) => m.targetRide === -ride.id);
    if (mech) {
      mech.targetRide = 0;
    }
    const def = FLAT_RIDES[ride.defId];
    const w = ride.rot % 2 === 0 ? def.footprint.w : def.footprint.d;
    const d = ride.rot % 2 === 0 ? def.footprint.d : def.footprint.w;
    for (let dz = 0; dz < d; dz++) {
      for (let dx = 0; dx < w; dx++) {
        const idx = cellIndex(state.world, ride.x + dx, ride.z + dz);
        if (state.world.occupancy[idx] === RIDE_OCCUPANT) {
          state.world.occupancy[idx] = 0;
        }
      }
    }
    const withinGrace = state.tick - ride.placedAtTick <= FULL_REFUND_TICKS;
    const rate = command.refund === "exact" || withinGrace ? 1 : BULLDOZE_REFUND_RATE;
    const refund = scaleMoney(money(def.costCents), rate);
    state.money = addMoney(state.money, refund);
    state.ledger.expense.construction -= refund;
    state.rides.flat.delete(ride.id);
    invalidatePathCache();
    return {
      ok: true,
      inverse: {
        type: "build/placeFlatRide",
        defId: ride.defId,
        x: ride.x,
        z: ride.z,
        rot: ride.rot,
        forceId: ride.id,
        forceCostCents: refund,
        forcePlacedAtTick: ride.placedAtTick,
      },
    };
  },
  "debug/noop": () => ({ ok: true }),
};

export interface JournalEntry {
  readonly tick: number;
  readonly command: Command;
}

const UNDO_DEPTH = 100;

export interface CommandBus {
  dispatch(state: SimState, command: Command): CommandResult;
  undo(state: SimState): boolean;
  redo(state: SimState): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  journal(): readonly JournalEntry[];
}

interface UndoEntry {
  readonly command: Command;
  readonly inverse: Command;
}

export function createCommandBus(): CommandBus {
  const journal: JournalEntry[] = [];
  const undoStack: UndoEntry[] = [];
  const redoStack: UndoEntry[] = [];

  const apply = (state: SimState, command: Command): CommandResult => {
    const handler = handlers[command.type] as Handler<Command>;
    const result = handler(state, command);
    if (result.ok) {
      journal.push({ tick: state.tick, command });
    }
    return result;
  };

  return {
    dispatch(state, command): CommandResult {
      const result = apply(state, command);
      if (result.ok && result.inverse) {
        undoStack.push({ command: result.replay ?? command, inverse: result.inverse });
        if (undoStack.length > UNDO_DEPTH) {
          undoStack.shift();
        }
        redoStack.length = 0;
      }
      return result;
    },
    undo(state): boolean {
      const entry = undoStack.pop();
      if (!entry) {
        return false;
      }
      const result = apply(state, entry.inverse);
      if (result.ok) {
        redoStack.push(entry);
        return true;
      }
      return false;
    },
    redo(state): boolean {
      const entry = redoStack.pop();
      if (!entry) {
        return false;
      }
      const result = apply(state, entry.command);
      if (result.ok && result.inverse) {
        undoStack.push({ command: entry.command, inverse: result.inverse });
        return true;
      }
      return false;
    },
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    journal: () => journal,
  };
}
