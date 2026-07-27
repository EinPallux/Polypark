"use client";

import {
  SHOP_DEFS,
  SHOP_FAIR_PRICE_RATIO,
  SHOP_PRICE_CEILING_CENTS,
  souvenirSecondItemChance,
} from "@/content/shops";
import { money, moneyToDollarString } from "@/shared/money";
import { t } from "@/ui/i18n/t";
import { SlabButton } from "@/ui/kit/SlabButton";
import { useGame } from "./store";

/**
 * Click a shop in inspect mode to price it (UI_UX §6.9, the same gesture that
 * selects a ride). Shops were the last thing in the park the player could not
 * set a number on, which also meant the Value sub-score judged them on a lever
 * that did not exist.
 *
 * The panel always states what guests consider fair, because "guests think $9
 * is steep for a snack" is the hint GAME_BALANCE §6 asks for — pricing should
 * be a judgement call, not a guessing game (pillar P5).
 */

const STEP_CENTS = 50;

export function ShopInspector() {
  const selectedShop = useGame((state) => state.selectedShop);
  const facade = useGame((state) => state.facade);
  // worldVersion re-reads the piece after a price change without mirroring the
  // whole world into React state.
  const worldVersion = useGame((state) => state.worldVersion);
  const buildMode = useGame((state) => state.buildMode);
  const selectShop = useGame((state) => state.selectShop);
  const setShopPrice = useGame((state) => state.setShopPrice);
  const stars = useGame((state) => state.rating?.stars ?? 0);

  if (selectedShop === null || buildMode.kind !== "inspect") {
    return null;
  }
  void worldVersion;
  const piece = facade?.placedPieces().find((p) => p.id === selectedShop);
  const def = piece ? SHOP_DEFS[piece.pieceId] : undefined;
  if (!piece || !def) {
    return null;
  }

  const price = piece.priceCents;
  const fairCents = Math.round(def.defaultPriceCents * SHOP_FAIR_PRICE_RATIO);
  const free = def.defaultPriceCents === 0;
  const margin = price - def.unitCostCents;
  const steep = price > fairCents;

  return (
    <div
      className="pointer-events-auto absolute bottom-24 right-4 z-20 w-72"
      data-testid="shop-inspector"
    >
      <div className="panel-cut bg-frost-100/95 p-4 shadow-[var(--elev-slab)]">
        <div className="flex items-center justify-between">
          <h2 className="skew-ui font-ui text-lg font-bold text-ink-700 uppercase">
            🍔 {t(`shop.${def.pieceId}` as never)}
          </h2>
          <button
            type="button"
            data-testid="shop-close"
            onClick={() => selectShop(null)}
            className="cursor-pointer font-bold text-ink-500"
          >
            ✕
          </button>
        </div>

        {free ? (
          // Restrooms stay free by design (GAME_DESIGN §24) — say so rather
          // than showing a disabled control the player will poke at.
          <p className="mt-2 font-body text-sm text-ink-500">{t("shop.alwaysFree")}</p>
        ) : (
          <>
            <div className="mt-3 flex items-center gap-2">
              <SlabButton
                data-testid="shop-price-down"
                disabled={price <= 0}
                onClick={() => setShopPrice(piece.id, Math.max(0, price - STEP_CENTS))}
              >
                −
              </SlabButton>
              <span
                data-testid="shop-price"
                className="flex-1 text-center font-numeral text-2xl font-bold text-ink-700 tabular-nums"
              >
                {moneyToDollarString(money(price))}
              </span>
              <SlabButton
                data-testid="shop-price-up"
                disabled={price >= SHOP_PRICE_CEILING_CENTS}
                onClick={() =>
                  setShopPrice(piece.id, Math.min(SHOP_PRICE_CEILING_CENTS, price + STEP_CENTS))
                }
              >
                +
              </SlabButton>
            </div>

            <p
              data-testid="shop-fair-hint"
              className={`mt-2 font-body text-xs ${steep ? "text-danger-500" : "text-ink-500"}`}
            >
              {steep
                ? t("shop.steep", { fair: moneyToDollarString(money(fairCents)) })
                : t("shop.fair", { fair: moneyToDollarString(money(fairCents)) })}
            </p>

            <p className="mt-1 font-numeral text-xs text-ink-500 tabular-nums">
              {t("shop.margin", {
                cost: moneyToDollarString(money(def.unitCostCents)),
                margin: moneyToDollarString(money(margin)),
              })}
            </p>
          </>
        )}

        {/* What this building does that a snack stall does not. Stated in the
            panel rather than left to be inferred from watching guests — a
            mechanic the player cannot see may as well not exist (pillar P5). */}
        {def.capacity !== undefined ? (
          <p data-testid="shop-seats" className="mt-2 font-body text-xs text-ink-500">
            {t("shop.seats", {
              seats: def.capacity,
              taken: facade?.shopOccupancy(piece.id) ?? 0,
            })}
          </p>
        ) : null}

        {def.secondary ? (
          <p className="mt-1 font-body text-xs text-ink-500">
            {t(
              def.secondary.amount >= 0 ? "shop.secondary.up" : "shop.secondary.down",
              {
                need: t(`need.${def.secondary.need}` as never),
                amount: Math.abs(def.secondary.amount),
              },
            )}
          </p>
        ) : null}

        {def.effect === "souvenir" ? (
          <p className="mt-1 font-body text-xs text-ink-500">
            {t("shop.souvenir", {
              percent: Math.round(souvenirSecondItemChance(stars) * 100),
            })}
          </p>
        ) : null}

        <p className="mt-2 font-body text-xs text-ink-500">
          {t("shop.upkeep", { amount: moneyToDollarString(money(def.upkeepCents)) })}
        </p>
      </div>
    </div>
  );
}
