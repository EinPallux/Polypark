/** JSON.stringify with recursively sorted keys — byte-stable output for CI drift checks. */
export function stableJson(value: unknown, indent = 2): string {
  return `${JSON.stringify(sortValue(value), null, indent)}\n`;
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value !== null && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortValue((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}
