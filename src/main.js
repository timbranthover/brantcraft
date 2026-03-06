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
const craftGrid = document.querySelector("#craft-grid");
const craftResult = document.querySelector("#craft-result");
const recipeList = document.querySelector("#recipe-list");
const inventoryStorage = document.querySelector("#inventory-storage");
const inventoryHotbar = document.querySelector("#inventory-hotbar");
const cursorStackEl = document.querySelector("#cursor-stack");

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const wrap = (value, length) => ((value % length) + length) % length;

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
    return slots;
  }

  if (savedInventory && typeof savedInventory === "object") {
    for (const [legacyKey, rawCount] of Object.entries(savedInventory)) {
      const itemId = LEGACY_ITEM_MIGRATION[Number(legacyKey)];
      if (!itemId) {
        continue;
      }
      insertStackIntoSlots(slots, createInventoryStack(itemId, Number(rawCount) || 0));
    }
    return slots;
  }

  for (const stack of STARTER_INVENTORY) {
    insertStackIntoSlots(slots, cloneStack(stack));
  }
  return slots;
}

const savedState = loadSave();
const sfx = createSoundSystem();

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  powerPreference: "high-performance",
  alpha: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.autoClear = false;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x9dd0ff, 28, 130);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 260);
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
const viewCamera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.01, 10);
viewScene.add(viewCamera);
viewScene.add(new THREE.AmbientLight(0xffffff, 1.2));
const viewSun = new THREE.DirectionalLight(0xffffff, 0.5);
viewSun.position.set(2, 2, 3);
viewScene.add(viewSun);

const viewModel = new THREE.Group();
viewCamera.add(viewModel);
viewModel.position.set(0.72, -0.62, -1.15);
const armMesh = new THREE.Mesh(
  new THREE.BoxGeometry(0.36, 0.62, 0.34),
  new THREE.MeshStandardMaterial({ color: 0xd6b397, roughness: 1 }),
);
armMesh.position.set(0, -0.08, 0);
armMesh.rotation.set(-0.12, 0.08, 0.24);
viewModel.add(armMesh);
const heldAnchor = new THREE.Group();
heldAnchor.position.set(-0.1, 0.12, -0.2);
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
  cursorStack: null,
  damageFlash: 0,
  handSwing: 0,
  pointerX: 0,
  pointerY: 0,
  drops: [],
  nextDropId: 1,
};

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
const mining = { key: "", progress: 0, duration: 0 };function runBrowserAction(action) {
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

function closeInventory() {
  if (state.mode !== "inventory" && state.mode !== "table") {
    return;
  }
  clearCraftGridToInventory(getActiveCraftGrid());
  setMode("playing");
  requestPointerLock();
}

function setMode(mode) {
  state.mode = mode;
  app.dataset.mode = mode;
  menu.classList.toggle("visible", mode === "menu");
  pausePanel.classList.toggle("visible", mode === "paused");
  inventoryPanel.classList.toggle("visible", mode === "inventory" || mode === "table");
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

function updateHeldMesh() {
  if (heldMesh) {
    heldAnchor.remove(heldMesh);
    heldMesh = null;
  }
  const stack = getSelectedStack();
  if (!stack) {
    return;
  }
  const material = new THREE.MeshBasicMaterial({ map: getItemTexture(stack.itemId, atlas), transparent: true, alphaTest: 0.1, side: THREE.DoubleSide });
  heldMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.56), material);
  heldMesh.position.set(-0.02, 0.04, -0.12);
  heldMesh.rotation.set(0.3, 0.8, 0.18);
  heldAnchor.add(heldMesh);
}

const hudHotbarSlots = Array.from({ length: HOTBAR_SIZE }, (_, index) => {
  const slot = createSlotElement("hud", index, true);
  slot.addEventListener("click", () => selectHotbar(index));
  hotbar.appendChild(slot);
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

function updateRecipeList() {
  const station = getActiveStation();
  const recipes = RECIPES.filter((recipe) => recipe.station === station);
  recipeList.innerHTML = recipes.map((recipe) => {
    const needs = recipe.shapeless ? recipe.inputs.join(" + ") : recipe.pattern.flat().filter(Boolean).join(" + ");
    const required = {};
    const ids = recipe.shapeless ? recipe.inputs : recipe.pattern.flat().filter(Boolean);
    ids.forEach((itemId) => {
      required[itemId] = (required[itemId] ?? 0) + 1;
    });
    const ready = Object.entries(required).every(([itemId, count]) => countItemInInventory(itemId) >= count);
    return `<div class="recipe-chip ${ready ? "ready" : ""}">${getItemName(recipe.output.itemId)} :: ${needs}</div>`;
  }).join("");
}

function renderAllInventoryViews() {
  hudHotbarSlots.forEach((slot, index) => renderSlot(slot, state.inventory[index], { active: index === state.selectedIndex }));
  inventoryHotbarSlots.forEach((slot, index) => renderSlot(slot, state.inventory[index], { active: index === state.selectedIndex }));
  storageSlots.forEach((slot, index) => renderSlot(slot, state.inventory[index + HOTBAR_SIZE]));

  craftSlots.forEach((slot, displayIndex) => {
    const binding = getCraftSlotBinding(displayIndex);
    const stack = binding == null ? null : getActiveCraftGrid()[binding];
    renderSlot(slot, stack, { disabled: binding == null || (state.mode !== "inventory" && state.mode !== "table") });
  });

  const recipe = getCurrentRecipe();
  renderSlot(resultSlot, recipe ? createInventoryStack(recipe.output.itemId, recipe.output.count) : null, { disabled: !recipe });
  inventoryTitle.textContent = state.mode === "table" ? "Crafting Table" : "Inventory";
  inventoryModeReadout.textContent = state.mode === "table" ? "3x3 TABLE GRID" : "2x2 PACK GRID";
  recipeReadout.textContent = recipe ? `RECIPE: ${getItemName(recipe.output.itemId)} x${recipe.output.count}` : "RECIPE: NONE";
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
  container.innerHTML = "";
  for (let index = 0; index < totalCount; index += 1) {
    const icon = document.createElement("span");
    icon.className = `band-icon ${type} ${index < filledCount ? "filled" : ""}`;
    container.appendChild(icon);
  }
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
  if (world.setBlock(placeX, placeY, placeZ, itemDef.placeableBlockId)) {
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
  const targetFov = sprinting ? 81 : 75;
  camera.fov += (targetFov - camera.fov) * 0.12;
  camera.updateProjectionMatrix();
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
  camera.getWorldDirection(lookDirection);
  currentTarget = world.raycast(camera.position, lookDirection, MAX_INTERACT_DISTANCE);
  if (currentTarget) {
    targetMarker.visible = true;
    targetMarker.position.set(currentTarget.x + 0.5, currentTarget.y + 0.5, currentTarget.z + 0.5);
    targetMarker.material.color.set(getBlockDefinition(currentTarget.blockId).mineable ? 0xffffff : 0xff7766);
  } else {
    targetMarker.visible = false;
    mining.key = "";
    mining.progress = 0;
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
  targetReadout.textContent = currentTarget ? `TARGET ${BLOCK_TYPES[currentTarget.blockId].name.toUpperCase()}` : "TARGET NONE";
  if (state.mode === "dead") {
    tooltipLabel.textContent = "Respawn to get back into the world.";
  } else if (state.mode === "inventory" || state.mode === "table") {
    tooltipLabel.textContent = state.mode === "table" ? "Crafting table online. Combine materials in the 3x3 grid." : "Inventory open. Use the 2x2 pack grid for early recipes.";
  } else if (currentTarget?.blockId === BLOCK.CRAFTING_TABLE) {
    tooltipLabel.textContent = "Right click to use Crafting Table | Left click to break | E inventory";
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
  viewModel.position.set(0.72 + bobX + swing * 0.12, -0.62 - bobY - swing * 0.08, -1.15 + swing * 0.08);
  viewModel.rotation.set(-0.5 + swing * 0.35, -0.34 - swing * 0.55, -0.16 + swing * 0.18);
  if (heldMesh) {
    heldMesh.rotation.z = 0.18 + swing * 0.55;
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
  if (state.mode === "playing") {
    updatePlayer(dt);
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
  if (state.mode === "inventory" || state.mode === "table") {
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
    },
    selected: getSelectedStack() ? {
      item: getItemName(getSelectedStack().itemId),
      count: getSelectedStack().count,
      durability: getSelectedStack().durability,
    } : null,
    target: currentTarget ? {
      x: currentTarget.x,
      y: currentTarget.y,
      z: currentTarget.z,
      name: BLOCK_TYPES[currentTarget.blockId].name,
      face: currentTarget.normal,
      breakProgress: Number(mining.progress.toFixed(2)),
    } : null,
    world: {
      seed: WORLD_SEED,
      time: getTimeLabel(state.timeOfDay),
      pointerLocked: document.pointerLockElement === canvas,
      dirtyBlocks: Object.keys(world.serializeChanges()).length,
      drops: state.drops.map((drop) => ({ item: getItemName(drop.stack.itemId), count: drop.stack.count })),
    },
    inventoryOpen: state.mode === "inventory" || state.mode === "table",
    craftStation: state.mode === "table" ? "crafting_table" : state.mode === "inventory" ? "inventory" : null,
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

window.advanceTime = (milliseconds) => {
  const steps = Math.max(1, Math.round(milliseconds / (FIXED_TIME_STEP * 1000)));
  for (let index = 0; index < steps; index += 1) {
    fixedUpdate(FIXED_TIME_STEP);
  }
  renderFrame();
  lastTime = performance.now();
};
