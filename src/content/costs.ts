import { money, type Money } from "@/shared/money";
import { type CatalogPiece } from "./schema";
import { SHOP_DEFS } from "./shops";

/**
 * M1 placement costs straight from GAME_BALANCE §3.2: paths $40/cell, scenery
 * by size class S/M/L/XL = $25/$80/$180/$400. Buildings/track get real
 * definitions in M2+; until then they take the XL price.
 */
export const PATH_COST: Money = money(40_00);
export const PLAZA_COST: Money = money(60_00);

const SIZE_CLASS_COST_CENTS = [25_00, 80_00, 180_00, 400_00] as const;

export function pieceCost(piece: CatalogPiece): Money {
  if (piece.category === "path") {
    return PATH_COST;
  }
  const shop = SHOP_DEFS[piece.id];
  if (shop) {
    return shop.buildCost;
  }
  const size = Math.max(
    piece.aabb.max[0] - piece.aabb.min[0],
    piece.aabb.max[1] - piece.aabb.min[1],
    piece.aabb.max[2] - piece.aabb.min[2],
  );
  const sizeClass = size < 0.6 ? 0 : size < 1.4 ? 1 : size < 2.6 ? 2 : 3;
  return money(SIZE_CLASS_COST_CENTS[sizeClass]);
}

/** The typed piece data the sim receives (it never reads catalog.json itself). */
export interface SimPieceDef {
  readonly id: string;
  readonly category: CatalogPiece["category"];
  readonly footprint: { readonly w: number; readonly d: number };
  readonly cost: Money;
}

export function toSimPieceDefs(pieces: readonly CatalogPiece[]): SimPieceDef[] {
  return pieces.map((piece) => ({
    id: piece.id,
    category: piece.category,
    footprint: piece.footprint,
    cost: pieceCost(piece),
  }));
}
