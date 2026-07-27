import { describe, expect, it } from "vitest";
import { DIFFICULTY_MODS, DIFFICULTY_IDS } from "@/content/difficulty";
import { CREDIT_GRADES, LOAN_PRODUCT_LIST } from "@/content/loans";
import {
  amortizationSchedule,
  clampAprBps,
  minPaymentCents,
  monthlyInterestCents,
} from "./amortize";

/** GAME_BALANCE §11 invariant #6 — money math is exact, not approximate. */
describe("invariant #6: loans amortize to exactly zero", () => {
  it("Piggy Bank closes at $0 on its final scheduled payment", () => {
    const piggy = LOAN_PRODUCT_LIST.find((p) => p.id === "piggy")!;
    const apr = piggy.aprBpsByGrade[2]; // grade C, the starting grade
    const steps = amortizationSchedule(piggy.principalCents, apr, piggy.termMonths);
    expect(steps.length).toBeLessThanOrEqual(piggy.termMonths);
    expect(steps[steps.length - 1]!.balanceAfterCents).toBe(0);
    const principalPaid = steps.reduce((sum, s) => sum + s.principalCents, 0);
    expect(principalPaid).toBe(piggy.principalCents);
  });

  it("every product × grade × difficulty combination closes exactly", () => {
    for (const product of LOAN_PRODUCT_LIST) {
      for (let grade = 0; grade < CREDIT_GRADES.length; grade++) {
        for (const difficulty of DIFFICULTY_IDS) {
          const apr = clampAprBps(
            product.aprBpsByGrade[grade]! + DIFFICULTY_MODS[difficulty].loanAprOffsetBps,
          );
          const steps = amortizationSchedule(product.principalCents, apr, product.termMonths);
          const label = `${product.id}/${CREDIT_GRADES[grade]}/${difficulty}`;
          expect(steps.length, label).toBeLessThanOrEqual(product.termMonths);
          expect(steps[steps.length - 1]!.balanceAfterCents, label).toBe(0);
          expect(
            steps.reduce((sum, s) => sum + s.principalCents, 0),
            label,
          ).toBe(product.principalCents);
        }
      }
    }
  });

  it("fuzz: 20k random loans never leave a residual cent or overrun the term", () => {
    // Deterministic LCG — the sim's own no-Math.random discipline. Failures are
    // collected rather than asserted per-case: 20k × expect() dwarfs the math.
    let seed = 20260727;
    const rand = (): number => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x1_0000_0000;
    };
    const failures: string[] = [];
    for (let i = 0; i < 20_000; i++) {
      const principal = 1 + Math.floor(rand() * 50_000_00);
      const term = 1 + Math.floor(rand() * 60);
      const apr = clampAprBps(100 + Math.floor(rand() * 4_000));
      const steps = amortizationSchedule(principal, apr, term);
      const label = `P=${principal} N=${term} apr=${apr}`;
      const last = steps[steps.length - 1];
      if (steps.length > term) {
        failures.push(`${label}: ran ${steps.length} months past term`);
      } else if (!last || last.balanceAfterCents !== 0) {
        failures.push(`${label}: residual ${last?.balanceAfterCents ?? "none"}`);
      } else if (steps.reduce((sum, s) => sum + s.principalCents, 0) !== principal) {
        failures.push(`${label}: principal sum mismatch`);
      } else if (steps.some((s) => s.principalCents <= 0)) {
        failures.push(`${label}: negative amortization`);
      }
    }
    expect(failures.slice(0, 5)).toEqual([]);
  });

  it("a zero-interest loan splits evenly and still closes", () => {
    const steps = amortizationSchedule(1_000_00, 0, 10);
    expect(steps[steps.length - 1]!.balanceAfterCents).toBe(0);
    expect(steps.every((s) => s.interestCents === 0)).toBe(true);
  });
});

describe("rounding discipline", () => {
  it("interest floors — rounding always favours the player", () => {
    // 999 cents at 1200 bps ⇒ 999 × 0.01 = 9.99 ⇒ floors to 9.
    expect(monthlyInterestCents(999, 1_200)).toBe(9);
    expect(monthlyInterestCents(0, 1_200)).toBe(0);
    expect(monthlyInterestCents(-5, 1_200)).toBe(0);
  });

  it("the minimum payment always exceeds the first month's interest", () => {
    for (const product of LOAN_PRODUCT_LIST) {
      for (let grade = 0; grade < CREDIT_GRADES.length; grade++) {
        const apr = product.aprBpsByGrade[grade]!;
        const payment = minPaymentCents(product.principalCents, apr, product.termMonths);
        expect(payment).toBeGreaterThan(monthlyInterestCents(product.principalCents, apr));
      }
    }
  });

  it("APR clamps keep difficulty offsets inside sane bounds", () => {
    expect(clampAprBps(-500)).toBe(100);
    expect(clampAprBps(99_000)).toBe(5_000);
    expect(clampAprBps(1_250)).toBe(1_250);
  });

  it("amortization is engine-deterministic: same inputs, identical schedule", () => {
    const a = amortizationSchedule(25_000_00, 1_100, 36);
    const b = amortizationSchedule(25_000_00, 1_100, 36);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
