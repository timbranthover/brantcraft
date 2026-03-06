import * as THREE from "three";

import {
  CHUNK_SIZE,
  WATER_LEVEL,
  WORLD_CHUNKS_X,
  WORLD_CHUNKS_Z,
  WORLD_DEPTH,
  WORLD_HEIGHT,
  WORLD_MAX_X,
  WORLD_MAX_Z,
  WORLD_MIN_X,
  WORLD_MIN_Z,
  WORLD_WIDTH,
} from "./constants.js";
import { BLOCK, BLOCK_TYPES, getBlockDefinition, getFaceTexture } from "./blocks.js";
import { createNoise, hash2D, hash3D } from "./noise.js";
import { getTileUV } from "./textures.js";

const FACE_DEFS = [
  {
    name: "right",
    dir: [1, 0, 0],
    corners: [
      [1, 0, 1],
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
    ],
    shade: 0.82,
  },
  {
    name: "left",
    dir: [-1, 0, 0],
    corners: [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
    ],
    shade: 0.72,
  },
  {
    name: "top",
    dir: [0, 1, 0],
    corners: [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0],
    ],
    shade: 1,
  },
  {
    name: "bottom",
    dir: [0, -1, 0],
    corners: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
    shade: 0.55,
  },
  {
    name: "front",
    dir: [0, 0, 1],
    corners: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ],
    shade: 0.9,
  },
  {
    name: "back",
    dir: [0, 0, -1],
    corners: [
      [1, 0, 0],
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
    ],
    shade: 0.78,
  },
];

function makeBuilder() {
  return {
    positions: [],
    normals: [],
    uvs: [],
    colors: [],
    indices: [],
    cursor: 0,
  };
}

function pushFace(builder, x, y, z, face, blockId) {
  const uv = getTileUV(getFaceTexture(blockId, face.name));
  const tint = getBlockDefinition(blockId).tint;
  const red = ((tint >> 16) & 255) / 255;
  const green = ((tint >> 8) & 255) / 255;
  const blue = (tint & 255) / 255;

  for (let index = 0; index < 4; index += 1) {
    const vertex = face.corners[index];
    builder.positions.push(x + vertex[0], y + vertex[1], z + vertex[2]);
    builder.normals.push(face.dir[0], face.dir[1], face.dir[2]);
    builder.uvs.push(uv[index][0], uv[index][1]);
    builder.colors.push(red * face.shade, green * face.shade, blue * face.shade);
  }

  builder.indices.push(
    builder.cursor,
    builder.cursor + 1,
    builder.cursor + 2,
    builder.cursor,
    builder.cursor + 2,
    builder.cursor + 3,
  );
  builder.cursor += 4;
}

function builderToGeometry(builder) {
  if (builder.indices.length === 0) {
    return null;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(builder.positions, 3),
  );
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(builder.normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(builder.uvs, 2));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(builder.colors, 3));
  geometry.setIndex(builder.indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function shouldRenderFace(blockId, neighborId) {
  if (neighborId === BLOCK.AIR) {
    return true;
  }

  const block = getBlockDefinition(blockId);
  const neighbor = getBlockDefinition(neighborId);

  if (block.renderLayer === "transparent") {
    return neighborId !== blockId;
  }

  if (block.renderLayer === "cutout") {
    return neighborId !== blockId && neighbor.renderLayer !== "opaque";
  }

  return !neighbor.solid || neighbor.renderLayer !== "opaque";
}

function chunkKey(chunkX, chunkZ) {
  return `${chunkX},${chunkZ}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export class VoxelWorld {
  constructor({ scene, materials, seed, savedChanges = null, onWorldMutated = null }) {
    this.scene = scene;
    this.materials = materials;
    this.seed = seed;
    this.onWorldMutated = onWorldMutated;
    this.noise = createNoise(seed);
    this.group = new THREE.Group();
    this.group.name = "voxel-world";
    this.scene.add(this.group);

    this.data = new Uint8Array(WORLD_WIDTH * WORLD_HEIGHT * WORLD_DEPTH);
    this.baseData = null;
    this.columnHeights = new Int16Array(WORLD_WIDTH * WORLD_DEPTH);
    this.chunkMeshes = new Map();
    this.modifications = new Map();
    this.surpriseChests = [];

    this.generateTerrain();
    this.baseData = this.data.slice();
    if (savedChanges) {
      this.applyChanges(savedChanges);
    }
    this.rebuildAllChunks();
  }

  get width() {
    return WORLD_WIDTH;
  }

  get depth() {
    return WORLD_DEPTH;
  }

  getIndex(x, y, z) {
    return ((x - WORLD_MIN_X) * WORLD_DEPTH + (z - WORLD_MIN_Z)) * WORLD_HEIGHT + y;
  }

  getColumnIndex(x, z) {
    return (x - WORLD_MIN_X) * WORLD_DEPTH + (z - WORLD_MIN_Z);
  }

  isInside(x, y, z) {
    return (
      x >= WORLD_MIN_X
      && x <= WORLD_MAX_X
      && z >= WORLD_MIN_Z
      && z <= WORLD_MAX_Z
      && y >= 0
      && y < WORLD_HEIGHT
    );
  }

  getBlock(x, y, z) {
    if (!this.isInside(x, y, z)) {
      return BLOCK.AIR;
    }
    return this.data[this.getIndex(x, y, z)];
  }

  setBaseBlock(x, y, z, blockId) {
    if (!this.isInside(x, y, z)) {
      return;
    }
    this.data[this.getIndex(x, y, z)] = blockId;
  }

  setBlock(x, y, z, blockId, track = true) {
    if (!this.isInside(x, y, z)) {
      return false;
    }

    const index = this.getIndex(x, y, z);
    if (this.data[index] === blockId) {
      return false;
    }

    this.data[index] = blockId;

    if (track && this.baseData) {
      const key = `${x},${y},${z}`;
      if (this.baseData[index] === blockId) {
        this.modifications.delete(key);
      } else {
        this.modifications.set(key, blockId);
      }
      if (this.onWorldMutated) {
        this.onWorldMutated();
      }
    }

    this.rebuildChunkAt(x, z);
    if (x % CHUNK_SIZE === 0) {
      this.rebuildChunkAt(x - 1, z);
    }
    if (x % CHUNK_SIZE === CHUNK_SIZE - 1) {
      this.rebuildChunkAt(x + 1, z);
    }
    if (z % CHUNK_SIZE === 0) {
      this.rebuildChunkAt(x, z - 1);
    }
    if (z % CHUNK_SIZE === CHUNK_SIZE - 1) {
      this.rebuildChunkAt(x, z + 1);
    }
    return true;
  }

  generateTerrain() {
    for (let worldX = WORLD_MIN_X; worldX <= WORLD_MAX_X; worldX += 1) {
      for (let worldZ = WORLD_MIN_Z; worldZ <= WORLD_MAX_Z; worldZ += 1) {
        const climate = this.sampleClimate(worldX, worldZ);
        const height = this.sampleHeight(worldX, worldZ, climate);
        this.columnHeights[this.getColumnIndex(worldX, worldZ)] = height;

        for (let y = 0; y < WORLD_HEIGHT; y += 1) {
          let blockId = BLOCK.AIR;

          if (y === 0) {
            blockId = BLOCK.BEDROCK;
          } else if (y <= height) {
            blockId = this.pickTerrainBlock(worldX, y, worldZ, height, climate);
          } else if (y <= WATER_LEVEL) {
            blockId = BLOCK.WATER;
          }

          this.setBaseBlock(worldX, y, worldZ, blockId);
        }
      }
    }

    for (let worldX = WORLD_MIN_X; worldX <= WORLD_MAX_X; worldX += 1) {
      for (let worldZ = WORLD_MIN_Z; worldZ <= WORLD_MAX_Z; worldZ += 1) {
        const height = this.getSurfaceHeight(worldX, worldZ);
        const topBlock = this.getBlock(worldX, height, worldZ);
        const climate = this.sampleClimate(worldX, worldZ);
        const treeChance = climate.biome === "forest" ? 0.84 : climate.biome === "plains" ? 0.94 : 1;
        const treeSeed = hash2D(worldX * 0.71, worldZ * 0.37, this.seed + 77);
        if (topBlock === BLOCK.GRASS && height > WATER_LEVEL + 1 && treeSeed > treeChance) {
          this.spawnTree(worldX, height + 1, worldZ);
        }
      }
    }

    this.placeSurpriseChests();
  }

  sampleClimate(x, z) {
    const macro = this.noise.fbm2((x + 400) * 0.008, (z - 200) * 0.008, 5, 2, 0.52);
    const temperature = this.noise.fbm2((x - 700) * 0.005, (z + 80) * 0.005, 3, 2, 0.5);
    const moisture = this.noise.fbm2((x + 120) * 0.005, (z + 600) * 0.005, 3, 2, 0.5);
    let biome = "plains";

    if (temperature > 0.62 && moisture < 0.42) {
      biome = "desert";
    } else if (moisture > 0.62) {
      biome = "forest";
    }

    if (macro > 0.7) {
      biome = "highlands";
    }

    return {
      macro,
      temperature,
      moisture,
      biome,
    };
  }

  sampleHeight(x, z, climate) {
    const continental = climate.macro;
    const detail = this.noise.fbm2(x * 0.03, z * 0.03, 3, 2, 0.5);
    const ridged = 1 - Math.abs(this.noise.fbm2((x + 900) * 0.015, (z - 320) * 0.015, 4, 2, 0.52) * 2 - 1);

    let height = 11 + continental * 16 + detail * 4;
    if (climate.biome === "highlands") {
      height += ridged * 14;
    }
    if (climate.biome === "desert") {
      height -= 2;
    }
    if (Math.abs(height - WATER_LEVEL) < 2) {
      height -= 1;
    }
    return clamp(Math.round(height), 6, WORLD_HEIGHT - 6);
  }

  pickTerrainBlock(x, y, z, surfaceHeight, climate) {
    const depth = surfaceHeight - y;
    const caveNoise = this.noise.fbm3((x + 100) * 0.068, y * 0.075, (z - 300) * 0.068, 3, 2, 0.5);
    if (y < surfaceHeight - 4 && y > 4 && caveNoise > 0.72) {
      return BLOCK.AIR;
    }

    const nearWater = surfaceHeight <= WATER_LEVEL + 1;
    if (depth === 0) {
      if (climate.biome === "desert" || nearWater) {
        return BLOCK.SAND;
      }
      return BLOCK.GRASS;
    }

    if (depth < 3) {
      if (climate.biome === "desert" || nearWater) {
        return BLOCK.SAND;
      }
      return BLOCK.DIRT;
    }

    let blockId = BLOCK.STONE;
    const coalNoise = hash3D(x * 0.23, y * 0.41, z * 0.29, this.seed + 11);
    const ironNoise = hash3D(x * 0.27, y * 0.36, z * 0.33, this.seed + 19);
    if (y < 30 && coalNoise > 0.86) {
      blockId = BLOCK.COAL_ORE;
    }
    if (y < 20 && ironNoise > 0.9) {
      blockId = BLOCK.IRON_ORE;
    }
    return blockId;
  }

  spawnTree(x, y, z) {
    const trunkHeight = 4 + Math.floor(hash2D(x * 0.91, z * 1.17, this.seed + 91) * 3);
    for (let index = 0; index < trunkHeight; index += 1) {
      if (this.getBlock(x, y + index, z) === BLOCK.AIR || this.getBlock(x, y + index, z) === BLOCK.WATER) {
        this.setBaseBlock(x, y + index, z, BLOCK.OAK_LOG);
      }
    }

    const canopyY = y + trunkHeight - 2;
    for (let offsetX = -2; offsetX <= 2; offsetX += 1) {
      for (let offsetZ = -2; offsetZ <= 2; offsetZ += 1) {
        for (let offsetY = 0; offsetY <= 3; offsetY += 1) {
          const targetX = x + offsetX;
          const targetY = canopyY + offsetY;
          const targetZ = z + offsetZ;
          if (!this.isInside(targetX, targetY, targetZ)) {
            continue;
          }
          const distance = Math.abs(offsetX) + Math.abs(offsetZ) + Math.abs(offsetY - 1) * 0.8;
          const threshold = 3.4 + hash3D(targetX * 0.9, targetY * 0.7, targetZ * 0.8, this.seed + 101) * 0.6;
          if (distance <= threshold && this.getBlock(targetX, targetY, targetZ) === BLOCK.AIR) {
            this.setBaseBlock(targetX, targetY, targetZ, BLOCK.LEAVES);
          }
        }
      }
    }
  }

  getSurfaceHeight(x, z) {
    return this.columnHeights[this.getColumnIndex(x, z)];
  }

  rebuildAllChunks() {
    for (let chunkX = 0; chunkX < WORLD_CHUNKS_X; chunkX += 1) {
      for (let chunkZ = 0; chunkZ < WORLD_CHUNKS_Z; chunkZ += 1) {
        this.buildChunkMesh(chunkX, chunkZ);
      }
    }
  }

  rebuildChunkAt(x, z) {
    if (x < WORLD_MIN_X || x > WORLD_MAX_X || z < WORLD_MIN_Z || z > WORLD_MAX_Z) {
      return;
    }
    const chunkX = Math.floor((x - WORLD_MIN_X) / CHUNK_SIZE);
    const chunkZ = Math.floor((z - WORLD_MIN_Z) / CHUNK_SIZE);
    this.buildChunkMesh(chunkX, chunkZ);
  }

  buildChunkMesh(chunkX, chunkZ) {
    const key = chunkKey(chunkX, chunkZ);
    const existing = this.chunkMeshes.get(key);
    if (existing) {
      existing.traverse((child) => {
        if (child.geometry) {
          child.geometry.dispose();
        }
      });
      this.group.remove(existing);
    }

    const builders = {
      opaque: makeBuilder(),
      cutout: makeBuilder(),
      transparent: makeBuilder(),
    };

    const startX = WORLD_MIN_X + chunkX * CHUNK_SIZE;
    const startZ = WORLD_MIN_Z + chunkZ * CHUNK_SIZE;

    for (let x = startX; x < startX + CHUNK_SIZE; x += 1) {
      for (let z = startZ; z < startZ + CHUNK_SIZE; z += 1) {
        for (let y = 0; y < WORLD_HEIGHT; y += 1) {
          const blockId = this.getBlock(x, y, z);
          if (blockId === BLOCK.AIR) {
            continue;
          }

          const block = getBlockDefinition(blockId);
          if (block.renderLayer === "none") {
            continue;
          }
          const builder = builders[block.renderLayer] ?? builders.opaque;

          for (const face of FACE_DEFS) {
            const neighborId = this.getBlock(x + face.dir[0], y + face.dir[1], z + face.dir[2]);
            if (shouldRenderFace(blockId, neighborId)) {
              pushFace(builder, x, y, z, face, blockId);
            }
          }
        }
      }
    }

    const chunkGroup = new THREE.Group();
    chunkGroup.name = key;

    for (const layer of ["opaque", "cutout", "transparent"]) {
      const geometry = builderToGeometry(builders[layer]);
      if (!geometry) {
        continue;
      }
      const mesh = new THREE.Mesh(geometry, this.materials[layer]);
      mesh.frustumCulled = true;
      chunkGroup.add(mesh);
    }

    chunkGroup.matrixAutoUpdate = false;
    chunkGroup.updateMatrix();
    this.chunkMeshes.set(key, chunkGroup);
    this.group.add(chunkGroup);
  }


  placeSurpriseChests() {
    const candidates = [
      { x: -18, z: 14 },
      { x: 21, z: -17 },
      { x: -26, z: -21 },
    ];

    candidates.forEach((candidate, index) => {
      const x = clamp(candidate.x, WORLD_MIN_X + 2, WORLD_MAX_X - 2);
      const z = clamp(candidate.z, WORLD_MIN_Z + 2, WORLD_MAX_Z - 2);
      const groundY = this.getTopSolidBlockY(x, z);
      if (groundY < 1) {
        return;
      }
      const chestY = groundY + 1;
      if (this.getBlock(x, chestY, z) !== BLOCK.AIR) {
        return;
      }
      this.setBaseBlock(x, chestY, z, BLOCK.CHEST);
      this.surpriseChests.push({ index, x, y: chestY, z });
      if (this.getBlock(x, groundY, z) === BLOCK.GRASS && this.getBlock(x, chestY + 1, z) === BLOCK.AIR) {
        if (this.isInside(x + 1, chestY, z) && this.getBlock(x + 1, chestY, z) === BLOCK.AIR) {
          this.setBaseBlock(x + 1, chestY, z, BLOCK.TORCH);
        }
      }
    });
  }
  getTopSolidBlockY(x, z) {
    if (x < WORLD_MIN_X || x > WORLD_MAX_X || z < WORLD_MIN_Z || z > WORLD_MAX_Z) {
      return 0;
    }
    for (let y = WORLD_HEIGHT - 1; y >= 0; y -= 1) {
      const blockId = this.getBlock(x, y, z);
      if (blockId === BLOCK.AIR || blockId === BLOCK.WATER || blockId === BLOCK.LEAVES) {
        continue;
      }
      return y;
    }
    return 0;
  }
  findSpawnPoint() {
    const candidates = [
      [0, 0],
      [6, 6],
      [-7, 4],
      [10, -8],
      [-12, -6],
    ];

    for (const [x, z] of candidates) {
      const clampedX = clamp(x, WORLD_MIN_X + 2, WORLD_MAX_X - 2);
      const clampedZ = clamp(z, WORLD_MIN_Z + 2, WORLD_MAX_Z - 2);
      const y = this.getSurfaceHeight(clampedX, clampedZ) + 1;
      if (this.getBlock(clampedX, y, clampedZ) === BLOCK.AIR) {
        return { x: clampedX + 0.5, y: y + 0.02, z: clampedZ + 0.5 };
      }
    }

    return { x: 0.5, y: WATER_LEVEL + 4, z: 0.5 };
  }


  getPresetChests() {
    return this.surpriseChests.map((entry) => ({ ...entry }));
  }

  isLightSourceNearby(x, y, z, radius = 8) {
    for (let ox = -radius; ox <= radius; ox += 1) {
      for (let oy = -2; oy <= 2; oy += 1) {
        for (let oz = -radius; oz <= radius; oz += 1) {
          const blockId = this.getBlock(x + ox, y + oy, z + oz);
          if (blockId === BLOCK.TORCH) {
            return true;
          }
        }
      }
    }
    return false;
  }

  getNearbyTorches(center, radius = 14) {
    const lights = [];
    const cx = Math.floor(center.x);
    const cy = Math.floor(center.y);
    const cz = Math.floor(center.z);
    for (let x = cx - radius; x <= cx + radius; x += 1) {
      for (let y = Math.max(0, cy - 4); y <= Math.min(WORLD_HEIGHT - 1, cy + 6); y += 1) {
        for (let z = cz - radius; z <= cz + radius; z += 1) {
          if (this.getBlock(x, y, z) !== BLOCK.TORCH) {
            continue;
          }
          lights.push({ x: x + 0.5, y: y + 0.72, z: z + 0.5, distance: Math.hypot(x + 0.5 - center.x, y + 0.72 - center.y, z + 0.5 - center.z) });
        }
      }
    }
    return lights.sort((a, b) => a.distance - b.distance).slice(0, 8);
  }
  raycast(origin, direction, maxDistance) {
    const stepX = Math.sign(direction.x);
    const stepY = Math.sign(direction.y);
    const stepZ = Math.sign(direction.z);

    const tDeltaX = stepX === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / direction.x);
    const tDeltaY = stepY === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / direction.y);
    const tDeltaZ = stepZ === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / direction.z);

    let voxelX = Math.floor(origin.x);
    let voxelY = Math.floor(origin.y);
    let voxelZ = Math.floor(origin.z);

    let tMaxX = stepX > 0 ? (voxelX + 1 - origin.x) * tDeltaX : (origin.x - voxelX) * tDeltaX;
    let tMaxY = stepY > 0 ? (voxelY + 1 - origin.y) * tDeltaY : (origin.y - voxelY) * tDeltaY;
    let tMaxZ = stepZ > 0 ? (voxelZ + 1 - origin.z) * tDeltaZ : (origin.z - voxelZ) * tDeltaZ;

    let distance = 0;
    let normal = { x: 0, y: 0, z: 0 };

    while (distance <= maxDistance) {
      const blockId = this.getBlock(voxelX, voxelY, voxelZ);
      if (blockId !== BLOCK.AIR && blockId !== BLOCK.WATER) {
        return {
          x: voxelX,
          y: voxelY,
          z: voxelZ,
          blockId,
          normal,
          distance,
        };
      }

      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        voxelX += stepX;
        distance = tMaxX;
        tMaxX += tDeltaX;
        normal = { x: -stepX, y: 0, z: 0 };
      } else if (tMaxY < tMaxZ) {
        voxelY += stepY;
        distance = tMaxY;
        tMaxY += tDeltaY;
        normal = { x: 0, y: -stepY, z: 0 };
      } else {
        voxelZ += stepZ;
        distance = tMaxZ;
        tMaxZ += tDeltaZ;
        normal = { x: 0, y: 0, z: -stepZ };
      }
    }

    return null;
  }

  isSolidAt(x, y, z) {
    return getBlockDefinition(this.getBlock(x, y, z)).solid;
  }

  applyChanges(savedChanges) {
    const entries = Array.isArray(savedChanges) ? savedChanges : Object.entries(savedChanges);
    for (const entry of entries) {
      const [key, rawValue] = Array.isArray(entry) ? entry : [entry[0], entry[1]];
      const [x, y, z] = key.split(",").map(Number);
      const blockId = Number(rawValue);
      if (!this.isInside(x, y, z)) {
        continue;
      }
      this.data[this.getIndex(x, y, z)] = blockId;
      this.modifications.set(key, blockId);
    }
  }

  serializeChanges() {
    return Object.fromEntries(this.modifications.entries());
  }

  getNearbyBlocks(center, radius = 3) {
    const blocks = [];
    const cx = Math.floor(center.x);
    const cy = Math.floor(center.y);
    const cz = Math.floor(center.z);

    for (let x = cx - radius; x <= cx + radius; x += 1) {
      for (let y = cy - 1; y <= cy + 2; y += 1) {
        for (let z = cz - radius; z <= cz + radius; z += 1) {
          const id = this.getBlock(x, y, z);
          if (id === BLOCK.AIR) {
            continue;
          }
          blocks.push({
            x,
            y,
            z,
            name: BLOCK_TYPES[id].name,
            id,
            distance: Math.hypot(x + 0.5 - center.x, y + 0.5 - center.y, z + 0.5 - center.z),
          });
        }
      }
    }

    return blocks.sort((a, b) => a.distance - b.distance).slice(0, 12);
  }
}



