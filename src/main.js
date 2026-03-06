import * as THREE from "three";

import { BLOCK, BLOCK_TYPES, getBlockDefinition } from "./blocks.js";
import {
  DAY_DURATION_SECONDS,
  FIXED_TIME_STEP,
  GRAVITY,
  JUMP_SPEED,
  MAX_INTERACT_DISTANCE,
  PLAYER_EYE_HEIGHT,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  PLAYER_STEP_HEIGHT,
  SAVE_KEY,
  SPRINT_SPEED,
  SWIM_ASCEND_ACCEL,
  SWIM_GRAVITY,
  WALK_SPEED,
  WORLD_MAX_X,
  WORLD_MAX_Z,
  WORLD_MIN_X,
  WORLD_MIN_Z,
  WORLD_SEED,
} from "./constants.js";
import {
  canStacksMerge,
  cloneStack,
  createInventoryStack,
  getDropItemForBlock,
  getItemDefinition,
  getItemIconDataUrl,
  getItemName,
  getItemTexture,
  getMaxStackSize,
  getRecipeForGrid,
  getToolMiningSpeed,
  ALL_TOOL_ITEM_IDS,
  DEBUG_LOADOUT,
  HOTBAR_SIZE,
  INVENTORY_SIZE,
  isPlaceableItem,
  ITEM,
  LEGACY_ITEM_MIGRATION,
  RECIPES,
  STARTER_INVENTORY,
} from "./items.js";
import { createSoundSystem } from "./sound.js";
import { createAtlasTexture } from "./textures.js";
import { createMobSystem } from "./mobs.js";
import { VoxelWorld } from "./world.js";

const canvas = document.querySelector("#game");
const app = document.querySelector("#app");
const menu = document.querySelector("#menu");
const pausePanel = document.querySelector("#pause-panel");
const inventoryPanel = document.querySelector("#inventory-panel");
const deathPanel = document.querySelector("#death-panel");
const startButton = document.querySelector("#start-btn");
const resumeButton = document.querySelector("#resume-btn");
const closeInventoryButton = document.querySelector("#close-inventory-btn");
const respawnButton = document.querySelector("#respawn-btn");
const deathCopy = document.querySelector("#death-copy");
const hotbar = document.querySelector("#hotbar");
const coordsReadout = document.querySelector("#coords-readout");
const seedReadout = document.querySelector("#seed-readout");
const timeReadout = document.querySelector("#time-readout");
const heldReadout = document.querySelector("#held-readout");
const targetReadout = document.querySelector("#target-readout");
const tooltipLabel = document.querySelector("#tooltip");
const saveIndicator = document.querySelector("#save-indicator");
const damageFlash = document.querySelector("#damage-flash");
const heartsBand = document.querySelector("#hearts-band");
const staminaBand = document.querySelector("#stamina-band");
const oxygenBand = document.querySelector("#oxygen-band");
const inventoryTitle = document.querySelector("#inventory-title");
const inventoryModeReadout = document.querySelector("#inventory-mode-readout");
const recipeReadout = document.querySelector("#recipe-readout");
const craftLayout = document.querySelector("#craft-layout");
const craftGrid = document.querySelector("#craft-grid");
const craftResult = document.querySelector("#craft-result");
const recipeList = document.querySelector("#recipe-list");
const chestBlock = document.querySelector("#chest-block");
const chestTitle = document.querySelector("#chest-title");
const chestStorage = document.querySelector("#chest-storage");
const inventoryStorage = document.querySelector("#inventory-storage");
const inventoryHotbar = document.querySelector("#inventory-hotbar");
const cursorStackEl = document.querySelector("#cursor-stack");

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const wrap = (value, length) => ((value % length) + length) % length;

function chestKey(x, y, z) {
  return `${x},${y},${z}`;
}

function createEmptySlots(length) {
  return Array.from({ length }, () => null);
}

function normalizeSlotArray(raw, length) {
  const slots = createEmptySlots(length);
  if (!Array.isArray(raw)) {
    return slots;
  }
  for (let index = 0; index < Math.min(length, raw.length); index += 1) {
    slots[index] = normalizeStack(raw[index]);
  }
  return slots;
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn("Failed to read save", error);
    return null;
  }
}

function normalizeStack(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const def = getItemDefinition(raw.itemId);
  if (!def) {
    return null;
  }
  const count = clamp(Number(raw.count) || 0, 0, def.stackSize);
  if (count <= 0) {
    return null;
  }
  return {
    itemId: raw.itemId,
    count,
    durability: def.category === "tool" ? clamp(Number(raw.durability) || def.durability, 1, def.durability) : null,
  };
}

function insertStackIntoSlots(slots, stack) {
  let remainder = cloneStack(stack);
  if (!remainder) {
    return null;
  }

  if (getMaxStackSize(remainder.itemId) > 1) {
    for (let index = 0; index < slots.length; index += 1) {
      const slot = slots[index];
      if (!canStacksMerge(slot, remainder)) {
        continue;
      }
      const max = getMaxStackSize(slot.itemId);
      const transfer = Math.min(max - slot.count, remainder.count);
      if (transfer <= 0) {
        continue;
      }
      slot.count += transfer;
      remainder.count -= transfer;
      if (remainder.count <= 0) {
        return null;
      }
    }
  }

  for (let index = 0; index < slots.length; index += 1) {
    if (slots[index]) {
      continue;
    }
    if (getMaxStackSize(remainder.itemId) === 1) {
      slots[index] = { ...remainder, count: 1 };
      remainder.count -= 1;
    } else {
      const placed = Math.min(getMaxStackSize(remainder.itemId), remainder.count);
      slots[index] = { ...remainder, count: placed };
      remainder.count -= placed;
    }
    if (remainder.count <= 0) {
      return null;
    }
  }

  return remainder;
}

function initializeInventory(savedInventory) {
  const slots = Array.from({ length: INVENTORY_SIZE }, () => null);

  if (Array.isArray(savedInventory)) {
    for (let index = 0; index < Math.min(savedInventory.length, INVENTORY_SIZE); index += 1) {
      slots[index] = normalizeStack(savedInventory[index]);
    }
    return ensureDebugLoadout(slots);
  }

  if (savedInventory && typeof savedInventory === "object") {
    for (const [legacyKey, rawCount] of Object.entries(savedInventory)) {
      const itemId = LEGACY_ITEM_MIGRATION[Number(legacyKey)];
      if (!itemId) {
        continue;
      }
      insertStackIntoSlots(slots, createInventoryStack(itemId, Number(rawCount) || 0));
    }
    return ensureDebugLoadout(slots);
  }

  for (const stack of STARTER_INVENTORY) {
    insertStackIntoSlots(slots, cloneStack(stack));
  }
  return ensureDebugLoadout(slots);
}

function ensureDebugLoadout(slots) {
  const rebuilt = Array.from({ length: INVENTORY_SIZE }, () => null);
  const preserved = slots.filter((slot) => slot && !ALL_TOOL_ITEM_IDS.includes(slot.itemId));

  ALL_TOOL_ITEM_IDS.forEach((itemId, index) => {
    if (index < INVENTORY_SIZE) {
      rebuilt[index] = createInventoryStack(itemId, 1);
    }
  });

  preserved.forEach((stack) => {
    insertStackIntoSlots(rebuilt, cloneStack(stack));
  });

  for (const desired of DEBUG_LOADOUT.filter((stack) => !ALL_TOOL_ITEM_IDS.includes(stack.itemId))) {
    const current = rebuilt.reduce((sum, slot) => sum + (slot?.itemId === desired.itemId ? slot.count : 0), 0);
    if (current < desired.count) {
      insertStackIntoSlots(rebuilt, createInventoryStack(desired.itemId, desired.count - current));
    }
  }

  return rebuilt;
}

const savedState = loadSave();
const sfx = createSoundSystem();

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  powerPreference: "high-performance",
  alpha: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.autoClear = false;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x9dd0ff, 28, 130);

const camera = new THREE.PerspectiveCamera(84, window.innerWidth / window.innerHeight, 0.1, 260);
camera.rotation.order = "YXZ";

const atlas = createAtlasTexture();
const materials = {
  opaque: new THREE.MeshStandardMaterial({ map: atlas.texture, vertexColors: true, roughness: 1, metalness: 0 }),
  cutout: new THREE.MeshStandardMaterial({ map: atlas.texture, vertexColors: true, roughness: 1, metalness: 0, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }),
  transparent: new THREE.MeshStandardMaterial({ map: atlas.texture, vertexColors: true, roughness: 0.95, metalness: 0, transparent: true, opacity: 0.88, side: THREE.DoubleSide }),
};
materials.transparent.depthWrite = false;

const ambientLight = new THREE.AmbientLight(0xffffff, 0.72);
scene.add(ambientLight);
const hemiLight = new THREE.HemisphereLight(0xb4dbff, 0x445c35, 0.42);
scene.add(hemiLight);
const sunLight = new THREE.DirectionalLight(0xfff1d4, 1.45);
scene.add(sunLight);
scene.add(sunLight.target);
const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(3.8, 18, 12), new THREE.MeshBasicMaterial({ color: 0xffe48f }));
scene.add(sunMesh);
const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(2.6, 18, 12), new THREE.MeshBasicMaterial({ color: 0xcfd7ff }));
scene.add(moonMesh);

const viewScene = new THREE.Scene();
const viewCamera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.01, 10);
viewScene.add(viewCamera);
viewScene.add(new THREE.AmbientLight(0xffffff, 1.2));
const viewSun = new THREE.DirectionalLight(0xffffff, 0.5);
viewSun.position.set(2, 2, 3);
viewScene.add(viewSun);

const viewModel = new THREE.Group();
viewCamera.add(viewModel);
viewModel.position.set(0.64, -0.48, -1.08);
const armMesh = new THREE.Mesh(
  new THREE.BoxGeometry(0.22, 0.42, 0.22),
  new THREE.MeshStandardMaterial({ color: 0xd6b397, roughness: 1 }),
);
armMesh.position.set(0, -0.04, 0);
armMesh.rotation.set(-0.08, 0.06, 0.16);
viewModel.add(armMesh);
const heldAnchor = new THREE.Group();
heldAnchor.position.set(-0.04, 0.08, -0.08);
viewModel.add(heldAnchor);
let heldMesh = null;

function createClouds(seed) {
  const cloudGroup = new THREE.Group();
  const cloudMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
  for (let index = 0; index < 14; index += 1) {
    const cloud = new THREE.Group();
    const pieces = 2 + Math.floor(((Math.sin(index * 12.3 + seed) + 1) * 0.5) * 3);
    for (let piece = 0; piece < pieces; piece += 1) {
      const width = 4 + ((index + piece) % 3) * 2;
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(width, 1.2 + (piece % 2) * 0.35, 3 + ((index + piece) % 2)),
        cloudMaterial,
      );
      box.position.set(piece * 2.3 - pieces * 1.3, piece % 2 ? 0.3 : -0.1, (piece % 3) - 1);
      cloud.add(box);
    }
    cloud.userData = { baseX: -70 + index * 14, baseZ: -46 + ((index * 17) % 92), height: 41 + (index % 4) * 2.2, speed: 1.8 + (index % 5) * 0.25 };
    cloudGroup.add(cloud);
  }
  return cloudGroup;
}

const clouds = createClouds(WORLD_SEED);
scene.add(clouds);

const torchLights = Array.from({ length: 6 }, () => {
  const light = new THREE.PointLight(0xffc36a, 0, 12, 2.2);
  light.visible = false;
  scene.add(light);
  return light;
});

const saveState = { dirty: false, countdown: 0, pulseUntil: 0 };
function queueSave() {
  saveState.dirty = true;
  saveState.countdown = 0.8;
}

const world = new VoxelWorld({
  scene,
  materials,
  seed: WORLD_SEED,
  savedChanges: savedState?.changes ?? null,
  onWorldMutated: queueSave,
});
const mobSystem = createMobSystem({ scene, world });

const spawnPoint = world.findSpawnPoint();
const initialPlayer = savedState?.player ?? {};
const player = {
  position: new THREE.Vector3(initialPlayer.x ?? spawnPoint.x, initialPlayer.y ?? spawnPoint.y, initialPlayer.z ?? spawnPoint.z),
  velocity: new THREE.Vector3(),
  yaw: initialPlayer.yaw ?? 0.45,
  pitch: initialPlayer.pitch ?? -0.35,
  grounded: false,
  underwater: false,
  isSprinting: false,
  lastSafePosition: new THREE.Vector3(spawnPoint.x, spawnPoint.y, spawnPoint.z),
  health: clamp(initialPlayer.health ?? 100, 1, 100),
  maxHealth: 100,
  stamina: clamp(initialPlayer.stamina ?? 100, 0, 100),
  maxStamina: 100,
  oxygen: clamp(initialPlayer.oxygen ?? 100, 0, 100),
  maxOxygen: 100,
  regenDelay: 0,
  drownTimer: 0,
  stepTimer: 0,
  bobPhase: 0,
};

const state = {
  started: false,
  mode: "menu",
  selectedIndex: clamp(savedState?.selectedIndex ?? 0, 0, HOTBAR_SIZE - 1),
  timeOfDay: savedState?.timeOfDay ?? 0.34,
  elapsed: 0,
  inventory: initializeInventory(savedState?.inventory),
  inventoryCraft: Array.from({ length: 4 }, () => null),
  tableCraft: Array.from({ length: 9 }, () => null),
  openChestKey: null,
  chestTitle: "Chest",
  chests: new Map(),
  cursorStack: null,
  damageFlash: 0,
  handSwing: 0,
  pointerX: 0,
  pointerY: 0,
  drops: [],
  nextDropId: 1,
  daylight: 1,
  mobSwingCooldown: 0,
};

initializeChestState();


function serializeChestMap() {
  return Object.fromEntries(Array.from(state.chests.entries()));
}

function createSurpriseChestLoot(index) {
  const variants = [
    [createInventoryStack(ITEM.DIAMOND, 3), createInventoryStack(ITEM.GOLD_INGOT, 8), createInventoryStack(ITEM.TORCH, 12)],
    [createInventoryStack(ITEM.IRON_INGOT, 12), createInventoryStack(ITEM.CHEST, 1), createInventoryStack(ITEM.TORCH, 16)],
    [createInventoryStack(ITEM.STONE_SWORD, 1), createInventoryStack(ITEM.OAK_LOG, 10), createInventoryStack(ITEM.COBBLESTONE, 16)],
  ];
  const slots = createEmptySlots(27);
  variants[index % variants.length].forEach((stack, slotIndex) => {
    slots[slotIndex * 3] = stack;
  });
  return slots;
}

function initializeChestState() {
  const savedChests = savedState?.chests ?? {};
  const presetChests = world.getPresetChests?.() ?? [];
  presetChests.forEach((entry) => {
    const key = chestKey(entry.x, entry.y, entry.z);
    const savedSlots = savedChests[key];
    state.chests.set(key, normalizeSlotArray(savedSlots ?? createSurpriseChestLoot(entry.index), 27));
  });

  Object.entries(savedChests).forEach(([key, rawSlots]) => {
    if (!state.chests.has(key)) {
      state.chests.set(key, normalizeSlotArray(rawSlots, 27));
    }
  });
}

function getOpenChestSlots() {
  return state.openChestKey ? state.chests.get(state.openChestKey) ?? null : null;
}
const keys = new Set();
let jumpQueued = false;
const pointer = { left: false };
const lookDirection = new THREE.Vector3();
const underwaterColor = new THREE.Color(0x2b5675);
const daySky = new THREE.Color(0x9fd3ff);
const dayFog = new THREE.Color(0xc8e2ff);
const nightSky = new THREE.Color(0x14203f);
const nightFog = new THREE.Color(0x243252);
const sunriseTint = new THREE.Color(0xf5b06e);

const targetMarker = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.04, 1.04, 1.04)),
  new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.86 }),
);
targetMarker.visible = false;
scene.add(targetMarker);

let currentTarget = null;
let currentMobTarget = null;
const mining = { key: "", progress: 0, duration: 0 };

function runBrowserAction(action) {
  try {
    const result = action?.();
    if (result && typeof result.catch === "function") {
      result.catch(() => {});
    }
  } catch {
    // Browser API availability varies in automation; ignore these transition errors.
  }
}

function requestPointerLock() {
  runBrowserAction(() => canvas.requestPointerLock?.());
}

function releasePointerLock() {
  runBrowserAction(() => document.exitPointerLock?.());
}

function getSelectedStack() {
  return state.inventory[state.selectedIndex] ?? null;
}

function getSelectedToolDefinition() {
  const stack = getSelectedStack();
  const def = stack ? getItemDefinition(stack.itemId) : null;
  return def?.category === "tool" ? def : null;
}

function getSelectedAttackDamage() {
  const tool = getSelectedToolDefinition();
  if (!tool) {
    return 2;
  }
  if (tool.toolType === "sword") {
    return tool.attackDamage ?? 5;
  }
  if (tool.toolType === "axe") {
    return Math.max(4, tool.attackDamage ?? 4);
  }
  return Math.max(2, (tool.attackDamage ?? 3) * 0.7);
}

function addStackToInventory(stack, shouldQueue = true) {
  const remainder = insertStackIntoSlots(state.inventory, stack);
  if (shouldQueue) {
    queueSave();
  }
  renderAllInventoryViews();
  return remainder;
}

function countItemInInventory(itemId) {
  return state.inventory.reduce((sum, slot) => sum + (slot?.itemId === itemId ? slot.count : 0), 0);
}

function getActiveCraftGrid() {
  return state.mode === "table" ? state.tableCraft : state.inventoryCraft;
}

function getActiveStation() {
  return state.mode === "table" ? "table" : "inventory";
}

function getCraftSlotBinding(displayIndex) {
  if (state.mode === "table") {
    return displayIndex;
  }
  const map = [0, 1, null, 2, 3, null, null, null, null];
  return map[displayIndex] ?? null;
}

function getCurrentRecipe() {
  if (state.mode !== "inventory" && state.mode !== "table") {
    return null;
  }
  return getRecipeForGrid(getActiveCraftGrid(), getActiveStation());
}

function createDropMesh(itemId) {
  const material = new THREE.SpriteMaterial({ map: getItemTexture(itemId, atlas), transparent: true, alphaTest: 0.1 });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.42, 0.42, 0.42);
  return sprite;
}

function spawnDrop(itemId, x, y, z, count = 1, durability = null) {
  const stack = createInventoryStack(itemId, count, durability);
  if (!stack) {
    return;
  }
  const mesh = createDropMesh(itemId);
  mesh.position.set(x + (Math.random() - 0.5) * 0.24, y + 0.35, z + (Math.random() - 0.5) * 0.24);
  scene.add(mesh);
  state.drops.push({
    id: state.nextDropId++,
    stack,
    mesh,
    velocity: new THREE.Vector3((Math.random() - 0.5) * 1.4, 2.5 + Math.random() * 0.9, (Math.random() - 0.5) * 1.4),
    age: 0,
  });
}

function clearCraftGridToInventory(grid) {
  for (let index = 0; index < grid.length; index += 1) {
    if (!grid[index]) {
      continue;
    }
    const remainder = addStackToInventory(grid[index], false);
    if (remainder) {
      spawnDrop(remainder.itemId, player.position.x, player.position.y + 1.2, player.position.z, remainder.count, remainder.durability);
    }
    grid[index] = null;
  }
  renderAllInventoryViews();
  queueSave();
}

function openInventory(mode = "inventory") {
  if (state.mode !== "playing") {
    return;
  }
  state.openChestKey = mode === "chest" ? state.openChestKey : null;
  state.mode = mode;
  app.dataset.mode = mode;
  menu.classList.remove("visible");
  pausePanel.classList.remove("visible");
  deathPanel.classList.remove("visible");
  inventoryPanel.classList.add("visible");
  pointer.left = false;
  releasePointerLock();
  renderAllInventoryViews();
}

function openChest(key, title = "Chest") {
  if (state.mode !== "playing") {
    return;
  }
  state.openChestKey = key;
  state.chestTitle = title;
  openInventory("chest");
}

function closeInventory() {
  if (!["inventory", "table", "chest"].includes(state.mode)) {
    return;
  }
  if (state.mode === "inventory" || state.mode === "table" || state.mode === "chest") {
    clearCraftGridToInventory(getActiveCraftGrid());
  }
  state.openChestKey = null;
  setMode("playing");
  requestPointerLock();
}

function setMode(mode) {
  state.mode = mode;
  app.dataset.mode = mode;
  menu.classList.toggle("visible", mode === "menu");
  pausePanel.classList.toggle("visible", mode === "paused");
  inventoryPanel.classList.toggle("visible", mode === "inventory" || mode === "table" || mode === "chest");
  deathPanel.classList.toggle("visible", mode === "dead");

  if (mode !== "playing") {
    pointer.left = false;
    jumpQueued = false;
    keys.clear();
    mining.key = "";
    mining.progress = 0;
    targetMarker.visible = false;
  }

  renderAllInventoryViews();
}

function getDeathMessage(reason) {
  const messages = {
    fall: "You hit the ground too hard. Respawn at the last safe spot.",
    drowning: "You ran out of oxygen underwater. Respawn at the last safe spot.",
    void: "You fell out of the world. Respawn at the last safe spot.",
  };
  return messages[reason] ?? "Your body gave out. Respawn at the last safe spot.";
}

function saveGame() {
  try {
    const payload = {
      player: {
        x: Number(player.position.x.toFixed(3)),
        y: Number(player.position.y.toFixed(3)),
        z: Number(player.position.z.toFixed(3)),
        yaw: Number(player.yaw.toFixed(4)),
        pitch: Number(player.pitch.toFixed(4)),
        health: Number(player.health.toFixed(2)),
        stamina: Number(player.stamina.toFixed(2)),
        oxygen: Number(player.oxygen.toFixed(2)),
      },
      selectedIndex: state.selectedIndex,
      timeOfDay: Number(state.timeOfDay.toFixed(5)),
      inventory: state.inventory,
      chests: serializeChestMap(),
      changes: world.serializeChanges(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    saveState.dirty = false;
    saveState.countdown = 0;
    saveState.pulseUntil = performance.now() + 1200;
  } catch (error) {
    console.warn("Failed to save", error);
  }
}

function applyDamage(amount, reason = "generic") {
  if (state.mode === "dead") {
    return;
  }
  player.health = clamp(player.health - amount, 0, player.maxHealth);
  player.regenDelay = 5.5;
  state.damageFlash = Math.min(1, state.damageFlash + 0.75);
  sfx.hurt();
  if (player.health <= 0) {
    deathCopy.textContent = getDeathMessage(reason);
    setMode("dead");
    releasePointerLock();
    queueSave();
  }
}

function respawnPlayer() {
  player.position.copy(player.lastSafePosition);
  player.position.y += 0.5;
  player.velocity.set(0, 0, 0);
  player.health = player.maxHealth;
  player.stamina = player.maxStamina;
  player.oxygen = player.maxOxygen;
  player.regenDelay = 0;
  player.drownTimer = 0;
  player.bobPhase = 0;
  state.damageFlash = 0;
  setMode("playing");
  queueSave();
  requestPointerLock();
  sfx.respawn();
}

function createSlotElement(type, index, showNumber = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = type === "hud" ? "hud-slot" : "inventory-slot";
  button.innerHTML = `
    <span class="slot-number">${showNumber ? index + 1 : ""}</span>
    <span class="slot-icon"></span>
    <span class="slot-count"></span>
    <span class="slot-durability"></span>
  `;
  return button;
}

function getToolColors(material) {
  const palettes = {
    wood: { head: 0xc89b63, shade: 0x8b6238 },
    stone: { head: 0xa7b1ba, shade: 0x6d7680 },
    iron: { head: 0xe1d7cc, shade: 0x9f988f },
    golden: { head: 0xf1cc56, shade: 0xb8891e },
    diamond: { head: 0x67dde0, shade: 0x2496a0 },
  };
  return palettes[material] ?? palettes.wood;
}

function createHeldToolMesh(def) {
  const group = new THREE.Group();
  const colors = getToolColors(def.material);
  const handleMat = new THREE.MeshStandardMaterial({ color: 0x9a6d3b, roughness: 1 });
  const headMat = new THREE.MeshStandardMaterial({ color: colors.head, roughness: 0.95 });
  const shadeMat = new THREE.MeshStandardMaterial({ color: colors.shade, roughness: 1 });
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.34, 0.05), handleMat);
  handle.position.set(0, -0.02, 0);
  group.add(handle);

  if (def.toolType === "sword") {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.34, 0.03), headMat);
    blade.position.set(0, 0.17, 0);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.04), shadeMat);
    guard.position.set(0, 0, 0);
    group.add(blade, guard);
  } else if (def.toolType === "pickaxe") {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.04), headMat);
    head.position.set(0, 0.14, 0);
    const tips = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.03), shadeMat);
    tips.position.set(0, 0.09, 0);
    group.add(head, tips);
  } else if (def.toolType === "axe") {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.04), headMat);
    head.position.set(-0.05, 0.12, 0);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 0.04), shadeMat);
    edge.position.set(0.03, 0.1, 0);
    group.add(head, edge);
  } else if (def.toolType === "shovel") {
    const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.04), headMat);
    scoop.position.set(0, 0.12, 0);
    group.add(scoop);
  } else if (def.toolType === "hoe") {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.04), headMat);
    head.position.set(-0.02, 0.15, 0);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.04), shadeMat);
    tip.position.set(0.06, 0.1, 0);
    group.add(head, tip);
  }

  group.scale.setScalar(0.88);
  group.rotation.set(0.3, 0.7, 0.25);
  group.userData.baseRotationZ = 0.25;
  return group;
}

function updateHeldMesh() {
  if (heldMesh) {
    heldAnchor.remove(heldMesh);
    heldMesh = null;
  }
  const stack = getSelectedStack();
  if (!stack) {
    return;
  }
  const def = getItemDefinition(stack.itemId);
  if (def?.category === "tool") {
    heldMesh = createHeldToolMesh(def);
  } else {
    const material = new THREE.MeshBasicMaterial({ map: getItemTexture(stack.itemId, atlas), transparent: true, alphaTest: 0.1, side: THREE.DoubleSide });
    heldMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), material);
    heldMesh.position.set(0, 0.04, -0.08);
    heldMesh.rotation.set(0.2, 0.78, 0.12);
    heldMesh.userData.baseRotationZ = 0.12;
  }
  heldAnchor.add(heldMesh);
}

const hudHotbarSlots = Array.from({ length: HOTBAR_SIZE }, (_, index) => {
  const slot = createSlotElement("hud", index, true);
  slot.addEventListener("click", () => selectHotbar(index));
  hotbar.appendChild(slot);
  return slot;
});

const chestSlots = Array.from({ length: 27 }, (_, index) => {
  const slot = createSlotElement("inventory", index, false);
  slot.addEventListener("click", () => handleChestSlotPrimary(index));
  slot.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    handleChestSlotSecondary(index);
  });
  chestStorage.appendChild(slot);
  return slot;
});
const storageSlots = [];
for (let index = HOTBAR_SIZE; index < INVENTORY_SIZE; index += 1) {
  const slot = createSlotElement("inventory", index, false);
  slot.addEventListener("click", () => handleInventorySlotPrimary(index));
  slot.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    handleInventorySlotSecondary(index);
  });
  inventoryStorage.appendChild(slot);
  storageSlots.push(slot);
}

const inventoryHotbarSlots = Array.from({ length: HOTBAR_SIZE }, (_, index) => {
  const slot = createSlotElement("inventory", index, true);
  slot.addEventListener("click", () => handleInventorySlotPrimary(index));
  slot.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    handleInventorySlotSecondary(index);
  });
  inventoryHotbar.appendChild(slot);
  return slot;
});

const craftSlots = Array.from({ length: 9 }, (_, displayIndex) => {
  const slot = createSlotElement("inventory", displayIndex, false);
  slot.addEventListener("click", () => handleCraftSlotPrimary(displayIndex));
  slot.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    handleCraftSlotSecondary(displayIndex);
  });
  craftGrid.appendChild(slot);
  return slot;
});

const resultSlot = createSlotElement("inventory", 0, false);
resultSlot.addEventListener("click", handleCraftResultPrimary);
resultSlot.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  handleCraftResultPrimary();
});
craftResult.appendChild(resultSlot);
recipeList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-recipe-id]");
  if (!button) {
    return;
  }
  autofillRecipe(button.dataset.recipeId);
});
function renderSlot(button, stack, options = {}) {
  const { active = false, disabled = false } = options;
  const icon = button.querySelector(".slot-icon");
  const count = button.querySelector(".slot-count");
  const durability = button.querySelector(".slot-durability");
  button.classList.toggle("active", active);
  button.disabled = disabled;
  button.style.opacity = disabled ? "0.22" : "1";

  if (!stack) {
    icon.style.backgroundImage = "none";
    count.textContent = "";
    durability.style.display = "none";
    return;
  }

  icon.style.backgroundImage = `url(${getItemIconDataUrl(stack.itemId, atlas)})`;
  count.textContent = stack.count > 1 ? `${stack.count}` : "";
  const def = getItemDefinition(stack.itemId);
  if (def?.category === "tool") {
    durability.style.display = "block";
    durability.style.setProperty("--durability", `${((stack.durability ?? def.durability) / def.durability) * 100}%`);
  } else {
    durability.style.display = "none";
  }
}

function updateCursorStackVisual() {
  cursorStackEl.classList.toggle("active", !!state.cursorStack);
  cursorStackEl.style.setProperty("--cursor-x", `${state.pointerX + 18}px`);
  cursorStackEl.style.setProperty("--cursor-y", `${state.pointerY + 18}px`);
  cursorStackEl.innerHTML = "";
  if (!state.cursorStack) {
    return;
  }
  const slot = createSlotElement("inventory", 0, false);
  renderSlot(slot, state.cursorStack);
  cursorStackEl.appendChild(slot);
}

function getRecipeRequirements(recipe) {
  const required = {};
  const ids = recipe.shapeless ? recipe.inputs : recipe.pattern.flat().filter(Boolean);
  ids.forEach((itemId) => {
    required[itemId] = (required[itemId] ?? 0) + 1;
  });
  return required;
}

function updateRecipeList() {
  const station = getActiveStation();
  const recipes = RECIPES.filter((recipe) => recipe.station === station);
  recipeList.innerHTML = recipes.map((recipe) => {
    const needs = recipe.shapeless ? recipe.inputs.join(" + ") : recipe.pattern.flat().filter(Boolean).join(" + ");
    const ready = Object.entries(getRecipeRequirements(recipe)).every(([itemId, count]) => countItemInInventory(itemId) >= count);
    return `<button type="button" class="recipe-chip ${ready ? "ready" : ""}" data-recipe-id="${recipe.id}">${getItemName(recipe.output.itemId)} <span>${needs}</span></button>`;
  }).join("");
}

function removeSingleItemFromInventory(itemId) {
  for (let index = 0; index < state.inventory.length; index += 1) {
    const slot = state.inventory[index];
    if (!slot || slot.itemId !== itemId) {
      continue;
    }
    slot.count -= 1;
    if (slot.count <= 0) {
      state.inventory[index] = null;
    }
    return true;
  }
  return false;
}

function autofillRecipe(recipeId) {
  const recipe = RECIPES.find((entry) => entry.id === recipeId && entry.station === getActiveStation());
  if (!recipe) {
    return;
  }
  const requirements = getRecipeRequirements(recipe);
  const ready = Object.entries(requirements).every(([itemId, count]) => countItemInInventory(itemId) >= count);
  if (!ready) {
    return;
  }
  const grid = getActiveCraftGrid();
  clearCraftGridToInventory(grid);
  if (recipe.shapeless) {
    recipe.inputs.forEach((itemId, index) => {
      if (removeSingleItemFromInventory(itemId)) {
        grid[index] = createInventoryStack(itemId, 1);
      }
    });
  } else {
    const width = getActiveStation() === "table" ? 3 : 2;
    recipe.pattern.forEach((row, y) => {
      row.forEach((itemId, x) => {
        if (!itemId) {
          return;
        }
        if (removeSingleItemFromInventory(itemId)) {
          grid[y * width + x] = createInventoryStack(itemId, 1);
        }
      });
    });
  }
  renderAllInventoryViews();
  queueSave();
}

function renderAllInventoryViews() {
  hudHotbarSlots.forEach((slot, index) => renderSlot(slot, state.inventory[index], { active: index === state.selectedIndex }));
  inventoryHotbarSlots.forEach((slot, index) => renderSlot(slot, state.inventory[index], { active: index === state.selectedIndex }));
  storageSlots.forEach((slot, index) => renderSlot(slot, state.inventory[index + HOTBAR_SIZE]));

  const chestSlotsData = getOpenChestSlots();
  chestSlots.forEach((slot, index) => renderSlot(slot, chestSlotsData?.[index] ?? null, { disabled: state.mode !== "chest" }));

  craftSlots.forEach((slot, displayIndex) => {
    const binding = getCraftSlotBinding(displayIndex);
    const stack = binding == null ? null : getActiveCraftGrid()[binding];
    renderSlot(slot, stack, { disabled: binding == null || (state.mode !== "inventory" && state.mode !== "table") });
  });

  const recipe = getCurrentRecipe();
  renderSlot(resultSlot, recipe ? createInventoryStack(recipe.output.itemId, recipe.output.count) : null, { disabled: !recipe || state.mode === "chest" });
  inventoryTitle.textContent = state.mode === "table" ? "Crafting Table" : state.mode === "chest" ? state.chestTitle : "Inventory";
  inventoryModeReadout.textContent = state.mode === "table" ? "3x3 TABLE GRID" : state.mode === "chest" ? "27 SLOT CACHE" : "2x2 PACK GRID";
  recipeReadout.textContent = state.mode === "chest" ? "CHEST: SHIFTLESS TRANSFER" : recipe ? `RECIPE: ${getItemName(recipe.output.itemId)} x${recipe.output.count}` : "RECIPE: NONE";
  craftLayout.classList.toggle("hidden-block", state.mode === "chest");
  chestBlock.classList.toggle("hidden-block", state.mode !== "chest");
  chestTitle.textContent = state.chestTitle;
  updateRecipeList();
  updateCursorStackVisual();
}

function handleInventorySlotPrimary(index) {
  const slot = state.inventory[index];
  if (!state.cursorStack) {
    if (slot) {
      state.cursorStack = slot;
      state.inventory[index] = null;
    }
  } else if (!slot) {
    state.inventory[index] = state.cursorStack;
    state.cursorStack = null;
  } else if (canStacksMerge(slot, state.cursorStack)) {
    const transfer = Math.min(getMaxStackSize(slot.itemId) - slot.count, state.cursorStack.count);
    if (transfer > 0) {
      slot.count += transfer;
      state.cursorStack.count -= transfer;
      if (state.cursorStack.count <= 0) {
        state.cursorStack = null;
      }
    }
  } else {
    state.inventory[index] = state.cursorStack;
    state.cursorStack = slot;
  }
  renderAllInventoryViews();
  updateHeldMesh();
  queueSave();
}

function handleInventorySlotSecondary(index) {
  const slot = state.inventory[index];
  if (!state.cursorStack) {
    if (!slot) {
      return;
    }
    const takeCount = Math.ceil(slot.count / 2);
    state.cursorStack = { ...slot, count: takeCount };
    slot.count -= takeCount;
    if (slot.count <= 0) {
      state.inventory[index] = null;
    }
  } else if (!slot) {
    state.inventory[index] = { ...state.cursorStack, count: 1 };
    state.cursorStack.count -= 1;
    if (state.cursorStack.count <= 0) {
      state.cursorStack = null;
    }
  } else if (canStacksMerge(slot, state.cursorStack) && slot.count < getMaxStackSize(slot.itemId)) {
    slot.count += 1;
    state.cursorStack.count -= 1;
    if (state.cursorStack.count <= 0) {
      state.cursorStack = null;
    }
  }
  renderAllInventoryViews();
  updateHeldMesh();
  queueSave();
}

function handleChestSlotPrimary(index) {
  const slots = getOpenChestSlots();
  if (!slots || state.mode !== "chest") {
    return;
  }
  const slot = slots[index];
  if (!state.cursorStack) {
    if (slot) {
      state.cursorStack = slot;
      slots[index] = null;
    }
  } else if (!slot) {
    slots[index] = state.cursorStack;
    state.cursorStack = null;
  } else if (canStacksMerge(slot, state.cursorStack)) {
    const transfer = Math.min(getMaxStackSize(slot.itemId) - slot.count, state.cursorStack.count);
    if (transfer > 0) {
      slot.count += transfer;
      state.cursorStack.count -= transfer;
      if (state.cursorStack.count <= 0) {
        state.cursorStack = null;
      }
    }
  } else {
    slots[index] = state.cursorStack;
    state.cursorStack = slot;
  }
  renderAllInventoryViews();
  queueSave();
}

function handleChestSlotSecondary(index) {
  const slots = getOpenChestSlots();
  if (!slots || state.mode !== "chest") {
    return;
  }
  const slot = slots[index];
  if (!state.cursorStack) {
    if (!slot) {
      return;
    }
    const takeCount = Math.ceil(slot.count / 2);
    state.cursorStack = { ...slot, count: takeCount };
    slot.count -= takeCount;
    if (slot.count <= 0) {
      slots[index] = null;
    }
  } else if (!slot) {
    slots[index] = { ...state.cursorStack, count: 1 };
    state.cursorStack.count -= 1;
    if (state.cursorStack.count <= 0) {
      state.cursorStack = null;
    }
  } else if (canStacksMerge(slot, state.cursorStack) && slot.count < getMaxStackSize(slot.itemId)) {
    slot.count += 1;
    state.cursorStack.count -= 1;
    if (state.cursorStack.count <= 0) {
      state.cursorStack = null;
    }
  }
  renderAllInventoryViews();
  queueSave();
}

function handleCraftSlotPrimary(displayIndex) {
  const binding = getCraftSlotBinding(displayIndex);
  if (binding == null || (state.mode !== "inventory" && state.mode !== "table")) {
    return;
  }
  const grid = getActiveCraftGrid();
  const slot = grid[binding];
  if (!state.cursorStack) {
    if (slot) {
      state.cursorStack = slot;
      grid[binding] = null;
    }
  } else if (!slot) {
    grid[binding] = state.cursorStack;
    state.cursorStack = null;
  } else if (canStacksMerge(slot, state.cursorStack)) {
    const transfer = Math.min(getMaxStackSize(slot.itemId) - slot.count, state.cursorStack.count);
    if (transfer > 0) {
      slot.count += transfer;
      state.cursorStack.count -= transfer;
      if (state.cursorStack.count <= 0) {
        state.cursorStack = null;
      }
    }
  } else {
    grid[binding] = state.cursorStack;
    state.cursorStack = slot;
  }
  renderAllInventoryViews();
}

function handleCraftSlotSecondary(displayIndex) {
  const binding = getCraftSlotBinding(displayIndex);
  if (binding == null || (state.mode !== "inventory" && state.mode !== "table")) {
    return;
  }
  const grid = getActiveCraftGrid();
  const slot = grid[binding];
  if (!state.cursorStack) {
    if (!slot) {
      return;
    }
    const takeCount = Math.ceil(slot.count / 2);
    state.cursorStack = { ...slot, count: takeCount };
    slot.count -= takeCount;
    if (slot.count <= 0) {
      grid[binding] = null;
    }
  } else if (!slot) {
    grid[binding] = { ...state.cursorStack, count: 1 };
    state.cursorStack.count -= 1;
    if (state.cursorStack.count <= 0) {
      state.cursorStack = null;
    }
  } else if (canStacksMerge(slot, state.cursorStack) && slot.count < getMaxStackSize(slot.itemId)) {
    slot.count += 1;
    state.cursorStack.count -= 1;
    if (state.cursorStack.count <= 0) {
      state.cursorStack = null;
    }
  }
  renderAllInventoryViews();
}

function consumeCraftRecipe(recipe) {
  const grid = getActiveCraftGrid();
  if (recipe.shapeless) {
    const remaining = [...recipe.inputs];
    for (let index = 0; index < grid.length; index += 1) {
      const slot = grid[index];
      if (!slot) {
        continue;
      }
      const itemIndex = remaining.indexOf(slot.itemId);
      if (itemIndex === -1) {
        continue;
      }
      remaining.splice(itemIndex, 1);
      slot.count -= 1;
      if (slot.count <= 0) {
        grid[index] = null;
      }
    }
    return;
  }

  for (let index = 0; index < grid.length; index += 1) {
    const slot = grid[index];
    if (!slot) {
      continue;
    }
    slot.count -= 1;
    if (slot.count <= 0) {
      grid[index] = null;
    }
  }
}

function handleCraftResultPrimary() {
  const recipe = getCurrentRecipe();
  if (!recipe) {
    return;
  }
  const outputStack = createInventoryStack(recipe.output.itemId, recipe.output.count);
  if (!state.cursorStack) {
    state.cursorStack = outputStack;
  } else if (canStacksMerge(state.cursorStack, outputStack) && state.cursorStack.count + outputStack.count <= getMaxStackSize(outputStack.itemId)) {
    state.cursorStack.count += outputStack.count;
  } else {
    return;
  }
  consumeCraftRecipe(recipe);
  state.handSwing = 1;
  sfx.craft();
  renderAllInventoryViews();
  queueSave();
}

function createBandIcons(container, type, filledCount, totalCount, hidden = false) {
  container.classList.toggle("hidden", hidden);
  if (container.children.length !== totalCount || container.dataset.iconType !== type) {
    container.innerHTML = "";
    container.dataset.iconType = type;
    for (let index = 0; index < totalCount; index += 1) {
      const icon = document.createElement("span");
      icon.className = `band-icon ${type}`;
      container.appendChild(icon);
    }
  }
  Array.from(container.children).forEach((icon, index) => {
    icon.classList.toggle("filled", index < filledCount);
  });
}

function getPlayerAabb(position = player.position) {
  return {
    minX: position.x - PLAYER_RADIUS,
    maxX: position.x + PLAYER_RADIUS,
    minY: position.y,
    maxY: position.y + PLAYER_HEIGHT,
    minZ: position.z - PLAYER_RADIUS,
    maxZ: position.z + PLAYER_RADIUS,
  };
}

function overlapsSolid(position = player.position) {
  const box = getPlayerAabb(position);
  const minX = Math.floor(box.minX);
  const maxX = Math.floor(box.maxX - 1e-6);
  const minY = Math.floor(box.minY);
  const maxY = Math.floor(box.maxY - 1e-6);
  const minZ = Math.floor(box.minZ);
  const maxZ = Math.floor(box.maxZ - 1e-6);
  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      for (let z = minZ; z <= maxZ; z += 1) {
        if (world.isSolidAt(x, y, z)) {
          return true;
        }
      }
    }
  }
  return false;
}

function canOccupy(x, y, z) {
  return !overlapsSolid(new THREE.Vector3(x, y, z));
}

function blockIntersectsPlayer(x, y, z) {
  const box = getPlayerAabb();
  return !(box.maxX <= x || box.minX >= x + 1 || box.maxY <= y || box.minY >= y + 1 || box.maxZ <= z || box.minZ >= z + 1);
}

function moveAxis(axis, delta) {
  if (delta === 0) {
    return false;
  }
  player.position[axis] += delta;
  let collided = false;
  const box = getPlayerAabb();
  const minX = Math.floor(box.minX);
  const maxX = Math.floor(box.maxX - 1e-6);
  const minY = Math.floor(box.minY);
  const maxY = Math.floor(box.maxY - 1e-6);
  const minZ = Math.floor(box.minZ);
  const maxZ = Math.floor(box.maxZ - 1e-6);
  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      for (let z = minZ; z <= maxZ; z += 1) {
        if (!world.isSolidAt(x, y, z)) {
          continue;
        }
        collided = true;
        if (axis === "x") {
          player.position.x = delta > 0 ? Math.min(player.position.x, x - PLAYER_RADIUS) : Math.max(player.position.x, x + 1 + PLAYER_RADIUS);
          player.velocity.x = 0;
        } else if (axis === "y") {
          if (delta > 0) {
            player.position.y = Math.min(player.position.y, y - PLAYER_HEIGHT);
          } else {
            player.position.y = Math.max(player.position.y, y + 1);
            player.grounded = true;
          }
          player.velocity.y = 0;
        } else if (axis === "z") {
          player.position.z = delta > 0 ? Math.min(player.position.z, z - PLAYER_RADIUS) : Math.max(player.position.z, z + 1 + PLAYER_RADIUS);
          player.velocity.z = 0;
        }
      }
    }
  }
  return collided;
}

function moveHorizontal(axis, delta) {
  if (delta === 0) {
    return;
  }
  const original = player.position.clone();
  const collided = moveAxis(axis, delta);
  if (!collided || !player.grounded) {
    return;
  }
  const stepped = original.clone();
  stepped.y += PLAYER_STEP_HEIGHT;
  if (!canOccupy(stepped.x, stepped.y, stepped.z)) {
    player.position.copy(original);
    moveAxis(axis, delta);
    return;
  }
  player.position.copy(stepped);
  const stepCollision = moveAxis(axis, delta);
  if (stepCollision || overlapsSolid()) {
    player.position.copy(original);
    moveAxis(axis, delta);
  }
}

function canHarvestBlock(blockId, toolDef) {
  const blockDef = getBlockDefinition(blockId);
  if (!blockDef.mineable) {
    return false;
  }
  if (!blockDef.requiresTool) {
    return true;
  }
  if (!toolDef || toolDef.toolType !== blockDef.preferredTool) {
    return false;
  }
  return (toolDef.toolLevel ?? 0) >= (blockDef.harvestLevel ?? 0);
}

function getBreakDuration(blockId) {
  const blockDef = getBlockDefinition(blockId);
  const toolDef = getSelectedToolDefinition();
  let duration = blockDef.breakTime;
  if (toolDef && toolDef.toolType === blockDef.preferredTool) {
    duration /= getToolMiningSpeed(toolDef, blockDef.preferredTool);
  } else if (blockDef.requiresTool) {
    duration *= 3.3;
  }
  return Math.max(duration, 0.15);
}

function damageHeldTool(amount = 1) {
  const stack = getSelectedStack();
  const def = getSelectedToolDefinition();
  if (!stack || !def) {
    return;
  }
  stack.durability = Math.max(0, (stack.durability ?? def.durability) - amount);
  if (stack.durability <= 0) {
    state.inventory[state.selectedIndex] = null;
  }
  renderAllInventoryViews();
  queueSave();
}

function selectHotbar(index) {
  state.selectedIndex = wrap(index, HOTBAR_SIZE);
  renderAllInventoryViews();
  updateHeldMesh();
  sfx.select();
  queueSave();
}

function tryUseOrPlaceBlock() {
  if (state.mode !== "playing" || !currentTarget) {
    return;
  }
  if (currentTarget.blockId === BLOCK.CRAFTING_TABLE) {
    openInventory("table");
    state.handSwing = 1;
    return;
  }
  if (currentTarget.blockId === BLOCK.CHEST) {
    const key = chestKey(currentTarget.x, currentTarget.y, currentTarget.z);
    openChest(key, presetChestKeys.has(key) ? "Surprise Chest" : "Oak Chest");
    state.handSwing = 1;
    return;
  }
  const selected = getSelectedStack();
  const itemDef = selected ? getItemDefinition(selected.itemId) : null;
  if (!selected || !itemDef || !Number.isInteger(itemDef.placeableBlockId)) {
    return;
  }
  const placeX = currentTarget.x + currentTarget.normal.x;
  const placeY = currentTarget.y + currentTarget.normal.y;
  const placeZ = currentTarget.z + currentTarget.normal.z;
  const occupant = world.getBlock(placeX, placeY, placeZ);
  if (!world.isInside(placeX, placeY, placeZ) || (occupant !== BLOCK.AIR && occupant !== BLOCK.WATER) || blockIntersectsPlayer(placeX, placeY, placeZ)) {
    return;
  }
  if (itemDef.placeableBlockId === BLOCK.TORCH) {
    const supportBlock = world.getBlock(placeX, placeY - 1, placeZ);
    if (supportBlock === BLOCK.AIR || supportBlock === BLOCK.WATER) {
      return;
    }
  }
  if (world.setBlock(placeX, placeY, placeZ, itemDef.placeableBlockId)) {
    if (itemDef.placeableBlockId === BLOCK.CHEST) {
      state.chests.set(chestKey(placeX, placeY, placeZ), createEmptySlots(27));
    }
    selected.count -= 1;
    if (selected.count <= 0) {
      state.inventory[state.selectedIndex] = null;
    }
    state.handSwing = 1;
    updateHeldMesh();
    renderAllInventoryViews();
    sfx.place();
    queueSave();
  }
}
function getSurfaceType(blockId) {
  if (blockId === BLOCK.SAND) return "sand";
  if ([BLOCK.STONE, BLOCK.COBBLESTONE, BLOCK.COAL_ORE, BLOCK.IRON_ORE, BLOCK.BEDROCK].includes(blockId)) return "stone";
  if ([BLOCK.OAK_LOG, BLOCK.PLANKS, BLOCK.CRAFTING_TABLE].includes(blockId)) return "wood";
  if (blockId === BLOCK.WATER) return "water";
  return "grass";
}

function updateLighting(dt) {
  state.timeOfDay = wrap(state.timeOfDay + dt / DAY_DURATION_SECONDS, 1);
  state.elapsed += dt;
  const sunAngle = state.timeOfDay * Math.PI * 2 - Math.PI / 2;
  const elevation = Math.sin(sunAngle);
  const daylight = clamp((elevation + 0.22) / 1.18, 0, 1);
  state.daylight = daylight;
  const sunrise = Math.max(0, 1 - Math.abs(elevation) * 4);
  const skyColor = new THREE.Color().lerpColors(nightSky, daySky, daylight).lerp(sunriseTint, sunrise * 0.14);
  const fogColor = new THREE.Color().lerpColors(nightFog, dayFog, daylight).lerp(sunriseTint, sunrise * 0.1);
  if (player.underwater) {
    renderer.setClearColor(underwaterColor);
    scene.fog.color.copy(underwaterColor);
    scene.fog.near = 1.5;
    scene.fog.far = 18;
  } else {
    renderer.setClearColor(skyColor);
    scene.fog.color.copy(fogColor);
    scene.fog.near = 28;
    scene.fog.far = 130;
  }
  ambientLight.intensity = 0.28 + daylight * 0.72;
  hemiLight.intensity = 0.18 + daylight * 0.45;
  sunLight.intensity = 0.14 + Math.max(0, elevation) * 1.7;
  sunLight.position.set(Math.cos(sunAngle) * 62, Math.sin(sunAngle) * 74, Math.sin(sunAngle * 0.55) * 48);
  sunLight.target.position.set(0, 0, 0);
  sunMesh.position.copy(sunLight.position).normalize().multiplyScalar(130);
  moonMesh.position.copy(sunMesh.position).multiplyScalar(-1);
  for (const cloud of clouds.children) {
    const span = 130;
    const drift = wrap(cloud.userData.baseX + state.elapsed * cloud.userData.speed, span * 2) - span;
    cloud.position.set(drift, cloud.userData.height, cloud.userData.baseZ);
  }
}

function updateTorchLights() {
  const nearbyTorches = world.getNearbyTorches(player.position, 12);
  torchLights.forEach((light, index) => {
    const torch = nearbyTorches[index];
    if (!torch) {
      light.visible = false;
      return;
    }
    light.visible = true;
    light.intensity = 0.85;
    light.position.set(torch.x, torch.y, torch.z);
  });
}

function updatePlayer(dt) {
  const feetBlock = world.getBlock(Math.floor(player.position.x), Math.floor(player.position.y + 0.1), Math.floor(player.position.z));
  const bodyBlock = world.getBlock(Math.floor(player.position.x), Math.floor(player.position.y + 0.9), Math.floor(player.position.z));
  const headBlock = world.getBlock(Math.floor(player.position.x), Math.floor(player.position.y + PLAYER_EYE_HEIGHT), Math.floor(player.position.z));
  player.underwater = headBlock === BLOCK.WATER;
  const inWater = feetBlock === BLOCK.WATER || bodyBlock === BLOCK.WATER || headBlock === BLOCK.WATER;
  const inputX = ((keys.has("KeyD") || keys.has("ArrowRight")) ? 1 : 0) - ((keys.has("KeyA") || keys.has("ArrowLeft")) ? 1 : 0);
  const inputZ = ((keys.has("KeyW") || keys.has("ArrowUp")) ? 1 : 0) - ((keys.has("KeyS") || keys.has("ArrowDown")) ? 1 : 0);
  const inputLength = Math.hypot(inputX, inputZ) || 1;
  const moveX = inputX / inputLength;
  const moveZ = inputZ / inputLength;
  const moving = inputX !== 0 || inputZ !== 0;
  const wantsSprint = (keys.has("ShiftLeft") || keys.has("ShiftRight")) && inputZ > 0 && !inWater;
  const sprinting = wantsSprint && moving && player.stamina > 8;
  player.isSprinting = sprinting;
  let speed = sprinting ? SPRINT_SPEED : WALK_SPEED;
  if (inWater) {
    speed *= 0.45;
  }
  const forwardX = -Math.sin(player.yaw);
  const forwardZ = -Math.cos(player.yaw);
  const rightX = Math.cos(player.yaw);
  const rightZ = -Math.sin(player.yaw);
  const targetVelocityX = (rightX * moveX + forwardX * moveZ) * speed;
  const targetVelocityZ = (rightZ * moveX + forwardZ * moveZ) * speed;
  const accel = player.grounded ? 16 : inWater ? 8 : 5;
  player.velocity.x += (targetVelocityX - player.velocity.x) * Math.min(1, accel * dt);
  player.velocity.z += (targetVelocityZ - player.velocity.z) * Math.min(1, accel * dt);
  if (!moving) {
    const drag = player.grounded ? 0.14 : 0.06;
    player.velocity.x *= 1 - drag;
    player.velocity.z *= 1 - drag;
  }
  if (jumpQueued) {
    if (player.grounded) {
      player.velocity.y = JUMP_SPEED;
      player.grounded = false;
      sfx.jump();
    } else if (inWater) {
      player.velocity.y += 2.8;
      sfx.jump();
    }
    jumpQueued = false;
  }
  if (inWater) {
    if (keys.has("Space")) {
      player.velocity.y += SWIM_ASCEND_ACCEL * dt;
    }
    if (keys.has("ControlLeft") || keys.has("ControlRight") || keys.has("KeyC")) {
      player.velocity.y -= SWIM_ASCEND_ACCEL * 0.7 * dt;
    }
    player.velocity.y -= SWIM_GRAVITY * dt;
    player.velocity.y = clamp(player.velocity.y, -4.4, 5.6);
  } else {
    player.velocity.y -= GRAVITY * dt;
  }
  if (sprinting) {
    player.stamina = clamp(player.stamina - 18 * dt, 0, player.maxStamina);
  } else {
    player.stamina = clamp(player.stamina + (player.grounded ? 15 : 8) * dt, 0, player.maxStamina);
  }
  if (player.underwater) {
    player.oxygen = clamp(player.oxygen - 20 * dt, 0, player.maxOxygen);
    if (player.oxygen <= 0) {
      player.drownTimer -= dt;
      if (player.drownTimer <= 0) {
        applyDamage(8, "drowning");
        player.drownTimer = 1;
      }
    }
  } else {
    player.oxygen = clamp(player.oxygen + 36 * dt, 0, player.maxOxygen);
    player.drownTimer = 0;
  }
  player.regenDelay = Math.max(0, player.regenDelay - dt);
  if (player.health < player.maxHealth && player.regenDelay <= 0 && player.stamina > 42 && !player.underwater) {
    player.health = clamp(player.health + 2.6 * dt, 0, player.maxHealth);
    player.stamina = clamp(player.stamina - 1.6 * dt, 0, player.maxStamina);
  }
  const wasGrounded = player.grounded;
  const verticalBeforeMove = player.velocity.y;
  player.grounded = false;
  moveHorizontal("x", player.velocity.x * dt);
  moveHorizontal("z", player.velocity.z * dt);
  moveAxis("y", player.velocity.y * dt);
  player.position.x = clamp(player.position.x, WORLD_MIN_X + 1.2, WORLD_MAX_X - 1.2);
  player.position.z = clamp(player.position.z, WORLD_MIN_Z + 1.2, WORLD_MAX_Z - 1.2);
  if (player.grounded && verticalBeforeMove < -11) {
    applyDamage((Math.abs(verticalBeforeMove) - 11) * 3.6, "fall");
    sfx.land(Math.abs(verticalBeforeMove));
  } else if (player.grounded && !wasGrounded && verticalBeforeMove < -3) {
    sfx.land(Math.abs(verticalBeforeMove));
  }
  if (player.grounded && !inWater) {
    player.lastSafePosition.copy(player.position);
  }
  if (player.position.y < -12) {
    deathCopy.textContent = getDeathMessage("void");
    setMode("dead");
    releasePointerLock();
  }
  const horizontalSpeed = Math.hypot(player.velocity.x, player.velocity.z);
  if (player.grounded && moving && horizontalSpeed > 0.65) {
    player.stepTimer -= dt;
    if (player.stepTimer <= 0) {
      sfx.step(getSurfaceType(feetBlock));
      player.stepTimer = sprinting ? 0.26 : 0.38;
    }
    player.bobPhase += dt * (sprinting ? 13 : 9);
  } else {
    player.stepTimer = Math.max(0, player.stepTimer - dt * 0.4);
    player.bobPhase += dt * 2.5;
  }
  const bobAmount = player.grounded ? Math.min(horizontalSpeed / SPRINT_SPEED, 1) * 0.05 : 0;
  const bobOffset = player.grounded ? Math.sin(player.bobPhase) * bobAmount : 0;
  camera.position.set(player.position.x, player.position.y + PLAYER_EYE_HEIGHT + bobOffset, player.position.z);
  camera.rotation.set(player.pitch, player.yaw, 0);
  const targetFov = sprinting ? 90 : 84;
  const nextFov = camera.fov + (targetFov - camera.fov) * 0.12;
  if (Math.abs(nextFov - camera.fov) > 0.02) {
    camera.fov = nextFov;
    camera.updateProjectionMatrix();
  }
}

function updateDrops(dt) {
  for (let index = state.drops.length - 1; index >= 0; index -= 1) {
    const drop = state.drops[index];
    drop.age += dt;
    drop.velocity.y -= 16 * dt;
    drop.mesh.position.addScaledVector(drop.velocity, dt);
    const floorY = Math.floor(drop.mesh.position.y - 0.18);
    if (world.isSolidAt(Math.floor(drop.mesh.position.x), floorY, Math.floor(drop.mesh.position.z)) && drop.velocity.y < 0) {
      drop.mesh.position.y = floorY + 1.15;
      drop.velocity.y *= -0.18;
      drop.velocity.x *= 0.65;
      drop.velocity.z *= 0.65;
    }
    if (drop.age > 0.3 && drop.mesh.position.distanceToSquared(camera.position) < 1.9 * 1.9) {
      const remainder = addStackToInventory(drop.stack, false);
      if (!remainder) {
        scene.remove(drop.mesh);
        state.drops.splice(index, 1);
        queueSave();
      } else {
        drop.stack = remainder;
      }
    }
  }
}

function updateInteraction(dt) {
  state.mobSwingCooldown = Math.max(0, state.mobSwingCooldown - dt);
  camera.getWorldDirection(lookDirection);
  currentTarget = world.raycast(camera.position, lookDirection, MAX_INTERACT_DISTANCE);
  const mobCandidate = mobSystem.getMobTarget(camera.position, lookDirection, MAX_INTERACT_DISTANCE);
  const blockDistance = currentTarget?.distance ?? Number.POSITIVE_INFINITY;
  currentMobTarget = mobCandidate && mobCandidate.distance <= blockDistance + 0.15 ? mobCandidate.mob : null;

  if (currentTarget && !currentMobTarget) {
    targetMarker.visible = true;
    targetMarker.position.set(currentTarget.x + 0.5, currentTarget.y + 0.5, currentTarget.z + 0.5);
    targetMarker.material.color.set(getBlockDefinition(currentTarget.blockId).mineable ? 0xffffff : 0xff7766);
  } else {
    targetMarker.visible = false;
    mining.key = "";
    mining.progress = 0;
  }

  if (pointer.left && currentMobTarget && state.mode === "playing" && state.mobSwingCooldown <= 0) {
    mobSystem.damageMob(currentMobTarget, getSelectedAttackDamage(), spawnDrop);
    const toolDef = getSelectedToolDefinition();
    if (toolDef) {
      damageHeldTool(1);
    }
    state.handSwing = 1;
    state.mobSwingCooldown = toolDef?.toolType === "sword" ? 0.34 : 0.5;
    sfx.mine();
    return;
  }

  if (pointer.left && currentTarget && state.mode === "playing" && getBlockDefinition(currentTarget.blockId).mineable) {
    const key = `${currentTarget.x},${currentTarget.y},${currentTarget.z}`;
    const duration = getBreakDuration(currentTarget.blockId);
    if (key !== mining.key) {
      mining.key = key;
      mining.progress = 0;
      mining.duration = duration;
    }
    mining.progress += dt / mining.duration;
    targetMarker.material.color.setHSL(0.12, 0.9, 0.55 + Math.min(0.25, mining.progress * 0.12));
    if (mining.progress >= 1) {
      const toolDef = getSelectedToolDefinition();
      const canHarvest = canHarvestBlock(currentTarget.blockId, toolDef);
      const dropItemId = getDropItemForBlock(currentTarget.blockId);
      if (currentTarget.blockId === BLOCK.CHEST) {
        const key = chestKey(currentTarget.x, currentTarget.y, currentTarget.z);
        const chestSlotsData = state.chests.get(key) ?? [];
        chestSlotsData.forEach((stack) => {
          if (stack) {
            spawnDrop(stack.itemId, currentTarget.x + 0.5, currentTarget.y + 0.45, currentTarget.z + 0.5, stack.count, stack.durability);
          }
        });
        state.chests.delete(key);
      }
      world.setBlock(currentTarget.x, currentTarget.y, currentTarget.z, BLOCK.AIR);
      if (canHarvest && dropItemId) {
        spawnDrop(dropItemId, currentTarget.x + 0.5, currentTarget.y + 0.2, currentTarget.z + 0.5);
      }
      if (toolDef) {
        damageHeldTool(1);
      }
      state.handSwing = 1;
      sfx.mine();
      mining.key = "";
      mining.progress = 0;
      currentTarget = null;
      targetMarker.visible = false;
      queueSave();
    }
  } else if (!pointer.left) {
    mining.key = "";
    mining.progress = 0;
  }
}

function getTimeLabel(value) {
  if (value < 0.23) return "DAWN";
  if (value < 0.52) return "DAY";
  if (value < 0.72) return "SUNSET";
  return "NIGHT";
}

function updateHud() {
  coordsReadout.textContent = `X:${player.position.x.toFixed(1)} Y:${player.position.y.toFixed(1)} Z:${player.position.z.toFixed(1)}`;
  seedReadout.textContent = `SEED ${WORLD_SEED}`;
  timeReadout.textContent = getTimeLabel(state.timeOfDay);
  const heldStack = getSelectedStack();
  heldReadout.textContent = heldStack ? `${getItemName(heldStack.itemId).toUpperCase()} ${heldStack.count > 1 ? `x${heldStack.count}` : ""}` : "HAND EMPTY";
  targetReadout.textContent = currentMobTarget
    ? `TARGET ${currentMobTarget.def.label.toUpperCase()}`
    : currentTarget
      ? `TARGET ${BLOCK_TYPES[currentTarget.blockId].name.toUpperCase()}`
      : "TARGET NONE";
  if (state.mode === "dead") {
    tooltipLabel.textContent = "Respawn to get back into the world.";
  } else if (state.mode === "inventory" || state.mode === "table") {
    tooltipLabel.textContent = state.mode === "table" ? "Crafting table online. Combine materials in the 3x3 grid." : "Inventory open. Use the 2x2 pack grid for early recipes.";
  } else if (state.mode === "chest") {
    tooltipLabel.textContent = "Chest open. Move loot between cache and pack.";
  } else if (currentMobTarget) {
    tooltipLabel.textContent = `Left click attack ${currentMobTarget.def.label} | ${getSelectedToolDefinition()?.toolType === "sword" ? "Sword" : "Tool"} damage ${getSelectedAttackDamage().toFixed(1)}`;
  } else if (currentTarget?.blockId === BLOCK.CRAFTING_TABLE) {
    tooltipLabel.textContent = "Right click to use Crafting Table | Left click to break | E inventory";
  } else if (currentTarget?.blockId === BLOCK.CHEST) {
    tooltipLabel.textContent = "Right click to open Chest | Left click to break | E inventory";
  } else if (currentTarget) {
    const progress = mining.key ? Math.round(mining.progress * 100) : 0;
    tooltipLabel.textContent = mining.key
      ? `Mining ${BLOCK_TYPES[currentTarget.blockId].name} ${progress}%`
      : heldStack && isPlaceableItem(heldStack.itemId)
        ? `Left click mine | Right click place ${getItemName(heldStack.itemId)} | E inventory`
        : `Left click mine | Right click use | E inventory`;
  } else {
    tooltipLabel.textContent = heldStack ? `Holding ${getItemName(heldStack.itemId)} | E inventory | Shift sprint` : "Punch a tree for logs | E inventory | Shift sprint";
  }
  createBandIcons(heartsBand, "heart", Math.ceil(player.health / 10), 10, false);
  createBandIcons(staminaBand, "stamina", Math.ceil(player.stamina / 10), 10, false);
  createBandIcons(oxygenBand, "oxygen", Math.ceil(player.oxygen / 10), 10, !player.underwater && player.oxygen > 98);
  const healthRatio = player.health / player.maxHealth;
  const lowHealthPulse = healthRatio < 0.35 ? (0.12 + (0.35 - healthRatio) * 0.75 * (0.5 + 0.5 * Math.sin(state.elapsed * 7))) : 0;
  state.damageFlash = Math.max(0, state.damageFlash - FIXED_TIME_STEP * 2.4);
  damageFlash.style.opacity = `${Math.max(lowHealthPulse, state.damageFlash * 0.7)}`;
  saveIndicator.classList.toggle("fresh", performance.now() < saveState.pulseUntil);
}

function updateViewModel(dt) {
  const speedRatio = player.grounded ? Math.min(Math.hypot(player.velocity.x, player.velocity.z) / SPRINT_SPEED, 1) : 0;
  const bobX = Math.sin(player.bobPhase * 0.5) * 0.025 * speedRatio;
  const bobY = Math.abs(Math.cos(player.bobPhase * 0.5)) * 0.02 * speedRatio;
  state.handSwing = Math.max(0, state.handSwing - dt * 3.2);
  const swing = Math.sin(state.handSwing * Math.PI);
  viewModel.visible = state.mode === "playing";
  viewModel.position.set(0.64 + bobX + swing * 0.08, -0.48 - bobY - swing * 0.05, -1.08 + swing * 0.05);
  viewModel.rotation.set(-0.36 + swing * 0.22, -0.24 - swing * 0.32, -0.08 + swing * 0.12);
  if (heldMesh) {
    heldMesh.rotation.z = (heldMesh.userData.baseRotationZ ?? 0.12) + swing * 0.18;
  }
}

function updateSaveTimer(dt) {
  if (!saveState.dirty) {
    return;
  }
  saveState.countdown -= dt;
  if (saveState.countdown <= 0) {
    saveGame();
  }
}

function fixedUpdate(dt) {
  updateLighting(dt);
  updateTorchLights();
  if (state.mode === "playing") {
    updatePlayer(dt);
    mobSystem.update(dt, {
      player: { position: player.position, applyDamage },
      daylight: state.daylight,
      spawnDrop,
    });
    updateInteraction(dt);
  }
  updateDrops(dt);
  updateViewModel(dt);
  updateSaveTimer(dt);
  updateHud();
}

function renderFrame() {
  renderer.clear();
  renderer.render(scene, camera);
  renderer.clearDepth();
  renderer.render(viewScene, viewCamera);
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    runBrowserAction(() => document.exitFullscreen?.());
    return;
  }
  runBrowserAction(() => document.documentElement.requestFullscreen?.());
}

function onResize() {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  viewCamera.aspect = window.innerWidth / window.innerHeight;
  viewCamera.updateProjectionMatrix();
}
startButton.addEventListener("click", () => {
  state.started = true;
  sfx.ensure();
  setMode("playing");
  requestPointerLock();
});
resumeButton.addEventListener("click", () => {
  sfx.ensure();
  setMode("playing");
  requestPointerLock();
});
closeInventoryButton.addEventListener("click", closeInventory);
respawnButton.addEventListener("click", respawnPlayer);

canvas.addEventListener("click", () => {
  if (state.started && state.mode === "paused" && document.pointerLockElement !== canvas) {
    requestPointerLock();
  }
});

document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement === canvas) {
    if (state.mode === "paused") {
      setMode("playing");
    }
  } else if (state.started && state.mode === "playing") {
    setMode("paused");
  }
});

document.addEventListener("mousemove", (event) => {
  state.pointerX = event.clientX;
  state.pointerY = event.clientY;
  updateCursorStackVisual();
  if (document.pointerLockElement !== canvas) {
    return;
  }
  player.yaw -= event.movementX * 0.0025;
  player.pitch = clamp(player.pitch - event.movementY * 0.0022, -Math.PI / 2 + 0.03, Math.PI / 2 - 0.03);
});

window.addEventListener("keydown", (event) => {
  sfx.ensure();
  if (state.mode === "dead") {
    if (event.code === "Enter") {
      event.preventDefault();
      respawnPlayer();
    }
    return;
  }
  if (state.mode === "inventory" || state.mode === "table" || state.mode === "chest") {
    if ((event.code === "KeyE" || event.code === "Escape") && !event.repeat) {
      event.preventDefault();
      closeInventory();
    }
    return;
  }
  if (state.mode === "paused") {
    if (event.code === "Enter" && !event.repeat) {
      event.preventDefault();
      requestPointerLock();
    } else if (event.code === "KeyF" && !event.repeat) {
      event.preventDefault();
      toggleFullscreen();
    } else if (event.code === "KeyK" && !event.repeat) {
      event.preventDefault();
      saveGame();
    }
    return;
  }
  if (state.mode !== "playing") {
    if (event.code === "KeyF" && !event.repeat) {
      event.preventDefault();
      toggleFullscreen();
    }
    return;
  }
  if (event.code === "KeyE" && !event.repeat) {
    event.preventDefault();
    openInventory("inventory");
    return;
  }
  keys.add(event.code);
  if (event.code === "Space") {
    jumpQueued = true;
    event.preventDefault();
  }
  if (event.code.startsWith("Digit")) {
    const index = Number(event.code.replace("Digit", "")) - 1;
    if (index >= 0 && index < HOTBAR_SIZE) {
      selectHotbar(index);
    }
  }
  if (event.code === "KeyF") {
    toggleFullscreen();
  }
  if (event.code === "KeyK") {
    saveGame();
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

window.addEventListener("wheel", (event) => {
  if (state.mode !== "playing") {
    return;
  }
  selectHotbar(state.selectedIndex + Math.sign(event.deltaY));
  event.preventDefault();
}, { passive: false });

window.addEventListener("mousedown", (event) => {
  const isWorldPointerInput = document.pointerLockElement === canvas || event.target === canvas;
  if (state.mode !== "playing" || !isWorldPointerInput) {
    return;
  }
  sfx.ensure();
  if (event.button === 0) {
    pointer.left = true;
  }
  if (event.button === 2) {
    tryUseOrPlaceBlock();
  }
});

window.addEventListener("mouseup", (event) => {
  if (event.button === 0) {
    pointer.left = false;
  }
});
window.addEventListener("contextmenu", (event) => event.preventDefault());
window.addEventListener("blur", () => {
  keys.clear();
  pointer.left = false;
  jumpQueued = false;
});
window.addEventListener("resize", onResize);
window.addEventListener("beforeunload", saveGame);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    saveGame();
  }
});

if (overlapsSolid()) {
  player.position.copy(new THREE.Vector3(spawnPoint.x, spawnPoint.y, spawnPoint.z));
}

seedReadout.textContent = `SEED ${WORLD_SEED}`;
setMode("menu");
updateHeldMesh();
renderAllInventoryViews();
updateHud();

let lastTime = performance.now();
let accumulator = 0;
function animate(now) {
  const delta = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  accumulator += delta;
  while (accumulator >= FIXED_TIME_STEP) {
    fixedUpdate(FIXED_TIME_STEP);
    accumulator -= FIXED_TIME_STEP;
  }
  renderFrame();
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

window.render_game_to_text = () => {
  const recipe = getCurrentRecipe();
  const payload = {
    mode: state.mode,
    note: "Player position uses feet coordinates. X increases east, Y increases upward, Z increases south.",
    player: {
      x: Number(player.position.x.toFixed(2)),
      y: Number(player.position.y.toFixed(2)),
      z: Number(player.position.z.toFixed(2)),
      vx: Number(player.velocity.x.toFixed(2)),
      vy: Number(player.velocity.y.toFixed(2)),
      vz: Number(player.velocity.z.toFixed(2)),
      grounded: player.grounded,
      underwater: player.underwater,
      yaw: Number(player.yaw.toFixed(2)),
      pitch: Number(player.pitch.toFixed(2)),
      health: Number(player.health.toFixed(1)),
      stamina: Number(player.stamina.toFixed(1)),
      oxygen: Number(player.oxygen.toFixed(1)),
      fov: Number(camera.fov.toFixed(1)),
    },
    selected: getSelectedStack() ? {
      item: getItemName(getSelectedStack().itemId),
      count: getSelectedStack().count,
      durability: getSelectedStack().durability,
    } : null,
    target: currentMobTarget
      ? {
          type: "mob",
          name: currentMobTarget.def.label,
          x: Number(currentMobTarget.position.x.toFixed(2)),
          y: Number(currentMobTarget.position.y.toFixed(2)),
          z: Number(currentMobTarget.position.z.toFixed(2)),
          health: Number(currentMobTarget.health.toFixed(1)),
        }
      : currentTarget
        ? {
            type: "block",
            x: currentTarget.x,
            y: currentTarget.y,
            z: currentTarget.z,
            name: BLOCK_TYPES[currentTarget.blockId].name,
            face: currentTarget.normal,
            breakProgress: Number(mining.progress.toFixed(2)),
          }
        : null,
    world: {
      seed: WORLD_SEED,
      time: getTimeLabel(state.timeOfDay),
      pointerLocked: document.pointerLockElement === canvas,
      dirtyBlocks: Object.keys(world.serializeChanges()).length,
      drops: state.drops.map((drop) => ({ item: getItemName(drop.stack.itemId), count: drop.stack.count })),
      mobs: mobSystem.getVisibleState(player.position),
    },
    inventoryOpen: state.mode === "inventory" || state.mode === "table" || state.mode === "chest",
    craftStation: state.mode === "table" ? "crafting_table" : state.mode === "inventory" ? "inventory" : null,
    chestOpen: state.mode === "chest" ? {
      key: state.openChestKey,
      title: state.chestTitle,
      slots: (getOpenChestSlots() ?? []).filter(Boolean).map((stack) => ({ item: getItemName(stack.itemId), count: stack.count })),
    } : null,
    craftResult: recipe ? { item: getItemName(recipe.output.itemId), count: recipe.output.count } : null,
    cursor: state.cursorStack ? { item: getItemName(state.cursorStack.itemId), count: state.cursorStack.count } : null,
    hotbar: Array.from({ length: HOTBAR_SIZE }, (_, index) => {
      const stack = state.inventory[index];
      return stack ? { slot: index + 1, active: index === state.selectedIndex, item: getItemName(stack.itemId), count: stack.count, durability: stack.durability } : { slot: index + 1, active: index === state.selectedIndex, item: null };
    }),
    inventoryCounts: Object.values(ITEM).map((itemId) => ({ item: getItemName(itemId), count: countItemInInventory(itemId) })).filter((entry) => entry.count > 0),
    nearby: world.getNearbyBlocks(player.position, 3),
  };
  return JSON.stringify(payload);
};

window.__brantcraftDebug = {
  setTimeOfDay(value) {
    state.timeOfDay = wrap(value, 1);
  },
  getMobs() {
    return mobSystem.getVisibleState(player.position);
  },
  getPresetChests() {
    return world.getPresetChests?.() ?? [];
  },
  teleportTo(x, y, z) {
    player.position.set(x, y, z);
    player.velocity.set(0, 0, 0);
  },
  setRotation(yaw, pitch = player.pitch) {
    player.yaw = yaw;
    player.pitch = pitch;
  },
  openChestAt(x, y, z) {
    const key = chestKey(x, y, z);
    const isPreset = (world.getPresetChests?.() ?? []).some((entry) => chestKey(entry.x, entry.y, entry.z) === key);
    openChest(key, isPreset ? "Surprise Chest" : "Oak Chest");
  },
};

window.advanceTime = (milliseconds) => {
  const steps = Math.max(1, Math.round(milliseconds / (FIXED_TIME_STEP * 1000)));
  for (let index = 0; index < steps; index += 1) {
    fixedUpdate(FIXED_TIME_STEP);
  }
  renderFrame();
  lastTime = performance.now();
};











































