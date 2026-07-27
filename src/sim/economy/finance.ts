import { money, scaleMoney } from "@/shared/money";
import { FLAT_RIDES } from "@/content/rides";
import {
  COLLECTIONS_MISSED_PAYMENTS,
  CREDIT_CLEAN_MONTHS_PER_GRADE,
  LOAN_PRODUCTS,
  MAX_CONCURRENT_LOANS,
  MAX_DEBT_RATIO,
  STARTING_CREDIT_GRADE,
  type CreditGradeIndex,
  type LoanProductId,
} from "@/content/loans";
import { type MarketingCampaignId } from "@/content/marketing";
import { type SimState } from "../state";
import { addExpense, addFinancing, type MonthlyReport } from "./ledgerCore";
import { clampAprBps, minPaymentCents, monthlyRate } from "./amortize";

/**
 * The finance spine (GAME_DESIGN §14): park value, loans, the A–E credit
 * ladder, collections, and Receivership — the no-game-over answer to
 * insolvency (ADR-15). Money is the tension instrument, never the executioner:
 * every path out of debt is reachable, and the 6-month settlement backstop
 * guarantees no park can be trapped (invariant #8).
 */

export interface Loan {
  readonly id: number;
  readonly product: LoanProductId;
  readonly principalCents: number;
  /** Locked at origination — retuning content never re-prices a live loan. */
  readonly aprBpsLocked: number;
  readonly termMonths: number;
  readonly minPaymentCents: number;
  /** Outstanding principal. Reaches EXACTLY 0 (invariant #6). */
  balanceCents: number;
  monthsPaid: number;
  /** Unpaid amount carried from missed payments (never penalty-compounded). */
  arrearsCents: number;
  missedPayments: number;
  totalInterestPaidCents: number;
  readonly openedMonth: number;
}

export interface CreditState {
  gradeIndex: CreditGradeIndex;
  cleanMonths: number;
  missedPaymentsTotal: number;
}

export interface MarketingState {
  readonly campaign: MarketingCampaignId;
  readonly startedAtTick: number;
  /** Exclusive: live while state.tick < endsAtTick. */
  readonly endsAtTick: number;
}

export interface ReceivershipState {
  active: boolean;
  enteredMonth: number;
  monthsActive: number;
  sweptCents: number;
  comebackMonthsRemaining: number;
}

export interface ParkValuation {
  readonly rideValueCents: number;
  readonly pieceValueCents: number;
  readonly pathValueCents: number;
  readonly landValueCents: number;
  /** rides + pieces + paths + land. Excludes cash and debt — the credit base. */
  readonly assetValueCents: number;
  readonly debtCents: number;
  /** assetValue + cash − debt: the number the Finance tab calls "Park value". */
  readonly parkValueCents: number;
  readonly debtRatio: number;
}

export interface FinanceState {
  nextLoanId: number;
  loans: Loan[];
  credit: CreditState;
  /** Home plot + expansions + district plots. Never depreciates. */
  landValueCents: number;
  campaign: MarketingState | null;
  receivership: ReceivershipState;
  insolventMonths: number;
  /** Repossessed ride key (tracked +id, flat −id). 0 = none. */
  repossessedRideKey: number;
  /** "Classic bankruptcy" sandbox toggle (ADR-15) — reserved, wired at M5. */
  readonly hardFail: boolean;
  /* ---- derived, never saved and never hashed ---- */
  valuationCacheKey: number;
  valuationCache: ParkValuation | null;
}

export type FinanceEvent =
  | { readonly kind: "loanTaken"; readonly product: LoanProductId; readonly amountCents: number }
  | { readonly kind: "loanPaidOff"; readonly product: LoanProductId }
  | { readonly kind: "paymentMissed"; readonly amountCents: number }
  | { readonly kind: "creditChanged"; readonly gradeIndex: number }
  | { readonly kind: "collections"; readonly rideKey: number }
  | { readonly kind: "repossessionCleared"; readonly rideKey: number }
  | { readonly kind: "receivershipEntered" }
  | { readonly kind: "receivershipExited"; readonly settled: boolean }
  | { readonly kind: "campaignEnded"; readonly campaign: MarketingCampaignId };

/* ------------------------------------------------------------------ */
/* Constants (GAME_BALANCE §8.2 + the M4 note)                         */
/* ------------------------------------------------------------------ */

export const STARTING_LAND_VALUE_CENTS = 20_000_00;
const DEPRECIATION_PER_MONTH = 0.02;
const DEPRECIATION_FLOOR = 0.45;
const PATH_VALUE_RATE = 0.7;
const PATH_LIST_COST_CENTS = 40_00;
const LATE_FEE_BPS = 500; // 5% of the missed payment, once, never compounding

export const RECEIVERSHIP_CONSTRUCTION_CAP_CENTS = 1_000_00;
const RECEIVERSHIP_PROFIT_SWEEP = 0.5;
/** Hard backstop: nobody stays in Receivership longer than this (invariant #8). */
export const RECEIVERSHIP_MAX_MONTHS = 6;
const RECEIVERSHIP_INTEREST_RELIEF = 0.5;
const COMEBACK_MONTHS = 2;
export const COMEBACK_RATING_BONUS_STARS = 0.2;

export function createFinanceState(hardFail = false): FinanceState {
  return {
    nextLoanId: 1,
    loans: [],
    credit: { gradeIndex: STARTING_CREDIT_GRADE, cleanMonths: 0, missedPaymentsTotal: 0 },
    landValueCents: STARTING_LAND_VALUE_CENTS,
    campaign: null,
    receivership: {
      active: false,
      enteredMonth: 0,
      monthsActive: 0,
      sweptCents: 0,
      comebackMonthsRemaining: 0,
    },
    insolventMonths: 0,
    repossessedRideKey: 0,
    hardFail,
    valuationCacheKey: -1,
    valuationCache: null,
  };
}

/* ------------------------------------------------------------------ */
/* Park value                                                          */
/* ------------------------------------------------------------------ */

const ageMonths = (state: SimState, sinceTick: number): number =>
  Math.max(0, (state.tick - sinceTick) / 3_000);

function depreciate(costCents: number, months: number): number {
  const factor = Math.min(Math.max(1 - DEPRECIATION_PER_MONTH * months, DEPRECIATION_FLOOR), 1);
  return scaleMoney(money(costCents), factor);
}

/** Full valuation. Memoized behind world version + month — see valuationOf. */
export function computeValuation(state: SimState): ParkValuation {
  let rideValueCents = 0;
  for (const ride of state.rides.tracked.values()) {
    rideValueCents += depreciate(ride.totalSpentCents, ageMonths(state, ride.createdAtTick));
  }
  for (const ride of state.rides.flat.values()) {
    rideValueCents += depreciate(
      FLAT_RIDES[ride.defId].costCents,
      ageMonths(state, ride.placedAtTick),
    );
  }
  let pieceValueCents = 0;
  for (const piece of state.world.placed.values()) {
    pieceValueCents += depreciate(piece.paidCents, ageMonths(state, piece.placedAtTick));
  }
  let pathCells = 0;
  for (let i = 0; i < state.world.pathCells.length; i++) {
    if (state.world.pathCells[i] === 1) {
      pathCells += 1;
    }
  }
  const pathValueCents = scaleMoney(money(pathCells * PATH_LIST_COST_CENTS), PATH_VALUE_RATE);
  const landValueCents = state.finance.landValueCents;
  const assetValueCents = rideValueCents + pieceValueCents + pathValueCents + landValueCents;
  let debtCents = 0;
  for (const loan of state.finance.loans) {
    debtCents += loan.balanceCents + loan.arrearsCents;
  }
  return {
    rideValueCents,
    pieceValueCents,
    pathValueCents,
    landValueCents,
    assetValueCents,
    debtCents,
    parkValueCents: assetValueCents + state.money - debtCents,
    debtRatio: debtCents / Math.max(assetValueCents, 1),
  };
}

/**
 * Cached valuation: rebuilt only when the world changes or a month closes, so
 * an open Finance panel polling at 60 fps costs one cache hit per frame.
 * The cache lives outside the snapshot — the state hash must never depend on
 * whether a UI panel happened to be open.
 */
export function valuationOf(state: SimState, worldVersion: number): ParkValuation {
  const key = worldVersion * 1_048_576 + state.monthNumber;
  const finance = state.finance;
  if (finance.valuationCacheKey === key && finance.valuationCache) {
    return finance.valuationCache;
  }
  const valuation = computeValuation(state);
  finance.valuationCacheKey = key;
  finance.valuationCache = valuation;
  return valuation;
}

export const invalidateValuation = (state: SimState): void => {
  state.finance.valuationCacheKey = -1;
  state.finance.valuationCache = null;
};

/* ------------------------------------------------------------------ */
/* Offers                                                              */
/* ------------------------------------------------------------------ */

export type OfferBlockedReason =
  | "receivership"
  | "max-loans"
  | "debt-ratio"
  | "already-held";

export function quotedAprBps(state: SimState, product: LoanProductId): number {
  const def = LOAN_PRODUCTS[product];
  return clampAprBps(
    def.aprBpsByGrade[state.finance.credit.gradeIndex] +
      state.difficultyMods.loanAprOffsetBps,
  );
}

/** Why this offer is unavailable, or null when it may be taken. */
export function offerBlockedReason(
  state: SimState,
  product: LoanProductId,
): OfferBlockedReason | null {
  const finance = state.finance;
  if (finance.receivership.active) {
    return "receivership";
  }
  if (finance.loans.length >= MAX_CONCURRENT_LOANS) {
    return "max-loans";
  }
  const valuation = computeValuation(state);
  const wouldOwe = valuation.debtCents + LOAN_PRODUCTS[product].principalCents;
  if (wouldOwe / Math.max(valuation.assetValueCents, 1) > MAX_DEBT_RATIO) {
    return "debt-ratio";
  }
  return null;
}

export interface TakeLoanResult {
  readonly loan: Loan;
  readonly originationFeeCents: number;
}

/** Open a loan. Callers must have checked offerBlockedReason first. */
export function openLoan(
  state: SimState,
  product: LoanProductId,
  pins: {
    readonly forceId?: number;
    readonly forceAprBps?: number;
    readonly forceMinPaymentCents?: number;
    readonly forceOpenedMonth?: number;
  },
): TakeLoanResult {
  const def = LOAN_PRODUCTS[product];
  const aprBps = pins.forceAprBps ?? quotedAprBps(state, product);
  const payment =
    pins.forceMinPaymentCents ?? minPaymentCents(def.principalCents, aprBps, def.termMonths);
  const id = pins.forceId ?? state.finance.nextLoanId;
  state.finance.nextLoanId = Math.max(state.finance.nextLoanId, id + 1);
  const loan: Loan = {
    id,
    product,
    principalCents: def.principalCents,
    aprBpsLocked: aprBps,
    termMonths: def.termMonths,
    minPaymentCents: payment,
    balanceCents: def.principalCents,
    monthsPaid: 0,
    arrearsCents: 0,
    missedPayments: 0,
    totalInterestPaidCents: 0,
    openedMonth: pins.forceOpenedMonth ?? state.monthNumber,
  };
  state.finance.loans.push(loan);
  addFinancing(state, "borrowed", def.principalCents);
  const originationFeeCents = scaleMoney(money(def.principalCents), def.originationBps / 10_000);
  if (originationFeeCents > 0) {
    addExpense(state, "interest", originationFeeCents);
  }
  invalidateValuation(state);
  return { loan, originationFeeCents };
}

/** Pay toward a loan: arrears first, then principal. Never overpays. */
export function payLoan(state: SimState, loan: Loan, requestedCents: number): number {
  const owed = loan.balanceCents + loan.arrearsCents;
  const applied = Math.min(requestedCents, owed, state.money);
  if (applied <= 0) {
    return 0;
  }
  const toArrears = Math.min(applied, loan.arrearsCents);
  loan.arrearsCents -= toArrears;
  loan.balanceCents -= applied - toArrears;
  addFinancing(state, "principalRepaid", applied);
  invalidateValuation(state);
  return applied;
}

export const totalArrears = (state: SimState): number =>
  state.finance.loans.reduce((sum, loan) => sum + loan.arrearsCents, 0);

/* ------------------------------------------------------------------ */
/* Monthly charges (runs inside tickLedger, before the report closes)  */
/* ------------------------------------------------------------------ */

/**
 * Interest, scheduled payments, late fees. Interest and fees post to
 * expense.interest so they land in the closing month's operating net;
 * principal movement posts to financing so borrowing never reads as profit.
 */
export function accrueFinanceCharges(state: SimState, events: FinanceEvent[]): boolean {
  const finance = state.finance;
  if (finance.loans.length === 0) {
    return false;
  }
  const relief = finance.receivership.active ? RECEIVERSHIP_INTEREST_RELIEF : 1;
  let missedAny = false;

  for (const loan of finance.loans) {
    if (loan.balanceCents <= 0 && loan.arrearsCents <= 0) {
      continue;
    }
    const interest = Math.floor(loan.balanceCents * monthlyRate(loan.aprBpsLocked) * relief);
    if (interest > 0) {
      loan.balanceCents += interest;
      loan.totalInterestPaidCents += interest;
      addExpense(state, "interest", interest);
    }
    if (finance.receivership.active) {
      continue; // payments suspended: the administrator sweeps profit instead
    }
    const due = Math.min(loan.minPaymentCents, loan.balanceCents + loan.arrearsCents);
    if (state.money >= due) {
      const toArrears = Math.min(due, loan.arrearsCents);
      loan.arrearsCents -= toArrears;
      loan.balanceCents -= due - toArrears;
      loan.monthsPaid += 1;
      addFinancing(state, "principalRepaid", due);
    } else {
      loan.arrearsCents += due;
      loan.missedPayments += 1;
      finance.credit.missedPaymentsTotal += 1;
      state.stats.paymentsMissed += 1;
      missedAny = true;
      const fee = scaleMoney(money(due), LATE_FEE_BPS / 10_000);
      if (fee > 0) {
        addExpense(state, "interest", fee);
      }
      events.push({ kind: "paymentMissed", amountCents: due });
    }
  }

  // A loan that reached zero is closed out.
  for (let i = finance.loans.length - 1; i >= 0; i--) {
    const loan = finance.loans[i]!;
    if (loan.balanceCents <= 0 && loan.arrearsCents <= 0) {
      finance.loans.splice(i, 1);
      state.stats.loansPaidOff += 1;
      events.push({ kind: "loanPaidOff", product: loan.product });
    }
  }
  invalidateValuation(state);
  return missedAny;
}

/* ------------------------------------------------------------------ */
/* Month close (runs after the ledger closed and produced a report)    */
/* ------------------------------------------------------------------ */

function repossessionTarget(state: SimState): number {
  let bestKey = 0;
  let bestCost = -1;
  for (const ride of state.rides.tracked.values()) {
    if (ride.totalSpentCents > bestCost || (ride.totalSpentCents === bestCost && ride.id < bestKey)) {
      bestCost = ride.totalSpentCents;
      bestKey = ride.id;
    }
  }
  if (bestKey !== 0) {
    return bestKey;
  }
  for (const ride of state.rides.flat.values()) {
    const cost = FLAT_RIDES[ride.defId].costCents;
    if (cost > bestCost) {
      bestCost = cost;
      bestKey = -ride.id;
    }
  }
  return bestKey;
}

/** Consolidate everything owed into one fresh 24-month loan and zero the cash. */
function settle(state: SimState, events: FinanceEvent[]): void {
  const finance = state.finance;
  let owed = 0;
  for (const loan of finance.loans) {
    owed += loan.balanceCents + loan.arrearsCents;
  }
  finance.loans.length = 0;
  if (owed > 0) {
    const def = LOAN_PRODUCTS.piggy;
    const apr = clampAprBps(
      LOAN_PRODUCTS.piggy.aprBpsByGrade[4] + state.difficultyMods.loanAprOffsetBps,
    );
    finance.loans.push({
      id: finance.nextLoanId,
      product: "piggy",
      principalCents: owed,
      aprBpsLocked: apr,
      termMonths: def.termMonths,
      minPaymentCents: minPaymentCents(owed, apr, def.termMonths),
      balanceCents: owed,
      monthsPaid: 0,
      arrearsCents: 0,
      missedPayments: 0,
      totalInterestPaidCents: 0,
      openedMonth: state.monthNumber,
    });
    finance.nextLoanId += 1;
  }
  if (state.money < 0) {
    // Settlement tops the park back up to exactly zero.
    addFinancing(state, "settlement", Math.abs(Number(state.money)));
  }
  events.push({ kind: "receivershipExited", settled: true });
}

export interface MonthCloseOutcome {
  readonly receivershipEntered: boolean;
  readonly receivershipExited: boolean;
}

/**
 * The order here is load-bearing: sweep needs the closed report, credit needs
 * the sweep's payments, and insolvency is judged on the cash left afterward.
 */
export function financeMonthClose(
  state: SimState,
  report: MonthlyReport,
  missedThisMonth: boolean,
  events: FinanceEvent[],
): MonthCloseOutcome {
  const finance = state.finance;
  const receivership = finance.receivership;
  let entered = false;
  let exited = false;

  // 1. Receivership sweep: half of operating profit onto the oldest debt.
  if (receivership.active && report.netCents > 0 && finance.loans.length > 0) {
    const oldest = [...finance.loans].sort(
      (a, b) => a.openedMonth - b.openedMonth || a.id - b.id,
    )[0]!;
    const sweep = Math.min(
      Math.floor(report.netCents * RECEIVERSHIP_PROFIT_SWEEP),
      Math.max(state.money, 0),
    );
    const applied = payLoan(state, oldest, sweep);
    receivership.sweptCents += applied;
    if (oldest.balanceCents <= 0 && oldest.arrearsCents <= 0) {
      finance.loans = finance.loans.filter((l) => l.id !== oldest.id);
      state.stats.loansPaidOff += 1;
      events.push({ kind: "loanPaidOff", product: oldest.product });
    }
  }

  // 2. Credit grade movement.
  const before = finance.credit.gradeIndex;
  if (missedThisMonth) {
    finance.credit.gradeIndex = Math.min(4, finance.credit.gradeIndex + 1) as CreditGradeIndex;
    finance.credit.cleanMonths = 0;
  } else if (state.money >= 0) {
    finance.credit.cleanMonths += 1;
    if (finance.credit.cleanMonths >= CREDIT_CLEAN_MONTHS_PER_GRADE) {
      finance.credit.gradeIndex = Math.max(0, finance.credit.gradeIndex - 1) as CreditGradeIndex;
      finance.credit.cleanMonths = 0;
    }
  } else {
    finance.credit.cleanMonths = 0;
  }
  if (finance.credit.gradeIndex !== before) {
    events.push({ kind: "creditChanged", gradeIndex: finance.credit.gradeIndex });
  }

  // 3. Collections, and 4. release the moment arrears clear.
  if (
    finance.credit.gradeIndex === 4 &&
    finance.credit.missedPaymentsTotal >= COLLECTIONS_MISSED_PAYMENTS &&
    finance.repossessedRideKey === 0
  ) {
    const target = repossessionTarget(state);
    if (target !== 0) {
      finance.repossessedRideKey = target;
      state.stats.repossessions += 1;
      events.push({ kind: "collections", rideKey: target });
    }
  }
  if (finance.repossessedRideKey !== 0 && totalArrears(state) === 0) {
    events.push({ kind: "repossessionCleared", rideKey: finance.repossessedRideKey });
    finance.repossessedRideKey = 0;
  }

  // 5. Insolvency counter and Receivership entry.
  finance.insolventMonths = state.money < 0 ? finance.insolventMonths + 1 : 0;
  if (
    !receivership.active &&
    state.money < 0 &&
    finance.insolventMonths >= state.difficultyMods.receivershipEntryMonths
  ) {
    receivership.active = true;
    receivership.enteredMonth = state.monthNumber;
    receivership.monthsActive = 0;
    receivership.sweptCents = 0;
    entered = true;
    state.stats.receiverships += 1;
    events.push({ kind: "receivershipEntered" });
  } else if (receivership.active) {
    receivership.monthsActive += 1;
    // 6. Exit: recovered naturally, or settled by the backstop.
    if (state.money >= 0 && totalArrears(state) === 0) {
      receivership.active = false;
      receivership.comebackMonthsRemaining = COMEBACK_MONTHS;
      exited = true;
      events.push({ kind: "receivershipExited", settled: false });
    } else if (receivership.monthsActive >= RECEIVERSHIP_MAX_MONTHS) {
      settle(state, events);
      receivership.active = false;
      receivership.comebackMonthsRemaining = COMEBACK_MONTHS;
      exited = true;
    }
    if (exited) {
      finance.insolventMonths = 0;
    }
  }

  // 7. Comeback arc decay.
  if (!receivership.active && receivership.comebackMonthsRemaining > 0) {
    receivership.comebackMonthsRemaining -= 1;
  }

  invalidateValuation(state);
  return { receivershipEntered: entered, receivershipExited: exited };
}

/* ------------------------------------------------------------------ */
/* Spending limits                                                     */
/* ------------------------------------------------------------------ */

/**
 * Receivership caps discretionary construction. Internal replays (undo/redo,
 * journal replay) carry pinned costs and MUST bypass the cap — otherwise
 * undoing a ride built before Receivership would fail and the undo-fuzz
 * invariant breaks. Staffing is never capped: hiring is how you climb out.
 */
export function receivershipSpendDenial(
  state: SimState,
  costCents: number,
  isPlayerOriginated: boolean,
): "receivership-limited" | null {
  if (!isPlayerOriginated || !state.finance.receivership.active) {
    return null;
  }
  return costCents > RECEIVERSHIP_CONSTRUCTION_CAP_CENTS ? "receivership-limited" : null;
}

/** Cash a full payoff of this loan would need today. */
export const payoffCents = (loan: Loan): number => loan.balanceCents + loan.arrearsCents;

export const debtTotalCents = (state: SimState): number =>
  state.finance.loans.reduce((sum, l) => sum + l.balanceCents + l.arrearsCents, 0);
