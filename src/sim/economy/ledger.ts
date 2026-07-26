import { addMoney, money, subMoney } from "@/shared/money";
import { type SimState } from "../state";
import { TICKS_PER_GAME_MONTH } from "../core/loop";

/**
 * Monthly income/expense ledger (GAME_DESIGN §14). Categories accumulate in
 * cents; the month closes on the tick boundary — wages and upkeep post, a
 * MonthlyReport is emitted, and the accumulators reset.
 */
export type IncomeCategory = "entry" | "food" | "drink" | "facility";
export type ExpenseCategory = "goods" | "wages" | "upkeep" | "construction";

export interface Ledger {
  income: Record<IncomeCategory, number>;
  expense: Record<ExpenseCategory, number>;
}

export function createLedger(): Ledger {
  return {
    income: { entry: 0, food: 0, drink: 0, facility: 0 },
    expense: { goods: 0, wages: 0, upkeep: 0, construction: 0 },
  };
}

export function addIncome(state: SimState, category: IncomeCategory, cents: number): void {
  state.ledger.income[category] += cents;
  state.money = addMoney(state.money, money(cents));
}

export function addExpense(state: SimState, category: ExpenseCategory, cents: number): void {
  state.ledger.expense[category] += cents;
  state.money = subMoney(state.money, money(cents));
}

export interface MonthlyReport {
  readonly month: number;
  readonly income: Record<IncomeCategory, number>;
  readonly expense: Record<ExpenseCategory, number>;
  readonly netCents: number;
  readonly guestsVisited: number;
  readonly endCashCents: number;
}

const JANITOR_WAGE_CENTS = 620_00; // GAME_BALANCE §7

/** Returns a report exactly on month boundaries, else null. */
export function tickLedger(state: SimState): MonthlyReport | null {
  if (state.tick === 0 || state.tick % TICKS_PER_GAME_MONTH !== 0) {
    return null;
  }
  // Month-end obligations: wages + shop upkeep.
  if (state.janitors.length > 0) {
    addExpense(state, "wages", state.janitors.length * JANITOR_WAGE_CENTS);
  }
  for (const piece of state.world.placed.values()) {
    const upkeep = state.shopUpkeep.get(piece.pieceId);
    if (upkeep) {
      addExpense(state, "upkeep", upkeep);
    }
  }

  const income = { ...state.ledger.income };
  const expense = { ...state.ledger.expense };
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
    netCents: net,
    guestsVisited: state.stats.guestsWelcomed - state.lastMonthGuests,
    endCashCents: state.money,
  };
  state.lastMonthGuests = state.stats.guestsWelcomed;
  state.ledger = createLedger();
  return report;
}
