/**
 * Catalog thumbnails (ASSET_GUIDE §5): screenshots every catalog piece via the
 * /dev/thumbs stage into public/thumbs/<pack>/<piece>.png (256×256).
 *
 * Self-contained: builds nothing, but needs a production build present
 * (`pnpm build`) — it boots `next start` on a scratch port, walks the catalog,
 * and shuts down. Screenshots are NOT byte-deterministic across GPU stacks,
 * so thumbs are regenerated manually (never part of the CI drift check).
 */
import { spawn } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { parseCatalog } from "../src/content/schema";

const ROOT = path.resolve(import.meta.dirname, "..");
const PORT = 3411;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT_DIR = path.join(ROOT, "public", "thumbs");

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`server did not come up at ${url}`);
}

async function main(): Promise<void> {
  if (!existsSync(path.join(ROOT, ".next"))) {
    throw new Error("no .next build found — run `pnpm build` first");
  }
  const catalog = parseCatalog(
    JSON.parse(await readFile(path.join(ROOT, "public", "content", "catalog.json"), "utf8")),
  );

  const server = spawn("pnpm", ["start", "--port", String(PORT)], {
    cwd: ROOT,
    stdio: "ignore",
    detached: true,
  });
  try {
    await waitForServer(BASE, 30_000);

    await rm(OUT_DIR, { recursive: true, force: true });
    await mkdir(OUT_DIR, { recursive: true });

    const executablePath = existsSync("/opt/pw-browsers/chromium")
      ? "/opt/pw-browsers/chromium"
      : undefined;
    const browser = await chromium.launch(executablePath ? { executablePath } : {});
    const page = await browser.newPage({ viewport: { width: 300, height: 300 } });

    let done = 0;
    for (const piece of catalog.pieces) {
      await page.goto(`${BASE}/dev/thumbs?id=${encodeURIComponent(piece.id)}`);
      const stage = page.locator("[data-thumb-stage]");
      await stage.waitFor({ state: "visible", timeout: 15_000 });
      await page.locator("[data-thumb-ready]").waitFor({ state: "attached", timeout: 15_000 });
      await page.waitForTimeout(150); // one settled frame after load
      const file = path.join(OUT_DIR, `${piece.id}.png`);
      await mkdir(path.dirname(file), { recursive: true });
      await stage.screenshot({ path: file });
      done += 1;
    }
    await browser.close();
    console.log(`rendered ${done}/${catalog.pieces.length} thumbnails into public/thumbs`);
  } finally {
    if (server.pid) {
      try {
        process.kill(-server.pid, "SIGTERM");
      } catch {
        server.kill("SIGTERM");
      }
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
