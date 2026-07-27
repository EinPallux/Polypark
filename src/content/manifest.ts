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
const roads = (piece: string): string => `Kenney_CityKitRoads/GLB format/${piece}`;
const suburban = (piece: string): string => `Kenney_CityKitSuburban/GLB format/${piece}`;

export const PILOT_MANIFEST: readonly ManifestEntry[] = [
  // Paths (NatureKit ground_path* auto-tile family — GAME_DESIGN §8.1)
  { id: "naturekit/path-straight", pack: "Kenney_NatureKit", source: nature("ground_pathStraight.glb"), category: "path", kit: "base", tags: ["path", "tile"] },
  { id: "naturekit/path-bend", pack: "Kenney_NatureKit", source: nature("ground_pathBend.glb"), category: "path", kit: "base", tags: ["path", "tile"] },
  { id: "naturekit/path-corner", pack: "Kenney_NatureKit", source: nature("ground_pathCorner.glb"), category: "path", kit: "base", tags: ["path", "tile"] },
  { id: "naturekit/path-cross", pack: "Kenney_NatureKit", source: nature("ground_pathCross.glb"), category: "path", kit: "base", tags: ["path", "tile"] },
  { id: "naturekit/path-end", pack: "Kenney_NatureKit", source: nature("ground_pathEnd.glb"), category: "path", kit: "base", tags: ["path", "tile"] },
  { id: "naturekit/path-split", pack: "Kenney_NatureKit", source: nature("ground_pathSplit.glb"), category: "path", kit: "base", tags: ["path", "tile"] },
  { id: "naturekit/path-tile", pack: "Kenney_NatureKit", source: nature("ground_pathTile.glb"), category: "path", kit: "base", tags: ["path", "tile", "plaza"] },
  // Vegetation & rocks
  { id: "naturekit/tree-simple", pack: "Kenney_NatureKit", source: nature("tree_simple.glb"), category: "scenery", kit: "base", tags: ["tree"] },
  { id: "naturekit/tree-pine-small-a", pack: "Kenney_NatureKit", source: nature("tree_pineSmallA.glb"), category: "scenery", kit: "base", tags: ["tree", "pine"] },
  { id: "naturekit/tree-pine-tall-b", pack: "Kenney_NatureKit", source: nature("tree_pineTallB_detailed.glb"), category: "scenery", kit: "base", tags: ["tree", "pine"] },
  { id: "naturekit/bush", pack: "Kenney_NatureKit", source: nature("plant_bush.glb"), category: "scenery", kit: "base", tags: ["bush"] },
  { id: "naturekit/bush-large", pack: "Kenney_NatureKit", source: nature("plant_bushLarge.glb"), category: "scenery", kit: "base", tags: ["bush"] },
  { id: "naturekit/rock-large-b", pack: "Kenney_NatureKit", source: nature("rock_largeB.glb"), category: "scenery", kit: "base", tags: ["rock"] },
  { id: "naturekit/flower-yellow-b", pack: "Kenney_NatureKit", source: nature("flower_yellowB.glb"), category: "scenery", kit: "base", tags: ["flower"] },
  { id: "naturekit/flower-yellow-c", pack: "Kenney_NatureKit", source: nature("flower_yellowC.glb"), category: "scenery", kit: "base", tags: ["flower"] },
  { id: "naturekit/flower-purple-a", pack: "Kenney_NatureKit", source: nature("flower_purpleA.glb"), category: "scenery", kit: "base", tags: ["flower"] },
  { id: "naturekit/flower-red-a", pack: "Kenney_NatureKit", source: nature("flower_redA.glb"), category: "scenery", kit: "base", tags: ["flower"] },
  { id: "naturekit/tree-default", pack: "Kenney_NatureKit", source: nature("tree_default.glb"), category: "scenery", kit: "base", tags: ["tree"] },
  { id: "naturekit/tree-oak", pack: "Kenney_NatureKit", source: nature("tree_oak.glb"), category: "scenery", kit: "base", tags: ["tree"] },
  { id: "naturekit/tree-fat", pack: "Kenney_NatureKit", source: nature("tree_fat.glb"), category: "scenery", kit: "base", tags: ["tree"] },
  { id: "naturekit/grass", pack: "Kenney_NatureKit", source: nature("grass.glb"), category: "scenery", kit: "base", tags: ["grass"] },
  { id: "naturekit/grass-large", pack: "Kenney_NatureKit", source: nature("grass_large.glb"), category: "scenery", kit: "base", tags: ["grass"] },
  { id: "naturekit/rock-small-a", pack: "Kenney_NatureKit", source: nature("rock_smallA.glb"), category: "scenery", kit: "base", tags: ["rock"] },
  { id: "naturekit/rock-small-c", pack: "Kenney_NatureKit", source: nature("rock_smallC.glb"), category: "scenery", kit: "base", tags: ["rock"] },
  { id: "naturekit/fence-planks", pack: "Kenney_NatureKit", source: nature("fence_planks.glb"), category: "scenery", kit: "base", tags: ["fence"] },
  { id: "naturekit/fence-corner", pack: "Kenney_NatureKit", source: nature("fence_corner.glb"), category: "scenery", kit: "base", tags: ["fence"] },
  { id: "naturekit/fence-gate", pack: "Kenney_NatureKit", source: nature("fence_gate.glb"), category: "scenery", kit: "base", tags: ["fence"] },
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
  // Districts (M5): Parking Grounds and Resort Row. The park is not only rides
  // — GAME_DESIGN §6 wants the whole resort, and these are the ground pieces
  // its plots are built from (kit-only law, ADR-16).
  // Facilities (M5): the three §6 buildings whose effects can be honest today.
  // Grill Garden / Sweet Scoop / Poly Bistro need real kit composition like the
  // flat rides had — no single pack piece is a restaurant — so they wait.
  { id: "coasterkit/stall-info", pack: "Kenney_CoasterKit", source: coaster("stall-information.glb"), category: "building", kit: "base", tags: ["shop", "info"] },
  { id: "minimarket/atm", pack: "Kenney_MiniMarketKit", source: "Kenney_MiniMarketKit/GLB format/bottle-return.glb", category: "building", kit: "base", tags: ["shop", "atm"] },
  { id: "modularbuildings/first-aid", pack: "Kenney_ModularBuildingsKit", source: "Kenney_ModularBuildingsKit/GLB format/building-sample-house-c.glb", category: "building", kit: "base", tags: ["shop", "first-aid"] },
  { id: "cityroads/parking-bay", pack: "Kenney_CityKitRoads", source: roads("road-driveway-double.glb"), category: "building", kit: "base", tags: ["parking", "district"] },
  { id: "cityroads/lot-road", pack: "Kenney_CityKitRoads", source: roads("road-straight.glb"), category: "building", kit: "base", tags: ["parking", "district", "road"] },
  { id: "cityroads/lot-light", pack: "Kenney_CityKitRoads", source: roads("light-square.glb"), category: "prop", kit: "base", tags: ["lamp", "parking", "district"] },
  { id: "suburban/cabin", pack: "Kenney_CityKitSuburban", source: suburban("building-type-a.glb"), category: "building", kit: "base", tags: ["hotel", "district", "resort"] },
  { id: "suburban/hotel-block", pack: "Kenney_CityKitSuburban", source: suburban("building-type-e.glb"), category: "building", kit: "base", tags: ["hotel", "district", "resort"] },
  { id: "suburban/hedge", pack: "Kenney_CityKitSuburban", source: suburban("fence-1x4.glb"), category: "scenery", kit: "base", tags: ["fence", "district", "resort"] },
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
  { id: "blockycharacters/character-b", pack: "Kenney_BlockyCharacters", source: "Kenney_BlockyCharacters/GLB format/character-b.glb", category: "character", kit: "base", tags: ["guest"] },
  { id: "blockycharacters/character-c", pack: "Kenney_BlockyCharacters", source: "Kenney_BlockyCharacters/GLB format/character-c.glb", category: "character", kit: "base", tags: ["guest"] },
  { id: "blockycharacters/character-d", pack: "Kenney_BlockyCharacters", source: "Kenney_BlockyCharacters/GLB format/character-d.glb", category: "character", kit: "base", tags: ["guest"] },
  { id: "blockycharacters/character-e", pack: "Kenney_BlockyCharacters", source: "Kenney_BlockyCharacters/GLB format/character-e.glb", category: "character", kit: "base", tags: ["guest"] },
  { id: "blockycharacters/character-f", pack: "Kenney_BlockyCharacters", source: "Kenney_BlockyCharacters/GLB format/character-f.glb", category: "character", kit: "base", tags: ["guest"] },
  // Shops (Kenney CoasterKit park stalls — GAME_DESIGN §10)
  { id: "coasterkit/stall-food", pack: "Kenney_CoasterKit", source: coaster("stall-food.glb"), category: "building", kit: "boardwalk", tags: ["shop", "food"] },
  { id: "coasterkit/stall-drinks", pack: "Kenney_CoasterKit", source: coaster("stall-drinks.glb"), category: "building", kit: "boardwalk", tags: ["shop", "drink"] },
  { id: "coasterkit/stall-toilets", pack: "Kenney_CoasterKit", source: coaster("stall-toilets.glb"), category: "building", kit: "base", tags: ["facility", "restroom"] },
  // Theme accents
  { id: "watercraftkit/boat-row-small", pack: "Kenney_WatercraftKit", source: "Kenney_WatercraftKit/GLB format/boat-row-small.glb", category: "prop", kit: "pirate", tags: ["boat"] },
  { id: "piratekit/cannon", pack: "Kenney_PirateKit", source: "Kenney_PirateKit/GLB format/cannon.glb", category: "prop", kit: "pirate", tags: ["pirate"] },
  { id: "holidaykit/tree-decorated-snow", pack: "Kenney_HolidayKit", source: "Kenney_HolidayKit/GLB format/tree-decorated-snow.glb", category: "scenery", kit: "winter", tags: ["tree", "holiday"] },
  { id: "citykitroads/light-curved", pack: "Kenney_CityKitRoads", source: "Kenney_CityKitRoads/GLB format/light-curved.glb", category: "prop", kit: "base", tags: ["lamp", "street"] },

  // ——— M3: the track vocabulary (steel + mouse families, GAME_DESIGN §8.2) ———
  // Steel (Steelwind) — steel-straight/curve/hill-complete/looping shipped in M0.
  { id: "coasterkit/steel-corner-small", pack: "Kenney_CoasterKit", source: coaster("coaster-steel-corner-small.glb"), category: "track", kit: "base", tags: ["coaster", "steel", "turn"] },
  { id: "coasterkit/steel-corner-large", pack: "Kenney_CoasterKit", source: coaster("coaster-steel-corner-large.glb"), category: "track", kit: "base", tags: ["coaster", "steel", "turn"] },
  { id: "coasterkit/steel-corner-small-ramp", pack: "Kenney_CoasterKit", source: coaster("coaster-steel-corner-small-ramp.glb"), category: "track", kit: "base", tags: ["coaster", "steel", "turn", "hill"] },
  { id: "coasterkit/steel-corner-large-ramp", pack: "Kenney_CoasterKit", source: coaster("coaster-steel-corner-large-ramp.glb"), category: "track", kit: "base", tags: ["coaster", "steel", "turn", "hill"] },
  { id: "coasterkit/steel-hill-half", pack: "Kenney_CoasterKit", source: coaster("coaster-steel-straight-hill-complete-half.glb"), category: "track", kit: "base", tags: ["coaster", "steel", "hill"] },
  { id: "coasterkit/steel-bump-up", pack: "Kenney_CoasterKit", source: coaster("coaster-steel-straight-bump-up.glb"), category: "track", kit: "base", tags: ["coaster", "steel", "airtime"] },
  { id: "coasterkit/steel-bump-down", pack: "Kenney_CoasterKit", source: coaster("coaster-steel-straight-bump-down.glb"), category: "track", kit: "base", tags: ["coaster", "steel", "dip"] },
  { id: "coasterkit/steel-station-track", pack: "Kenney_CoasterKit", source: coaster("coaster-steel-track.glb"), category: "track", kit: "base", tags: ["coaster", "steel", "station"] },
  // Mouse (Mousetrap) — the whole compact family.
  { id: "coasterkit/mouse-straight", pack: "Kenney_CoasterKit", source: coaster("coaster-mouse-straight.glb"), category: "track", kit: "base", tags: ["coaster", "mouse"] },
  { id: "coasterkit/mouse-curve", pack: "Kenney_CoasterKit", source: coaster("coaster-mouse-curve.glb"), category: "track", kit: "base", tags: ["coaster", "mouse"] },
  { id: "coasterkit/mouse-corner-small", pack: "Kenney_CoasterKit", source: coaster("coaster-mouse-corner-small.glb"), category: "track", kit: "base", tags: ["coaster", "mouse", "turn"] },
  { id: "coasterkit/mouse-corner-large", pack: "Kenney_CoasterKit", source: coaster("coaster-mouse-corner-large.glb"), category: "track", kit: "base", tags: ["coaster", "mouse", "turn"] },
  { id: "coasterkit/mouse-corner-small-ramp", pack: "Kenney_CoasterKit", source: coaster("coaster-mouse-corner-small-ramp.glb"), category: "track", kit: "base", tags: ["coaster", "mouse", "turn", "hill"] },
  { id: "coasterkit/mouse-corner-large-ramp", pack: "Kenney_CoasterKit", source: coaster("coaster-mouse-corner-large-ramp.glb"), category: "track", kit: "base", tags: ["coaster", "mouse", "turn", "hill"] },
  { id: "coasterkit/mouse-hill-complete", pack: "Kenney_CoasterKit", source: coaster("coaster-mouse-straight-hill-complete.glb"), category: "track", kit: "base", tags: ["coaster", "mouse", "hill"] },
  { id: "coasterkit/mouse-hill-half", pack: "Kenney_CoasterKit", source: coaster("coaster-mouse-straight-hill-complete-half.glb"), category: "track", kit: "base", tags: ["coaster", "mouse", "hill"] },
  { id: "coasterkit/mouse-bump-up", pack: "Kenney_CoasterKit", source: coaster("coaster-mouse-straight-bump-up.glb"), category: "track", kit: "base", tags: ["coaster", "mouse", "airtime"] },
  { id: "coasterkit/mouse-bump-down", pack: "Kenney_CoasterKit", source: coaster("coaster-mouse-straight-bump-down.glb"), category: "track", kit: "base", tags: ["coaster", "mouse", "dip"] },
  { id: "coasterkit/mouse-looping", pack: "Kenney_CoasterKit", source: coaster("coaster-mouse-looping.glb"), category: "track", kit: "base", tags: ["coaster", "mouse", "inversion"] },
  { id: "coasterkit/mouse-station-track", pack: "Kenney_CoasterKit", source: coaster("coaster-mouse-track.glb"), category: "track", kit: "base", tags: ["coaster", "mouse", "station"] },
  // Shared coaster hardware
  { id: "coasterkit/station-gate", pack: "Kenney_CoasterKit", source: coaster("station-gate.glb"), category: "building", kit: "base", tags: ["coaster", "station"] },
  { id: "coasterkit/support-large", pack: "Kenney_CoasterKit", source: coaster("support-large.glb"), category: "track", kit: "base", tags: ["coaster", "support"] },
  { id: "coasterkit/queue-corner", pack: "Kenney_CoasterKit", source: coaster("queue-corner.glb"), category: "path", kit: "base", tags: ["queue"] },
  // ——— M3: flat-ride compositions (kit assemblies per GAME_DESIGN §9 / P7) ———
  { id: "piratekit/ship-pirate-small", pack: "Kenney_PirateKit", source: "Kenney_PirateKit/GLB format/ship-pirate-small.glb", category: "ride-part", kit: "pirate", tags: ["ride", "galleon"] },
  { id: "spacekit/rocket-base-a", pack: "Kenney_SpaceKit", source: "Kenney_SpaceKit/GLTF format/rocket_baseA.glb", category: "ride-part", kit: "cosmic", tags: ["ride", "rocket"] },
  { id: "spacekit/rocket-top-a", pack: "Kenney_SpaceKit", source: "Kenney_SpaceKit/GLTF format/rocket_topA.glb", category: "ride-part", kit: "cosmic", tags: ["ride", "rocket"] },
  { id: "spooktober/pumpkin-large", pack: "KayKit_Spooktober", source: "KayKit_Spooktober/Models/gltf/pumpkinLarge.gltf.glb", category: "ride-part", kit: "spooky", tags: ["ride", "pumpkin"] },
  { id: "foodkit/cup-tea-ride", pack: "Kenney_FoodKit", source: "Kenney_FoodKit/GLB format/cup-tea.glb", category: "ride-part", kit: "boardwalk", tags: ["ride", "teacup"] },
  { id: "miniarena/floor", pack: "Kenney_MiniArena", source: "Kenney_MiniArena/GLB format/floor.glb", category: "ride-part", kit: "base", tags: ["ride", "platform"] },
  { id: "cubepets/dog", pack: "Kenney_CubePets", source: "Kenney_CubePets/GLB format/animal-dog.glb", category: "ride-part", kit: "cuddle", tags: ["pet", "ride"] },
  { id: "cubepets/chick", pack: "Kenney_CubePets", source: "Kenney_CubePets/GLB format/animal-chick.glb", category: "ride-part", kit: "cuddle", tags: ["pet", "ride"] },
  { id: "cubepets/deer", pack: "Kenney_CubePets", source: "Kenney_CubePets/GLB format/animal-deer.glb", category: "ride-part", kit: "cuddle", tags: ["pet", "ride"] },
  { id: "cubepets/cow", pack: "Kenney_CubePets", source: "Kenney_CubePets/GLB format/animal-cow.glb", category: "ride-part", kit: "cuddle", tags: ["pet", "ride"] },
  // Mechanic uniform (BlockyCharacters palette g — staff, TECH §6.3)
  { id: "blockycharacters/character-g", pack: "Kenney_BlockyCharacters", source: "Kenney_BlockyCharacters/GLB format/character-g.glb", category: "character", kit: "base", tags: ["staff"] },
];

/**
 * Emote glyphs (EmotesPack Vector/Style 2 — ONE style family, GAME_BALANCE
 * §10) copied to public/emotes. Hunger has no pack glyph anywhere — the
 * renderer draws that one tiny burger itself under P7's UI/SVG exception.
 */
export const EMOTE_SOURCES: readonly { id: string; source: string }[] = [
  "faceHappy",
  "faceSad",
  "heart",
  "anger",
  "drop",
  "sleep",
  "swirl",
  "question",
  "cash",
  "star",
  "exclamation",
].map((id) => ({
  id,
  source: `Kenney_EmotesPack/PNG/Vector/Style 2/emote_${id}.png`,
}));

/** Skybox images ship as-is (PNG copy, no mesh pipeline). */
export const SKYBOX_SOURCES: readonly { id: string; source: string }[] = [
  { id: "morning", source: "Kenney_Skyboxes/Skyboxes/skybox-morning.png" },
  { id: "day", source: "Kenney_Skyboxes/Skyboxes/skybox-day.png" },
  { id: "night", source: "Kenney_Skyboxes/Skyboxes/skybox-night.png" },
  { id: "space", source: "Kenney_Skyboxes/Skyboxes/skybox-space.png" },
  { id: "alien", source: "Kenney_Skyboxes/Skyboxes/skybox-alien.png" },
];
