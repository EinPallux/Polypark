/**
 * SimFacade — the ONLY surface render/ui/app may import from the simulation
 * (TECHNICAL_ARCHITECTURE §3, enforced by ESLint + dependency-cruiser).
 *
 * The interface is message-shaped on purpose: commands/queries in, snapshots
 * and event batches out, so moving the sim into a Web Worker (TECH §4.4) is a
 * transport change, not a redesign.
 */
import { type SimPieceDef } from "@/content/costs";
import { type SiteDescriptor } from "@/content/sites/types";
import { type FlatRideId } from "@/content/rides";
import { type TrackFamilyId, type TrackKind } from "@/content/track";
import {
  checkAppendPiece,
  checkStartTrack,
  createCommandBus,
  type Command,
  type CommandFailure,
  type CommandResult,
} from "./core/commands";
import { createEventCollector, type SimEvent } from "./core/events";
import { stateHash } from "./core/hash";
import {
  createInitialState,
  restoreState,
  snapshotState,
  type SimStateSnapshot,
} from "./state";
import {
  guestNeedsSnapshot,
  liveGuestCount,
  moodOf,
  tickGuests,
  type GuestSoA,
} from "./guests/guests";
import { tickJanitors } from "./staff/janitors";
import { RIDE_STATE, tickMechanics, tickRides, type RideEvent } from "./rides/rides";
import {
  debtTotalCents,
  financeMonthClose,
  offerBlockedReason,
  payoffCents,
  quotedAprBps,
  valuationOf,
  RECEIVERSHIP_MAX_MONTHS,
  type FinanceEvent,
  type OfferBlockedReason,
  type ParkValuation,
} from "./economy/finance";
import { campaignIsLive, tickMarketing } from "./economy/marketing";
import { evaluateRating, tickRating, type RatingView } from "./rating/rating";
export type { RatingView, RatingCause, RatingCauseId, SubScore } from "./rating/rating";
export { RATING_CAUSE_IDS } from "./rating/rating";
import { minPaymentCents } from "./economy/amortize";
import { CREDIT_GRADES, LOAN_PRODUCT_LIST, type CreditGrade, type LoanProductId } from "@/content/loans";
import { type MarketingCampaignId } from "@/content/marketing";
import { type DifficultyId } from "@/content/difficulty";
import {
  type TrackEvaluation,
  type TrackPieceState,
  type TrackPose,
} from "./rides/trackGraph";
import {
  goalProgress,
  levelForXp,
  refocusForReceivership,
  tickGoals,
  type GoalProgress,
} from "./goals/goals";
import { tickLedger } from "./economy/ledger";
import {
  checkPaintPath,
  checkPlace,
  resolveAllPathTiles,
  type PlaceCheck,
  type PlacedPiece,
  type ResolvedPathTile,
  type Rotation,
} from "./world/world";
import { type Terrain } from "./world/terrain";

export type {
  Command,
  CommandResult,
  SimEvent,
  SimStateSnapshot,
  PlaceCheck,
  PlacedPiece,
  ResolvedPathTile,
  Rotation,
  Terrain,
};
export {
  createFixedStepper,
  TICKS_PER_SECOND,
  TICKS_PER_GAME_MONTH,
  GAME_SECONDS_PER_TICK,
  type FixedStepper,
  type GameSpeed,
} from "./core/loop";
export { type MonthlyReport } from "./economy/ledger";
export { EMOTE, GUEST_STATE } from "./guests/guests";
export { RIDE_STATE } from "./rides/rides";
export { pieceEntryPoses, pieceRenderFrame, poseAtArc } from "./rides/trackGraph";
export type {
  PieceRun,
  TrackEvaluation,
  TrackPieceState,
  TrackPose,
} from "./rides/trackGraph";
export type { RideStateId } from "./rides/rides";

/** Live view of one tracked ride for render + inspector (rebuilt per call). */
export interface TrackedRideView {
  readonly key: number;
  readonly family: TrackFamilyId;
  readonly anchor: TrackPose;
  readonly baseHeight: number;
  readonly pieces: readonly TrackPieceState[];
  readonly state: number;
  readonly priceCents: number;
  readonly evaln: TrackEvaluation;
  readonly tested: boolean;
  readonly trainArc: number;
  readonly trainPrevArc: number;
  readonly trainPhase: "dwell" | "run";
  readonly queueLen: number;
  readonly riderCount: number;
  readonly cycleCount: number;
  readonly entranceX: number;
  readonly entranceZ: number;
  readonly totalSpentCents: number;
}

export interface FlatRideView {
  readonly key: number;
  readonly defId: FlatRideId;
  readonly x: number;
  readonly z: number;
  readonly rot: 0 | 1 | 2 | 3;
  readonly state: number;
  readonly priceCents: number;
  readonly phase: "loading" | "running";
  readonly phaseTicks: number;
  readonly queueLen: number;
  readonly riderCount: number;
  readonly cycleCount: number;
  readonly tested: boolean;
  readonly entranceX: number;
  readonly entranceZ: number;
}

export interface LoanView {
  readonly id: number;
  readonly product: LoanProductId;
  readonly principalCents: number;
  readonly balanceCents: number;
  readonly aprBps: number;
  readonly termMonths: number;
  readonly monthsPaid: number;
  readonly minPaymentCents: number;
  readonly arrearsCents: number;
  readonly missedPayments: number;
  readonly monthsRemaining: number;
  readonly totalInterestPaidCents: number;
  /** Cash to close it today — payoff is free, no penalty. */
  readonly payoffCents: number;
}

export interface LoanOfferView {
  readonly product: LoanProductId;
  readonly principalCents: number;
  readonly termMonths: number;
  readonly aprBps: number;
  readonly minPaymentCents: number;
  readonly originationFeeCents: number;
  readonly blocked: OfferBlockedReason | null;
}

export interface FinanceView {
  readonly valuation: ParkValuation;
  readonly loans: readonly LoanView[];
  readonly offers: readonly LoanOfferView[];
  readonly creditGrade: CreditGrade;
  readonly monthsToNextGrade: number;
  readonly campaign: MarketingCampaignId | null;
  readonly campaignEndsAtTick: number | null;
  readonly receivership: {
    readonly active: boolean;
    readonly monthsActive: number;
    readonly monthsRemaining: number;
    readonly sweptCents: number;
    readonly comebackMonthsRemaining: number;
  };
  readonly insolventMonths: number;
  readonly repossessedRideKey: number;
  readonly difficulty: DifficultyId;
}

/** Live read-only views into the guest SoA for the crowd renderer (zero-copy). */
export interface GuestRenderView {
  readonly count: number;
  readonly state: Uint8Array;
  readonly variant: Uint8Array;
  readonly emote: Uint8Array;
  readonly x: Float32Array;
  readonly z: Float32Array;
  readonly px: Float32Array;
  readonly pz: Float32Array;
}

export interface HudView {
  readonly tick: number;
  readonly money: number;
  readonly parkName: string;
  readonly parkOpen: boolean;
  readonly entryFeeCents: number;
  readonly guestCount: number;
  readonly janitorCount: number;
  readonly mechanicCount: number;
  readonly litterCount: number;
  readonly rideCount: number;
  readonly brokenRideCount: number;
  readonly xp: number;
  readonly level: number;
  readonly goals: readonly GoalProgress[];
  readonly receivershipActive: boolean;
  readonly debtCents: number;
  readonly creditGrade: CreditGrade;
  readonly activeCampaign: MarketingCampaignId | null;
  readonly ratingStars: number;
}

export interface SimFacade {
  advance(ticks: number): void;
  dispatch(command: Command): CommandResult;
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  snapshot(): SimStateSnapshot;
  drainEvents(): SimEvent[];
  hash(): string;
  /** Monotonic counter bumped by every successful world mutation — render memo key. */
  worldVersion(): number;
  /** Read-only terrain view (static per site — safe to hold). */
  terrain(): Terrain;
  checkPlace(pieceId: string, x: number, z: number, rot: Rotation): PlaceCheck;
  checkPaintPath(x: number, z: number): PlaceCheck;
  pathTiles(): ResolvedPathTile[];
  placedPieces(): PlacedPiece[];
  hud(): HudView;
  guestView(): GuestRenderView;
  guestInfo(slot: number): ReturnType<typeof guestNeedsSnapshot> | null;
  ridesView(): { tracked: TrackedRideView[]; flat: FlatRideView[] };
  /** Builder dry-runs (ghost validity + live E/I/N preview). */
  checkStartTrack(
    family: TrackFamilyId,
    mx: number,
    mz: number,
    heading: 0 | 1 | 2 | 3,
  ): CommandFailure | null;
  checkAppendPiece(
    rideId: number,
    kind: TrackKind,
    flipped: boolean,
  ): { reason: CommandFailure | null; preview: TrackEvaluation | null };
  finance(): FinanceView;
  rating(): RatingView;
}

export interface CreateSimOptions {
  readonly seed: number;
  readonly parkName?: string;
  readonly site: SiteDescriptor;
  readonly pieceDefs: readonly SimPieceDef[];
  readonly resumeFrom?: SimStateSnapshot;
  readonly difficulty?: DifficultyId;
  readonly startingCashCents?: number;
  readonly hardFail?: boolean;
}

/** Translate a finance module event into the public SimEvent union. */
function emitFinanceEvent(
  events: { emit(event: SimEvent): void },
  financeEvent: FinanceEvent,
): void {
  switch (financeEvent.kind) {
    case "loanTaken":
      events.emit({
        type: "finance/loanTaken",
        product: financeEvent.product,
        amountCents: financeEvent.amountCents,
      });
      return;
    case "loanPaidOff":
      events.emit({ type: "finance/loanPaidOff", product: financeEvent.product });
      return;
    case "paymentMissed":
      events.emit({ type: "finance/paymentMissed", amountCents: financeEvent.amountCents });
      return;
    case "creditChanged":
      events.emit({
        type: "finance/creditChanged",
        grade: CREDIT_GRADES[financeEvent.gradeIndex] ?? "C",
      });
      return;
    case "collections":
      events.emit({ type: "finance/collections", rideKey: financeEvent.rideKey });
      return;
    case "repossessionCleared":
      events.emit({ type: "finance/repossessionCleared", rideKey: financeEvent.rideKey });
      return;
    case "receivershipEntered":
      events.emit({ type: "finance/receivershipEntered" });
      return;
    case "receivershipExited":
      events.emit({ type: "finance/receivershipExited", settled: financeEvent.settled });
      return;
    case "campaignEnded":
      events.emit({ type: "marketing/campaignEnded", campaign: financeEvent.campaign });
      return;
  }
}

export function createSim(options: CreateSimOptions): SimFacade {
  const state = options.resumeFrom
    ? restoreState(options.resumeFrom, options.site, options.pieceDefs)
    : createInitialState(
        options.seed,
        options.parkName ?? "My Polypark",
        options.site,
        options.pieceDefs,
        {
          ...(options.difficulty ? { difficulty: options.difficulty } : {}),
          ...(options.startingCashCents !== undefined
            ? { startingCashCents: options.startingCashCents }
            : {}),
          ...(options.hardFail !== undefined ? { hardFail: options.hardFail } : {}),
        },
      );
  const bus = createCommandBus();
  const events = createEventCollector();
  let version = 1;

  events.emit({ type: "sim/started", seed: state.seed });

  const bumpOnBuild = (command: Command, ok: boolean): void => {
    if (ok && (command.type.startsWith("build/") || command.type.startsWith("ride/"))) {
      version += 1;
    }
  };

  return {
    advance(ticks: number): void {
      // System order is fixed and versioned (TECH §4.1): guests → staff →
      // rides → goals → ledger. New systems slot before goals/ledger so the
      // stat counters they bump are visible the same tick.
      for (let i = 0; i < ticks; i++) {
        state.tick += 1;
        tickGuests(state);
        tickJanitors(state);
        const rideEvents: RideEvent[] = [];
        tickMechanics(state, rideEvents);
        tickRides(state, rideEvents);
        for (const rideEvent of rideEvents) {
          events.emit(
            rideEvent.kind === "broke"
              ? { type: "ride/broke", rideKey: rideEvent.rideKey }
              : rideEvent.kind === "repaired"
                ? { type: "ride/repaired", rideKey: rideEvent.rideKey }
                : { type: "ride/testPassed", rideKey: rideEvent.rideKey },
          );
        }
        for (const done of tickGoals(state)) {
          const before = levelForXp(state.xp);
          state.xp += done.rewardXp;
          events.emit({ type: "goal/completed", cardId: done.cardId, rewardXp: done.rewardXp });
          const after = levelForXp(state.xp);
          if (after > before) {
            events.emit({ type: "park/levelUp", level: after });
          }
        }
        tickRating(state);
        const financeEvents: FinanceEvent[] = [];
        tickMarketing(state, financeEvents);
        const closed = tickLedger(state, financeEvents);
        if (closed) {
          // Finance closes AFTER the ledger: the sweep and the credit ladder
          // both read the report's operating net.
          const outcome = financeMonthClose(
            state,
            closed.report,
            closed.missedPayment,
            financeEvents,
          );
          if (outcome.receivershipEntered) {
            refocusForReceivership(state);
          }
          events.emit({ type: "park/monthReport", report: closed.report });
        }
        for (const financeEvent of financeEvents) {
          emitFinanceEvent(events, financeEvent);
        }
      }
    },
    dispatch(command: Command): CommandResult {
      const result = bus.dispatch(state, command);
      bumpOnBuild(command, result.ok);
      if (result.ok && command.type === "park/rename") {
        events.emit({ type: "park/renamed", name: state.parkName });
      }
      return result;
    },
    undo(): boolean {
      const done = bus.undo(state);
      if (done) {
        version += 1;
      }
      return done;
    },
    redo(): boolean {
      const done = bus.redo(state);
      if (done) {
        version += 1;
      }
      return done;
    },
    canUndo: () => bus.canUndo(),
    canRedo: () => bus.canRedo(),
    snapshot: () => snapshotState(state),
    drainEvents: () => events.drain(),
    hash: () => stateHash(snapshotState(state)),
    worldVersion: () => version,
    terrain: () => state.world.terrain,
    checkPlace: (pieceId, x, z, rot) => checkPlace(state.world, pieceId, x, z, rot),
    checkPaintPath: (x, z) => checkPaintPath(state.world, x, z),
    pathTiles: () => resolveAllPathTiles(state.world),
    placedPieces: () => [...state.world.placed.values()],
    hud: () => {
      let broken = 0;
      for (const ride of state.rides.tracked.values()) {
        if (ride.state === RIDE_STATE.broken) {
          broken += 1;
        }
      }
      for (const ride of state.rides.flat.values()) {
        if (ride.state === RIDE_STATE.broken) {
          broken += 1;
        }
      }
      return {
        tick: state.tick,
        money: state.money,
        parkName: state.parkName,
        parkOpen: state.parkOpen,
        entryFeeCents: state.entryFeeCents,
        guestCount: liveGuestCount(state.guests),
        janitorCount: state.janitors.length,
        mechanicCount: state.mechanics.length,
        litterCount: state.litter.length,
        rideCount: state.rides.tracked.size + state.rides.flat.size,
        brokenRideCount: broken,
        xp: state.xp,
        level: levelForXp(state.xp),
        goals: goalProgress(state),
        receivershipActive: state.finance.receivership.active,
        debtCents: debtTotalCents(state),
        creditGrade: CREDIT_GRADES[state.finance.credit.gradeIndex] ?? "C",
        activeCampaign: campaignIsLive(state) ? state.finance.campaign!.campaign : null,
        ratingStars: state.rating.stars,
      };
    },
    rating: () => evaluateRating(state),
    finance: () => {
      const finance = state.finance;
      const receivership = finance.receivership;
      return {
        valuation: valuationOf(state, version),
        loans: finance.loans.map((loan) => ({
          id: loan.id,
          product: loan.product,
          principalCents: loan.principalCents,
          balanceCents: loan.balanceCents,
          aprBps: loan.aprBpsLocked,
          termMonths: loan.termMonths,
          monthsPaid: loan.monthsPaid,
          minPaymentCents: loan.minPaymentCents,
          arrearsCents: loan.arrearsCents,
          missedPayments: loan.missedPayments,
          monthsRemaining: Math.max(0, loan.termMonths - loan.monthsPaid),
          totalInterestPaidCents: loan.totalInterestPaidCents,
          payoffCents: payoffCents(loan),
        })),
        offers: LOAN_PRODUCT_LIST.map((product) => {
          const apr = quotedAprBps(state, product.id);
          return {
            product: product.id,
            principalCents: product.principalCents,
            termMonths: product.termMonths,
            aprBps: apr,
            minPaymentCents: minPaymentCents(product.principalCents, apr, product.termMonths),
            originationFeeCents: Math.round(
              (product.principalCents * product.originationBps) / 10_000,
            ),
            blocked: offerBlockedReason(state, product.id),
          };
        }),
        creditGrade: CREDIT_GRADES[finance.credit.gradeIndex] ?? "C",
        monthsToNextGrade:
          finance.credit.gradeIndex === 0 ? 0 : 6 - finance.credit.cleanMonths,
        campaign: campaignIsLive(state) ? finance.campaign!.campaign : null,
        campaignEndsAtTick: campaignIsLive(state) ? finance.campaign!.endsAtTick : null,
        receivership: {
          active: receivership.active,
          monthsActive: receivership.monthsActive,
          monthsRemaining: receivership.active
            ? Math.max(0, RECEIVERSHIP_MAX_MONTHS - receivership.monthsActive)
            : 0,
          sweptCents: receivership.sweptCents,
          comebackMonthsRemaining: receivership.comebackMonthsRemaining,
        },
        insolventMonths: finance.insolventMonths,
        repossessedRideKey: finance.repossessedRideKey,
        difficulty: state.difficulty,
      };
    },
    ridesView: () => {
      const tracked: TrackedRideView[] = [];
      for (const ride of state.rides.tracked.values()) {
        tracked.push({
          key: ride.id,
          family: ride.family,
          anchor: ride.anchor,
          baseHeight: ride.baseHeight,
          pieces: ride.pieces,
          state: ride.state,
          priceCents: ride.priceCents,
          evaln: ride.evaln,
          tested: ride.tested,
          trainArc: ride.trainArc,
          trainPrevArc: ride.trainPrevArc,
          trainPhase: ride.trainPhase,
          queueLen: ride.queue.length,
          riderCount: ride.riders.length,
          cycleCount: ride.cycleCount,
          entranceX: ride.entranceX,
          entranceZ: ride.entranceZ,
          totalSpentCents: ride.totalSpentCents,
        });
      }
      const flat: FlatRideView[] = [];
      for (const ride of state.rides.flat.values()) {
        flat.push({
          key: -ride.id,
          defId: ride.defId,
          x: ride.x,
          z: ride.z,
          rot: ride.rot,
          state: ride.state,
          priceCents: ride.priceCents,
          phase: ride.phase,
          phaseTicks: ride.phaseTicks,
          queueLen: ride.queue.length,
          riderCount: ride.riders.length,
          cycleCount: ride.cycleCount,
          tested: ride.tested,
          entranceX: ride.entranceX,
          entranceZ: ride.entranceZ,
        });
      }
      return { tracked, flat };
    },
    checkStartTrack: (family, mx, mz, heading) =>
      checkStartTrack(state, family, mx, mz, heading),
    checkAppendPiece: (rideId, kind, flipped) => checkAppendPiece(state, rideId, kind, flipped),
    guestView: () => ({
      count: state.guests.count,
      state: state.guests.state,
      variant: state.guests.variant,
      emote: state.guests.emote,
      x: state.guests.x,
      z: state.guests.z,
      px: state.guests.px,
      pz: state.guests.pz,
    }),
    guestInfo: (slot: number) => {
      const g: GuestSoA = state.guests;
      if (slot < 0 || slot >= g.count || g.state[slot] === 0) {
        return null;
      }
      void moodOf; // (kept in the facade surface via guestNeedsSnapshot)
      return guestNeedsSnapshot(g, slot);
    },
  };
}
