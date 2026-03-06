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
  STICK: "stick",
  WOODEN_PICKAXE: "wooden_pickaxe",
  WOODEN_AXE: "wooden_axe",
  WOODEN_SHOVEL: "wooden_shovel",
  STONE_PICKAXE: "stone_pickaxe",
  STONE_AXE: "stone_axe",
  STONE_SHOVEL: "stone_shovel",
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
  [ITEM.STICK]: {
    id: ITEM.STICK,
    name: "Stick",
    category: "material",
    stackSize: 64,
    iconPainter: drawStickIcon,
  },
  [ITEM.WOODEN_PICKAXE]: defineTool(ITEM.WOODEN_PICKAXE, "Wooden Pickaxe", "pickaxe", "wood", 59, drawPickaxeIcon),
  [ITEM.WOODEN_AXE]: defineTool(ITEM.WOODEN_AXE, "Wooden Axe", "axe", "wood", 59, drawAxeIcon),
  [ITEM.WOODEN_SHOVEL]: defineTool(ITEM.WOODEN_SHOVEL, "Wooden Shovel", "shovel", "wood", 59, drawShovelIcon),
  [ITEM.STONE_PICKAXE]: defineTool(ITEM.STONE_PICKAXE, "Stone Pickaxe", "pickaxe", "stone", 131, drawPickaxeIcon),
  [ITEM.STONE_AXE]: defineTool(ITEM.STONE_AXE, "Stone Axe", "axe", "stone", 131, drawAxeIcon),
  [ITEM.STONE_SHOVEL]: defineTool(ITEM.STONE_SHOVEL, "Stone Shovel", "shovel", "stone", 131, drawShovelIcon),
};

function defineTool(id, name, toolType, material, durability, iconPainter) {
  return {
    id,
    name,
    category: "tool",
    stackSize: 1,
    toolType,
    material,
    toolLevel: material === "stone" ? 1 : 0,
    durability,
    iconPainter,
  };
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
};

export const STARTER_INVENTORY = [];

export const RECIPES = [
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
    id: "wooden_pickaxe",
    station: "table",
    pattern: [
      [ITEM.OAK_PLANKS, ITEM.OAK_PLANKS, ITEM.OAK_PLANKS],
      [null, ITEM.STICK, null],
      [null, ITEM.STICK, null],
    ],
    output: { itemId: ITEM.WOODEN_PICKAXE, count: 1 },
  },
  {
    id: "wooden_axe_right",
    station: "table",
    pattern: [
      [ITEM.OAK_PLANKS, ITEM.OAK_PLANKS],
      [ITEM.OAK_PLANKS, ITEM.STICK],
      [null, ITEM.STICK],
    ],
    output: { itemId: ITEM.WOODEN_AXE, count: 1 },
  },
  {
    id: "wooden_axe_left",
    station: "table",
    pattern: [
      [ITEM.OAK_PLANKS, ITEM.OAK_PLANKS],
      [ITEM.STICK, ITEM.OAK_PLANKS],
      [ITEM.STICK, null],
    ],
    output: { itemId: ITEM.WOODEN_AXE, count: 1 },
  },
  {
    id: "wooden_shovel",
    station: "table",
    pattern: [
      [ITEM.OAK_PLANKS],
      [ITEM.STICK],
      [ITEM.STICK],
    ],
    output: { itemId: ITEM.WOODEN_SHOVEL, count: 1 },
  },
  {
    id: "stone_pickaxe",
    station: "table",
    pattern: [
      [ITEM.COBBLESTONE, ITEM.COBBLESTONE, ITEM.COBBLESTONE],
      [null, ITEM.STICK, null],
      [null, ITEM.STICK, null],
    ],
    output: { itemId: ITEM.STONE_PICKAXE, count: 1 },
  },
  {
    id: "stone_axe_right",
    station: "table",
    pattern: [
      [ITEM.COBBLESTONE, ITEM.COBBLESTONE],
      [ITEM.COBBLESTONE, ITEM.STICK],
      [null, ITEM.STICK],
    ],
    output: { itemId: ITEM.STONE_AXE, count: 1 },
  },
  {
    id: "stone_axe_left",
    station: "table",
    pattern: [
      [ITEM.COBBLESTONE, ITEM.COBBLESTONE],
      [ITEM.STICK, ITEM.COBBLESTONE],
      [ITEM.STICK, null],
    ],
    output: { itemId: ITEM.STONE_AXE, count: 1 },
  },
  {
    id: "stone_shovel",
    station: "table",
    pattern: [
      [ITEM.COBBLESTONE],
      [ITEM.STICK],
      [ITEM.STICK],
    ],
    output: { itemId: ITEM.STONE_SHOVEL, count: 1 },
  },
];

function drawStickIcon(ctx) {
  ctx.fillStyle = "rgba(0,0,0,0)";
  ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = "#9f7644";
  ctx.fillRect(6, 2, 2, 12);
  ctx.fillStyle = "#c4975a";
  ctx.fillRect(7, 2, 1, 12);
}

function drawPickaxeIcon(ctx, material) {
  const head = material === "stone" ? "#95a0a8" : "#b98951";
  const shade = material === "stone" ? "#717983" : "#8a6336";
  drawStickIcon(ctx);
  ctx.fillStyle = head;
  ctx.fillRect(2, 2, 12, 3);
  ctx.fillStyle = shade;
  ctx.fillRect(2, 5, 3, 1);
  ctx.fillRect(11, 5, 3, 1);
}

function drawAxeIcon(ctx, material) {
  const head = material === "stone" ? "#95a0a8" : "#b98951";
  const shade = material === "stone" ? "#717983" : "#8a6336";
  drawStickIcon(ctx);
  ctx.fillStyle = head;
  ctx.fillRect(3, 2, 6, 5);
  ctx.fillStyle = shade;
  ctx.fillRect(8, 3, 3, 4);
}

function drawShovelIcon(ctx, material) {
  const head = material === "stone" ? "#95a0a8" : "#b98951";
  drawStickIcon(ctx);
  ctx.fillStyle = head;
  ctx.fillRect(5, 1, 4, 5);
}

function createCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 16;
  return canvas;
}

const iconCache = new Map();
const textureCache = new Map();

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
  const cacheKey = `${itemId}`;
  if (iconCache.has(cacheKey)) {
    return iconCache.get(cacheKey);
  }
  const canvas = createCanvas();
  const ctx = canvas.getContext("2d");
  const def = getItemDefinition(itemId);
  if (!def) {
    iconCache.set(cacheKey, canvas);
    return canvas;
  }
  if (def.category === "block") {
    drawBlockIcon(ctx, atlas, itemId);
  } else if (def.iconPainter) {
    def.iconPainter(ctx, def.material);
  }
  iconCache.set(cacheKey, canvas);
  return canvas;
}

export function getItemIconDataUrl(itemId, atlas) {
  return getItemIconCanvas(itemId, atlas).toDataURL("image/png");
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
  if (tool.material === "stone") {
    return 4;
  }
  return 2;
}
