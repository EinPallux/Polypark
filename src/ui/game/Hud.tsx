"use client";

import { useMemo, useState } from "react";
import { moneyToDollarString, money } from "@/shared/money";
import { GAME_SECONDS_PER_TICK, type GameSpeed } from "@/sim/api";
import { t } from "@/ui/i18n/t";
import { Keycap } from "@/ui/kit/Keycap";
import { HintRail, type Hint } from "@/ui/kit/HintRail";
import { IdentityChip } from "@/ui/kit/IdentityChip";
import { GoalPanel, ParkControls } from "./panels";
import { useGame } from "./store";

/**
 * The in-game HUD shell (UI_UX §6.10): bottom-left vitals, bottom-center build
 * dock + speed controls, top-center clock, top-left toasts, bottom-right
 * hints. Guests/rating/level show their M2+ arrival ribbons honestly.
 */

function clockText(tick: number): { time: string; day: number } {
  const totalMinutes = Math.floor((tick * GAME_SECONDS_PER_TICK) / 60);
  const minutesIntoDay = (9 * 60 + totalMinutes) % (24 * 60);
  const hours = Math.floor(minutesIntoDay / 60);
  const minutes = minutesIntoDay % 60;
  const day = Math.floor((9 * 60 + totalMinutes) / (24 * 60)) + 1;
  return {
    time: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
    day,
  };
}

function Vitals() {
  const hud = useGame((state) => state.hud);
  if (!hud) {
    return null;
  }
  return (
    <div className="pointer-events-auto flex items-center gap-4 bg-ink-900/85 px-4 py-2 text-white shadow-[var(--elev-slab)]">
      <span
        data-testid="hud-money"
        className="font-numeral text-xl font-semibold text-grass-500 tabular-nums"
      >
        {moneyToDollarString(money(hud.money))}
      </span>
      <span className="font-ui text-xs font-semibold tracking-[0.06em] text-frost-300/70 uppercase">
        👥 <span data-testid="hud-guests" className="font-numeral tabular-nums">{hud.guestCount}</span>{" "}
        ·{" "}
        <span data-testid="hud-rating" className="font-numeral tabular-nums">
          {hud.ratingStars.toFixed(1)}
        </span>
        <span className="text-gold-400" aria-label={t("play.vitals.rating")}>
          ★
        </span>{" "}
        ·{" "}
        <span data-testid="hud-level">
          {t("play.vitals.level")} {hud.level}
        </span>
      </span>
      {hud.debtCents > 0 ? (
        <span
          data-testid="hud-debt"
          className="font-numeral text-xs font-semibold text-danger-500 tabular-nums"
        >
          −{moneyToDollarString(money(hud.debtCents))}
        </span>
      ) : null}
      {hud.receivershipActive ? (
        <span
          data-testid="hud-receivership"
          className="skew-ui bg-danger-500 px-2 py-0.5 font-ui text-[10px] font-bold text-white uppercase"
        >
          <span className="unskew-ui inline-block">{t("play.vitals.receivership")}</span>
        </span>
      ) : null}
    </div>
  );
}

function Clock() {
  const tick = useGame((state) => state.hud?.tick ?? 0);
  const { time, day } = useMemo(() => clockText(tick), [tick]);
  return (
    <div className="pointer-events-auto flex items-center gap-3 bg-ink-900/85 px-4 py-1.5 text-white shadow-[var(--elev-slab)]">
      <span className="font-numeral text-lg font-semibold tabular-nums">{time}</span>
      <span className="font-ui text-xs font-semibold tracking-[0.08em] text-frost-300/80 uppercase">
        {t("play.day", { day })}
      </span>
      <span aria-hidden>☀</span>
    </div>
  );
}

function SpeedControls() {
  const speed = useGame((state) => state.speed);
  const setSpeed = useGame((state) => state.setSpeed);
  const options: { value: GameSpeed; label: string }[] = [
    { value: 0, label: "⏸" },
    { value: 1, label: "1×" },
    { value: 2, label: "2×" },
    { value: 4, label: "4×" },
  ];
  return (
    <div className="pointer-events-auto flex items-stretch gap-0.5 bg-ink-900/85 p-1 shadow-[var(--elev-slab)]">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          data-testid={`speed-${option.value}`}
          aria-label={option.value === 0 ? t("play.speed.pause") : `${option.value}×`}
          aria-pressed={speed === option.value}
          onClick={() => setSpeed(option.value)}
          className={`skew-ui min-w-9 cursor-pointer px-2 py-1 font-ui text-sm font-bold ${
            speed === option.value ? "bg-gold-400 text-ink-900" : "text-frost-300 hover:bg-white/10"
          }`}
        >
          <span className="unskew-ui inline-block">{option.label}</span>
        </button>
      ))}
    </div>
  );
}

function Dock({
  onOpenPalette,
  onToggleStaff,
  onOpenRides,
  onOpenManage,
}: {
  onOpenPalette: (category: "path" | "scenery" | "shops") => void;
  onToggleStaff: () => void;
  onOpenRides: () => void;
  onOpenManage: () => void;
}) {
  const buildMode = useGame((state) => state.buildMode);
  const setBuildMode = useGame((state) => state.setBuildMode);

  const buttons: {
    id: string;
    label: string;
    icon: string;
    active: boolean;
    onClick: () => void;
  }[] = [
    {
      id: "paths",
      label: t("play.mode.paths"),
      icon: "🛤",
      active: buildMode.kind === "path",
      onClick: () => (buildMode.kind === "path" ? setBuildMode({ kind: "inspect" }) : setBuildMode({ kind: "path" })),
    },
    {
      id: "scenery",
      label: t("play.mode.scenery"),
      icon: "🌳",
      active: buildMode.kind === "place",
      onClick: () => onOpenPalette("scenery"),
    },
    {
      id: "shops",
      label: t("play.dock.shops"),
      icon: "🍔",
      active: buildMode.kind === "place",
      onClick: () => onOpenPalette("shops"),
    },
    {
      id: "rides",
      label: t("play.dock.rides"),
      icon: "🎢",
      active: buildMode.kind === "track" || buildMode.kind === "place-ride",
      onClick: onOpenRides,
    },
    {
      id: "staff",
      label: t("staff.title"),
      icon: "🧹",
      active: false,
      onClick: onToggleStaff,
    },
    {
      id: "manage",
      label: t("play.dock.manage"),
      icon: "📊",
      active: false,
      onClick: onOpenManage,
    },
    {
      id: "bulldoze",
      label: t("play.mode.bulldoze"),
      icon: "🧨",
      active: buildMode.kind === "bulldoze",
      onClick: () =>
        buildMode.kind === "bulldoze" ? setBuildMode({ kind: "inspect" }) : setBuildMode({ kind: "bulldoze" }),
    },
  ];

  return (
    <div className="pointer-events-auto flex items-stretch gap-1 bg-ink-900/85 p-1.5 shadow-[var(--elev-slab)]">
      {buttons.map((button) => (
        <button
          key={button.id}
          type="button"
          data-testid={`dock-${button.id}`}
          onClick={button.onClick}
          aria-pressed={button.active}
          className={`skew-ui flex cursor-pointer flex-col items-center px-3 py-1.5 font-ui text-xs font-bold uppercase ${
            button.active ? "bg-gold-400 text-ink-900" : "text-frost-300 hover:bg-white/10"
          }`}
        >
          <span className="unskew-ui text-lg leading-none" aria-hidden>
            {button.icon}
          </span>
          <span className="unskew-ui mt-0.5">{button.label}</span>
        </button>
      ))}
    </div>
  );
}

function Toasts() {
  const toasts = useGame((state) => state.toasts);
  return (
    <div className="pointer-events-none flex flex-col gap-1.5" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-2 bg-ink-900/85 px-3 py-1.5 font-ui text-sm font-semibold text-white shadow-[var(--elev-slab)] border-l-4 ${
            toast.tone === "good"
              ? "border-grass-500"
              : toast.tone === "bad"
                ? "border-danger-500"
                : "border-sky-500"
          }`}
        >
          {toast.text}
        </div>
      ))}
    </div>
  );
}

function ContextHints() {
  const buildMode = useGame((state) => state.buildMode);
  const hints: Hint[] =
    buildMode.kind === "place"
      ? [
          { keys: ["LMB"], label: t("play.hint.place") },
          { keys: ["R"], label: t("play.hint.rotate") },
          { keys: ["ESC"], label: t("play.hint.cancel") },
        ]
      : buildMode.kind === "path"
        ? [
            { keys: ["LMB"], label: t("play.hint.paint") },
            { keys: ["ESC"], label: t("play.hint.cancel") },
          ]
        : buildMode.kind === "bulldoze"
          ? [
              { keys: ["LMB"], label: t("play.hint.demolish") },
              { keys: ["ESC"], label: t("play.hint.cancel") },
            ]
          : [
              { keys: ["M"], label: t("play.hint.manage") },
              { keys: ["CTRL", "Z"], label: t("play.hint.undo") },
              { keys: ["ESC"], label: t("play.hint.menu") },
            ];
  return (
    <div className="pointer-events-none text-frost-100">
      <HintRail hints={hints} />
    </div>
  );
}

export function Hud({
  onOpenPalette,
  onToggleStaff,
  onOpenRides,
  onOpenManage,
}: {
  onOpenPalette: (category: "path" | "scenery" | "shops") => void;
  onToggleStaff: () => void;
  onOpenRides: () => void;
  onOpenManage: () => void;
}) {
  const parkName = useGame((state) => state.hud?.parkName);
  const [hintCollapsed] = useState(false);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-4">
      <div className="flex items-start justify-between">
        <Toasts />
        <div className="flex items-center gap-2">
          <Clock />
          <ParkControls />
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="pointer-events-auto">
            <IdentityChip {...(parkName ? { name: parkName } : {})} tickets={0} />
          </div>
          <GoalPanel />
        </div>
      </div>
      <div className="flex items-end justify-between gap-4">
        <Vitals />
        <div className="flex items-center gap-2">
          <Dock
            onOpenPalette={onOpenPalette}
            onToggleStaff={onToggleStaff}
            onOpenRides={onOpenRides}
            onOpenManage={onOpenManage}
          />
          <SpeedControls />
        </div>
        {hintCollapsed ? <Keycap>?</Keycap> : <ContextHints />}
      </div>
    </div>
  );
}
