import { APR_CEIL_BPS, APR_FLOOR_BPS } from "@/content/loans";

/**
 * Integer-cent loan amortization (GAME_BALANCE §8.2, invariant #6).
 *
 * The invariant is exact, not approximate: a loan paid at its minimum every
 * month reaches EXACTLY zero within its term, with no residual cent. Two
 * rounding choices carry that proof:
 *
 *   payment  = ceil(annuity)   — rounds UP, so principal always outruns the schedule
 *   interest = floor(b × r)    — rounds DOWN, in the player's favour
 *
 * Proof sketch. Let B_m be the real-valued annuity balance under the exact
 * payment M* (B_0 = P, B_N = 0) and b_m our integer balance. By induction
 * b_m ≤ B_m: b_{m+1} = b_m + floor(b_m·r) − M ≤ b_m(1+r) − M* ≤ B_m(1+r) − M*
 * = B_{m+1}. Hence b_N ≤ B_N = 0, and since the final payment is clamped to
 * (balance + interest) the balance lands on zero rather than overshooting.
 * Non-degeneracy: M* > P·r, so principal strictly decreases every month.
 *
 * `Math.pow` is deliberately avoided — it is not bit-identical across JS
 * engines, and every number here feeds the determinism hash.
 */

/** (1 + r)^n by repeated multiplication: deterministic across engines. */
function powLoop(base: number, exponent: number): number {
  let result = 1;
  for (let i = 0; i < exponent; i++) {
    result *= base;
  }
  return result;
}

export const clampAprBps = (bps: number): number =>
  Math.min(Math.max(Math.round(bps), APR_FLOOR_BPS), APR_CEIL_BPS);

/** Monthly rate from an APR in basis points (10,000 bps × 12 months). */
export const monthlyRate = (aprBps: number): number => aprBps / 120_000;

/** Interest owed this month on a balance. Floors — never rounds up. */
export function monthlyInterestCents(balanceCents: number, aprBps: number): number {
  if (balanceCents <= 0) {
    return 0;
  }
  return Math.floor(balanceCents * monthlyRate(aprBps));
}

/** The fixed minimum payment: the annuity, rounded up to whole cents. */
export function minPaymentCents(
  principalCents: number,
  aprBps: number,
  termMonths: number,
): number {
  if (termMonths <= 0) {
    return principalCents;
  }
  const r = monthlyRate(aprBps);
  if (r === 0) {
    return Math.ceil(principalCents / termMonths);
  }
  const growth = powLoop(1 + r, termMonths);
  return Math.ceil((principalCents * r * growth) / (growth - 1));
}

export interface AmortizationStep {
  readonly month: number;
  readonly interestCents: number;
  readonly principalCents: number;
  readonly paymentCents: number;
  readonly balanceAfterCents: number;
}

/**
 * Walk a loan to zero at minimum payments — the schedule invariant #6 checks.
 * The final payment absorbs the remainder, so it is smaller than the rest.
 */
export function amortizationSchedule(
  principalCents: number,
  aprBps: number,
  termMonths: number,
): AmortizationStep[] {
  const payment = minPaymentCents(principalCents, aprBps, termMonths);
  const steps: AmortizationStep[] = [];
  let balance = principalCents;
  for (let month = 1; month <= termMonths && balance > 0; month++) {
    const interest = monthlyInterestCents(balance, aprBps);
    const due = Math.min(payment, balance + interest);
    const principalPart = due - interest;
    balance -= principalPart;
    steps.push({
      month,
      interestCents: interest,
      principalCents: principalPart,
      paymentCents: due,
      balanceAfterCents: balance,
    });
  }
  return steps;
}
