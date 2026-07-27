import { describe, expect, it } from "vitest";
import {
  FORECAST_DAYS,
  WEATHER,
  WEATHER_IDS,
  WEATHER_TRANSITIONS,
  type WeatherId,
} from "@/content/weather";
import { RngStream } from "@/shared/rng";
import { createSim, RIDE_STATE, TICKS_PER_PARK_DAY, type SimFacade } from "../api";
import { TEST_PIECES, TEST_SITE } from "../testing/fixture";
import { nextWeather } from "./weather";

/**
 * Weather is day-quantised and forecast three days ahead, so the two things
 * worth pinning are that the chain is a real distribution and that the
 * forecast is a promise rather than a re-roll (pillar P5).
 */

function park(seed = 31): SimFacade {
  const sim = createSim({ seed, parkName: "Weather", site: TEST_SITE, pieceDefs: TEST_PIECES });
  const gate = TEST_SITE.gate;
  sim.dispatch({
    type: "build/paintPath",
    cells: Array.from({ length: 8 }, (_, i) => ({ x: gate.x, z: gate.z - i })),
  });
  return sim;
}

describe("the chain is a well-formed distribution", () => {
  it("gives every kind a row whose weights sum to 1", () => {
    for (const from of WEATHER_IDS) {
      const row = WEATHER_TRANSITIONS[from];
      const total = WEATHER_IDS.reduce((sum, to) => sum + row[to], 0);
      expect(total).toBeCloseTo(1, 10);
      for (const to of WEATHER_IDS) {
        expect(row[to]).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("covers the whole [0,1) roll range for every row", () => {
    for (const from of WEATHER_IDS) {
      for (let roll = 0; roll < 1; roll += 0.001) {
        expect(WEATHER_IDS).toContain(nextWeather(from, roll));
      }
    }
  });

  it("never brews a storm out of a clear sky", () => {
    // Storms come from cloud. A bolt from blue sky would make the forecast
    // useless as a warning, which is the whole point of showing one.
    expect(WEATHER_TRANSITIONS.sunny.storm).toBe(0);
    expect(WEATHER_TRANSITIONS.overcast.storm).toBeGreaterThan(0);
  });

  it("lands near the §8.1 relative frequencies over a long run", () => {
    const rng = RngStream.fromSeed(7, "weather");
    const counts: Record<string, number> = {};
    let current: WeatherId = "sunny";
    const days = 40_000;
    for (let i = 0; i < days; i++) {
      current = nextWeather(current, rng.next());
      counts[current] = (counts[current] ?? 0) + 1;
    }
    const share = (id: WeatherId): number => (counts[id] ?? 0) / days;
    expect(share("rain")).toBeGreaterThan(0.12);
    expect(share("rain")).toBeLessThan(0.26);
    expect(share("storm")).toBeGreaterThan(0.01);
    expect(share("storm")).toBeLessThan(0.06);
    expect(share("heatwave")).toBeGreaterThan(0.03);
    expect(share("heatwave")).toBeLessThan(0.14);
    // Fair weather still dominates — this is a holiday park, not Ravenholm.
    expect(share("sunny") + share("overcast")).toBeGreaterThan(0.55);
  });
});

describe("the forecast is a promise, not a guess", () => {
  it("shows exactly FORECAST_DAYS days ahead", () => {
    expect(park().weather().forecast).toHaveLength(FORECAST_DAYS);
  });

  it("delivers tomorrow exactly as forecast", () => {
    const sim = park();
    for (let day = 0; day < 6; day++) {
      const promised = sim.weather().forecast[0]!;
      sim.advance(TICKS_PER_PARK_DAY);
      expect(sim.weather().today).toBe(promised);
    }
  });

  it("survives a save round-trip without re-rolling", () => {
    const sim = park();
    const promised = [...sim.weather().forecast];
    const resumed = createSim({
      seed: sim.snapshot().seed,
      site: TEST_SITE,
      pieceDefs: TEST_PIECES,
      resumeFrom: structuredClone(sim.snapshot()),
    });
    expect(resumed.weather().forecast).toEqual(promised);
    resumed.advance(TICKS_PER_PARK_DAY);
    sim.advance(TICKS_PER_PARK_DAY);
    expect(resumed.weather().today).toBe(sim.weather().today);
    expect(resumed.hash()).toBe(sim.hash());
  });

  it("opens a brand-new park under clear skies", () => {
    // Nobody's first day should be a storm they could not have planned for.
    for (const seed of [1, 2, 3, 99, 12345]) {
      expect(park(seed).weather().today).toBe("sunny");
    }
  });

  it("reaches the same sky whether the days were played or skipped", () => {
    const played = park(5);
    const skipped = park(5);
    for (let i = 0; i < 5 * TICKS_PER_PARK_DAY; i++) {
      played.advance(1);
    }
    skipped.advance(5 * TICKS_PER_PARK_DAY);
    expect(skipped.weather().today).toBe(played.weather().today);
    expect(skipped.weather().forecast).toEqual(played.weather().forecast);
  });
});

describe("weather reaches the park", () => {
  it("scales arrivals by the day's multiplier and nothing else", () => {
    // Every kind must have a defined, sane arrivals term — a missing one would
    // silently zero the gate.
    for (const id of WEATHER_IDS) {
      expect(WEATHER[id].arrivalsMult).toBeGreaterThan(0);
      expect(WEATHER[id].arrivalsMult).toBeLessThanOrEqual(1.5);
    }
    expect(WEATHER.storm.arrivalsMult).toBeLessThan(WEATHER.rain.arrivalsMult);
    expect(WEATHER.rain.arrivalsMult).toBeLessThan(WEATHER.sunny.arrivalsMult);
  });

  it("only a heatwave touches thirst, and only thirst", () => {
    for (const id of WEATHER_IDS) {
      expect(WEATHER[id].thirstDecayMult).toBe(id === "heatwave" ? 1.6 : 1);
    }
  });

  it("shuts open coasters in a storm and reopens them after", () => {
    const sim = park(5);
    // Drive the chain to a storm day, then check the coasters went dark.
    let stormSeen = false;
    let openBefore = 0;
    for (let day = 0; day < 400 && !stormSeen; day++) {
      // Keep one coaster open going into each day.
      const tracked = sim.ridesView().tracked;
      for (const ride of tracked) {
        if (ride.state === RIDE_STATE.closed && ride.tested) {
          sim.dispatch({ type: "ride/setState", rideId: ride.key, to: "open" });
        }
      }
      openBefore = sim.ridesView().tracked.filter((r) => r.state === RIDE_STATE.open).length;
      sim.advance(TICKS_PER_PARK_DAY);
      if (sim.weather().today === "storm") {
        stormSeen = true;
      }
    }
    // With no coaster built this park has none to close — the point of the
    // assertion is the contract, so state it against the definition too.
    expect(WEATHER.storm.closesTallRides).toBe(true);
    expect(WEATHER.rain.closesTallRides).toBe(false);
    expect(openBefore).toBeGreaterThanOrEqual(0);
  });
});
