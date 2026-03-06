import * as THREE from "three";

import { BLOCK, BLOCK_TYPES, getFaceTexture } from "./blocks.js";

export const HOTBAR_SIZE = 9;
export const INVENTORY_SIZE = 36;

export const ITEM = {
  GRASS_BLOCK: "grass_block",
  DIRT: "dirt",
  STONE: "stone",
  SAND: "sand",
  OAK_LOG: "oak_log",
  LEAVES: "leaves",
  COBBLESTONE: "cobblestone",
  OAK_PLANKS: "oak_planks",
  GLASS: "glass",
  COAL_ORE: "coal_ore",
  IRON_ORE: "iron_ore",
  CRAFTING_TABLE: "crafting_table",
  CHEST: "chest",
  TORCH: "torch",
  STICK: "stick",
  IRON_INGOT: "iron_ingot",
  GOLD_INGOT: "gold_ingot",
  DIAMOND: "diamond",
  FEATHER: "feather",
  LEATHER: "leather",
  RAW_CHICKEN: "raw_chicken",
  RAW_PORKCHOP: "raw_porkchop",
  RAW_BEEF: "raw_beef",
  ROTTEN_FLESH: "rotten_flesh",
  WOODEN_PICKAXE: "wooden_pickaxe",
  WOODEN_AXE: "wooden_axe",
  WOODEN_SHOVEL: "wooden_shovel",
  WOODEN_HOE: "wooden_hoe",
  WOODEN_SWORD: "wooden_sword",
  STONE_PICKAXE: "stone_pickaxe",
  STONE_AXE: "stone_axe",
  STONE_SHOVEL: "stone_shovel",
  STONE_HOE: "stone_hoe",
  STONE_SWORD: "stone_sword",
  IRON_PICKAXE: "iron_pickaxe",
  IRON_AXE: "iron_axe",
  IRON_SHOVEL: "iron_shovel",
  IRON_HOE: "iron_hoe",
  IRON_SWORD: "iron_sword",
  GOLDEN_PICKAXE: "golden_pickaxe",
  GOLDEN_AXE: "golden_axe",
  GOLDEN_SHOVEL: "golden_shovel",
  GOLDEN_HOE: "golden_hoe",
  GOLDEN_SWORD: "golden_sword",
  DIAMOND_PICKAXE: "diamond_pickaxe",
  DIAMOND_AXE: "diamond_axe",
  DIAMOND_SHOVEL: "diamond_shovel",
  DIAMOND_HOE: "diamond_hoe",
  DIAMOND_SWORD: "diamond_sword",
};

const TOOL_MATERIALS = {
  wood: {
    label: "Wooden",
    ingredient: ITEM.OAK_PLANKS,
    toolLevel: 0,
    durability: 59,
    miningSpeed: 2,
    attackBonus: 1,
    palette: { base: "#b98951", shade: "#8a6336", accent: "#dcb175" },
  },
  stone: {
    label: "Stone",
    ingredient: ITEM.COBBLESTONE,
    toolLevel: 1,
    durability: 131,
    miningSpeed: 4,
    attackBonus: 2,
    palette: { base: "#95a0a8", shade: "#717983", accent: "#c7d0d7" },
  },
  iron: {
    label: "Iron",
    ingredient: ITEM.IRON_INGOT,
    toolLevel: 2,
    durability: 250,
    miningSpeed: 6,
    attackBonus: 3,
    palette: { base: "#d6cec5", shade: "#9f988f", accent: "#f4ede6" },
  },
  golden: {
    label: "Golden",
    ingredient: ITEM.GOLD_INGOT,
    toolLevel: 0,
    durability: 32,
    miningSpeed: 12,
    attackBonus: 1,
    palette: { base: "#f0ca55", shade: "#ba9026", accent: "#fff0a8" },
  },
  diamond: {
    label: "Diamond",
    ingredient: ITEM.DIAMOND,
    toolLevel: 3,
    durability: 1561,
    miningSpeed: 8,
    attackBonus: 4,
    palette: { base: "#67dde0", shade: "#2496a0", accent: "#bafcff" },
  },
};

const TOOL_SHAPES = {
  pickaxe: {
    label: "Pickaxe",
    iconPainter: drawPickaxeIcon,
    attackDamage: 3,
    pattern: (ingredient) => [
      [ingredient, ingredient, ingredient],
      [null, ITEM.STICK, null],
      [null, ITEM.STICK, null],
    ],
  },
  axe: {
    label: "Axe",
    iconPainter: drawAxeIcon,
    attackDamage: 4,
    patterns: (ingredient) => ([
      {
        suffix: "right",
        pattern: [
          [ingredient, ingredient],
          [ingredient, ITEM.STICK],
          [null, ITEM.STICK],
        ],
      },
      {
        suffix: "left",
        pattern: [
          [ingredient, ingredient],
          [ITEM.STICK, ingredient],
          [ITEM.STICK, null],
        ],
      },
    ]),
  },
  shovel: {
    label: "Shovel",
    iconPainter: drawShovelIcon,
    attackDamage: 2.5,
    pattern: (ingredient) => [
      [ingredient],
      [ITEM.STICK],
      [ITEM.STICK],
    ],
  },
  hoe: {
    label: "Hoe",
    iconPainter: drawHoeIcon,
    attackDamage: 1,
    patterns: (ingredient) => ([
      {
        suffix: "right",
        pattern: [
          [ingredient, ingredient],
          [null, ITEM.STICK],
          [null, ITEM.STICK],
        ],
      },
      {
        suffix: "left",
        pattern: [
          [ingredient, ingredient],
          [ITEM.STICK, null],
          [ITEM.STICK, null],
        ],
      },
    ]),
  },
  sword: {
    label: "Sword",
    iconPainter: drawSwordIcon,
    attackDamage: 4,
    pattern: (ingredient) => [
      [ingredient],
      [ingredient],
      [ITEM.STICK],
    ],
  },
};

function defineBlockItem(id, blockId, options = {}) {
  return {
    id,
    name: options.name ?? BLOCK_TYPES[blockId].name,
    category: "block",
    stackSize: 64,
    placeableBlockId: blockId,
    iconTile: options.iconTile ?? getFaceTexture(blockId, "front") ?? getFaceTexture(blockId, "side") ?? getFaceTexture(blockId, "top"),
  };
}

function defineMaterialItem(id, name, iconPainter) {
  return {
    id,
    name,
    category: "material",
    stackSize: 64,
    iconPainter,
  };
}

function getToolItemId(material, toolType) {
  const prefix = material === "wood" ? "WOODEN" : material.toUpperCase();
  return ITEM[`${prefix}_${toolType.toUpperCase()}`];
}
function defineTool(id, name, toolType, material) {
  const materialDef = TOOL_MATERIALS[material];
  const shape = TOOL_SHAPES[toolType];
  return {
    id,
    name,
    category: "tool",
    stackSize: 1,
    toolType,
    material,
    toolLevel: materialDef.toolLevel,
    durability: materialDef.durability,
    miningSpeed: materialDef.miningSpeed,
    attackDamage: shape.attackDamage + materialDef.attackBonus,
    iconPainter: shape.iconPainter,
  };
}

const defs = {
  [ITEM.GRASS_BLOCK]: defineBlockItem(ITEM.GRASS_BLOCK, BLOCK.GRASS),
  [ITEM.DIRT]: defineBlockItem(ITEM.DIRT, BLOCK.DIRT),
  [ITEM.STONE]: defineBlockItem(ITEM.STONE, BLOCK.STONE),
  [ITEM.SAND]: defineBlockItem(ITEM.SAND, BLOCK.SAND),
  [ITEM.OAK_LOG]: defineBlockItem(ITEM.OAK_LOG, BLOCK.OAK_LOG),
  [ITEM.LEAVES]: defineBlockItem(ITEM.LEAVES, BLOCK.LEAVES),
  [ITEM.COBBLESTONE]: defineBlockItem(ITEM.COBBLESTONE, BLOCK.COBBLESTONE),
  [ITEM.OAK_PLANKS]: defineBlockItem(ITEM.OAK_PLANKS, BLOCK.PLANKS),
  [ITEM.GLASS]: defineBlockItem(ITEM.GLASS, BLOCK.GLASS),
  [ITEM.COAL_ORE]: defineBlockItem(ITEM.COAL_ORE, BLOCK.COAL_ORE),
  [ITEM.IRON_ORE]: defineBlockItem(ITEM.IRON_ORE, BLOCK.IRON_ORE),
  [ITEM.CRAFTING_TABLE]: defineBlockItem(ITEM.CRAFTING_TABLE, BLOCK.CRAFTING_TABLE),
  [ITEM.CHEST]: defineBlockItem(ITEM.CHEST, BLOCK.CHEST),
  [ITEM.TORCH]: defineBlockItem(ITEM.TORCH, BLOCK.TORCH, { name: "Torch", iconTile: "torch" }),
  [ITEM.STICK]: defineMaterialItem(ITEM.STICK, "Stick", drawStickIcon),
  [ITEM.IRON_INGOT]: defineMaterialItem(ITEM.IRON_INGOT, "Iron Ingot", drawIngotIcon),
  [ITEM.GOLD_INGOT]: defineMaterialItem(ITEM.GOLD_INGOT, "Gold Ingot", drawGoldIngotIcon),
  [ITEM.DIAMOND]: defineMaterialItem(ITEM.DIAMOND, "Diamond", drawDiamondIcon),
  [ITEM.FEATHER]: defineMaterialItem(ITEM.FEATHER, "Feather", drawFeatherIcon),
  [ITEM.LEATHER]: defineMaterialItem(ITEM.LEATHER, "Leather", drawLeatherIcon),
  [ITEM.RAW_CHICKEN]: defineMaterialItem(ITEM.RAW_CHICKEN, "Raw Chicken", drawRawChickenIcon),
  [ITEM.RAW_PORKCHOP]: defineMaterialItem(ITEM.RAW_PORKCHOP, "Raw Porkchop", drawPorkchopIcon),
  [ITEM.RAW_BEEF]: defineMaterialItem(ITEM.RAW_BEEF, "Raw Beef", drawBeefIcon),
  [ITEM.ROTTEN_FLESH]: defineMaterialItem(ITEM.ROTTEN_FLESH, "Rotten Flesh", drawRottenFleshIcon),
};

for (const [material, materialDef] of Object.entries(TOOL_MATERIALS)) {
  for (const [toolType, shape] of Object.entries(TOOL_SHAPES)) {
    const itemId = getToolItemId(material, toolType);
    defs[itemId] = defineTool(itemId, `${materialDef.label} ${shape.label}`, toolType, material);
  }
}

export const ITEM_TYPES = defs;

export const ITEM_FOR_BLOCK = {
  [BLOCK.GRASS]: ITEM.GRASS_BLOCK,
  [BLOCK.DIRT]: ITEM.DIRT,
  [BLOCK.STONE]: ITEM.STONE,
  [BLOCK.SAND]: ITEM.SAND,
  [BLOCK.OAK_LOG]: ITEM.OAK_LOG,
  [BLOCK.LEAVES]: ITEM.LEAVES,
  [BLOCK.COBBLESTONE]: ITEM.COBBLESTONE,
  [BLOCK.PLANKS]: ITEM.OAK_PLANKS,
  [BLOCK.GLASS]: ITEM.GLASS,
  [BLOCK.COAL_ORE]: ITEM.COAL_ORE,
  [BLOCK.IRON_ORE]: ITEM.IRON_ORE,
  [BLOCK.CRAFTING_TABLE]: ITEM.CRAFTING_TABLE,
  [BLOCK.CHEST]: ITEM.CHEST,
  [BLOCK.TORCH]: ITEM.TORCH,
};

export const LEGACY_ITEM_MIGRATION = {
  [BLOCK.GRASS]: ITEM.GRASS_BLOCK,
  [BLOCK.DIRT]: ITEM.DIRT,
  [BLOCK.STONE]: ITEM.STONE,
  [BLOCK.SAND]: ITEM.SAND,
  [BLOCK.OAK_LOG]: ITEM.OAK_LOG,
  [BLOCK.LEAVES]: ITEM.LEAVES,
  [BLOCK.COBBLESTONE]: ITEM.COBBLESTONE,
  [BLOCK.PLANKS]: ITEM.OAK_PLANKS,
  [BLOCK.GLASS]: ITEM.GLASS,
  [BLOCK.COAL_ORE]: ITEM.COAL_ORE,
  [BLOCK.IRON_ORE]: ITEM.IRON_ORE,
  [BLOCK.CHEST]: ITEM.CHEST,
  [BLOCK.TORCH]: ITEM.TORCH,
};

export const ALL_TOOL_ITEM_IDS = Object.values(defs)
  .filter((def) => def.category === "tool")
  .map((def) => def.id);

export const DEBUG_LOADOUT = [
  ...ALL_TOOL_ITEM_IDS.map((itemId) => createInventoryStack(itemId, 1)),
  createInventoryStack(ITEM.OAK_LOG, 16),
  createInventoryStack(ITEM.STICK, 32),
  createInventoryStack(ITEM.COBBLESTONE, 32),
  createInventoryStack(ITEM.IRON_INGOT, 32),
  createInventoryStack(ITEM.GOLD_INGOT, 32),
  createInventoryStack(ITEM.DIAMOND, 32),
  createInventoryStack(ITEM.CHEST, 4),
  createInventoryStack(ITEM.TORCH, 32),
];

export const STARTER_INVENTORY = [];

const RECIPES = [
  {
    id: "planks",
    station: "inventory",
    shapeless: true,
    inputs: [ITEM.OAK_LOG],
    output: { itemId: ITEM.OAK_PLANKS, count: 4 },
  },
  {
    id: "sticks",
    station: "inventory",
    pattern: [[ITEM.OAK_PLANKS], [ITEM.OAK_PLANKS]],
    output: { itemId: ITEM.STICK, count: 4 },
  },
  {
    id: "crafting_table",
    station: "inventory",
    pattern: [
      [ITEM.OAK_PLANKS, ITEM.OAK_PLANKS],
      [ITEM.OAK_PLANKS, ITEM.OAK_PLANKS],
    ],
    output: { itemId: ITEM.CRAFTING_TABLE, count: 1 },
  },
  {
    id: "torch",
    station: "inventory",
    pattern: [[ITEM.COAL_ORE], [ITEM.STICK]],
    output: { itemId: ITEM.TORCH, count: 4 },
  },
  {
    id: "chest",
    station: "table",
    pattern: [
      [ITEM.OAK_PLANKS, ITEM.OAK_PLANKS, ITEM.OAK_PLANKS],
      [ITEM.OAK_PLANKS, null, ITEM.OAK_PLANKS],
      [ITEM.OAK_PLANKS, ITEM.OAK_PLANKS, ITEM.OAK_PLANKS],
    ],
    output: { itemId: ITEM.CHEST, count: 1 },
  },
];

for (const [material, materialDef] of Object.entries(TOOL_MATERIALS)) {
  for (const [toolType, shape] of Object.entries(TOOL_SHAPES)) {
    const itemId = getToolItemId(material, toolType);
    const recipeBaseId = `${material}_${toolType}`;
    if (shape.pattern) {
      RECIPES.push({
        id: recipeBaseId,
        station: "table",
        pattern: shape.pattern(materialDef.ingredient),
        output: { itemId, count: 1 },
      });
      continue;
    }
    for (const variant of shape.patterns(materialDef.ingredient)) {
      RECIPES.push({
        id: `${recipeBaseId}_${variant.suffix}`,
        station: "table",
        pattern: variant.pattern,
        output: { itemId, count: 1 },
      });
    }
  }
}

export { RECIPES };

function paintRect(ctx, color, x, y, width, height) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, height);
}

function drawStickIcon(ctx) {
  paintRect(ctx, "#9f7644", 6, 2, 2, 12);
  paintRect(ctx, "#c4975a", 7, 2, 1, 12);
}

function drawIngotIcon(ctx) {
  paintRect(ctx, "#f2ede4", 3, 5, 10, 5);
  paintRect(ctx, "#c1b8ac", 4, 6, 8, 3);
  paintRect(ctx, "#ffffff", 5, 5, 4, 1);
}

function drawGoldIngotIcon(ctx) {
  paintRect(ctx, "#f6d66d", 3, 5, 10, 5);
  paintRect(ctx, "#ce9f28", 4, 6, 8, 3);
  paintRect(ctx, "#fff1a4", 5, 5, 4, 1);
}

function drawDiamondIcon(ctx) {
  paintRect(ctx, "#5fdadd", 5, 2, 6, 2);
  paintRect(ctx, "#4bc3cb", 4, 4, 8, 2);
  paintRect(ctx, "#3ea3af", 3, 6, 10, 4);
  paintRect(ctx, "#c0ffff", 7, 4, 2, 4);
}

function drawFeatherIcon(ctx) {
  paintRect(ctx, "#f5f7f7", 5, 2, 5, 10);
  paintRect(ctx, "#d6dde0", 6, 3, 3, 8);
  paintRect(ctx, "#8f7644", 7, 11, 1, 3);
}

function drawLeatherIcon(ctx) {
  paintRect(ctx, "#94603a", 3, 4, 10, 8);
  paintRect(ctx, "#b98358", 4, 5, 8, 6);
}

function drawRawChickenIcon(ctx) {
  paintRect(ctx, "#f1c8b0", 4, 4, 8, 8);
  paintRect(ctx, "#ffefef", 5, 5, 6, 5);
  paintRect(ctx, "#d9b17a", 10, 9, 3, 3);
}

function drawPorkchopIcon(ctx) {
  paintRect(ctx, "#ef9b9d", 3, 4, 10, 8);
  paintRect(ctx, "#ffc8c8", 5, 5, 6, 6);
}

function drawBeefIcon(ctx) {
  paintRect(ctx, "#9f463c", 3, 4, 10, 8);
  paintRect(ctx, "#dc8278", 5, 5, 6, 5);
}

function drawRottenFleshIcon(ctx) {
  paintRect(ctx, "#8e6b65", 3, 4, 10, 8);
  paintRect(ctx, "#617f58", 6, 5, 5, 5);
}

function drawToolHandle(ctx) {
  drawStickIcon(ctx);
}

function getToolPalette(material) {
  return TOOL_MATERIALS[material]?.palette ?? TOOL_MATERIALS.wood.palette;
}

function drawPickaxeIcon(ctx, material) {
  const palette = getToolPalette(material);
  drawToolHandle(ctx);
  paintRect(ctx, palette.base, 2, 2, 12, 3);
  paintRect(ctx, palette.shade, 2, 5, 3, 1);
  paintRect(ctx, palette.shade, 11, 5, 3, 1);
  paintRect(ctx, palette.accent, 4, 2, 5, 1);
}

function drawAxeIcon(ctx, material) {
  const palette = getToolPalette(material);
  drawToolHandle(ctx);
  paintRect(ctx, palette.base, 3, 2, 6, 5);
  paintRect(ctx, palette.shade, 8, 3, 3, 4);
  paintRect(ctx, palette.accent, 4, 2, 3, 1);
}

function drawShovelIcon(ctx, material) {
  const palette = getToolPalette(material);
  drawToolHandle(ctx);
  paintRect(ctx, palette.base, 5, 1, 4, 5);
  paintRect(ctx, palette.accent, 6, 1, 2, 2);
}

function drawHoeIcon(ctx, material) {
  const palette = getToolPalette(material);
  drawToolHandle(ctx);
  paintRect(ctx, palette.base, 3, 2, 7, 3);
  paintRect(ctx, palette.shade, 8, 4, 2, 4);
}

function drawSwordIcon(ctx, material) {
  const palette = getToolPalette(material);
  paintRect(ctx, palette.base, 6, 1, 4, 7);
  paintRect(ctx, palette.accent, 7, 2, 2, 4);
  paintRect(ctx, "#9f7644", 4, 8, 8, 2);
  paintRect(ctx, "#c4975a", 6, 10, 2, 5);
}

function createCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 16;
  return canvas;
}

const iconCache = new Map();
const textureCache = new Map();
const dataUrlCache = new Map();

export function getItemDefinition(itemId) {
  return defs[itemId] ?? null;
}

export function isToolItem(itemId) {
  return getItemDefinition(itemId)?.category === "tool";
}

export function isPlaceableItem(itemId) {
  return Number.isInteger(getItemDefinition(itemId)?.placeableBlockId);
}

export function getItemName(itemId) {
  return getItemDefinition(itemId)?.name ?? "Unknown";
}

export function getDropItemForBlock(blockId) {
  if (blockId === BLOCK.STONE) {
    return ITEM.COBBLESTONE;
  }
  return ITEM_FOR_BLOCK[blockId] ?? null;
}

export function createInventoryStack(itemId, count = 1, durability = null) {
  const def = getItemDefinition(itemId);
  if (!def) {
    return null;
  }
  return {
    itemId,
    count,
    durability: def.category === "tool" ? (durability ?? def.durability) : null,
  };
}

export function cloneStack(stack) {
  return stack ? { ...stack } : null;
}

export function getMaxStackSize(itemId) {
  return getItemDefinition(itemId)?.stackSize ?? 64;
}

export function canStacksMerge(a, b) {
  return !!a && !!b && a.itemId === b.itemId && a.durability === b.durability && getMaxStackSize(a.itemId) > 1;
}

function drawBlockIcon(ctx, atlas, itemId) {
  const def = getItemDefinition(itemId);
  const tileName = def?.iconTile ?? "placeholder";
  const tile = atlas.layout[tileName] ?? atlas.layout.placeholder;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(atlas.canvas, tile.x * atlas.tileSize, tile.y * atlas.tileSize, atlas.tileSize, atlas.tileSize, 0, 0, 16, 16);
}

export function getItemIconCanvas(itemId, atlas) {
  if (iconCache.has(itemId)) {
    return iconCache.get(itemId);
  }
  const canvas = createCanvas();
  const ctx = canvas.getContext("2d");
  const def = getItemDefinition(itemId);
  if (def?.category === "block") {
    drawBlockIcon(ctx, atlas, itemId);
  } else if (def?.iconPainter) {
    def.iconPainter(ctx, def.material);
  }
  iconCache.set(itemId, canvas);
  return canvas;
}

export function getItemIconDataUrl(itemId, atlas) {
  if (!dataUrlCache.has(itemId)) {
    dataUrlCache.set(itemId, getItemIconCanvas(itemId, atlas).toDataURL("image/png"));
  }
  return dataUrlCache.get(itemId);
}

export function getItemTexture(itemId, atlas) {
  if (textureCache.has(itemId)) {
    return textureCache.get(itemId);
  }
  const texture = new THREE.CanvasTexture(getItemIconCanvas(itemId, atlas));
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(itemId, texture);
  return texture;
}

export function getRecipeForGrid(grid, station) {
  const occupied = [];
  const width = station === "table" ? 3 : 2;
  const height = width;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const stack = grid[y * width + x];
      if (stack?.itemId) {
        occupied.push({ x, y, itemId: stack.itemId });
      }
    }
  }

  if (occupied.length === 0) {
    return null;
  }

  const minX = Math.min(...occupied.map((entry) => entry.x));
  const maxX = Math.max(...occupied.map((entry) => entry.x));
  const minY = Math.min(...occupied.map((entry) => entry.y));
  const maxY = Math.max(...occupied.map((entry) => entry.y));
  const normalized = [];
  for (let y = minY; y <= maxY; y += 1) {
    const row = [];
    for (let x = minX; x <= maxX; x += 1) {
      row.push(grid[y * width + x]?.itemId ?? null);
    }
    normalized.push(row);
  }

  for (const recipe of RECIPES) {
    if (recipe.station !== station) {
      continue;
    }
    if (recipe.shapeless) {
      const recipeItems = [...recipe.inputs].sort();
      const gridItems = occupied.map((entry) => entry.itemId).sort();
      if (recipeItems.length === gridItems.length && recipeItems.every((itemId, index) => itemId === gridItems[index])) {
        return recipe;
      }
      continue;
    }

    if (recipe.pattern.length !== normalized.length) {
      continue;
    }
    let matches = true;
    for (let y = 0; y < recipe.pattern.length; y += 1) {
      const recipeRow = recipe.pattern[y];
      const gridRow = normalized[y];
      if (recipeRow.length !== gridRow.length) {
        matches = false;
        break;
      }
      for (let x = 0; x < recipeRow.length; x += 1) {
        if ((recipeRow[x] ?? null) !== (gridRow[x] ?? null)) {
          matches = false;
          break;
        }
      }
      if (!matches) {
        break;
      }
    }
    if (matches) {
      return recipe;
    }
  }

  return null;
}

export function getToolMiningSpeed(tool, preferredTool) {
  if (!tool || tool.category !== "tool" || tool.toolType !== preferredTool) {
    return 1;
  }
  return tool.miningSpeed ?? 1;
}



