/**
 * Weather (GAME_DESIGN §16, GAME_BALANCE §8.1). One kind per park day, drawn
 * from a Markov chain at day rollover so weather *clusters* — a heatwave lasts,
 * a storm brews out of overcast — instead of flickering at random.
 *
 * The chain is authored, not sampled, because the forecast strip promises the
 * player three days of foresight (pillar P5: plannable, never a slot machine).
 * A player who sees a storm coming can close the coaster before it closes
 * itself; that only reads as fair if tomorrow really does follow from today.
 */

export const WEATHER_IDS = ["sunny", "overcast", "rain", "storm", "heatwave"] as const;
export type WeatherId = (typeof WEATHER_IDS)[number];

export interface WeatherDef {
  readonly id: WeatherId;
  readonly nameKey: string;
  /** Multiplies arrivals (GAME_BALANCE §4.1 `weatherMult`). */
  readonly arrivalsMult: number;
  /** Multiplies the Thirst need's decay only — never other needs. */
  readonly thirstDecayMult: number;
  /** Storms shut the tall, fast rides for the day (§8.1, §5.1 H2+). */
  readonly closesTallRides: boolean;
  /** Skew for the render layer: sky tint + particles. Sim ignores it. */
  readonly gloom: number;
}

export const WEATHER: Readonly<Record<WeatherId, WeatherDef>> = {
  sunny: {
    id: "sunny",
    nameKey: "weather.sunny",
    arrivalsMult: 1.1,
    thirstDecayMult: 1,
    closesTallRides: false,
    gloom: 0,
  },
  overcast: {
    id: "overcast",
    nameKey: "weather.overcast",
    arrivalsMult: 1,
    thirstDecayMult: 1,
    closesTallRides: false,
    gloom: 0.35,
  },
  rain: {
    id: "rain",
    nameKey: "weather.rain",
    arrivalsMult: 0.6,
    thirstDecayMult: 1,
    closesTallRides: false,
    gloom: 0.7,
  },
  storm: {
    id: "storm",
    nameKey: "weather.storm",
    arrivalsMult: 0.35,
    thirstDecayMult: 1,
    closesTallRides: true,
    gloom: 1,
  },
  heatwave: {
    id: "heatwave",
    nameKey: "weather.heatwave",
    // why: no separate drink-income multiplier. GAME_BALANCE's "one knob per
    // concept" rule — thirstier guests buy more drinks on their own, and
    // stacking an income bonus on top would pay the player twice for one event.
    arrivalsMult: 0.85,
    thirstDecayMult: 1.6,
    closesTallRides: false,
    gloom: 0,
  },
};

export const WEATHER_LIST: readonly WeatherDef[] = Object.values(WEATHER);

/**
 * Day-to-day transition weights. Rows sum to 1 (asserted in weather.test.ts).
 * Tuned so the stationary distribution lands near GAME_BALANCE §8.1's relative
 * frequencies — rain ≈ 18%, heatwave ≈ 8%, storm ≈ 3% — while keeping runs
 * believable: storms come out of cloud, never out of a clear sky, and always
 * break to cloud rather than straight back to sun.
 */
export const WEATHER_TRANSITIONS: Readonly<Record<WeatherId, Readonly<Record<WeatherId, number>>>> =
  {
    sunny: { sunny: 0.62, overcast: 0.24, rain: 0.06, storm: 0, heatwave: 0.08 },
    overcast: { sunny: 0.3, overcast: 0.34, rain: 0.28, storm: 0.06, heatwave: 0.02 },
    rain: { sunny: 0.14, overcast: 0.4, rain: 0.38, storm: 0.08, heatwave: 0 },
    storm: { sunny: 0.1, overcast: 0.45, rain: 0.4, storm: 0.05, heatwave: 0 },
    heatwave: { sunny: 0.34, overcast: 0.1, rain: 0.02, storm: 0.04, heatwave: 0.5 },
  };

/** A brand-new park opens under clear skies — never a storm on day one. */
export const WEATHER_START: WeatherId = "sunny";

/** How many days ahead the forecast strip shows (GAME_DESIGN §16). */
export const FORECAST_DAYS = 3;
