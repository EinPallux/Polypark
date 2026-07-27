import { FLAT_RIDES } from "@/content/rides";
import { TRACK_FAMILIES } from "@/content/track";
import { type SimState } from "../state";
import { TICKS_PER_GAME_MONTH } from "../core/loop";
import { accrueFinanceCharges, type FinanceEvent } from "./finance";
import {
  addExpense,
  createLedger,
  type MonthlyReport,
} from "./ledgerCore";

export {
  addExpense,
  addFinancing,
  addIncome,
  createLedger,
  restoreLedger,
  type ExpenseCategory,
  type FinancingCategory,
  type IncomeCategory,
  type Ledger,
  type MonthlyReport,
} from "./ledgerCore";

/** Monthly ride upkeep (per-piece for coasters, flat per GAME_BALANCE §5). */
function rideUpkeepCentsOf(state: SimState): number {
  let total = 0;
  for (const ride of state.rides.tracked.values()) {
    total += TRACK_FAMILIES[ride.family].upkeepPerPieceCents * ride.pieces.length;
  }
  for (const ride of state.rides.flat.values()) {
    total += FLAT_RIDES[ride.defId].upkeepCents;
  }
  return total;
}

const JANITOR_WAGE_CENTS = 620_00; // GAME_BALANCE §7
const MECHANIC_WAGE_CENTS = 950_00; // GAME_BALANCE §7

/**
 * Returns a report exactly on month boundaries, else null. `financeEvents`
 * collects anything the finance charges raised (missed payments, payoffs) so
 * the facade can surface them without the ledger knowing about the event bus.
 */
export function tickLedger(
  state: SimState,
  financeEvents: FinanceEvent[] = [],
): { report: MonthlyReport; missedPayment: boolean } | null {
  if (state.tick === 0 || state.tick % TICKS_PER_GAME_MONTH !== 0) {
    return null;
  }
  // Month-end obligations: wages + shop and ride upkeep.
  if (state.janitors.length > 0) {
    addExpense(state, "wages", state.janitors.length * JANITOR_WAGE_CENTS);
  }
  if (state.mechanics.length > 0) {
    addExpense(state, "wages", state.mechanics.length * MECHANIC_WAGE_CENTS);
  }
  for (const piece of state.world.placed.values()) {
    const upkeep = state.shopUpkeep.get(piece.pieceId);
    if (upkeep) {
      addExpense(state, "upkeep", upkeep);
    }
  }
  const rideUpkeep = rideUpkeepCentsOf(state);
  if (rideUpkeep > 0) {
    addExpense(state, "upkeep", rideUpkeep);
  }
  // Interest, scheduled payments and late fees land inside the closing month.
  const missedPayment = accrueFinanceCharges(state, financeEvents);

  const income = { ...state.ledger.income };
  const expense = { ...state.ledger.expense };
  const financing = { ...state.ledger.financing };
  const totalIncome = Object.values(income).reduce((a, b) => a + b, 0);
  const totalExpense = Object.values(expense).reduce((a, b) => a + b, 0);
  const net = totalIncome - totalExpense;
  state.monthNumber += 1;
  if (net > 0) {
    state.stats.monthsProfit += 1;
  }
  const report: MonthlyReport = {
    month: state.monthNumber,
    income,
    expense,
    financing,
    netCents: net,
    cashDeltaCents:
      net + financing.borrowed + financing.settlement - financing.principalRepaid,
    guestsVisited: state.stats.guestsWelcomed - state.lastMonthGuests,
    endCashCents: state.money,
  };
  state.lastMonthGuests = state.stats.guestsWelcomed;
  state.ledger = createLedger();
  return { report, missedPayment };
}
