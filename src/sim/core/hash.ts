import { fnv1a } from "./rng";

/** JSON.stringify with recursively sorted object keys — stable across runs. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    );
    const sorted: Record<string, unknown> = {};
    for (const [key, entryValue] of entries) {
      sorted[key] = sortValue(entryValue);
    }
    return sorted;
  }
  return value;
}

/**
 * Order-independent structural hash of a state object. Used by the golden-seed
 * determinism tests (TECHNICAL_ARCHITECTURE §11.1): same seed + same commands
 * must produce the same hash, forever.
 */
export function stateHash(value: unknown): string {
  return fnv1a(stableStringify(value)).toString(16).padStart(8, "0");
}
