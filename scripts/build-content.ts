/**
 * Content pipeline v1 (ASSET_GUIDE §5, TECHNICAL_ARCHITECTURE §5).
 *
 * Reads the allow-listed pieces in src/content/manifest.ts from the immutable
 * /assets library, optimizes them (dedup → prune → weld → quantize), and emits:
 *
 *   public/models/<pack-slug>/<piece-slug>.glb   optimized shipping meshes
 *   public/content/catalog.json                  zod-validated piece catalog
 *   public/skyboxes/<id>.png                     skybox images (straight copy)
 *
 * Output is byte-deterministic for a given /assets + manifest + toolchain, so
 * CI regenerates and fails on drift (pnpm content:check). This script (and
 * scripts/lib) are the ONLY code allowed to touch /assets.
 */
import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { Logger, NodeIO, getBounds } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, weld, quantize } from "@gltf-transform/functions";
import { EMOTE_SOURCES, PILOT_MANIFEST, SKYBOX_SOURCES } from "../src/content/manifest";
import { CatalogSchema, type Catalog, type CatalogPiece } from "../src/content/schema";
import { CELL_SIZE_METERS } from "../src/shared/grid";
import { stableJson } from "./lib/stable-json";

const ROOT = path.resolve(import.meta.dirname, "..");
const ASSETS_DIR = path.join(ROOT, "assets");
const MODELS_DIR = path.join(ROOT, "public", "models");
const CONTENT_DIR = path.join(ROOT, "public", "content");
const SKYBOX_DIR = path.join(ROOT, "public", "skyboxes");

/** TECH §10: no single shipped GLB above this. */
const MAX_GLB_BYTES = 1.5 * 1024 * 1024;

async function main(): Promise<void> {
  // Fail on ALL missing sources at once — nobody enjoys whack-a-mole.
  const missing = PILOT_MANIFEST.filter((entry) => !existsSync(path.join(ASSETS_DIR, entry.source)));
  const missingSky = SKYBOX_SOURCES.filter((s) => !existsSync(path.join(ASSETS_DIR, s.source)));
  if (missing.length > 0 || missingSky.length > 0) {
    for (const entry of missing) console.error(`MISSING  ${entry.id}  ->  assets/${entry.source}`);
    for (const s of missingSky) console.error(`MISSING  skybox/${s.id}  ->  assets/${s.source}`);
    throw new Error(`${missing.length + missingSky.length} manifest source(s) not found in /assets`);
  }

  const duplicateIds = PILOT_MANIFEST.map((e) => e.id).filter((id, i, all) => all.indexOf(id) !== i);
  if (duplicateIds.length > 0) {
    throw new Error(`Duplicate manifest ids: ${[...new Set(duplicateIds)].join(", ")}`);
  }

  // Clean output dirs so removed manifest entries actually disappear.
  await rm(MODELS_DIR, { recursive: true, force: true });
  await rm(CONTENT_DIR, { recursive: true, force: true });
  await rm(SKYBOX_DIR, { recursive: true, force: true });
  await mkdir(CONTENT_DIR, { recursive: true });
  await mkdir(SKYBOX_DIR, { recursive: true });

  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .setLogger(new Logger(Logger.Verbosity.ERROR));
  const pieces: CatalogPiece[] = [];
  let totalBytes = 0;
  let totalSourceBytes = 0;

  for (const entry of [...PILOT_MANIFEST].sort((a, b) => a.id.localeCompare(b.id))) {
    const sourcePath = path.join(ASSETS_DIR, entry.source);
    const document = await io.read(sourcePath);
    await document.transform(dedup(), prune(), weld(), quantize());

    const scene = document.getRoot().getDefaultScene() ?? document.getRoot().listScenes()[0];
    if (!scene) {
      throw new Error(`${entry.id}: no scene in ${entry.source}`);
    }
    const bounds = getBounds(scene);
    const size = {
      x: bounds.max[0] - bounds.min[0],
      y: bounds.max[1] - bounds.min[1],
      z: bounds.max[2] - bounds.min[2],
    };
    const cells = (meters: number): number =>
      Math.max(1, Math.ceil(meters / CELL_SIZE_METERS - 0.05));

    const glb = await io.writeBinary(document);
    if (glb.byteLength > MAX_GLB_BYTES) {
      throw new Error(
        `${entry.id}: ${glb.byteLength} bytes exceeds the ${MAX_GLB_BYTES} single-GLB budget (TECH §10)`,
      );
    }

    const file = `models/${entry.id}.glb`;
    const outPath = path.join(ROOT, "public", file);
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, glb);

    totalBytes += glb.byteLength;
    totalSourceBytes += (await stat(sourcePath)).size;

    pieces.push({
      id: entry.id,
      pack: entry.pack,
      source: entry.source,
      file,
      category: entry.category,
      kit: entry.kit,
      tags: [...entry.tags],
      footprint: { w: cells(size.x), d: cells(size.z) },
      aabb: {
        min: bounds.min.map(round3) as [number, number, number],
        max: bounds.max.map(round3) as [number, number, number],
      },
      sizeBytes: glb.byteLength,
    });
  }

  for (const sky of SKYBOX_SOURCES) {
    await cp(path.join(ASSETS_DIR, sky.source), path.join(SKYBOX_DIR, `${sky.id}.png`));
  }
  const emoteDir = path.join(ROOT, "public", "emotes");
  await rm(emoteDir, { recursive: true, force: true });
  await mkdir(emoteDir, { recursive: true });
  for (const emote of EMOTE_SOURCES) {
    await cp(path.join(ASSETS_DIR, emote.source), path.join(emoteDir, `${emote.id}.png`));
  }

  const gltfTransformVersion = JSON.parse(
    await readFile(path.join(ROOT, "node_modules", "@gltf-transform", "core", "package.json"), "utf8"),
  ) as { version: string };

  const catalog: Catalog = CatalogSchema.parse({
    formatVersion: 1,
    generator: { tool: "build-content", gltfTransform: gltfTransformVersion.version },
    pieces,
  });
  await writeFile(path.join(CONTENT_DIR, "catalog.json"), stableJson(catalog));

  const kb = (n: number): string => `${(n / 1024).toFixed(1)} KB`;
  console.log(`built ${pieces.length} pieces + ${SKYBOX_SOURCES.length} skyboxes`);
  console.log(`models: ${kb(totalBytes)} shipped (from ${kb(totalSourceBytes)} source)`);
  const largest = [...pieces].sort((a, b) => b.sizeBytes - a.sizeBytes)[0];
  if (largest) {
    console.log(`largest: ${largest.id} at ${kb(largest.sizeBytes)}`);
  }
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
