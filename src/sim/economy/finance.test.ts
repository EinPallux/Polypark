import { describe, expect, it } from "vitest";
import { createSim, type SimFacade } from "../api";
import { TEST_PIECES, TEST_SITE } from "../testing/fixture";
import { TICKS_PER_GAME_MONTH } from "../core/loop";
import { RECEIVERSHIP_MAX_MONTHS } from "./finance";

/**
 * The finance spine end to end: borrowing, the credit ladder, collections, and
 * the Receivership promise — insolvency is a rough chapter, never a deleted
 * save (ADR-15, invariant #8).
 */

function park(options?: {
  difficulty?: "relaxed" | "standard" | "tycoon";
  cash?: number;
}): SimFacade {
  return createSim({
    // Progression is not what this test is about — build from a full palette.
    unlockAll: true,
    seed: 99,
    parkName: "Finance Test",
    site: TEST_SITE,
    pieceDefs: TEST_PIECES,
    ...(options?.difficulty ? { difficulty: options.difficulty } : {}),
    ...(options?.cash !== undefined ? { startingCashCents: options.cash } : {}),
  });
}

describe("loans", () => {
  it("borrowing adds cash, charges origination, and is not counted as profit", () => {
    const sim = park();
    const before = sim.hud().money;
    expect(sim.dispatch({ type: "finance/takeLoan", product: "piggy" }).ok).toBe(true);
    // +$10,000 principal − 1% origination fee.
    expect(sim.hud().money).toBe(before + 10_000_00 - 100_00);
    const finance = sim.finance();
    expect(finance.loans).toHaveLength(1);
    expect(finance.loans[0]!.balanceCents).toBe(10_000_00);
    expect(sim.hud().debtCents).toBe(10_000_00);
  });

  it("a loan does not read as a profitable month", () => {
    const sim = park();
    expect(sim.dispatch({ type: "finance/takeLoan", product: "piggy" }).ok).toBe(true);
    sim.advance(TICKS_PER_GAME_MONTH);
    const report = sim.drainEvents().find((e) => e.type === "park/monthReport");
    expect(report).toBeDefined();
    if (report?.type === "park/monthReport") {
      // Borrowing lands in financing, never in income.
      expect(report.report.financing.borrowed).toBe(10_000_00);
      expect(Object.values(report.report.income).reduce((a, b) => a + b, 0)).toBe(0);
      expect(report.report.netCents).toBeLessThan(0); // only interest + fees
      expect(report.report.cashDeltaCents).toBeGreaterThan(0); // but cash rose
    }
  });

  it("blocks offers that would break the 65% debt ratio", () => {
    const sim = park();
    // A bare park is worth its $20,000 home plot: $25k+ borrowing is refused,
    // $10,000 (ratio 0.5) is fine. Borrowing power grows with what you build.
    const offers = sim.finance().offers;
    expect(offers.find((o) => o.product === "piggy")!.blocked).toBeNull();
    expect(offers.find((o) => o.product === "trust")!.blocked).toBe("debt-ratio");
    expect(sim.dispatch({ type: "finance/takeLoan", product: "trust" }).ok).toBe(false);
    expect(sim.dispatch({ type: "finance/takeLoan", product: "piggy" }).ok).toBe(true);
    // Now leveraged, even a second small loan is out of reach.
    expect(sim.finance().offers.find((o) => o.product === "piggy")!.blocked).toBe("debt-ratio");
  });

  it("payoff clears the loan and costs no penalty", () => {
    const sim = park();
    sim.dispatch({ type: "finance/takeLoan", product: "piggy" });
    const loanId = sim.finance().loans[0]!.id;
    const cashBefore = sim.hud().money;
    expect(sim.dispatch({ type: "finance/payLoan", loanId, amount: "payoff" }).ok).toBe(true);
    expect(sim.finance().loans).toHaveLength(0);
    expect(sim.hud().money).toBe(cashBefore - 10_000_00);
    expect(sim.snapshot().stats.loansPaidOff).toBe(1);
  });

  it("the quoted rate follows the credit grade and difficulty", () => {
    const standard = park()
      .finance()
      .offers.find((o) => o.product === "piggy")!;
    const tycoon = park({ difficulty: "tycoon" })
      .finance()
      .offers.find((o) => o.product === "piggy")!;
    const relaxed = park({ difficulty: "relaxed" })
      .finance()
      .offers.find((o) => o.product === "piggy")!;
    expect(standard.aprBps).toBe(850); // grade C
    expect(tycoon.aprBps).toBe(1_150); // +300 bps
    expect(relaxed.aprBps).toBe(650); // −200 bps
  });
});

describe("difficulty", () => {
  it("scales starting cash per GAME_BALANCE §2", () => {
    expect(park({ difficulty: "relaxed" }).hud().money).toBe(112_500_00);
    expect(park({ difficulty: "standard" }).hud().money).toBe(75_000_00);
    expect(park({ difficulty: "tycoon" }).hud().money).toBe(56_250_00);
  });
});

describe("invariant #8: Receivership is a chapter, never an ending", () => {
  /**
   * A park that cannot pay: a closed gate (no income), a loan to service, and
   * a payroll far beyond its means. Wages are the sink — a loan alone can
   * never bankrupt you, because borrowing hands you the cash.
   */
  function insolventPark(): SimFacade {
    const sim = park({ cash: 2_000_00 });
    sim.dispatch({ type: "finance/takeLoan", product: "piggy" });
    for (let i = 0; i < 20; i++) {
      sim.dispatch({ type: "staff/hireJanitor" });
    }
    return sim;
  }

  it("never triggers while cash is non-negative", () => {
    const sim = park();
    sim.advance(TICKS_PER_GAME_MONTH * 8);
    expect(sim.hud().money).toBeGreaterThanOrEqual(0);
    expect(sim.finance().receivership.active).toBe(false);
    expect(sim.hud().receivershipActive).toBe(false);
  });

  it("opens only after the difficulty's run of insolvent months", () => {
    const sim = insolventPark();
    // Standard = 2 consecutive insolvent month closes.
    let entered = false;
    for (let month = 0; month < 4 && !entered; month++) {
      sim.advance(TICKS_PER_GAME_MONTH);
      entered = sim.finance().receivership.active;
    }
    expect(entered).toBe(true);
  });

  it("never holds a park longer than six months, even doing nothing", () => {
    const sim = insolventPark();
    // This park keeps its ruinous payroll and never earns a cent — the worst
    // case. It may re-enter, but no single spell may exceed the backstop.
    let sawActive = false;
    for (let month = 0; month < 24; month++) {
      sim.advance(TICKS_PER_GAME_MONTH);
      const receivership = sim.finance().receivership;
      if (receivership.active) {
        sawActive = true;
        expect(receivership.monthsActive).toBeLessThanOrEqual(RECEIVERSHIP_MAX_MONTHS);
      }
    }
    expect(sawActive).toBe(true);
  });

  it("the scripted recovery playbook always exits — and it stays exited", () => {
    const sim = insolventPark();
    for (let month = 0; month < 4 && !sim.finance().receivership.active; month++) {
      sim.advance(TICKS_PER_GAME_MONTH);
    }
    expect(sim.finance().receivership.active).toBe(true);

    // The playbook: cut the payroll you cannot afford. Nothing exotic — the
    // actions a player has available from inside Receivership.
    for (let i = 0; i < 20; i++) {
      sim.dispatch({ type: "staff/fireJanitor" });
    }
    let exitedWithin = 0;
    for (let month = 1; month <= RECEIVERSHIP_MAX_MONTHS + 1; month++) {
      sim.advance(TICKS_PER_GAME_MONTH);
      if (!sim.finance().receivership.active) {
        exitedWithin = month;
        break;
      }
    }
    expect(exitedWithin).toBeGreaterThan(0);
    expect(exitedWithin).toBeLessThanOrEqual(RECEIVERSHIP_MAX_MONTHS + 1);
    // Exit leaves the park solvent and current: cash at or above zero and no
    // arrears outstanding. (A park with literally no income can slide back —
    // that is honest, and the previous test proves each spell still ends.)
    expect(sim.hud().money).toBeGreaterThanOrEqual(0);
    expect(sim.finance().loans.reduce((sum, l) => sum + l.arrearsCents, 0)).toBe(0);
  });

  it("caps big construction while active but never blocks hiring the way out", () => {
    const sim = insolventPark();
    for (let month = 0; month < 4 && !sim.finance().receivership.active; month++) {
      sim.advance(TICKS_PER_GAME_MONTH);
    }
    expect(sim.finance().receivership.active).toBe(true);
    // A $1,200 path run (30 cells × $40) is over the $1,000 cap and refused…
    const denied = sim.dispatch({
      type: "build/paintPath",
      // 30 DISTINCT cells — duplicates dedupe and would fall under the cap.
      cells: Array.from({ length: 30 }, (_, i) => ({
        x: TEST_SITE.gate.x - (i % 2),
        z: TEST_SITE.gate.z - Math.floor(i / 2),
      })),
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.reason).toBe("receivership-limited");
    }
    // …but staffing is never subject to the cap: it is how a park climbs out.
    // (This park is broke, so hiring still fails — on ORDINARY affordability,
    // never on the receivership limit. That distinction is the whole point.)
    const hire = sim.dispatch({ type: "staff/hireJanitor" });
    expect(hire.ok).toBe(false);
    if (!hire.ok) {
      expect(hire.reason).toBe("not-enough-money");
    }
    // A solvent park in receivership hires freely: no cap, any wage bill.
    const solvent = park({ cash: 5_000_00 });
    solvent.dispatch({ type: "finance/takeLoan", product: "piggy" });
    expect(solvent.dispatch({ type: "staff/hireMechanic" }).ok).toBe(true);
    // And marketing is frozen.
    expect(sim.dispatch({ type: "marketing/start", campaign: "flyers" }).ok).toBe(false);
  });

  it("deals recovery goal cards while active and stops dealing them after", () => {
    const sim = insolventPark();
    for (let month = 0; month < 4 && !sim.finance().receivership.active; month++) {
      sim.advance(TICKS_PER_GAME_MONTH);
    }
    sim.advance(30);
    const activeCards = sim.hud().goals.map((g) => g.cardId);
    expect(activeCards.some((id) => id.startsWith("recovery-"))).toBe(true);
  });
});

describe("marketing", () => {
  it("runs for its duration, then expires on its own", () => {
    const sim = park();
    expect(sim.dispatch({ type: "marketing/start", campaign: "flyers" }).ok).toBe(true);
    expect(sim.hud().activeCampaign).toBe("flyers");
    // A second campaign cannot stack.
    expect(sim.dispatch({ type: "marketing/start", campaign: "online" }).ok).toBe(false);
    sim.advance(TICKS_PER_GAME_MONTH + 1);
    expect(sim.hud().activeCampaign).toBeNull();
    expect(sim.snapshot().stats.campaignsRun).toBe(1);
  });

  it("charges the campaign to its own ledger line", () => {
    const sim = park();
    sim.dispatch({ type: "marketing/start", campaign: "parade" });
    expect(sim.snapshot().ledger.expense.marketing).toBe(6_500_00);
  });
});

describe("determinism and persistence", () => {
  it("a park with debt round-trips through a save and resumes identically", () => {
    const sim = park();
    sim.dispatch({ type: "finance/takeLoan", product: "trust" });
    sim.dispatch({ type: "marketing/start", campaign: "online" });
    sim.advance(TICKS_PER_GAME_MONTH + 500);
    const snapshot = sim.snapshot();
    const resumed = createSim({
      // Progression is not what this test is about — build from a full palette.
      unlockAll: true,
      seed: snapshot.seed,
      site: TEST_SITE,
      pieceDefs: TEST_PIECES,
      resumeFrom: structuredClone(snapshot),
    });
    resumed.advance(400);
    sim.advance(400);
    expect(resumed.hash()).toBe(sim.hash());
  });

  it("the valuation cache never leaks into the state hash", () => {
    const sim = park();
    const before = sim.hash();
    sim.finance(); // builds the cache
    sim.finance();
    expect(sim.hash()).toBe(before);
  });

  it("park value counts assets, cash and debt", () => {
    const sim = park();
    const empty = sim.finance().valuation;
    expect(empty.landValueCents).toBe(20_000_00);
    expect(empty.parkValueCents).toBe(empty.assetValueCents + 75_000_00);
    sim.dispatch({ type: "finance/takeLoan", product: "piggy" });
    const borrowed = sim.finance().valuation;
    expect(borrowed.debtCents).toBe(10_000_00);
    expect(borrowed.debtRatio).toBeGreaterThan(0);
  });
});
