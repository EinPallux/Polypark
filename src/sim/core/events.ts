/**
 * Sim → outside world notifications (toasts, audio cues, UI refresh hints).
 * Events are collected per advance and drained by the facade — the sim never
 * calls into UI code (TECHNICAL_ARCHITECTURE §3).
 */
import { type MonthlyReport } from "../economy/ledger";

export type SimEvent =
  | { readonly type: "sim/started"; readonly seed: number }
  | { readonly type: "park/renamed"; readonly name: string }
  | { readonly type: "goal/completed"; readonly cardId: string; readonly rewardXp: number }
  | { readonly type: "park/levelUp"; readonly level: number }
  | { readonly type: "park/monthReport"; readonly report: MonthlyReport };

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
