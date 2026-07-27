import { addMoney, money, subMoney } from "@/shared/money";
import { type SimState } from "../state";

/**
 * Monthly income/expense ledger (GAME_DESIGN §14). Categories accumulate in
 * cents; the month closes on the tick boundary — wages and upkeep post, a
 * MonthlyReport is emitted, and the accumulators reset.
 */
export type IncomeCategory =
  | "entry"
  | "food"
  | "drink"
  | "facility"
  | "ride"
  | "sponsor"
  /** Souvenirs (Gift Kiosk). Kept out of `facility` so the Finance panel can
   *  show retail as the revenue stream it is rather than burying it with
   *  restroom and cash-machine fees. */
  | "retail";
export type ExpenseCategory =
  | "goods"
  | "wages"
  | "upkeep"
  | "construction"
  | "marketing"
  | "interest"
  | "admin";
/**
 * Financing moves cash without being income or expense: borrowing is not
 * profit and repaying principal is not a cost. Keeping it in its own section
 * is what stops a loan from reading as a wildly successful month.
 */
export type FinancingCategory = "borrowed" | "principalRepaid" | "settlement";

export interface Ledger {
  income: Record<IncomeCategory, number>;
  expense: Record<ExpenseCategory, number>;
  financing: Record<FinancingCategory, number>;
}

export function createLedger(): Ledger {
  return {
    income: { entry: 0, food: 0, drink: 0, facility: 0, ride: 0, sponsor: 0, retail: 0 },
    expense: {
      goods: 0,
      wages: 0,
      upkeep: 0,
      construction: 0,
      marketing: 0,
      interest: 0,
      admin: 0,
    },
    financing: { borrowed: 0, principalRepaid: 0, settlement: 0 },
  };
}

/**
 * Rebuild a ledger from a save, filling in categories the save predates.
 *
 * A save records whatever categories existed when it was written, so a v5 file
 * has no `retail` bucket. Cloning it straight through would leave that key
 * undefined and turn the park's first souvenir sale into `undefined + 1200`
 * — a NaN that spreads silently through every total. Merging over the current
 * defaults means adding an income or expense category never needs a format
 * bump, and never needs one to be remembered.
 */
export function restoreLedger(saved: Ledger): Ledger {
  const fresh = createLedger();
  return {
    income: { ...fresh.income, ...saved.income },
    expense: { ...fresh.expense, ...saved.expense },
    financing: { ...fresh.financing, ...saved.financing },
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

/** Cash movement that is neither income nor expense. `cents` is a magnitude. */
export function addFinancing(
  state: SimState,
  category: FinancingCategory,
  cents: number,
): void {
  state.ledger.financing[category] += cents;
  state.money =
    category === "principalRepaid"
      ? subMoney(state.money, money(cents))
      : addMoney(state.money, money(cents));
}

export interface MonthlyReport {
  readonly month: number;
  readonly income: Record<IncomeCategory, number>;
  readonly expense: Record<ExpenseCategory, number>;
  readonly financing: Record<FinancingCategory, number>;
  /** Operating net (income − expense). What "a profitable month" means. */
  readonly netCents: number;
  /** Operating net plus financing movement — what the cash pile actually did. */
  readonly cashDeltaCents: number;
  readonly guestsVisited: number;
  readonly endCashCents: number;
}
