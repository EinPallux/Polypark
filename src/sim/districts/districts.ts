/**
 * District plots and what owning them does (GAME_BALANCE §3.3).
 *
 * Buying a plot is a one-off purchase that raises the park's land value and
 * opens the district's buildables. It is the only way land value grows, which
 * matters more than it looks: land value feeds the park valuation, the
 * valuation sets borrowing headroom, and without it the biggest loan stays
 * permanently out of reach no matter how well the park does.
 */
import {
  CAPACITY_PER_BAY,
  CAPACITY_TAPER_EXPONENT,
  CAPACITY_TAPER_FLOOR,
  DISTRICTS,
  DISTRICT_IDS,
  GATE_ARRIVAL_CAPACITY,
  HOTEL_MAX_OCCUPANCY,
  HOTEL_NIGHTLY_CENTS,
  HOTEL_ROOMS,
  HOTEL_UPKEEP_PER_ROOM_CENTS,
  type DistrictId,
} from "@/content/districts";
import { type SimState } from "../state";

export interface DistrictsState {
  /** Plots the park owns. */
  owned: DistrictId[];
  /**
   * Billboards in the Commerce Quarter. Derived from placed pieces once that
   * district ships; 0 until then. Marketing reads it (§3.3), so it exists as a
   * real field rather than an optional the caller has to guard.
   */
  billboardCount: number;
  /** Fractional guests the gate turned away this month — reported, not hidden. */
  turnedAwayThisMonth: number;
}

export function createDistrictsState(): DistrictsState {
  return { owned: [], billboardCount: 0, turnedAwayThisMonth: 0 };
}

export const ownsDistrict = (state: SimState, id: DistrictId): boolean =>
  state.districts.owned.includes(id);

/** Piece ids the park may build because it owns the district that offers them. */
export function districtBuildables(state: SimState): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const id of state.districts.owned) {
    for (const piece of DISTRICTS[id].buildables) {
      ids.add(piece);
    }
  }
  return ids;
}

/** Every district buildable, owned or not — the palette greys the rest. */
export const ALL_DISTRICT_BUILDABLES: ReadonlySet<string> = new Set(
  DISTRICT_IDS.flatMap((id) => [...DISTRICTS[id].buildables]),
);

/** The district a piece belongs to, or null if it is ordinary park content. */
export function districtOfPiece(pieceId: string): DistrictId | null {
  for (const id of DISTRICT_IDS) {
    if (DISTRICTS[id].buildables.includes(pieceId)) {
      return id;
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Parking Grounds — arrival capacity                                  */
/* ------------------------------------------------------------------ */

/** Concurrent guests the park can comfortably handle. */
export function arrivalCapacity(state: SimState): number {
  let bays = 0;
  for (const piece of state.world.placed.values()) {
    if (piece.pieceId === "cityroads/parking-bay") {
      bays += 1;
    }
  }
  return GATE_ARRIVAL_CAPACITY + bays * CAPACITY_PER_BAY;
}

/**
 * Multiplies arrivals when the park is busier than it can handle. Never zero:
 * a full lot slows the gate, it does not close it. Monotonic in `live`, so
 * more guests never *helps* — a property the test pins, because a
 * non-monotonic taper would make the park oscillate.
 */
export function arrivalCapacityMult(state: SimState, liveGuests: number): number {
  const capacity = arrivalCapacity(state);
  if (liveGuests <= capacity) {
    return 1;
  }
  return Math.max(
    Math.pow(capacity / liveGuests, CAPACITY_TAPER_EXPONENT),
    CAPACITY_TAPER_FLOOR,
  );
}

/** Guests turned away this month because the park was over capacity. */
export function bumpTurnaways(state: SimState, mult: number): void {
  if (mult < 1) {
    state.districts.turnedAwayThisMonth += 1 - mult;
  }
}

/* ------------------------------------------------------------------ */
/* Resort Row — hotel rooms                                            */
/* ------------------------------------------------------------------ */

export function hotelRooms(state: SimState): number {
  let rooms = 0;
  for (const piece of state.world.placed.values()) {
    rooms += HOTEL_ROOMS[piece.pieceId as keyof typeof HOTEL_ROOMS] ?? 0;
  }
  return rooms;
}

/**
 * Monthly hotel income and upkeep. Occupancy follows the park's rating: nobody
 * books a room beside a park they did not enjoy. Upkeep is charged on every
 * room whether or not it sold, which is what makes over-building a real
 * mistake rather than a free bet.
 */
export function hotelMonthClose(state: SimState): { grossCents: number; upkeepCents: number } {
  const rooms = hotelRooms(state);
  if (rooms === 0) {
    return { grossCents: 0, upkeepCents: 0 };
  }
  const occupancy = Math.min(HOTEL_MAX_OCCUPANCY, (state.rating.stars / 5) * HOTEL_MAX_OCCUPANCY);
  // Four park days a month, so four nights of trade per room (§16 calendar).
  const nights = 4;
  const grossCents = Math.round(rooms * occupancy * nights * HOTEL_NIGHTLY_CENTS);
  return { grossCents, upkeepCents: rooms * HOTEL_UPKEEP_PER_ROOM_CENTS };
}
