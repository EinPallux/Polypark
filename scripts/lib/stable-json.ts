/** JSON.stringify with recursively sorted keys — byte-stable output for CI drift checks. */
export function stableJson(value: unknown, indent = 2): string {
  return `${JSON.stringify(sortValue(value), null, indent)}\n`;
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      sorted[key] = sortValue(record[key]);
    }
    return sorted;
  }
  return value;
}
