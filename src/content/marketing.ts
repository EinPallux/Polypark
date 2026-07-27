/**
 * Marketing campaigns (GAME_DESIGN §14.1, UI_UX §6.8 Marketing tab). A campaign
 * buys reach for a fixed run: more arrivals, skewed toward the archetypes the
 * channel actually speaks to. One campaign at a time; frozen in Receivership.
 */

export const MARKETING_CAMPAIGN_IDS = ["flyers", "online", "parade"] as const;
export type MarketingCampaignId = (typeof MARKETING_CAMPAIGN_IDS)[number];

export interface MarketingCampaignDef {
  readonly id: MarketingCampaignId;
  readonly nameKey: string;
  readonly costCents: number;
  /** Whole game months; ticks = durationMonths × TICKS_PER_GAME_MONTH. */
  readonly durationMonths: number;
  /** Added to 1.0 to form the arrivals reach multiplier (0.15 = +15%). */
  readonly reachBonus: number;
  /** Per-archetype weight skew: [family, thrill, foodie, sightseer, superfan]. */
  readonly skew: readonly [number, number, number, number, number];
}

export const MARKETING_CAMPAIGNS: Readonly<Record<MarketingCampaignId, MarketingCampaignDef>> = {
  flyers: {
    id: "flyers",
    nameKey: "marketing.flyers.name",
    costCents: 1_200_00,
    durationMonths: 1,
    reachBonus: 0.15,
    skew: [1.35, 1.0, 1.0, 1.25, 1.0],
  },
  online: {
    id: "online",
    nameKey: "marketing.online.name",
    costCents: 3_000_00,
    durationMonths: 2,
    reachBonus: 0.3,
    skew: [1.0, 1.4, 1.1, 1.0, 1.5],
  },
  parade: {
    id: "parade",
    nameKey: "marketing.parade.name",
    costCents: 6_500_00,
    durationMonths: 3,
    reachBonus: 0.45,
    skew: [1.5, 1.0, 1.3, 1.2, 1.0],
  },
};

export const MARKETING_CAMPAIGN_LIST: readonly MarketingCampaignDef[] =
  Object.values(MARKETING_CAMPAIGNS);
