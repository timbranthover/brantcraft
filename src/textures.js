import * as THREE from "three";

const TILE_SIZE = 16;
const GRID_SIZE = 5;
const TILE_NAMES = [
  "grassTop",
  "grassSide",
  "dirt",
  "stone",
  "sand",
  "water",
  "logTop",
  "logSide",
  "leaves",
  "cobble",
  "planks",
  "glass",
  "coalOre",
  "ironOre",
  "bedrock",
  "craftingTop",
  "craftingSide",
  "craftingFront",
  "chestTop",
  "chestSide",
  "chestFront",
  "torch",
  "terminalFrame",
  "placeholder",
];

const layout = Object.fromEntries(
  TILE_NAMES.map((name, index) => [
    name,
    { x: index % GRID_SIZE, y: Math.floor(index / GRID_SIZE) },
  ]),
);

const fract = (value) => value - Math.floor(value);

function noise2(x, y, seed) {
  return fract(Math.sin(x * 127.1 + y * 311.7 + seed * 21.13) * 43758.5453123);
}

function fill(ctx, color) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
}

function setPixel(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

function drawNoiseTile(ctx, palette, seed, stripe = false) {
  for (let y = 0; y < TILE_SIZE; y += 1) {
    for (let x = 0; x < TILE_SIZE; x += 1) {
      const value = noise2(x, y, seed + (stripe ? x * 3.1 : 0));
      const index = Math.min(palette.length - 1, Math.floor(value * palette.length));
      setPixel(ctx, x, y, palette[index]);
    }
  }
}

function drawGrassTop(ctx) {
  drawNoiseTile(ctx, ["#2c7c31", "#35913b", "#44a947", "#6bbb51"], 3.1);
  for (let y = 10; y < TILE_SIZE; y += 1) {
    for (let x = 0; x < TILE_SIZE; x += 1) {
      if ((x + y) % 5 === 0) {
        setPixel(ctx, x, y, "#7fcc5f");
      }
    }
  }
}

function drawGrassSide(ctx) {
  drawNoiseTile(ctx, ["#5e4024", "#744c29", "#855735", "#94623b"], 4.9);
  for (let y = 0; y < 4; y += 1) {
    for (let x = 0; x < TILE_SIZE; x += 1) {
      const tone = y < 2 ? "#4baa4a" : "#3a8f39";
      setPixel(ctx, x, y, tone);
      if (x % 3 === 0 && y === 3) {
        setPixel(ctx, x, y, "#65c454");
      }
    }
  }
}

function drawSand(ctx) {
  drawNoiseTile(ctx, ["#ccb86c", "#d6c57b", "#dece8d", "#ebd99a"], 8.2);
}

function drawWater(ctx) {
  fill(ctx, "rgba(0, 0, 0, 0)");
  for (let y = 0; y < TILE_SIZE; y += 1) {
    for (let x = 0; x < TILE_SIZE; x += 1) {
      const wave = Math.sin((x + y * 0.7) * 0.7) * 0.08 + noise2(x, y, 12.3) * 0.2;
      const light = Math.max(0, Math.min(1, 0.5 + wave));
      const color = light > 0.58 ? "rgba(91, 153, 224, 0.86)" : "rgba(48, 104, 196, 0.82)";
      setPixel(ctx, x, y, color);
    }
  }
}

function drawLogTop(ctx) {
  drawNoiseTile(ctx, ["#8d6e43", "#9e7a49", "#af8957"], 14.7);
  for (let ring = 0; ring < 4; ring += 1) {
    const inset = ring * 2;
    ctx.strokeStyle = ["#684726", "#755330", "#86623b", "#9d744b"][ring];
    ctx.lineWidth = 1;
    ctx.strokeRect(inset + 0.5, inset + 0.5, TILE_SIZE - inset * 2 - 1, TILE_SIZE - inset * 2 - 1);
  }
}

function drawLogSide(ctx) {
  drawNoiseTile(ctx, ["#694726", "#75502a", "#846036", "#5d3d1d"], 18.3, true);
  for (let x = 2; x < TILE_SIZE; x += 4) {
    ctx.fillStyle = "rgba(33, 22, 10, 0.25)";
    ctx.fillRect(x, 0, 1, TILE_SIZE);
  }
}

function drawLeaves(ctx) {
  fill(ctx, "rgba(0, 0, 0, 0)");
  for (let y = 0; y < TILE_SIZE; y += 1) {
    for (let x = 0; x < TILE_SIZE; x += 1) {
      const value = noise2(x, y, 24.7);
      if (value > 0.18 || (x + y) % 5 === 0) {
        const color = value > 0.7 ? "rgba(95, 173, 81, 0.95)" : "rgba(60, 132, 56, 0.92)";
        setPixel(ctx, x, y, color);
      }
    }
  }
}

function drawCobble(ctx) {
  drawNoiseTile(ctx, ["#62676d", "#767b81", "#85898f"], 28.2);
  ctx.strokeStyle = "rgba(44, 47, 52, 0.6)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 5.5);
  ctx.lineTo(TILE_SIZE, 4.5);
  ctx.moveTo(0, 11.5);
  ctx.lineTo(TILE_SIZE, 10.5);
  ctx.moveTo(5.5, 0);
  ctx.lineTo(4.5, TILE_SIZE);
  ctx.moveTo(11.5, 0);
  ctx.lineTo(10.5, TILE_SIZE);
  ctx.stroke();
}

function drawPlanks(ctx) {
  drawNoiseTile(ctx, ["#b07c44", "#c18a4d", "#d49959"], 32.7, true);
  ctx.fillStyle = "rgba(89, 59, 28, 0.35)";
  for (let y = 3; y < TILE_SIZE; y += 4) {
    ctx.fillRect(0, y, TILE_SIZE, 1);
  }
}

function drawGlass(ctx) {
  fill(ctx, "rgba(0, 0, 0, 0)");
  ctx.strokeStyle = "rgba(220, 244, 255, 0.9)";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
  ctx.strokeStyle = "rgba(220, 244, 255, 0.55)";
  ctx.beginPath();
  ctx.moveTo(4.5, 0.5);
  ctx.lineTo(11.5, TILE_SIZE - 0.5);
  ctx.moveTo(0.5, 9.5);
  ctx.lineTo(6.5, 3.5);
  ctx.stroke();
  for (let x = 0; x < TILE_SIZE; x += 1) {
    if (x % 4 === 0) {
      setPixel(ctx, x, 2, "rgba(255, 255, 255, 0.5)");
    }
  }
}

function drawOre(ctx, sparkle) {
  drawNoiseTile(ctx, ["#6c7075", "#7f8489", "#909499"], 37.9);
  for (let y = 0; y < TILE_SIZE; y += 1) {
    for (let x = 0; x < TILE_SIZE; x += 1) {
      if (noise2(x, y, 44.1) > 0.78) {
        setPixel(ctx, x, y, sparkle);
      }
    }
  }
}

function drawBedrock(ctx) {
  drawNoiseTile(ctx, ["#2b2b2c", "#3a3a3b", "#4a4a4d", "#1f1f20"], 47.5);
}

function drawCraftingTop(ctx) {
  drawNoiseTile(ctx, ["#9d7447", "#ad8252", "#bf9462"], 52.7);
  ctx.strokeStyle = "rgba(61, 35, 15, 0.7)";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
  ctx.beginPath();
  ctx.moveTo(5.5, 0);
  ctx.lineTo(5.5, TILE_SIZE);
  ctx.moveTo(10.5, 0);
  ctx.lineTo(10.5, TILE_SIZE);
  ctx.moveTo(0, 5.5);
  ctx.lineTo(TILE_SIZE, 5.5);
  ctx.moveTo(0, 10.5);
  ctx.lineTo(TILE_SIZE, 10.5);
  ctx.stroke();
}

function drawCraftingSide(ctx) {
  drawNoiseTile(ctx, ["#74532d", "#86623a", "#996f43"], 56.2, true);
  ctx.fillStyle = "rgba(214, 187, 129, 0.55)";
  ctx.fillRect(2, 3, 12, 10);
  ctx.fillStyle = "rgba(86, 49, 24, 0.7)";
  ctx.fillRect(4, 5, 8, 6);
}

function drawCraftingFront(ctx) {
  drawNoiseTile(ctx, ["#765630", "#8b6640", "#a1784c"], 58.4, true);
  ctx.fillStyle = "#d4b982";
  ctx.fillRect(2, 2, 5, 5);
  ctx.fillRect(9, 2, 5, 5);
  ctx.fillRect(2, 9, 12, 5);
  ctx.fillStyle = "#5b3719";
  ctx.fillRect(3, 3, 3, 3);
  ctx.fillRect(10, 3, 3, 3);
  ctx.fillRect(4, 10, 8, 3);
}

function drawChestTop(ctx) {
  drawNoiseTile(ctx, ["#98663b", "#a97442", "#c0894e"], 60.9, true);
  ctx.fillStyle = "rgba(82, 46, 21, 0.7)";
  ctx.fillRect(0, 7, TILE_SIZE, 2);
  ctx.fillRect(2, 2, 12, 2);
}

function drawChestSide(ctx) {
  drawNoiseTile(ctx, ["#7e532f", "#8f6037", "#a56f42"], 63.1, true);
  ctx.fillStyle = "rgba(62, 36, 15, 0.68)";
  ctx.fillRect(0, 4, TILE_SIZE, 1);
  ctx.fillRect(0, 11, TILE_SIZE, 1);
  ctx.fillStyle = "rgba(202, 162, 90, 0.48)";
  ctx.fillRect(1, 5, 14, 6);
}

function drawChestFront(ctx) {
  drawChestSide(ctx);
  ctx.fillStyle = "#d8bf6f";
  ctx.fillRect(7, 6, 2, 4);
  ctx.fillStyle = "#5d4218";
  ctx.fillRect(7, 7, 2, 2);
}

function drawTorch(ctx) {
  fill(ctx, "rgba(0,0,0,0)");
  ctx.fillStyle = "#8f6432";
  ctx.fillRect(7, 5, 2, 9);
  ctx.fillStyle = "#ffb247";
  ctx.fillRect(5, 1, 6, 6);
  ctx.fillStyle = "#ffd98c";
  ctx.fillRect(6, 2, 4, 3);
}

function drawTerminalFrame(ctx) {
  fill(ctx, "#0c130e");
  ctx.strokeStyle = "#86d089";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
  ctx.fillStyle = "rgba(134, 208, 137, 0.22)";
  for (let y = 2; y < TILE_SIZE; y += 3) {
    ctx.fillRect(2, y, TILE_SIZE - 4, 1);
  }
}

const painters = {
  grassTop: drawGrassTop,
  grassSide: drawGrassSide,
  dirt: (ctx) => drawNoiseTile(ctx, ["#5a3d23", "#6d4928", "#7e5631", "#94633d"], 5.4),
  stone: (ctx) => drawNoiseTile(ctx, ["#666c73", "#757b82", "#838992"], 6.9),
  sand: drawSand,
  water: drawWater,
  logTop: drawLogTop,
  logSide: drawLogSide,
  leaves: drawLeaves,
  cobble: drawCobble,
  planks: drawPlanks,
  glass: drawGlass,
  coalOre: (ctx) => drawOre(ctx, "#202225"),
  ironOre: (ctx) => drawOre(ctx, "#b68e6d"),
  bedrock: drawBedrock,
  craftingTop: drawCraftingTop,
  craftingSide: drawCraftingSide,
  craftingFront: drawCraftingFront,
  chestTop: drawChestTop,
  chestSide: drawChestSide,
  chestFront: drawChestFront,
  torch: drawTorch,
  terminalFrame: drawTerminalFrame,
  placeholder: (ctx) => {
    fill(ctx, "#ff00ff");
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, TILE_SIZE / 2, TILE_SIZE / 2);
    ctx.fillRect(TILE_SIZE / 2, TILE_SIZE / 2, TILE_SIZE / 2, TILE_SIZE / 2);
  },
};

export function createAtlasTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = GRID_SIZE * TILE_SIZE;
  canvas.height = Math.ceil(TILE_NAMES.length / GRID_SIZE) * TILE_SIZE;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  for (const tileName of TILE_NAMES) {
    const tile = layout[tileName];
    ctx.save();
    ctx.translate(tile.x * TILE_SIZE, tile.y * TILE_SIZE);
    painters[tileName](ctx);
    ctx.restore();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipMapNearestFilter;
  texture.generateMipmaps = true;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return { texture, canvas, tileSize: TILE_SIZE, gridSize: GRID_SIZE, layout };
}

export function getTileUV(tileName) {
  const tile = layout[tileName] ?? layout.placeholder;
  const rows = Math.ceil(TILE_NAMES.length / GRID_SIZE);
  const u0 = tile.x / GRID_SIZE;
  const v0 = 1 - (tile.y + 1) / rows;
  const u1 = (tile.x + 1) / GRID_SIZE;
  const v1 = 1 - tile.y / rows;
  const inset = 0.0015;
  return [
    [u0 + inset, v0 + inset],
    [u1 - inset, v0 + inset],
    [u1 - inset, v1 - inset],
    [u0 + inset, v1 - inset],
  ];
}
