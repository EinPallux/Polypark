import { money, type Money } from "@/shared/money";

/**
 * Shop/facility definitions (GAME_BALANCE §6) keyed by catalog piece id.
 * A placed building piece with an entry here runs a serve loop in the sim.
 */
export type NeedKey = "hunger" | "thirst" | "bladder" | "energy" | "fun";

/**
 * What a facility does beyond satisfying a need. Kept separate from NeedKey so
 * a facility can have a real effect without pretending to be a need — an ATM
 * does not make you less hungry, it makes you able to buy lunch.
 */
export type FacilityEffect = "wallet" | "firstAid" | "wayfinding" | "souvenir";

export interface ShopDef {
  readonly pieceId: string;
  readonly buildCost: Money;
  /** Player-facing default price per serving (0 = free facility). */
  readonly defaultPriceCents: number;
  /** Ingredient cost per serving, charged to the park. */
  readonly unitCostCents: number;
  readonly satisfies: NeedKey;
  readonly amount: number;
  /**
   * A second need this serving moves, which MAY be negative — GAME_BALANCE §6
   * gives the Grill Garden "Thirst −5", because salty food is what sends a
   * guest to the drinks stall afterwards. Shops that feed each other are the
   * point; a park is a system, not a row of independent vending machines.
   */
  readonly secondary?: { readonly need: NeedKey; readonly amount: number };
  readonly serveTicks: number;
  /**
   * Guests served at once. Absent means unlimited, which is right for a stall
   * window that turns a guest around in a second or two — §6 only specifies
   * occupancy for the seated buildings. The Poly Bistro's 40 covers are what
   * make it "high margin, low throughput" (GAME_DESIGN §10) rather than a
   * snack stall with bigger numbers on it.
   */
  readonly capacity?: number;
  /** Monthly upkeep. */
  readonly upkeepCents: number;
  /** Chance a serving eventually becomes litter (GAME_DESIGN §12.3). */
  readonly litterChance: number;
  readonly ledgerCategory: "food" | "drink" | "facility" | "retail";
  /** Optional facility behaviour (GAME_BALANCE §6). */
  readonly effect?: FacilityEffect;
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
  /**
   * The four composed buildings (GAME_DESIGN §10). Each is a kit assembly
   * rather than a catalog piece — see src/content/buildings.ts — and each
   * carries a mechanic the three M2 stalls do not have, which is the whole
   * reason they waited for real composition instead of shipping as reskins.
   */
  "composed/grill-garden": {
    pieceId: "composed/grill-garden",
    buildCost: money(5_500_00),
    defaultPriceCents: 9_00,
    unitCostCents: 2_80,
    satisfies: "hunger",
    amount: 70,
    secondary: { need: "thirst", amount: -5 },
    serveTicks: 25,
    upkeepCents: 170_00,
    litterChance: 0.35,
    ledgerCategory: "food",
  },
  "composed/sweet-scoop": {
    pieceId: "composed/sweet-scoop",
    buildCost: money(4_200_00),
    defaultPriceCents: 5_00,
    unitCostCents: 1_20,
    satisfies: "hunger",
    amount: 25,
    secondary: { need: "fun", amount: 6 },
    serveTicks: 12,
    upkeepCents: 140_00,
    litterChance: 0.25,
    ledgerCategory: "food",
  },
  "composed/poly-bistro": {
    pieceId: "composed/poly-bistro",
    buildCost: money(12_000_00),
    defaultPriceCents: 18_00,
    unitCostCents: 6_00,
    satisfies: "hunger",
    amount: 90,
    // The park's only source of Energy. Guests tire on a fixed clock and
    // nothing gave it back before this building existed.
    secondary: { need: "energy", amount: 20 },
    // §6: "20 min seated × 40 seats". 20 game-minutes at 12 game-seconds per
    // tick is 100 ticks, so the whole restaurant turns over 40 covers every
    // 100 ticks — roughly a tenth of a snack stall's throughput for four
    // times the margin.
    serveTicks: 100,
    capacity: 40,
    upkeepCents: 420_00,
    litterChance: 0.1, // cleared from tables, not dropped on the path
    ledgerCategory: "food",
  },
  "composed/gift-kiosk": {
    pieceId: "composed/gift-kiosk",
    buildCost: money(4_800_00),
    defaultPriceCents: 12_00,
    unitCostCents: 4_00,
    satisfies: "fun",
    amount: 8,
    serveTicks: 20,
    upkeepCents: 150_00,
    litterChance: 0.2,
    ledgerCategory: "retail",
    effect: "souvenir",
  },
  /**
   * Facilities (GAME_BALANCE §6). Each has a real mechanical effect — a
   * building that only decorates the palette is content in name only.
   */
  "minimarket/atm": {
    pieceId: "minimarket/atm",
    buildCost: money(1_500_00),
    defaultPriceCents: 2_50, // the fee IS the product
    unitCostCents: 0,
    satisfies: "fun", // nominal; the wallet top-up is the point
    amount: 0,
    serveTicks: 4,
    upkeepCents: 60_00,
    litterChance: 0,
    ledgerCategory: "facility",
    effect: "wallet",
  },
  "modularbuildings/first-aid": {
    pieceId: "modularbuildings/first-aid",
    buildCost: money(3_600_00),
    defaultPriceCents: 0, // free, and stays free (GAME_DESIGN §24)
    unitCostCents: 0,
    satisfies: "energy",
    amount: 35,
    serveTicks: 15,
    upkeepCents: 160_00,
    litterChance: 0,
    ledgerCategory: "facility",
    effect: "firstAid",
  },
  "coasterkit/stall-info": {
    pieceId: "coasterkit/stall-info",
    buildCost: money(2_000_00),
    defaultPriceCents: 0,
    unitCostCents: 0,
    satisfies: "fun",
    amount: 6,
    serveTicks: 6,
    upkeepCents: 80_00,
    litterChance: 0,
    ledgerCategory: "facility",
    effect: "wayfinding",
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

/** How much cash an ATM hands a guest (GAME_BALANCE §4.3 refill). */
export const ATM_REFILL_CENTS = 40_00;
/**
 * How far guests will look for a shop, in cells — and how much further an Info
 * Kiosk lets them look. A park too big to navigate is the problem the kiosk
 * exists to solve (§6: "−60% lost chance in 40 m").
 */
export const SHOP_SEARCH_REACH = 3;
export const INFO_KIOSK_REACH_BONUS = 5;

/** Guests per month one First Aid post covers (inspection score, §8.1). */
export const FIRST_AID_GUESTS_PER_POST = 400;

/**
 * Souvenirs scale with how much guests like the park (GAME_DESIGN §10:
 * "Fun + souvenir income, rating-scaled").
 *
 * Expressed as basket size rather than as a hidden multiplier on the price:
 * every buyer takes one item at the price the player set, and a delighted
 * guest has a chance at a second. A secret multiplier on a number the player
 * typed into the inspector would make the panel lie; "they bought two" is
 * something the park can be told about honestly.
 *
 * The chance runs from 0 at 1★ to 1 at 5★, so §6's "$12 avg" lands near the
 * listed price for a middling park and roughly doubles for a beloved one.
 */
export const SOUVENIR_SECOND_ITEM_MIN_STARS = 1;
export const SOUVENIR_SECOND_ITEM_MAX_STARS = 5;

export function souvenirSecondItemChance(stars: number): number {
  const span = SOUVENIR_SECOND_ITEM_MAX_STARS - SOUVENIR_SECOND_ITEM_MIN_STARS;
  const t = (stars - SOUVENIR_SECOND_ITEM_MIN_STARS) / span;
  return Math.min(1, Math.max(0, t));
}
