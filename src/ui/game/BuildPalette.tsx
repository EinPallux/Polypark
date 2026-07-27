"use client";

/**
 * M1 piece palette: a compact dock popover of scenery pieces with pipeline
 * thumbnails. The full Build Catalog screen (UI_UX §6.6) lands in M3.
 */
import Image from "next/image";
import { t } from "@/ui/i18n/t";
import { money, moneyToDollarString, type Money } from "@/shared/money";
import { pieceCost } from "@/content/costs";
import { SHOP_DEFS } from "@/content/shops";
import { composedBuilding } from "@/content/buildings";
import { unlockLevel } from "@/sim/api";
import { useGame } from "./store";

interface PaletteEntry {
  readonly id: string;
  readonly label: string;
  /** Catalog piece whose thumbnail represents this entry. */
  readonly thumbId: string;
  readonly cost: Money;
}

export function BuildPalette({
  open,
  category,
  onClose,
}: {
  open: boolean;
  category: "scenery" | "shops";
  onClose: () => void;
}) {
  const catalog = useGame((state) => state.catalog);
  const buildMode = useGame((state) => state.buildMode);
  const setBuildMode = useGame((state) => state.setBuildMode);
  const progression = useGame((state) => state.progression);

  if (!open || !catalog) {
    return null;
  }
  const unlocked = new Set(progression?.unlocked ?? []);
  // The shop tab is driven by the shop roster rather than by the catalog: a
  // composed building (Poly Bistro and friends) has no catalog row of its own,
  // and filtering the catalog would silently drop every one of them. Scenery
  // is still catalog-driven, since there the piece IS the thing.
  const entries: PaletteEntry[] =
    category === "shops"
      ? Object.keys(SHOP_DEFS).map((id) => {
          const composed = composedBuilding(id);
          const piece = catalog.pieces.find((candidate) => candidate.id === id);
          return {
            id,
            label: t(`shop.${id}` as never),
            thumbId: composed ? composed.thumbPieceId : id,
            cost: composed ? composed.buildCost : piece ? pieceCost(piece) : money(0),
          };
        })
      : catalog.pieces
          .filter((piece) => piece.category === "scenery" || piece.category === "prop")
          .map((piece) => ({
            id: piece.id,
            label: piece.id.split("/")[1] ?? piece.id,
            thumbId: piece.id,
            cost: pieceCost(piece),
          }));

  return (
    <div className="pointer-events-auto absolute bottom-24 left-1/2 z-20 w-[560px] max-w-[90vw] -translate-x-1/2">
      <div className="panel-cut bg-frost-100/95 p-4 shadow-[var(--elev-slab)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="skew-ui font-ui text-lg font-bold tracking-tight text-ink-700 uppercase">
            {category === "shops" ? t("play.dock.shops") : t("play.mode.scenery")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer font-ui text-sm font-bold text-ink-500 uppercase hover:text-ink-700"
          >
            ✕
          </button>
        </div>
        <div className="grid max-h-64 grid-cols-6 gap-2 overflow-y-auto pr-1">
          {entries.map((entry) => {
            const selected = buildMode.kind === "place" && buildMode.pieceId === entry.id;
            const shortName = entry.label;
            // Locked items stay visible, greyed, wearing the level they arrive
            // at. Hiding them would make the palette feel arbitrary; showing
            // them makes the track legible without opening a screen.
            const needs = unlocked.has(entry.id) ? null : unlockLevel(entry.id);
            const locked = needs !== null;
            return (
              <button
                key={entry.id}
                type="button"
                data-testid={`palette-${entry.id.replace("/", "-")}`}
                disabled={locked}
                aria-disabled={locked}
                title={
                  locked
                    ? t("palette.locked", { level: needs })
                    : `${shortName} · ${moneyToDollarString(entry.cost)}`
                }
                onClick={() => {
                  if (locked) {
                    return;
                  }
                  setBuildMode({ kind: "place", pieceId: entry.id });
                  onClose();
                }}
                className={`relative flex flex-col items-center gap-1 bg-white/70 p-1.5 shadow-[var(--elev-slab)] transition-transform ${
                  locked
                    ? "cursor-not-allowed opacity-45 grayscale"
                    : "cursor-pointer hover:-translate-y-0.5"
                } ${selected ? "ring-2 ring-gold-400" : ""}`}
              >
                {locked ? (
                  <span
                    data-testid={`palette-lock-${entry.id.replace("/", "-")}`}
                    className="absolute top-0.5 right-0.5 bg-ink-900/85 px-1 font-ui text-[9px] font-bold text-gold-400"
                  >
                    L{needs}
                  </span>
                ) : null}
                <Image
                  src={`/thumbs/${entry.thumbId}.png`}
                  alt={shortName}
                  width={64}
                  height={64}
                  className="h-16 w-16 object-contain"
                  unoptimized
                />
                <span className="w-full truncate text-center font-ui text-[10px] font-semibold text-ink-500">
                  {shortName}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
