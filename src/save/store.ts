"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { decodeSave, encodeSave } from "./codec";
import { type SaveFile } from "./schema";

/**
 * IndexedDB save slots (TECH §8). Bytes are the same gzip payload as the
 * future .polypark export files — one format, one migration path. localStorage
 * keeps only the "continue" pointer.
 */

export interface SlotMeta {
  readonly slot: string;
  readonly name: string;
  readonly savedAtIso: string;
  readonly appVersion: string;
  readonly siteId: string;
  readonly tick: number;
  readonly moneyCents: number;
}

interface PolyparkDB extends DBSchema {
  saves: {
    key: string;
    value: { bytes: Uint8Array; meta: SlotMeta };
  };
}

const CONTINUE_KEY = "polypark.continueSlot";

let dbPromise: Promise<IDBPDatabase<PolyparkDB>> | null = null;

function db(): Promise<IDBPDatabase<PolyparkDB>> {
  dbPromise ??= openDB<PolyparkDB>("polypark", 1, {
    upgrade(database) {
      database.createObjectStore("saves");
    },
  });
  return dbPromise;
}

export async function writeSlot(slot: string, save: SaveFile): Promise<SlotMeta> {
  const meta: SlotMeta = {
    slot,
    name: save.meta.name,
    savedAtIso: save.meta.savedAtIso,
    appVersion: save.appVersion,
    siteId: save.sim.world.siteId,
    tick: save.sim.tick,
    moneyCents: save.sim.money,
  };
  await (await db()).put("saves", { bytes: encodeSave(save), meta }, slot);
  window.localStorage.setItem(CONTINUE_KEY, slot);
  return meta;
}

export async function readSlot(slot: string): Promise<SaveFile | null> {
  const entry = await (await db()).get("saves", slot);
  return entry ? decodeSave(entry.bytes) : null;
}

export async function listSlots(): Promise<SlotMeta[]> {
  const entries = await (await db()).getAll("saves");
  return entries.map((entry) => entry.meta).sort((a, b) => b.savedAtIso.localeCompare(a.savedAtIso));
}

export function continueSlot(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(CONTINUE_KEY);
}

/** Ask the browser not to evict our saves (best effort, TECH §14 risk table). */
export function requestPersistence(): void {
  void navigator.storage?.persist?.();
}
