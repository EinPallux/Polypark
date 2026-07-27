/**
 * Districts (GAME_DESIGN §6, GAME_BALANCE §3.3).
 *
 * Polypark is a resort, not only a ride park — the pitch is explicit that the
 * parking lot, the hotels and the staff village are part of the place. A
 * district is a plot you buy once; it raises the park's land value and opens
 * its own buildables.
 *
 * All six are authored here from the start even though only two ship their
 * buildables, so adding the rest is a content edit and not a framework change.
 * The unshipped four are marked `buildables: []` and the UI says "coming" —
 * naming a district the player cannot use yet is honest; hiding the shape of
 * the resort is not.
 *
 * Every district is optional. None gates a system the park depends on, and
 * none can be lost — buying one is a permanent improvement (ADR-15).
 */

export const DISTRICT_IDS = [
  "parking",
  "resort",
  "staffVillage",
  "worksYard",
  "commerce",
  "arrivalStation",
] as const;
export type DistrictId = (typeof DISTRICT_IDS)[number];

export interface DistrictDef {
  readonly id: DistrictId;
  readonly nameKey: string;
  readonly blurbKey: string;
  /** One-off plot price in cents (GAME_BALANCE §3.3). */
  readonly plotCents: number;
  /** Park Level the plot goes on sale at. */
  readonly unlockLevel: number;
  /** Piece ids this district adds to the build palette. */
  readonly buildables: readonly string[];
}

export const DISTRICTS: Readonly<Record<DistrictId, DistrictDef>> = {
  parking: {
    id: "parking",
    nameKey: "district.parking.name",
    blurbKey: "district.parking.blurb",
    plotCents: 4_000_00,
    unlockLevel: 3,
    buildables: ["cityroads/parking-bay", "cityroads/lot-road", "cityroads/lot-light"],
  },
  resort: {
    id: "resort",
    nameKey: "district.resort.name",
    blurbKey: "district.resort.blurb",
    plotCents: 12_000_00,
    unlockLevel: 10,
    buildables: ["suburban/cabin", "suburban/hotel-block", "suburban/hedge"],
  },
  staffVillage: {
    id: "staffVillage",
    nameKey: "district.staffVillage.name",
    blurbKey: "district.staffVillage.blurb",
    plotCents: 8_000_00,
    unlockLevel: 8,
    buildables: [],
  },
  worksYard: {
    id: "worksYard",
    nameKey: "district.worksYard.name",
    blurbKey: "district.worksYard.blurb",
    plotCents: 10_000_00,
    unlockLevel: 12,
    buildables: [],
  },
  commerce: {
    id: "commerce",
    nameKey: "district.commerce.name",
    blurbKey: "district.commerce.blurb",
    plotCents: 15_000_00,
    unlockLevel: 14,
    buildables: [],
  },
  arrivalStation: {
    id: "arrivalStation",
    nameKey: "district.arrivalStation.name",
    blurbKey: "district.arrivalStation.blurb",
    plotCents: 18_000_00,
    unlockLevel: 18,
    buildables: [],
  },
};

export const DISTRICT_LIST: readonly DistrictDef[] = Object.values(DISTRICTS);

/* ---- Parking Grounds: arrival capacity (GAME_BALANCE §3.3) ---- */

/** Guests the front gate alone can handle at once. */
export const GATE_ARRIVAL_CAPACITY = 60;
/** Extra concurrent guests each parking bay supports (2 cars ≈ 5 guests). */
export const CAPACITY_PER_BAY = 5;

/**
 * Over-capacity taper. §3.3 reads as a hard ceiling, and GAME_DESIGN §6 calls
 * it "peak concurrent guests" — but a hard 60 would delete the shipped game,
 * which benches happily at 1,200–1,500 guests, and would read as a wall rather
 * than a pressure.
 *
 * So capacity is a soft, continuous, monotonic taper instead: past capacity,
 * arrivals scale by `(capacity / live)^0.6`, floored so a park is never fully
 * shut out. Building bays visibly speeds the gate back up; not building them
 * costs throughput without ever costing the park its guests.
 */
export const CAPACITY_TAPER_EXPONENT = 0.6;
export const CAPACITY_TAPER_FLOOR = 0.15;

/* ---- Resort Row (GAME_BALANCE §3.3) ---- */

export const HOTEL_ROOMS = { "suburban/cabin": 2, "suburban/hotel-block": 4 } as const;
export const HOTEL_NIGHTLY_CENTS = 30_00;
export const HOTEL_UPKEEP_PER_ROOM_CENTS = 6_00;
/**
 * Occupancy ships in the reduced form §3.3 allows: `f(rating)` only. The
 * night-hours term waits on night running (ROADMAP M5/M6) — multiplying by a
 * feature that does not exist would just be multiplying by 1 with extra steps.
 */
export const HOTEL_MAX_OCCUPANCY = 0.9;
