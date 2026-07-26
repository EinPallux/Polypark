"use client";

import { moneyToDollarString, money } from "@/shared/money";
import { type TranslationKey } from "@/ui/i18n/en";
import { t } from "@/ui/i18n/t";
import { DisplayTitle } from "@/ui/kit/DisplayTitle";
import { SlabButton } from "@/ui/kit/SlabButton";
import { useGame } from "./store";

/** M2 HUD panels: Goal Deck, park controls, staff popover, month report, guest card. */

const goalTitle = (cardId: string): string => t(`goal.${cardId}` as TranslationKey);

export function GoalPanel() {
  // Select the stable hud reference; derive goals here (a `?? []` inside the
  // selector would allocate per call and loop React — learned the hard way).
  const hud = useGame((state) => state.hud);
  const dismissGoal = useGame((state) => state.dismissGoal);
  const goals = hud?.goals ?? [];
  if (goals.length === 0) {
    return null;
  }
  return (
    <div className="pointer-events-auto flex w-72 flex-col gap-1.5" data-testid="goal-panel">
      <h2 className="skew-ui px-1 text-right font-ui text-xs font-bold tracking-[0.1em] text-white uppercase drop-shadow-[0_1px_0_rgba(16,21,31,0.6)]">
        {t("goal.panel.title")}
      </h2>
      {goals.map((goal) => {
        const fraction = Math.min(goal.progress / goal.target, 1);
        return (
          <div
            key={goal.cardId}
            data-testid={`goal-${goal.cardId}`}
            className="group bg-ink-900/85 px-3 py-2 text-white shadow-[var(--elev-slab)]"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-ui text-xs font-semibold">{goalTitle(goal.cardId)}</span>
              <span className="flex items-center gap-1.5">
                <span className="font-numeral text-xs text-gold-400 tabular-nums">
                  +{goal.rewardXp} XP
                </span>
                <button
                  type="button"
                  title={t("goal.dismiss")}
                  onClick={() => dismissGoal(goal.cardId)}
                  className="cursor-pointer text-frost-300/40 opacity-0 transition-opacity group-hover:opacity-100 hover:text-white"
                >
                  ✕
                </button>
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1.5 flex-1 bg-white/15">
                <div className="h-full bg-grass-500" style={{ width: `${fraction * 100}%` }} />
              </div>
              <span className="font-numeral text-xs tabular-nums">
                {goal.progress}/{goal.target}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ParkControls() {
  const hud = useGame((state) => state.hud);
  const setParkOpen = useGame((state) => state.setParkOpen);
  const setEntryFee = useGame((state) => state.setEntryFee);
  if (!hud) {
    return null;
  }
  return (
    <div className="pointer-events-auto flex items-center gap-2 bg-ink-900/85 px-2 py-1.5 shadow-[var(--elev-slab)]">
      <button
        type="button"
        data-testid="park-toggle"
        onClick={() => setParkOpen(!hud.parkOpen)}
        title={hud.parkOpen ? t("park.closeAction") : t("park.openAction")}
        className={`skew-ui cursor-pointer px-3 py-1 font-ui text-sm font-bold uppercase ${
          hud.parkOpen ? "bg-grass-500 text-ink-900" : "bg-danger-500 text-white"
        }`}
      >
        <span className="unskew-ui inline-block">
          {hud.parkOpen ? t("park.open") : t("park.closed")}
        </span>
      </button>
      <span className="font-ui text-xs font-semibold tracking-[0.06em] text-frost-300/80 uppercase">
        {t("park.entryFee")}
      </span>
      <span className="flex items-center gap-1">
        <button
          type="button"
          aria-label="-$1"
          onClick={() => setEntryFee(Math.max(hud.entryFeeCents - 100, 0))}
          className="cursor-pointer bg-white/10 px-1.5 font-ui text-sm font-bold text-white hover:bg-white/20"
        >
          −
        </button>
        <span
          data-testid="entry-fee"
          className="min-w-10 text-center font-numeral text-sm font-semibold text-white tabular-nums"
        >
          {moneyToDollarString(money(hud.entryFeeCents))}
        </span>
        <button
          type="button"
          aria-label="+$1"
          onClick={() => setEntryFee(Math.min(hud.entryFeeCents + 100, 100_00))}
          className="cursor-pointer bg-white/10 px-1.5 font-ui text-sm font-bold text-white hover:bg-white/20"
        >
          +
        </button>
      </span>
    </div>
  );
}

export function StaffPopover({ open, onClose }: { open: boolean; onClose: () => void }) {
  const hud = useGame((state) => state.hud);
  const hire = useGame((state) => state.hireJanitor);
  const fire = useGame((state) => state.fireJanitor);
  if (!open || !hud) {
    return null;
  }
  return (
    <div className="pointer-events-auto absolute bottom-24 left-1/2 z-20 w-72 -translate-x-1/2">
      <div className="panel-cut bg-frost-100/95 p-4 shadow-[var(--elev-slab)]">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="skew-ui font-ui text-lg font-bold text-ink-700 uppercase">
            {t("staff.title")}
          </h2>
          <button type="button" onClick={onClose} className="cursor-pointer font-bold text-ink-500">
            ✕
          </button>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-ui text-sm font-semibold text-ink-700">
            {t("staff.janitors")}:{" "}
            <span data-testid="janitor-count" className="font-numeral tabular-nums">
              {hud.janitorCount}
            </span>
          </span>
          <span className="font-ui text-xs text-ink-500">🧹 {hud.litterCount}</span>
        </div>
        <div className="mt-3 flex gap-2">
          <SlabButton data-testid="hire-janitor" onClick={hire}>
            {t("staff.hire")}
          </SlabButton>
          <SlabButton variant="secondary" onClick={fire} disabled={hud.janitorCount === 0}>
            {t("staff.fire")}
          </SlabButton>
        </div>
      </div>
    </div>
  );
}

export function MonthReportModal() {
  const report = useGame((state) => state.monthReport);
  const close = useGame((state) => state.closeReport);
  if (!report) {
    return null;
  }
  const rows = (record: Record<string, number>, prefix: string) =>
    Object.entries(record)
      .filter(([, cents]) => cents !== 0)
      .map(([category, cents]) => (
        <div key={category} className="flex justify-between font-body text-sm text-ink-700">
          <span>{t(`report.cat.${category}` as TranslationKey)}</span>
          <span className="font-numeral tabular-nums">
            {prefix}
            {moneyToDollarString(money(Math.abs(cents)))}
          </span>
        </div>
      ));
  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-ink-900/55">
      <div
        data-testid="month-report"
        className="panel-cut flex w-[26rem] flex-col gap-3 bg-frost-100 p-8 shadow-[var(--elev-slab)]"
      >
        <DisplayTitle as="h2">{t("report.title", { month: report.month })}</DisplayTitle>
        <div className="mt-2 grid grid-cols-2 gap-6">
          <div>
            <h3 className="mb-1 font-ui text-xs font-bold tracking-[0.08em] text-grass-500 uppercase">
              {t("report.income")}
            </h3>
            {rows(report.income, "+")}
          </div>
          <div>
            <h3 className="mb-1 font-ui text-xs font-bold tracking-[0.08em] text-danger-500 uppercase">
              {t("report.expenses")}
            </h3>
            {rows(report.expense, "−")}
          </div>
        </div>
        <div className="mt-1 flex justify-between border-t border-ink-700/15 pt-2 font-ui text-sm font-bold text-ink-700">
          <span>{t("report.net")}</span>
          <span
            className={`font-numeral tabular-nums ${report.netCents >= 0 ? "text-grass-500" : "text-danger-500"}`}
          >
            {report.netCents >= 0 ? "+" : "−"}
            {moneyToDollarString(money(Math.abs(report.netCents)))}
          </span>
        </div>
        <div className="flex justify-between font-body text-sm text-ink-500">
          <span>{t("report.guests")}</span>
          <span className="font-numeral tabular-nums">{report.guestsVisited}</span>
        </div>
        <div className="flex justify-between font-body text-sm text-ink-500">
          <span>{t("report.cash")}</span>
          <span className="font-numeral tabular-nums">
            {moneyToDollarString(money(report.endCashCents))}
          </span>
        </div>
        <SlabButton size="lg" data-testid="report-continue" onClick={close} className="mt-2">
          {t("report.continue")}
        </SlabButton>
      </div>
    </div>
  );
}

function NeedBar({ label, value }: { label: string; value: number }) {
  const tone = value > 55 ? "bg-grass-500" : value > 30 ? "bg-gold-400" : "bg-danger-500";
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 font-ui text-xs font-semibold text-ink-500">{label}</span>
      <div className="h-1.5 flex-1 bg-frost-300">
        <div className={`h-full ${tone}`} style={{ width: `${Math.round(value)}%` }} />
      </div>
    </div>
  );
}

export function GuestInspector() {
  const slot = useGame((state) => state.selectedGuest);
  const facade = useGame((state) => state.facade);
  const select = useGame((state) => state.selectGuest);
  // hud in deps keeps the card live-updating at sync rate
  useGame((state) => state.hud);
  if (slot === null || !facade) {
    return null;
  }
  const info = facade.guestInfo(slot);
  if (!info) {
    return null;
  }
  return (
    <div
      data-testid="guest-inspector"
      className="pointer-events-auto absolute top-24 right-4 z-20 w-72"
    >
      <div className="panel-cut bg-frost-100/95 p-4 shadow-[var(--elev-slab)]">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="skew-ui font-ui text-lg font-bold text-ink-700 uppercase">
            {t("guest.title")} #{slot + 1}
          </h2>
          <button
            type="button"
            onClick={() => select(null)}
            className="cursor-pointer font-bold text-ink-500"
            aria-label={t("guest.follow.close")}
          >
            ✕
          </button>
        </div>
        <p className="font-body text-xs text-ink-500">
          {t(`guest.archetype.${info.archetype}` as TranslationKey)} ·{" "}
          {t(`guest.mood.${info.mood}` as TranslationKey)} · {t("guest.wallet")}{" "}
          {moneyToDollarString(info.wallet)}
        </p>
        <div className="mt-3 flex flex-col gap-1.5">
          <NeedBar label={t("need.hunger")} value={info.hunger} />
          <NeedBar label={t("need.thirst")} value={info.thirst} />
          <NeedBar label={t("need.bladder")} value={info.bladder} />
          <NeedBar label={t("need.energy")} value={info.energy} />
          <NeedBar label={t("need.fun")} value={info.fun} />
        </div>
        <div className="mt-3 border-t border-ink-700/10 pt-2">
          {info.thoughts.slice(-3).map((thought, index) => (
            <p key={index} className="font-body text-xs text-ink-700 italic">
              “{t(thought as TranslationKey)}”
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
