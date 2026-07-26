/**
 * Performance budget gate (TECHNICAL_ARCHITECTURE §10). Budgets are numbers
 * here, not aspirations in prose — CI fails when one breaks. Run after
 * `pnpm build` (and after `pnpm content:build` for model budgets).
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { parseCatalog } from "../src/content/schema";

const ROOT = path.resolve(import.meta.dirname, "..");

/** TECH §10 — keep in sync with the table in TECHNICAL_ARCHITECTURE.md. */
const BUDGETS = {
  singleGlbBytes: 1.5 * 1024 * 1024,
  totalModelBytes: 60 * 1024 * 1024,
  titleRouteJsGzBytes: 300 * 1024,
  playRouteJsGzBytes: 900 * 1024, // "game chunk lazy ≤900 KB"
};

interface Check {
  readonly name: string;
  readonly actual: string;
  readonly limit: string;
  readonly ok: boolean;
}

const kb = (bytes: number): string => `${(bytes / 1024).toFixed(1)} KB`;

async function walkFiles(dir: string, suffix: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walkFiles(full, suffix)));
    } else if (entry.name.endsWith(suffix)) {
      out.push(full);
    }
  }
  return out;
}

async function checkModels(checks: Check[]): Promise<void> {
  const modelsDir = path.join(ROOT, "public", "models");
  const glbs = await walkFiles(modelsDir, ".glb");
  let total = 0;
  let largest = { file: "-", size: 0 };
  for (const file of glbs) {
    const { size } = await stat(file);
    total += size;
    if (size > largest.size) {
      largest = { file: path.relative(modelsDir, file), size };
    }
  }
  checks.push({
    name: `largest single GLB (${largest.file})`,
    actual: kb(largest.size),
    limit: kb(BUDGETS.singleGlbBytes),
    ok: largest.size <= BUDGETS.singleGlbBytes,
  });
  checks.push({
    name: `total shipped models (${glbs.length} files)`,
    actual: kb(total),
    limit: kb(BUDGETS.totalModelBytes),
    ok: total <= BUDGETS.totalModelBytes,
  });
}

async function checkCatalog(checks: Check[]): Promise<void> {
  const raw = await readFile(path.join(ROOT, "public", "content", "catalog.json"), "utf8");
  let ok = true;
  let detail = "valid";
  try {
    const catalog = parseCatalog(JSON.parse(raw));
    detail = `${catalog.pieces.length} pieces`;
  } catch (error) {
    ok = false;
    detail = error instanceof Error ? error.message.slice(0, 80) : "invalid";
  }
  checks.push({ name: "catalog.json zod-validates", actual: detail, limit: "valid", ok });
}

async function checkRouteJs(
  checks: Check[],
  routeKey: string,
  label: string,
  limit: number,
): Promise<void> {
  const manifestPath = path.join(ROOT, ".next", "app-build-manifest.json");
  if (!existsSync(manifestPath)) {
    checks.push({
      name: label,
      actual: "no .next build — run `pnpm build` first",
      limit: kb(limit),
      ok: false,
    });
    return;
  }
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    pages: Record<string, string[]>;
  };
  const files = new Set<string>([
    ...(manifest.pages[routeKey] ?? []),
    ...(manifest.pages["/layout"] ?? []),
  ]);
  let gzTotal = 0;
  for (const file of files) {
    if (!file.endsWith(".js")) continue;
    const content = await readFile(path.join(ROOT, ".next", file));
    gzTotal += gzipSync(content, { level: 9 }).byteLength;
  }
  checks.push({
    name: `${label} (${files.size} chunks)`,
    actual: kb(gzTotal),
    limit: kb(limit),
    ok: gzTotal <= limit,
  });
}

async function main(): Promise<void> {
  const checks: Check[] = [];
  await checkModels(checks);
  await checkCatalog(checks);
  await checkRouteJs(checks, "/page", "title route first-load JS gz", BUDGETS.titleRouteJsGzBytes);
  await checkRouteJs(checks, "/play/page", "play route first-load JS gz", BUDGETS.playRouteJsGzBytes);

  let failed = 0;
  for (const check of checks) {
    const mark = check.ok ? "OK  " : "FAIL";
    if (!check.ok) failed += 1;
    console.log(`${mark}  ${check.name}: ${check.actual} (limit ${check.limit})`);
  }
  if (failed > 0) {
    throw new Error(`${failed} budget check(s) failed (TECH §10)`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
