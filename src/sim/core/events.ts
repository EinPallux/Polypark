/**
 * Sim → outside world notifications (toasts, audio cues, UI refresh hints).
 * Events are collected per advance and drained by the facade — the sim never
 * calls into UI code (TECHNICAL_ARCHITECTURE §3).
 */
import { type WeatherId } from "@/content/weather";
import { type EventId } from "@/content/events";
import { type MonthlyReport } from "../economy/ledger";
import { type CreditGrade, type LoanProductId } from "@/content/loans";
import { type MarketingCampaignId } from "@/content/marketing";

export type SimEvent =
  | { readonly type: "sim/started"; readonly seed: number }
  | { readonly type: "park/renamed"; readonly name: string }
  | { readonly type: "goal/completed"; readonly cardId: string; readonly rewardXp: number }
  | { readonly type: "park/levelUp"; readonly level: number }
  | { readonly type: "event/drawn"; readonly card: EventId }
  | { readonly type: "inspection/passed"; readonly score: number }
  | { readonly type: "inspection/failed"; readonly score: number }
  | {
      readonly type: "weather/changed";
      readonly weather: WeatherId;
      /** Tall rides a storm just shut, or reopened when it passed. */
      readonly ridesClosed: number;
    }
  | { readonly type: "park/monthReport"; readonly report: MonthlyReport }
  | { readonly type: "ride/broke"; readonly rideKey: number }
  | { readonly type: "ride/repaired"; readonly rideKey: number }
  | { readonly type: "ride/testPassed"; readonly rideKey: number }
  | { readonly type: "finance/loanTaken"; readonly product: LoanProductId; readonly amountCents: number }
  | { readonly type: "finance/loanPaidOff"; readonly product: LoanProductId }
  | { readonly type: "finance/paymentMissed"; readonly amountCents: number }
  | { readonly type: "finance/creditChanged"; readonly grade: CreditGrade }
  | { readonly type: "finance/collections"; readonly rideKey: number }
  | { readonly type: "finance/repossessionCleared"; readonly rideKey: number }
  | { readonly type: "finance/receivershipEntered" }
  | { readonly type: "finance/receivershipExited"; readonly settled: boolean }
  | { readonly type: "marketing/campaignEnded"; readonly campaign: MarketingCampaignId };

export interface EventCollector {
  emit(event: SimEvent): void;
  drain(): SimEvent[];
}

export function createEventCollector(): EventCollector {
  let pending: SimEvent[] = [];

  return {
    emit(event: SimEvent): void {
      pending.push(event);
    },
    drain(): SimEvent[] {
      const drained = pending;
      pending = [];
      return drained;
    },
  };
}
