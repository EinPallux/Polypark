"use client";

import { useMemo, useState } from "react";
import { FLAT_RIDE_LIST } from "@/content/rides";
import { TRACK_FAMILIES, TRACK_KIND_LIST } from "@/content/track";
import { RIDE_STATE } from "@/sim/api";
import { money, moneyToDollarString } from "@/shared/money";
import { t } from "@/ui/i18n/t";
import { SlabButton } from "@/ui/kit/SlabButton";
import { useGame } from "./store";

/**
 * M3 ride UI: the RIDES palette (coaster starters + flat rides + roster),
 * the track builder side panel with live E/I/N, and the ride inspector
 * (UI_UX §6: panels are cut slabs, numbers are numerals, buttons shout).
 */

const FLAT_RIDE_THUMBS: Record<string, string> = {
  teacups: "/thumbs/foodkit/cup-tea-ride.png",
  carousel: "/thumbs/cubepets/bunny.png",
  galleon: "/thumbs/piratekit/ship-pirate-small.png",
  rocket: "/thumbs/spacekit/rocket-top-a.png",
  drop: "/thumbs/spooktober/pumpkin-large.png",
};

const stateLabel = (state: number): string =>
  state === RIDE_STATE.open
    ? t("ride.inspector.state.open")
    : state === RIDE_STATE.testing
      ? t("ride.inspector.state.testing")
      : state === RIDE_STATE.broken
        ? t("ride.inspector.state.broken")
        : t("ride.inspector.state.closed");

export function RidesPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const setBuildMode = useGame((state) => state.setBuildMode);
  const selectRide = useGame((state) => state.selectRide);
  const rides = useGame((state) => state.rides);
  if (!open) {
    return null;
  }
  const roster = [...(rides?.tracked ?? []), ...(rides?.flat ?? [])];
  return (
    <div className="pointer-events-auto absolute bottom-24 left-1/2 z-20 w-[520px] -translate-x-1/2">
      <div className="panel-cut bg-frost-100/95 p-4 shadow-[var(--elev-slab)]" data-testid="rides-palette">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="skew-ui font-ui text-lg font-bold text-ink-700 uppercase">
            {t("play.dock.rides")}
          </h2>
          <button type="button" onClick={onClose} className="cursor-pointer font-bold text-ink-500">
            ✕
          </button>
        </div>
        <p className="mb-1 font-ui text-xs font-bold text-ink-500 uppercase">
          {t("ride.palette.coasters")}
        </p>
        <div className="mb-3 flex gap-2">
          {(["steel", "mouse"] as const).map((family) => {
            const def = TRACK_FAMILIES[family];
            return (
              <button
                key={family}
                type="button"
                data-testid={`ride-start-${family}`}
                onClick={() => {
                  setBuildMode({ kind: "track", family, rideId: null });
                  onClose();
                }}
                className="skew-ui flex-1 cursor-pointer bg-ink-900 px-3 py-2 text-left hover:bg-ink-700"
              >
                <span className="unskew-ui block font-ui text-sm font-bold text-white uppercase">
                  🎢 {t(`ride.family.${family}` as never)}
                </span>
                <span className="unskew-ui block font-numeral text-xs text-frost-300 tabular-nums">
                  {moneyToDollarString(money(def.baseCostCents + def.trainCostCents))}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mb-1 font-ui text-xs font-bold text-ink-500 uppercase">
          {t("ride.palette.flat")}
        </p>
        <div className="grid grid-cols-5 gap-2">
          {FLAT_RIDE_LIST.map((def) => (
            <button
              key={def.id}
              type="button"
              data-testid={`ride-flat-${def.id}`}
              onClick={() => {
                setBuildMode({ kind: "place-ride", defId: def.id });
                onClose();
              }}
              className="cursor-pointer bg-white/70 p-1.5 text-center hover:bg-gold-400/40"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- tiny local thumbs */}
              <img
                src={FLAT_RIDE_THUMBS[def.id] ?? ""}
                alt=""
                className="mx-auto h-12 w-12 object-contain"
              />
              <span className="block font-ui text-[11px] leading-tight font-bold text-ink-700">
                {t(def.nameKey as never)}
              </span>
              <span className="block font-numeral text-[10px] text-ink-500 tabular-nums">
                {moneyToDollarString(money(def.costCents))}
              </span>
            </button>
          ))}
        </div>
        {roster.length > 0 && (
          <>
            <p className="mt-3 mb-1 font-ui text-xs font-bold text-ink-500 uppercase">
              {t("ride.roster")}
            </p>
            <div className="flex max-h-24 flex-col gap-1 overflow-y-auto">
              {roster.map((ride) => {
                const name =
                  "family" in ride
                    ? t(`ride.family.${ride.family}` as never)
                    : t(`ride.${ride.defId}` as never);
                return (
                  <button
                    key={ride.key}
                    type="button"
                    onClick={() => {
                      selectRide(ride.key);
                      onClose();
                    }}
                    className="flex cursor-pointer items-center justify-between bg-white/60 px-2 py-1 text-left hover:bg-gold-400/30"
                  >
                    <span className="font-ui text-xs font-bold text-ink-700">{name}</span>
                    <span className="font-ui text-[10px] text-ink-500 uppercase">
                      {stateLabel(ride.state)}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Live builder panel — appears while a track is being laid piece by piece. */
export function TrackBuilderPanel() {
  const buildMode = useGame((state) => state.buildMode);
  const rides = useGame((state) => state.rides);
  const facade = useGame((state) => state.facade);
  const [flipped, setFlipped] = useState(false);

  if (buildMode.kind !== "track" || !facade) {
    return null;
  }
  if (buildMode.rideId === null) {
    return (
      <div className="pointer-events-none absolute top-24 left-4 z-20 w-64">
        <div className="panel-cut bg-ink-900/90 p-3 shadow-[var(--elev-slab)]">
          <p className="font-ui text-sm font-bold text-gold-400 uppercase">
            {t(`ride.family.${buildMode.family}` as never)}
          </p>
          <p className="mt-1 font-body text-xs text-frost-300">{t("ride.palette.startHint")}</p>
        </div>
      </div>
    );
  }
  const ride = rides?.tracked.find((r) => r.key === buildMode.rideId);
  return ride ? <BuilderBody rideKey={ride.key} flipped={flipped} setFlipped={setFlipped} /> : null;
}

/**
 * Split so the dry-runs memoize on build edits only: the panel subscribes
 * per-frame store churn, but the 11 checkAppendPiece calls (occupancy +
 * energy + scenery scans each) must run once per EDIT — running them every
 * frame saturated the main thread (observed in the M3 e2e).
 */
function BuilderBody({
  rideKey,
  flipped,
  setFlipped,
}: {
  rideKey: number;
  flipped: boolean;
  setFlipped: (next: boolean) => void;
}) {
  const facade = useGame((state) => state.facade);
  const rides = useGame((state) => state.rides);
  const worldVersion = useGame((state) => state.worldVersion);
  const appendPiece = useGame((state) => state.appendTrackPiece);
  const popPiece = useGame((state) => state.popTrackPiece);
  const setBuildMode = useGame((state) => state.setBuildMode);
  const setRideState = useGame((state) => state.setRideState);
  const demolishRide = useGame((state) => state.demolishRide);
  const selectRide = useGame((state) => state.selectRide);
  const ride = rides?.tracked.find((r) => r.key === rideKey);
  const pieceCount = ride?.pieces.length ?? 0;
  const checks = useMemo(() => {
    if (!facade || !ride) {
      return new Map<string, ReturnType<NonNullable<typeof facade>["checkAppendPiece"]>>();
    }
    const map = new Map<string, ReturnType<typeof facade.checkAppendPiece>>();
    for (const kind of TRACK_KIND_LIST) {
      if (kind !== "station") {
        map.set(kind, facade.checkAppendPiece(ride.key, kind, flipped));
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- worldVersion + pieceCount key the dry-runs to edits
  }, [facade, rideKey, pieceCount, flipped, worldVersion]);
  if (!facade || !ride) {
    return null;
  }
  const evaln = ride.evaln;
  const kinds = TRACK_KIND_LIST.filter((kind) => kind !== "station");

  return (
    <div className="pointer-events-auto absolute top-24 left-4 z-20 w-72" data-testid="track-builder">
      <div className="panel-cut bg-ink-900/92 p-3 shadow-[var(--elev-slab)]">
        <div className="flex items-center justify-between">
          <h2 className="skew-ui font-ui text-base font-bold text-gold-400 uppercase">
            {t("ride.builder.title")} · {t(`ride.family.${ride.family}` as never)}
          </h2>
        </div>
        <p className="mt-0.5 font-numeral text-xs text-frost-300 tabular-nums">
          {t("ride.builder.pieces", {
            count: ride.pieces.length,
            cost: moneyToDollarString(money(ride.totalSpentCents)),
          })}
        </p>
        <p
          data-testid="builder-status"
          className={`mt-1 font-ui text-xs font-bold uppercase ${evaln.valid ? "text-grass-500" : "text-frost-300"}`}
        >
          {evaln.valid
            ? t("ride.builder.closed")
            : evaln.reason === "not-closed" || evaln.reason === "no-pieces"
              ? t("ride.builder.open")
              : t(`ride.builder.invalid.${evaln.reason}` as never)}
        </p>
        {evaln.valid && (
          <p data-testid="builder-stats" className="mt-1 font-numeral text-sm text-white tabular-nums">
            {t("ride.inspector.stats", { e: evaln.eStat, i: evaln.iStat, n: evaln.nStat })}
          </p>
        )}
        <label className="mt-2 flex cursor-pointer items-center gap-2 font-ui text-xs text-frost-300">
          <input
            type="checkbox"
            checked={flipped}
            onChange={(event) => {
              setFlipped(event.target.checked);
            }}
            data-testid="builder-flip"
          />
          {t("ride.builder.flip")}
        </label>
        <div className="mt-2 grid grid-cols-2 gap-1">
          {kinds.map((kind) => {
            const check = checks.get(kind) ?? { reason: "invalid" as const, preview: null };
            const preview = check.preview;
            return (
              <button
                key={kind}
                type="button"
                data-testid={`piece-${kind}`}
                disabled={check.reason !== null}
                onClick={() => appendPiece(kind, flipped)}
                title={
                  preview
                    ? t("ride.inspector.stats", {
                        e: preview.eStat,
                        i: preview.iStat,
                        n: preview.nStat,
                      })
                    : undefined
                }
                className={`skew-ui px-2 py-1 text-left font-ui text-[11px] font-bold uppercase ${
                  check.reason === null
                    ? "cursor-pointer bg-white/10 text-white hover:bg-gold-400 hover:text-ink-900"
                    : "cursor-not-allowed bg-white/5 text-frost-300/40"
                }`}
              >
                <span className="unskew-ui">
                  {flipped && (kind.startsWith("hill") || kind.startsWith("corner")) ? "↘ " : ""}
                  {t(`ride.piece.${kind}` as never)}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <SlabButton
            variant="secondary"
            data-testid="builder-pop"
            onClick={popPiece}
            disabled={ride.pieces.length <= 1}
          >
            {t("ride.builder.undoPiece")}
          </SlabButton>
          <SlabButton
            data-testid="builder-test"
            disabled={!evaln.valid}
            onClick={() => setRideState(ride.key, "testing")}
          >
            {t("ride.inspector.test")}
          </SlabButton>
          <SlabButton
            data-testid="builder-done"
            variant="secondary"
            onClick={() => {
              setBuildMode({ kind: "inspect" });
              selectRide(ride.key);
            }}
          >
            {t("ride.builder.done")}
          </SlabButton>
          <SlabButton
            variant="secondary"
            data-testid="builder-demolish"
            onClick={() => demolishRide(ride.key)}
          >
            {t("ride.builder.demolish")}
          </SlabButton>
        </div>
      </div>
    </div>
  );
}

export function RideInspector() {
  const selectedRide = useGame((state) => state.selectedRide);
  const rides = useGame((state) => state.rides);
  const buildMode = useGame((state) => state.buildMode);
  const selectRide = useGame((state) => state.selectRide);
  const setRideState = useGame((state) => state.setRideState);
  const setRidePrice = useGame((state) => state.setRidePrice);
  const demolishRide = useGame((state) => state.demolishRide);
  const setBuildMode = useGame((state) => state.setBuildMode);

  if (selectedRide === null || buildMode.kind === "track") {
    return null;
  }
  const tracked = rides?.tracked.find((r) => r.key === selectedRide);
  const flat = rides?.flat.find((r) => r.key === selectedRide);
  const ride = tracked ?? flat;
  if (!ride) {
    return null;
  }
  const name = tracked
    ? t(`ride.family.${tracked.family}` as never)
    : t(`ride.${flat!.defId}` as never);
  const stats = tracked ? tracked.evaln : null;

  return (
    <div className="pointer-events-auto absolute bottom-24 right-4 z-20 w-72" data-testid="ride-inspector">
      <div className="panel-cut bg-frost-100/95 p-4 shadow-[var(--elev-slab)]">
        <div className="flex items-center justify-between">
          <h2 className="skew-ui font-ui text-lg font-bold text-ink-700 uppercase">🎢 {name}</h2>
          <button
            type="button"
            onClick={() => selectRide(null)}
            className="cursor-pointer font-bold text-ink-500"
          >
            ✕
          </button>
        </div>
        <p data-testid="ride-state" className="mt-1 font-ui text-sm font-bold text-ink-500 uppercase">
          {stateLabel(ride.state)}
        </p>
        {stats?.valid && (
          <p className="mt-1 font-numeral text-sm text-ink-700 tabular-nums">
            {t("ride.inspector.stats", { e: stats.eStat, i: stats.iStat, n: stats.nStat })}
          </p>
        )}
        <p className="mt-1 font-numeral text-xs text-ink-500 tabular-nums">
          {t("ride.inspector.queue", { count: ride.queueLen })} ·{" "}
          {t("ride.inspector.riders", { count: ride.riderCount })} ·{" "}
          {t("ride.inspector.cycles", { count: ride.cycleCount })}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <span className="font-ui text-sm font-semibold text-ink-700">
            {t("ride.inspector.price")}
          </span>
          <span className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setRidePrice(ride.key, Math.max(0, ride.priceCents - 50))}
              className="cursor-pointer bg-ink-900/10 px-1.5 font-ui text-sm font-bold text-ink-700 hover:bg-ink-900/20"
            >
              −
            </button>
            <span data-testid="ride-price" className="font-numeral text-sm tabular-nums">
              {moneyToDollarString(money(ride.priceCents))}
            </span>
            <button
              type="button"
              onClick={() => setRidePrice(ride.key, Math.min(20_00, ride.priceCents + 50))}
              className="cursor-pointer bg-ink-900/10 px-1.5 font-ui text-sm font-bold text-ink-700 hover:bg-ink-900/20"
            >
              +
            </button>
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {ride.state === RIDE_STATE.closed && !ride.tested && (
            <SlabButton data-testid="ride-test" onClick={() => setRideState(ride.key, "testing")}>
              {t("ride.inspector.test")}
            </SlabButton>
          )}
          {ride.state === RIDE_STATE.closed && ride.tested && (
            <SlabButton data-testid="ride-open" onClick={() => setRideState(ride.key, "open")}>
              {t("ride.inspector.openRide")}
            </SlabButton>
          )}
          {(ride.state === RIDE_STATE.open || ride.state === RIDE_STATE.testing) && (
            <SlabButton
              variant="secondary"
              data-testid="ride-close"
              onClick={() => setRideState(ride.key, "closed")}
            >
              {t("ride.inspector.closeRide")}
            </SlabButton>
          )}
          {tracked && ride.state === RIDE_STATE.closed && (
            <SlabButton
              variant="secondary"
              data-testid="ride-edit"
              onClick={() =>
                setBuildMode({ kind: "track", family: tracked.family, rideId: tracked.key })
              }
            >
              {t("ride.builder.title")}
            </SlabButton>
          )}
          <SlabButton
            variant="secondary"
            data-testid="ride-demolish"
            onClick={() => demolishRide(ride.key)}
          >
            {t("ride.builder.demolish")}
          </SlabButton>
        </div>
      </div>
    </div>
  );
}
