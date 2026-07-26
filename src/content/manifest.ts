import { type PIECE_CATEGORIES, type KIT_IDS } from "./schema";

/**
 * The M0 pilot manifest: the allow-list of pieces the content pipeline ships
 * (ASSET_GUIDE §5). Paths are relative to /assets and must exist — the build
 * fails loudly otherwise (kit-only law: every piece has pack provenance).
 *
 * Growing the game's content = appending here (+ regenerating), not code.
 */
export interface ManifestEntry {
  readonly id: string;
  readonly pack: string;
  readonly source: string;
  readonly category: (typeof PIECE_CATEGORIES)[number];
  readonly kit: (typeof KIT_IDS)[number];
  readonly tags: readonly string[];
}

const nature = (piece: string): string => `Kenney_NatureKit/GLTF format/${piece}`;
const coaster = (piece: string): string => `Kenney_CoasterKit/GLB format/${piece}`;

export const PILOT_MANIFEST: readonly ManifestEntry[] = [
  // Paths (NatureKit ground_path* auto-tile family — GAME_DESIGN §8.1)
  { id: "naturekit/path-straight", pack: "Kenney_NatureKit", source: nature("ground_pathStraight.glb"), category: "path", kit: "base", tags: ["path", "tile"] },
  { id: "naturekit/path-bend", pack: "Kenney_NatureKit", source: nature("ground_pathBend.glb"), category: "path", kit: "base", tags: ["path", "tile"] },
  { id: "naturekit/path-corner", pack: "Kenney_NatureKit", source: nature("ground_pathCorner.glb"), category: "path", kit: "base", tags: ["path", "tile"] },
  { id: "naturekit/path-cross", pack: "Kenney_NatureKit", source: nature("ground_pathCross.glb"), category: "path", kit: "base", tags: ["path", "tile"] },
  { id: "naturekit/path-end", pack: "Kenney_NatureKit", source: nature("ground_pathEnd.glb"), category: "path", kit: "base", tags: ["path", "tile"] },
  // Vegetation & rocks
  { id: "naturekit/tree-simple", pack: "Kenney_NatureKit", source: nature("tree_simple.glb"), category: "scenery", kit: "base", tags: ["tree"] },
  { id: "naturekit/tree-pine-small-a", pack: "Kenney_NatureKit", source: nature("tree_pineSmallA.glb"), category: "scenery", kit: "base", tags: ["tree", "pine"] },
  { id: "naturekit/tree-pine-tall-b", pack: "Kenney_NatureKit", source: nature("tree_pineTallB_detailed.glb"), category: "scenery", kit: "base", tags: ["tree", "pine"] },
  { id: "naturekit/bush", pack: "Kenney_NatureKit", source: nature("plant_bush.glb"), category: "scenery", kit: "base", tags: ["bush"] },
  { id: "naturekit/bush-large", pack: "Kenney_NatureKit", source: nature("plant_bushLarge.glb"), category: "scenery", kit: "base", tags: ["bush"] },
  { id: "naturekit/rock-large-b", pack: "Kenney_NatureKit", source: nature("rock_largeB.glb"), category: "scenery", kit: "base", tags: ["rock"] },
  { id: "naturekit/flower-yellow-b", pack: "Kenney_NatureKit", source: nature("flower_yellowB.glb"), category: "scenery", kit: "base", tags: ["flower"] },
  { id: "naturekit/flower-yellow-c", pack: "Kenney_NatureKit", source: nature("flower_yellowC.glb"), category: "scenery", kit: "base", tags: ["flower"] },
  // Coaster track vocabulary (steel family)
  { id: "coasterkit/steel-straight", pack: "Kenney_CoasterKit", source: coaster("coaster-steel-straight.glb"), category: "track", kit: "base", tags: ["coaster", "steel"] },
  { id: "coasterkit/steel-curve", pack: "Kenney_CoasterKit", source: coaster("coaster-steel-curve.glb"), category: "track", kit: "base", tags: ["coaster", "steel"] },
  { id: "coasterkit/steel-hill-complete", pack: "Kenney_CoasterKit", source: coaster("coaster-steel-straight-hill-complete.glb"), category: "track", kit: "base", tags: ["coaster", "steel", "hill"] },
  { id: "coasterkit/steel-looping", pack: "Kenney_CoasterKit", source: coaster("coaster-steel-looping.glb"), category: "track", kit: "base", tags: ["coaster", "steel", "inversion"] },
  { id: "coasterkit/support-small", pack: "Kenney_CoasterKit", source: coaster("support-small.glb"), category: "track", kit: "base", tags: ["coaster", "support"] },
  { id: "coasterkit/station", pack: "Kenney_CoasterKit", source: coaster("station.glb"), category: "building", kit: "base", tags: ["coaster", "station"] },
  { id: "coasterkit/queue-straight", pack: "Kenney_CoasterKit", source: coaster("queue-straight.glb"), category: "path", kit: "base", tags: ["queue"] },
  { id: "coasterkit/queue-entrance", pack: "Kenney_CoasterKit", source: coaster("queue-entrance.glb"), category: "path", kit: "base", tags: ["queue"] },
  { id: "coasterkit/train", pack: "Kenney_CoasterKit", source: coaster("coaster-train.glb"), category: "vehicle", kit: "base", tags: ["coaster", "train"] },
  // Food props (Teacup Twirl seeds — GAME_DESIGN §9)
  { id: "foodkit/cup-tea", pack: "Kenney_FoodKit", source: "Kenney_FoodKit/GLB format/cup-tea.glb", category: "prop", kit: "boardwalk", tags: ["food", "teacup"] },
  { id: "foodkit/cup-saucer", pack: "Kenney_FoodKit", source: "Kenney_FoodKit/GLB format/cup-saucer.glb", category: "prop", kit: "boardwalk", tags: ["food", "teacup"] },
  { id: "foodkit/burger-cheese", pack: "Kenney_FoodKit", source: "Kenney_FoodKit/GLB format/burger-cheese.glb", category: "prop", kit: "boardwalk", tags: ["food"] },
  // Rails
  { id: "trainkit/railroad-straight", pack: "Kenney_TrainKit", source: "Kenney_TrainKit/GLB format/railroad-straight.glb", category: "track", kit: "rails", tags: ["railroad"] },
  { id: "trainkit/locomotive-a", pack: "Kenney_TrainKit", source: "Kenney_TrainKit/GLB format/train-locomotive-a.glb", category: "vehicle", kit: "rails", tags: ["train"] },
  // District traffic (KayKit CityBits — Parking Grounds, GAME_DESIGN §6)
  { id: "citybits/car-sedan", pack: "KayKit_CityBits", source: "KayKit_CityBits/gltf/car_sedan.gltf", category: "vehicle", kit: "base", tags: ["car", "parking"] },
  { id: "citybits/car-taxi", pack: "KayKit_CityBits", source: "KayKit_CityBits/gltf/car_taxi.gltf", category: "vehicle", kit: "base", tags: ["car", "taxi", "parking"] },
  { id: "citybits/streetlight", pack: "KayKit_CityBits", source: "KayKit_CityBits/gltf/streetlight.gltf", category: "prop", kit: "base", tags: ["lamp"] },
  // Buildings
  { id: "modularbuildings/house-a", pack: "Kenney_ModularBuildingsKit", source: "Kenney_ModularBuildingsKit/GLB format/building-sample-house-a.glb", category: "building", kit: "base", tags: ["house"] },
  { id: "modularbuildings/house-b", pack: "Kenney_ModularBuildingsKit", source: "Kenney_ModularBuildingsKit/GLB format/building-sample-house-b.glb", category: "building", kit: "base", tags: ["house"] },
  { id: "modularbuildings/tower-a", pack: "Kenney_ModularBuildingsKit", source: "Kenney_ModularBuildingsKit/GLB format/building-sample-tower-a.glb", category: "building", kit: "base", tags: ["tower"] },
  // Furniture props
  { id: "furniturekit/bench", pack: "Kenney_FurnitureKit", source: "Kenney_FurnitureKit/GLTF format/bench.glb", category: "prop", kit: "base", tags: ["bench"] },
  { id: "furniturekit/lamp-round-floor", pack: "Kenney_FurnitureKit", source: "Kenney_FurnitureKit/GLTF format/lampRoundFloor.glb", category: "prop", kit: "base", tags: ["lamp"] },
  // Characters & pets
  { id: "cubepets/cat", pack: "Kenney_CubePets", source: "Kenney_CubePets/GLB format/animal-cat.glb", category: "character", kit: "cuddle", tags: ["pet"] },
  { id: "cubepets/bunny", pack: "Kenney_CubePets", source: "Kenney_CubePets/GLB format/animal-bunny.glb", category: "character", kit: "cuddle", tags: ["pet"] },
  { id: "blockycharacters/character-a", pack: "Kenney_BlockyCharacters", source: "Kenney_BlockyCharacters/GLB format/character-a.glb", category: "character", kit: "base", tags: ["guest"] },
  // Theme accents
  { id: "watercraftkit/boat-row-small", pack: "Kenney_WatercraftKit", source: "Kenney_WatercraftKit/GLB format/boat-row-small.glb", category: "prop", kit: "pirate", tags: ["boat"] },
  { id: "piratekit/cannon", pack: "Kenney_PirateKit", source: "Kenney_PirateKit/GLB format/cannon.glb", category: "prop", kit: "pirate", tags: ["pirate"] },
  { id: "holidaykit/tree-decorated-snow", pack: "Kenney_HolidayKit", source: "Kenney_HolidayKit/GLB format/tree-decorated-snow.glb", category: "scenery", kit: "winter", tags: ["tree", "holiday"] },
  { id: "citykitroads/light-curved", pack: "Kenney_CityKitRoads", source: "Kenney_CityKitRoads/GLB format/light-curved.glb", category: "prop", kit: "base", tags: ["lamp", "street"] },
];

/** Skybox images ship as-is (PNG copy, no mesh pipeline). */
export const SKYBOX_SOURCES: readonly { id: string; source: string }[] = [
  { id: "morning", source: "Kenney_Skyboxes/Skyboxes/skybox-morning.png" },
  { id: "day", source: "Kenney_Skyboxes/Skyboxes/skybox-day.png" },
  { id: "night", source: "Kenney_Skyboxes/Skyboxes/skybox-night.png" },
  { id: "space", source: "Kenney_Skyboxes/Skyboxes/skybox-space.png" },
  { id: "alien", source: "Kenney_Skyboxes/Skyboxes/skybox-alien.png" },
];
