import { describe, expect, it } from "vitest";
import { GOAL_CARDS } from "@/content/goals";
import { LOAN_PRODUCTS } from "@/content/loans";
import { MARKETING_CAMPAIGNS } from "@/content/marketing";
import { FLAT_RIDES } from "@/content/rides";
import { TRACK_FAMILY_IDS } from "@/content/track";
import { RATING_CAUSE_IDS } from "@/sim/api";
import { WEATHER, WEATHER_IDS } from "@/content/weather";
import { en } from "./en";
import { months, t } from "./t";

/**
 * Keys built from content ids — `goal.${card.id}`, a def's nameKey — reach t()
 * through a cast, so TypeScript cannot see them. This test is the check that
 * would have: every id the game can name must resolve to real copy. M3's ride
 * goals and M4's loan names both shipped blank before it existed.
 */

const has = (key: string): boolean => Object.hasOwn(en, key);

describe("every dynamically-built key resolves", () => {
  it("names each goal card", () => {
    expect(GOAL_CARDS.filter((card) => !has(`goal.${card.id}`)).map((c) => c.id)).toEqual([]);
  });

  it("names each loan product and marketing campaign", () => {
    const defs = [...Object.values(LOAN_PRODUCTS), ...Object.values(MARKETING_CAMPAIGNS)];
    expect(defs.filter((def) => !has(def.nameKey)).map((d) => d.id)).toEqual([]);
  });

  it("names each ride the player can build", () => {
    const missing = [
      ...Object.keys(FLAT_RIDES).filter((id) => !has(`ride.${id}`)),
      ...TRACK_FAMILY_IDS.filter((id) => !has(`ride.family.${id}`)),
    ];
    expect(missing).toEqual([]);
  });

  it("names every kind of weather, in the table and on the strip", () => {
    const missing = [
      ...WEATHER_IDS.filter((id) => !has(`weather.${id}`)),
      ...Object.values(WEATHER).filter((def) => !has(def.nameKey)).map((d) => d.id),
    ];
    expect(missing).toEqual([]);
  });

  it("explains every rating cause the sim can raise", () => {
    const missing = RATING_CAUSE_IDS.filter((cause) => !has(`rating.cause.${cause}`));
    expect(missing).toEqual([]);
  });
});

describe("t()", () => {
  it("fills {params} and leaves unknown ones alone", () => {
    expect(t("goal.completedToast", { title: "Tidy park", xp: 150 })).toBe(
      "Goal complete: Tidy park (+150 XP)",
    );
  });

  it("echoes an unknown key instead of rendering blank", () => {
    // why: casts let a missing key through; a visible id beats an empty gap.
    expect(t("goal.not-a-real-card" as never)).toBe("goal.not-a-real-card");
  });

  it("has no empty copy anywhere", () => {
    expect(Object.entries(en).filter(([, value]) => value.trim() === "")).toEqual([]);
  });

  it("says '1 month', never '1 months'", () => {
    expect(months(1)).toBe("1 month");
    expect(months(3)).toBe("3 months");
    expect(months(0)).toBe("0 months");
  });

  it("leaves no {placeholder} unfilled in a rendered sentence", () => {
    const rendered = t("manage.campaignTerms", { reach: 15, duration: months(1) });
    expect(rendered).toBe("+15% arrivals · 1 month");
    expect(rendered).not.toMatch(/\{/);
  });
});
