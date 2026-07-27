/**
 * The weather chain (GAME_DESIGN §16, GAME_BALANCE §8.1).
 *
 * One kind per park day, drawn at day rollover from the authored Markov chain
 * in content/weather.ts. The next FORECAST_DAYS days are drawn *ahead of time*
 * and stored, so the forecast strip is a promise the sim keeps rather than a
 * guess it re-rolls — the difference between "plan around the storm" and "the
 * game lied to you" (pillar P5).
 *
 * Weather owns Rain/Storm/Heatwave outright. GAME_BALANCE §8.1 lists them among
 * the event cards, but the Rain row's own cooldown column reads "(weather-
 * driven)" — they are conditions with duration, not one-shot draws, and the
 * forecast promise is impossible if a card can spring one on you.
 */
import {
  FORECAST_DAYS,
  WEATHER,
  WEATHER_IDS,
  WEATHER_START,
  WEATHER_TRANSITIONS,
  type WeatherId,
} from "@/content/weather";
import { parkClock } from "../core/loop";
import { type RngStream } from "../core/rng";
import { RIDE_STATE } from "../rides/rides";
import { type SimState } from "../state";

export interface WeatherState {
  /** What it is doing right now. */
  today: WeatherId;
  /** The next FORECAST_DAYS days, already drawn. Index 0 is tomorrow. */
  forecast: WeatherId[];
  /** The park day `today` describes — rollover is keyed off this, so it is idempotent. */
  dayIndex: number;
  /** Rides this weather shut today, so the same storm never closes them twice. */
  closedByWeather: number[];
}

export function createWeatherState(rng: RngStream): WeatherState {
  const forecast: WeatherId[] = [];
  let last = WEATHER_START;
  for (let i = 0; i < FORECAST_DAYS; i++) {
    last = nextWeather(last, rng.next());
    forecast.push(last);
  }
  return { today: WEATHER_START, forecast, dayIndex: 0, closedByWeather: [] };
}

/** One transition. Pure given the roll, which is what makes the chain testable. */
export function nextWeather(from: WeatherId, roll: number): WeatherId {
  const row = WEATHER_TRANSITIONS[from];
  let acc = 0;
  for (const id of WEATHER_IDS) {
    acc += row[id];
    if (roll < acc) {
      return id;
    }
  }
  // Float error only — the rows are asserted to sum to 1 in weather.test.ts.
  return WEATHER_IDS[WEATHER_IDS.length - 1]!;
}

export interface WeatherEvent {
  readonly kind: "weather/changed";
  readonly weather: WeatherId;
  readonly ridesClosed: number;
}

/**
 * Advance the chain if the park clock rolled into a new day. Returns an event
 * on the days it changed, so the HUD can say so without polling.
 */
export function tickWeather(state: SimState): WeatherEvent | null {
  const { dayIndex } = parkClock(state.tick);
  const weather = state.weather;
  if (dayIndex <= weather.dayIndex) {
    return null;
  }

  // A resumed save can jump several days at once; walk them so the chain is
  // identical whether the park ran the days or skipped them.
  let changed = false;
  while (weather.dayIndex < dayIndex) {
    weather.dayIndex += 1;
    const wasToday = weather.today;
    weather.today = weather.forecast.shift() ?? WEATHER_START;
    const last = weather.forecast[weather.forecast.length - 1] ?? weather.today;
    weather.forecast.push(nextWeather(last, state.rng.weather.next()));
    changed = changed || weather.today !== wasToday;
  }

  const ridesClosed = applyWeatherToRides(state);
  if (!changed && ridesClosed === 0) {
    return null;
  }
  return { kind: "weather/changed", weather: weather.today, ridesClosed };
}

/**
 * Storms shut the tall, fast rides for the day (§8.1 "H2+ rides close 1 day").
 * Every tracked coaster counts as H2+; flat rides do not — none of the shipped
 * five reaches the height class, and closing the carousel in a shower would
 * read as punishment rather than safety.
 *
 * Reopening is deliberate: only rides the weather itself closed come back, so a
 * storm never reopens something the player had shut on purpose.
 */
function applyWeatherToRides(state: SimState): number {
  const weather = state.weather;
  const def = WEATHER[weather.today];

  if (!def.closesTallRides) {
    let reopened = 0;
    for (const key of weather.closedByWeather) {
      const ride = state.rides.tracked.get(key);
      if (ride && ride.state === RIDE_STATE.closed && ride.tested) {
        ride.state = RIDE_STATE.open;
        reopened += 1;
      }
    }
    weather.closedByWeather.length = 0;
    return reopened;
  }

  let closed = 0;
  for (const ride of state.rides.tracked.values()) {
    if (ride.state === RIDE_STATE.open) {
      ride.state = RIDE_STATE.closed;
      weather.closedByWeather.push(ride.id);
      closed += 1;
    }
  }
  return closed;
}

/** GAME_BALANCE §4.1's `weatherMult` term. */
export const weatherArrivalsMult = (state: SimState): number =>
  WEATHER[state.weather.today].arrivalsMult;

/** Multiplies Thirst decay only — a heatwave makes guests thirsty, not tired. */
export const weatherThirstMult = (state: SimState): number =>
  WEATHER[state.weather.today].thirstDecayMult;
