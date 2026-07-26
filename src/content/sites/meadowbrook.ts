import { type SiteDescriptor } from "./types";

/**
 * Meadowbrook — the default Site (GAME_DESIGN §5): a rolling lawn with a
 * gentle hill in the northeast, a pond in the southwest, and treelines all
 * around. Authored to keep a generous flat meadow through the middle.
 */
export const MEADOWBROOK: SiteDescriptor = {
  id: "meadowbrook",
  name: "Meadowbrook",
  cells: { w: 48, d: 48 },
  surroundCells: 26,
  seed: 194_027,
  landforms: [
    { kind: "hill", x: 38, z: 10, radius: 16, height: 1.9 }, // NE viewpoint hill
    { kind: "hill", x: 6, z: 4, radius: 12, height: 1.1 }, // NW shoulder
    { kind: "basin", x: 9, z: 38, radius: 9, height: 1.6 }, // SW pond basin
    { kind: "hill", x: 58, z: 40, radius: 18, height: 2.6 }, // off-site backdrop east
    { kind: "hill", x: -12, z: 20, radius: 16, height: 2.2 }, // off-site backdrop west
    { kind: "hill", x: 24, z: -14, radius: 20, height: 2.8 }, // off-site backdrop north
  ],
  noise: { amplitude: 0.16, scale: 13 },
  waterLevel: -0.62,
  gate: { x: 24, z: 47 },
  scatter: [
    {
      pieces: ["naturekit/tree-default", "naturekit/tree-oak", "naturekit/tree-pine-tall-b", "naturekit/tree-fat"],
      region: "rim",
      density: 0.34,
      minScale: 1.1,
      maxScale: 1.9,
      maxSlope: "steep",
    },
    {
      pieces: ["naturekit/tree-pine-small-a", "naturekit/bush", "naturekit/bush-large"],
      region: "rim",
      density: 0.22,
      minScale: 0.9,
      maxScale: 1.5,
      maxSlope: "steep",
    },
    {
      pieces: ["naturekit/grass", "naturekit/grass-large", "naturekit/flower-yellow-b", "naturekit/flower-purple-a", "naturekit/flower-red-a"],
      region: "interior",
      density: 0.05,
      minScale: 0.8,
      maxScale: 1.4,
      maxSlope: "gentle",
    },
    {
      pieces: ["naturekit/rock-small-a", "naturekit/rock-small-c"],
      region: "interior",
      density: 0.012,
      minScale: 0.8,
      maxScale: 1.3,
      maxSlope: "steep",
    },
    {
      pieces: ["naturekit/tree-simple", "naturekit/tree-default"],
      region: "interior",
      density: 0.02,
      minScale: 1.0,
      maxScale: 1.5,
      maxSlope: "gentle",
    },
  ],
};

export const SITES: Readonly<Record<string, SiteDescriptor>> = {
  [MEADOWBROOK.id]: MEADOWBROOK,
};
