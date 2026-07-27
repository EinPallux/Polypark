import { MARKETING_CAMPAIGNS, type MarketingCampaignId } from "@/content/marketing";
import { type SimState } from "../state";
import { TICKS_PER_GAME_MONTH } from "../core/loop";
import { type FinanceEvent } from "./finance";

/**
 * Marketing campaigns: the `marketingMult` term GAME_BALANCE §4.1 always
 * specified but nothing supplied until now. A campaign lifts arrivals and
 * skews who shows up toward the archetypes the channel speaks to.
 */

export const campaignIsLive = (state: SimState): boolean => {
  const campaign = state.finance.campaign;
  return campaign !== null && state.tick < campaign.endsAtTick;
};

/** Arrivals reach multiplier. Billboards (Commerce Quarter) amplify it. */
export function marketingMult(state: SimState): number {
  if (!campaignIsLive(state)) {
    return 1;
  }
  const def = MARKETING_CAMPAIGNS[state.finance.campaign!.campaign];
  const billboards = Math.min(state.districts.billboardCount, 3);
  return 1 + def.reachBonus * (1 + 0.1 * billboards);
}

/**
 * Archetype weights for the next spawn: the base mix, skewed by any live
 * campaign, renormalized so the total spawn rate is unchanged (reach is the
 * multiplier's job — the skew only decides who).
 */
export function archetypeWeights(
  state: SimState,
  base: readonly number[],
): readonly number[] {
  if (!campaignIsLive(state)) {
    return base;
  }
  const skew = MARKETING_CAMPAIGNS[state.finance.campaign!.campaign].skew;
  const weighted = base.map((weight, i) => weight * (skew[i] ?? 1));
  const total = weighted.reduce((a, b) => a + b, 0);
  return total > 0 ? weighted.map((w) => w / total) : base;
}

export function startCampaign(
  state: SimState,
  campaign: MarketingCampaignId,
  startTick: number,
): void {
  const def = MARKETING_CAMPAIGNS[campaign];
  state.finance.campaign = {
    campaign,
    startedAtTick: startTick,
    endsAtTick: startTick + def.durationMonths * TICKS_PER_GAME_MONTH,
  };
  state.stats.campaignsRun += 1;
}

/** One comparison per tick; clears the campaign on the tick it expires. */
export function tickMarketing(state: SimState, events: FinanceEvent[]): void {
  const campaign = state.finance.campaign;
  if (campaign !== null && state.tick >= campaign.endsAtTick) {
    state.finance.campaign = null;
    events.push({ kind: "campaignEnded", campaign: campaign.campaign });
  }
}
