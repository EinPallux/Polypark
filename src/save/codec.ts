import { gzipSync, gunzipSync, strToU8, strFromU8 } from "fflate";
import { SaveFileSchema, type SaveFile } from "./schema";
import { runMigrations } from "./migrations";

/**
 * Binary save codec: gzipped UTF-8 JSON (TECHNICAL_ARCHITECTURE §8). The same
 * bytes go into IndexedDB slots (M1) and .polypark export files — one format,
 * one migration path.
 */

export function encodeSave(save: SaveFile): Uint8Array {
  const validated = SaveFileSchema.parse(save);
  // mtime: 0 keeps the gzip header deterministic — same save, same bytes.
  return gzipSync(strToU8(JSON.stringify(validated)), { level: 6, mtime: 0 });
}

export class SaveCorruptError extends Error {
  constructor(cause: unknown) {
    super("This save file could not be read (corrupt or not a Polypark save).");
    this.name = "SaveCorruptError";
    this.cause = cause;
  }
}

export function decodeSave(bytes: Uint8Array): SaveFile {
  let raw: unknown;
  try {
    raw = JSON.parse(strFromU8(gunzipSync(bytes)));
  } catch (error) {
    throw new SaveCorruptError(error);
  }
  if (typeof raw !== "object" || raw === null) {
    throw new SaveCorruptError("save payload is not an object");
  }
  const migrated = runMigrations(raw as Record<string, unknown>);
  return SaveFileSchema.parse(migrated);
}
