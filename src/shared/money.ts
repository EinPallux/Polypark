import { type Brand } from "./brand";

/**
 * Money is ALWAYS integer cents (CLAUDE.md engineering rules). Constructing a
 * Money from a non-integer throws — float drift must die at the boundary, not
 * propagate through the ledger.
 */
export type Money = Brand<number, "Money">;

export function money(cents: number): Money {
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError(`Money must be integer cents, got ${cents}`);
  }
  return cents as Money;
}

export const ZERO_MONEY: Money = money(0);

export function addMoney(a: Money, b: Money): Money {
  return money(a + b);
}

export function subMoney(a: Money, b: Money): Money {
  return money(a - b);
}

/** Scale by a ratio (e.g. -15% upkeep discount), rounding half away from zero. */
export function scaleMoney(a: Money, factor: number): Money {
  const scaled = a * factor;
  const rounded = Math.sign(scaled) * Math.round(Math.abs(scaled));
  return money(rounded);
}

export function minMoney(a: Money, b: Money): Money {
  return a <= b ? a : b;
}

export function maxMoney(a: Money, b: Money): Money {
  return a >= b ? a : b;
}

/** Plain-dollars debug/test formatting; user-facing formatting lives in the UI i18n layer. */
export function moneyToDollarString(a: Money): string {
  const sign = a < 0 ? "-" : "";
  const abs = Math.abs(a);
  const dollars = Math.floor(abs / 100);
  const cents = abs % 100;
  return cents === 0 ? `${sign}$${dollars}` : `${sign}$${dollars}.${String(cents).padStart(2, "0")}`;
}
