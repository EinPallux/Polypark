"use client";

/**
 * M1 piece palette: a compact dock popover of scenery pieces with pipeline
 * thumbnails. The full Build Catalog screen (UI_UX §6.6) lands in M3.
 */
import Image from "next/image";
import { t } from "@/ui/i18n/t";
import { moneyToDollarString } from "@/shared/money";
import { pieceCost } from "@/content/costs";
import { useGame } from "./store";

export function BuildPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const catalog = useGame((state) => state.catalog);
  const buildMode = useGame((state) => state.buildMode);
  const setBuildMode = useGame((state) => state.setBuildMode);

  if (!open || !catalog) {
    return null;
  }
  const pieces = catalog.pieces.filter(
    (piece) => piece.category === "scenery" || piece.category === "prop",
  );

  return (
    <div className="pointer-events-auto absolute bottom-24 left-1/2 z-20 w-[560px] max-w-[90vw] -translate-x-1/2">
      <div className="panel-cut bg-frost-100/95 p-4 shadow-[var(--elev-slab)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="skew-ui font-ui text-lg font-bold tracking-tight text-ink-700 uppercase">
            {t("play.mode.scenery")}
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
          {pieces.map((piece) => {
            const selected = buildMode.kind === "place" && buildMode.pieceId === piece.id;
            const shortName = piece.id.split("/")[1] ?? piece.id;
            return (
              <button
                key={piece.id}
                type="button"
                data-testid={`palette-${piece.id.replace("/", "-")}`}
                title={`${shortName} · ${moneyToDollarString(pieceCost(piece))}`}
                onClick={() => {
                  setBuildMode({ kind: "place", pieceId: piece.id });
                  onClose();
                }}
                className={`flex cursor-pointer flex-col items-center gap-1 bg-white/70 p-1.5 shadow-[var(--elev-slab)] transition-transform hover:-translate-y-0.5 ${
                  selected ? "ring-2 ring-gold-400" : ""
                }`}
              >
                <Image
                  src={`/thumbs/${piece.id}.png`}
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
