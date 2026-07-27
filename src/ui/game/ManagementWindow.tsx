"use client";

import { useState } from "react";
import { LOAN_PRODUCTS } from "@/content/loans";
import { MARKETING_CAMPAIGNS, MARKETING_CAMPAIGN_LIST } from "@/content/marketing";
import { money, moneyToDollarString } from "@/shared/money";
import { type RatingCause, type SubScore } from "@/sim/api";
import { months, t } from "@/ui/i18n/t";
import { SlabButton } from "@/ui/kit/SlabButton";
import { TabBar } from "@/ui/kit/TabBar";
import { useGame } from "./store";

/**
 * The management window (UI_UX §6.8): one window, tabs across the top.
 * Everything the tycoon layer produces is reachable here in at most two
 * clicks from the HUD, and every stat expands to plain-language causes
 * (UI_UX §7.1 rule 1). Copy comes from i18n; the sim only supplies data.
 */

const TAB_IDS = ["finance", "rating", "loans", "marketing"] as const;
type TabId = (typeof TAB_IDS)[number];

const cash = (cents: number): string => moneyToDollarString(money(cents));

function StatTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "good" | "bad" | "neutral";
}) {
  const toneClass =
    tone === "good" ? "text-grass-500" : tone === "bad" ? "text-danger-500" : "text-ink-700";
  return (
    <div className="flex-1 bg-white/70 px-3 py-2">
      <p className="font-ui text-[10px] font-bold tracking-wide text-ink-500 uppercase">
        {label}
      </p>
      <p className={`font-numeral text-lg font-bold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}

/** Literal names so `rating.sub.${name}` resolves without a cast. */
type SubScoreName = "fun" | "value" | "care" | "wonder" | "flow";

/** A sub-score row that expands to its top-3 causes in plain language. */
function SubScoreRow({
  name,
  sub,
  weight,
}: {
  name: SubScoreName;
  sub: SubScore;
  weight: number;
}) {
  const [open, setOpen] = useState(false);
  const rideName = useRideNamer();
  return (
    <div className="bg-white/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-testid={`rating-sub-${name}`}
        className="flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left hover:bg-gold-400/20"
      >
        <span className="w-20 font-ui text-xs font-bold text-ink-700 uppercase">
          {t(`rating.sub.${name}`)}
        </span>
        <span className="h-2 flex-1 bg-ink-900/10">
          <span
            className="block h-full bg-gold-400"
            style={{ width: `${Math.round(sub.score)}%` }}
          />
        </span>
        <span className="w-10 text-right font-numeral text-sm tabular-nums">
          {Math.round(sub.score)}
        </span>
        <span className="w-10 text-right font-ui text-[10px] text-ink-500">{weight}%</span>
        <span aria-hidden className="text-ink-500">
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open && (
        <ul className="px-4 pb-2">
          {sub.causes.length === 0 && (
            <li className="font-body text-xs text-ink-500">{t("rating.cause.none")}</li>
          )}
          {sub.causes.slice(0, 3).map((cause: RatingCause, i) => (
            <li key={i} className="font-body text-xs text-ink-700">
              • {t(`rating.cause.${cause.cause}`)}
              {cause.rideKey !== undefined ? ` — ${rideName(cause.rideKey)}` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Names a ride from its key so causes can point at the culprit. */
function useRideNamer(): (key: number) => string {
  const rides = useGame((state) => state.rides);
  return (key: number): string => {
    const tracked = rides?.tracked.find((r) => r.key === key);
    if (tracked) {
      return t(`ride.family.${tracked.family}` as never);
    }
    const flat = rides?.flat.find((r) => r.key === key);
    return flat ? t(`ride.${flat.defId}` as never) : "";
  };
}

function FinanceTab() {
  const finance = useGame((state) => state.finance);
  const hud = useGame((state) => state.hud);
  if (!finance || !hud) {
    return null;
  }
  const v = finance.valuation;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <StatTile label={t("manage.cash")} value={cash(hud.money)} tone={hud.money < 0 ? "bad" : "neutral"} />
        <StatTile label={t("manage.parkValue")} value={cash(v.parkValueCents)} />
        <StatTile
          label={t("manage.debt")}
          value={cash(v.debtCents)}
          tone={v.debtCents > 0 ? "bad" : "neutral"}
        />
      </div>
      <div className="bg-white/60 p-3">
        <p className="mb-1 font-ui text-xs font-bold text-ink-500 uppercase">
          {t("manage.assets")}
        </p>
        {(
          [
            ["manage.assets.rides", v.rideValueCents],
            ["manage.assets.pieces", v.pieceValueCents],
            ["manage.assets.paths", v.pathValueCents],
            ["manage.assets.land", v.landValueCents],
          ] as const
        ).map(([key, value]) => (
          <div key={key} className="flex justify-between font-body text-sm text-ink-700">
            <span>{t(key)}</span>
            <span className="font-numeral tabular-nums">{cash(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RatingTab() {
  const rating = useGame((state) => state.rating);
  if (!rating) {
    return null;
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline gap-3 bg-white/70 px-4 py-3">
        <span data-testid="rating-stars" className="font-numeral text-4xl font-bold text-ink-700 tabular-nums">
          {rating.stars.toFixed(1)}
        </span>
        <span className="font-ui text-lg text-gold-400">★</span>
        {rating.capStars < 5 && (
          <span className="font-ui text-[10px] text-ink-500 uppercase">
            {t("manage.ratingCapped", { cap: rating.capStars })}
          </span>
        )}
      </div>
      {rating.confidence < 0.999 && (
        <p className="font-body text-xs text-ink-500">{t("manage.ratingSettling")}</p>
      )}
      <div className="flex flex-col gap-1">
        <SubScoreRow name="fun" sub={rating.fun} weight={30} />
        <SubScoreRow name="value" sub={rating.value} weight={20} />
        <SubScoreRow name="care" sub={rating.care} weight={20} />
        <SubScoreRow name="wonder" sub={rating.wonder} weight={15} />
        <SubScoreRow name="flow" sub={rating.flow} weight={15} />
      </div>
    </div>
  );
}

function LoansTab() {
  const finance = useGame((state) => state.finance);
  const takeLoan = useGame((state) => state.takeLoan);
  const payLoan = useGame((state) => state.payLoan);
  if (!finance) {
    return null;
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 bg-white/70 px-3 py-2">
        <span className="font-ui text-xs font-bold text-ink-500 uppercase">
          {t("manage.creditGrade")}
        </span>
        <span data-testid="credit-grade" className="font-numeral text-xl font-bold text-ink-700">
          {finance.creditGrade}
        </span>
        <span className="font-body text-xs text-ink-500">
          {finance.monthsToNextGrade > 0
            ? t("manage.creditNext", { duration: months(finance.monthsToNextGrade) })
            : t("manage.creditBest")}
        </span>
      </div>

      {finance.loans.length > 0 && (
        <div className="flex flex-col gap-1">
          {finance.loans.map((loan) => (
            <div key={loan.id} className="flex items-center gap-2 bg-white/60 px-3 py-2">
              <span className="flex-1 font-ui text-sm font-bold text-ink-700">
                {t(LOAN_PRODUCTS[loan.product].nameKey as never)}
              </span>
              <span className="font-numeral text-sm tabular-nums">{cash(loan.balanceCents)}</span>
              {loan.arrearsCents > 0 && (
                <span className="font-numeral text-xs text-danger-500 tabular-nums">
                  +{cash(loan.arrearsCents)}
                </span>
              )}
              <SlabButton
                data-testid={`pay-loan-${loan.id}`}
                onClick={() => payLoan(loan.id, "payoff")}
              >
                {t("manage.payoff", { amount: cash(loan.payoffCents) })}
              </SlabButton>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {finance.offers.map((offer) => (
          <div key={offer.product} className="flex flex-col gap-1 bg-white/60 p-3">
            <p className="font-ui text-sm font-bold text-ink-700 uppercase">
              {t(LOAN_PRODUCTS[offer.product].nameKey as never)}
            </p>
            <p className="font-numeral text-lg font-bold tabular-nums">
              {cash(offer.principalCents)}
            </p>
            <p className="font-body text-[11px] text-ink-500">
              {t("manage.loanTerms", {
                apr: (offer.aprBps / 100).toFixed(2),
                duration: months(offer.termMonths),
                payment: cash(offer.minPaymentCents),
              })}
            </p>
            <SlabButton
              data-testid={`take-loan-${offer.product}`}
              disabled={offer.blocked !== null}
              onClick={() => takeLoan(offer.product)}
              title={offer.blocked ? t(`manage.offerBlocked.${offer.blocked}`) : undefined}
            >
              {offer.blocked
                ? t(`manage.offerBlocked.${offer.blocked}`)
                : t("manage.borrow")}
            </SlabButton>
          </div>
        ))}
      </div>
    </div>
  );
}

function MarketingTab() {
  const finance = useGame((state) => state.finance);
  const startCampaign = useGame((state) => state.startCampaign);
  if (!finance) {
    return null;
  }
  const running = finance.campaign;
  return (
    <div className="flex flex-col gap-3">
      {running && (
        <p data-testid="campaign-running" className="bg-white/70 px-3 py-2 font-body text-sm text-ink-700">
          {t("manage.campaignRunning", {
            name: t(MARKETING_CAMPAIGNS[running].nameKey as never),
          })}
        </p>
      )}
      <div className="grid grid-cols-3 gap-2">
        {MARKETING_CAMPAIGN_LIST.map((def) => (
          <div key={def.id} className="flex flex-col gap-1 bg-white/60 p-3">
            <p className="font-ui text-sm font-bold text-ink-700 uppercase">
              {t(def.nameKey as never)}
            </p>
            <p className="font-numeral text-lg font-bold tabular-nums">{cash(def.costCents)}</p>
            <p className="font-body text-[11px] text-ink-500">
              {t("manage.campaignTerms", {
                reach: Math.round(def.reachBonus * 100),
                duration: months(def.durationMonths),
              })}
            </p>
            <SlabButton
              data-testid={`start-campaign-${def.id}`}
              disabled={running !== null || finance.receivership.active}
              onClick={() => startCampaign(def.id)}
            >
              {t("manage.launch")}
            </SlabButton>
          </div>
        ))}
      </div>
      {finance.receivership.active && (
        <p className="font-body text-xs text-ink-500">{t("manage.marketingFrozen")}</p>
      )}
    </div>
  );
}

export function ManagementWindow({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<TabId>("finance");
  const finance = useGame((state) => state.finance);
  if (!open) {
    return null;
  }
  const receivership = finance?.receivership;
  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-ink-900/55">
      <div
        className="panel-cut w-[780px] max-w-[94vw] bg-frost-100/97 shadow-[var(--elev-slab)]"
        data-testid="manage-window"
      >
        <div className="flex items-center justify-between bg-ink-900 px-4 py-2">
          <h2 className="skew-ui font-ui text-lg font-bold text-white uppercase">
            {t("manage.title")}
          </h2>
          <button
            type="button"
            data-testid="manage-close"
            onClick={onClose}
            className="cursor-pointer font-bold text-frost-300 hover:text-white"
          >
            ✕
          </button>
        </div>
        {receivership?.active && (
          <div
            data-testid="receivership-banner"
            className="border-l-4 border-danger-500 bg-danger-500/10 px-4 py-2"
          >
            <p className="font-ui text-sm font-bold text-ink-700">{t("manage.receivership.title")}</p>
            <p className="font-body text-xs text-ink-700">
              {t("manage.receivership.blurb", { duration: months(receivership.monthsRemaining) })}
            </p>
          </div>
        )}
        <TabBar
          tabs={TAB_IDS.map((id) => ({ id, label: t(`manage.tab.${id}`) }))}
          active={tab}
          onChange={(id) => setTab(id as TabId)}
        />
        <div className="max-h-[60vh] overflow-y-auto p-4">
          {tab === "finance" && <FinanceTab />}
          {tab === "rating" && <RatingTab />}
          {tab === "loans" && <LoansTab />}
          {tab === "marketing" && <MarketingTab />}
        </div>
      </div>
    </div>
  );
}
