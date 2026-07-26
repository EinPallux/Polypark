import { describe, expect, it } from "vitest";
import { addMoney, money, moneyToDollarString, scaleMoney, subMoney } from "./money";

describe("money (integer cents, CLAUDE.md)", () => {
  it("constructs from integers and rejects floats", () => {
    expect(money(1250)).toBe(1250);
    expect(() => money(12.5)).toThrow(RangeError);
    expect(() => money(Number.NaN)).toThrow(RangeError);
    expect(() => money(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
  });

  it("adds and subtracts without drift", () => {
    let total = money(0);
    for (let i = 0; i < 1000; i++) {
      total = addMoney(total, money(1)); // 1 cent × 1000
    }
    expect(total).toBe(1000);
    expect(subMoney(total, money(999))).toBe(1);
  });

  it("scales with round-half-away-from-zero and stays integer", () => {
    expect(scaleMoney(money(100), 0.155)).toBe(16);
    expect(scaleMoney(money(-100), 0.155)).toBe(-16);
    expect(scaleMoney(money(333), 1 / 3)).toBe(111);
  });

  it("formats for debug output", () => {
    expect(moneyToDollarString(money(128_450_00))).toBe("$128450");
    expect(moneyToDollarString(money(999))).toBe("$9.99");
    expect(moneyToDollarString(money(-50))).toBe("-$0.50");
  });
});
