import { type Brand } from "./brand";

/**
 * Entity ids are branded sequential integers issued by the sim (deterministic —
 * never UUIDs, CLAUDE.md determinism rules).
 */
export type PieceInstanceId = Brand<number, "PieceInstanceId">;
export type GuestId = Brand<number, "GuestId">;
export type StaffId = Brand<number, "StaffId">;
export type RideId = Brand<number, "RideId">;

/** Catalog piece ids are stable strings from the content pipeline (e.g. "naturekit/tree-simple"). */
export type CatalogPieceId = Brand<string, "CatalogPieceId">;

export function catalogPieceId(id: string): CatalogPieceId {
  return id as CatalogPieceId;
}
