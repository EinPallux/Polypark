import { z } from "zod";

/**
 * The generated content catalog (public/content/catalog.json) is the single
 * source of truth for every shippable piece (TECHNICAL_ARCHITECTURE §5).
 * scripts/build-content.ts validates on write; the app validates on load.
 */

export const PIECE_CATEGORIES = [
  "path",
  "scenery",
  "building",
  "track",
  "prop",
  "vehicle",
  "character",
  /** Kit pieces consumed by ride compositions — never placeable on their own. */
  "ride-part",
  /** Kit pieces consumed by building compositions — never placeable on their own. */
  "building-part",
] as const;

export const KIT_IDS = [
  "base",
  "boardwalk",
  "pirate",
  "cosmic",
  "spooky",
  "storybook",
  "winter",
  "grandprix",
  "rails",
  "putt",
  "cuddle",
  "marble",
] as const;

export const CatalogPieceSchema = z.object({
  /** Stable id: "<pack-slug>/<piece-slug>" — referenced by content definitions and saves. */
  id: z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/),
  pack: z.string().min(1),
  /** Source path inside /assets — provenance for the kit-only law (GAME_DESIGN P7). */
  source: z.string().min(1),
  /** Shipped file under public/. */
  file: z.string().startsWith("models/"),
  category: z.enum(PIECE_CATEGORIES),
  kit: z.enum(KIT_IDS),
  tags: z.array(z.string()).default([]),
  /** Cells occupied at rotation 0 (cell = 2×2 m, GAME_DESIGN §8.1). */
  footprint: z.object({ w: z.number().int().min(1), d: z.number().int().min(1) }),
  aabb: z.object({
    min: z.tuple([z.number(), z.number(), z.number()]),
    max: z.tuple([z.number(), z.number(), z.number()]),
  }),
  sizeBytes: z.number().int().positive(),
});

export const CatalogSchema = z.object({
  formatVersion: z.literal(1),
  generator: z.object({
    tool: z.literal("build-content"),
    gltfTransform: z.string(),
  }),
  pieces: z.array(CatalogPieceSchema).min(1),
});

export type CatalogPiece = z.infer<typeof CatalogPieceSchema>;
export type Catalog = z.infer<typeof CatalogSchema>;

export function parseCatalog(json: unknown): Catalog {
  return CatalogSchema.parse(json);
}
