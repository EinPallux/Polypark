import { money, type Money } from "@/shared/money";

/**
 * Shop/facility definitions (GAME_BALANCE §6) keyed by catalog piece id.
 * A placed building piece with an entry here runs a serve loop in the sim.
 */
export type NeedKey = "hunger" | "thirst" | "bladder" | "energy" | "fun";

export interface ShopDef {
  readonly pieceId: string;
  readonly buildCost: Money;
  /** Player-facing default price per serving (0 = free facility). */
  readonly defaultPriceCents: number;
  /** Ingredient cost per serving, charged to the park. */
  readonly unitCostCents: number;
  readonly satisfies: NeedKey;
  readonly amount: number;
  readonly serveTicks: number;
  /** Monthly upkeep. */
  readonly upkeepCents: number;
  /** Chance a serving eventually becomes litter (GAME_DESIGN §12.3). */
  readonly litterChance: number;
  readonly ledgerCategory: "food" | "drink" | "facility";
}

export const SHOP_DEFS: Readonly<Record<string, ShopDef>> = {
  "coasterkit/stall-food": {
    pieceId: "coasterkit/stall-food",
    buildCost: money(3_200_00),
    defaultPriceCents: 6_00,
    unitCostCents: 1_70,
    satisfies: "hunger",
    amount: 45,
    serveTicks: 13, // 1.3 s real time at 1× (GAME_BALANCE §6 M2 note)
    upkeepCents: 120_00,
    litterChance: 0.3,
    ledgerCategory: "food",
  },
  "coasterkit/stall-drinks": {
    pieceId: "coasterkit/stall-drinks",
    buildCost: money(2_600_00),
    defaultPriceCents: 4_00,
    unitCostCents: 80,
    satisfies: "thirst",
    amount: 55,
    serveTicks: 7,
    upkeepCents: 90_00,
    litterChance: 0.2,
    ledgerCategory: "drink",
  },
  "coasterkit/stall-toilets": {
    pieceId: "coasterkit/stall-toilets",
    buildCost: money(2_800_00),
    defaultPriceCents: 0,
    unitCostCents: 30,
    satisfies: "bladder",
    amount: 85,
    serveTicks: 8,
    upkeepCents: 110_00,
    litterChance: 0,
    ledgerCategory: "facility",
  },
};

/**
 * Hard ceiling on any shop price. Not a balance dial — a decency rail: the
 * elasticity model already makes gouging unprofitable, and this only stops the
 * UI offering a number no guest would ever pay (GAME_DESIGN §24).
 */
export const SHOP_PRICE_CEILING_CENTS = 40_00;

/**
 * How far above the default price guests will tolerate before they start
 * walking away, scaled by each archetype's price tolerance (GAME_BALANCE §4.3).
 * At 1.0 the shop is at its default; the walk-away curve starts past this.
 */
export const SHOP_FAIR_PRICE_RATIO = 1.15;
