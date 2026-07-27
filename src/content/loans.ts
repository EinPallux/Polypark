/**
 * Loan products and the credit ladder (GAME_BALANCE §8.2). Three escalating
 * offers let you buy the marquee ride you cannot afford yet; the A–E grade you
 * earn six clean months at a time decides what they cost.
 *
 * Rates are quoted from this table but LOCKED onto the loan at origination, so
 * retuning these numbers never re-prices a loan already in flight (which would
 * break the amortization exactness invariant on an old save).
 */

export const LOAN_PRODUCT_IDS = ["piggy", "trust", "consortium"] as const;
export type LoanProductId = (typeof LOAN_PRODUCT_IDS)[number];

export const CREDIT_GRADES = ["A", "B", "C", "D", "E"] as const;
export type CreditGrade = (typeof CREDIT_GRADES)[number];
/** Index into CREDIT_GRADES: 0 = A (best) … 4 = E (floor). */
export type CreditGradeIndex = 0 | 1 | 2 | 3 | 4;

export interface LoanProductDef {
  readonly id: LoanProductId;
  /** i18n key — never a literal user-facing string (CLAUDE.md). */
  readonly nameKey: string;
  readonly principalCents: number;
  readonly termMonths: number;
  /** APR in basis points, indexed by CreditGradeIndex (A→E). */
  readonly aprBpsByGrade: readonly [number, number, number, number, number];
  /** Origination fee as basis points of principal (100 bps = 1%). */
  readonly originationBps: number;
  /** Hard rating ceiling in stars while any loan of this product is live. */
  readonly ratingCapStars: number | null;
}

export const LOAN_PRODUCTS: Readonly<Record<LoanProductId, LoanProductDef>> = {
  piggy: {
    id: "piggy",
    nameKey: "loan.piggy.name",
    principalCents: 10_000_00,
    termMonths: 24,
    aprBpsByGrade: [600, 725, 850, 975, 1100],
    originationBps: 100,
    ratingCapStars: null,
  },
  trust: {
    id: "trust",
    nameKey: "loan.trust.name",
    principalCents: 25_000_00,
    termMonths: 36,
    aprBpsByGrade: [800, 950, 1100, 1250, 1400],
    originationBps: 200,
    ratingCapStars: null,
  },
  consortium: {
    id: "consortium",
    nameKey: "loan.consortium.name",
    principalCents: 60_000_00,
    termMonths: 48,
    aprBpsByGrade: [1100, 1300, 1500, 1700, 1900],
    originationBps: 300,
    ratingCapStars: 4.5,
  },
};

export const LOAN_PRODUCT_LIST: readonly LoanProductDef[] = Object.values(LOAN_PRODUCTS);

/** Parks start at C (GAME_BALANCE §8.2). */
export const STARTING_CREDIT_GRADE: CreditGradeIndex = 2;
/** Clean months needed to climb one grade. */
export const CREDIT_CLEAN_MONTHS_PER_GRADE = 6;
/** Concurrent loan cap (GAME_DESIGN §14.3). */
export const MAX_CONCURRENT_LOANS = 3;
/** Debt/asset ratio above which no new offer may be taken. */
export const MAX_DEBT_RATIO = 0.65;
/** Missed payments at grade E that trigger collections. */
export const COLLECTIONS_MISSED_PAYMENTS = 2;
/** APR clamp after difficulty offsets, in basis points. */
export const APR_FLOOR_BPS = 100;
export const APR_CEIL_BPS = 5_000;
