import * as THREE from "three";

import { BLOCK } from "./blocks.js";
import { MAX_INTERACT_DISTANCE, WORLD_MAX_X, WORLD_MAX_Z, WORLD_MIN_X, WORLD_MIN_Z } from "./constants.js";
import { ITEM } from "./items.js";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const MOB_DEFS = {
  zombie: {
    id: "zombie",
    label: "Zombie",
    passive: false,
    health: 20,
    speed: 2.1,
    attackDamage: 8,
    attackRange: 1.35,
    hitRadius: 0.45,
    height: 1.95,
    burnInDaylight: true,
    drops: [{ itemId: ITEM.ROTTEN_FLESH, min: 1, max: 2 }],
    createModel: createZombieModel,
  },
  chicken: {
    id: "chicken",
    label: "Chicken",
    passive: true,
    health: 4,
    speed: 1.1,
    hitRadius: 0.35,
    height: 0.9,
    drops: [{ itemId: ITEM.RAW_CHICKEN, min: 1, max: 1 }, { itemId: ITEM.FEATHER, min: 0, max: 2 }],
    createModel: createChickenModel,
  },
  pig: {
    id: "pig",
    label: "Pig",
    passive: true,
    health: 10,
    speed: 1.25,
    hitRadius: 0.45,
    height: 1.0,
    drops: [{ itemId: ITEM.RAW_PORKCHOP, min: 1, max: 2 }],
    createModel: createPigModel,
  },
  cow: {
    id: "cow",
    label: "Cow",
    passive: true,
    health: 10,
    speed: 1.2,
    hitRadius: 0.48,
    height: 1.45,
    drops: [{ itemId: ITEM.RAW_BEEF, min: 1, max: 3 }, { itemId: ITEM.LEATHER, min: 0, max: 2 }],
    createModel: createCowModel,
  },
};

const PASSIVE_TYPES = ["chicken", "pig", "cow"];
const PASSIVE_CAP = 10;
const ZOMBIE_CAP = 6;

function createBox(width, height, depth, color) {
  return new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), new THREE.MeshLambertMaterial({ color }));
}

function createZombieModel() {
  const group = new THREE.Group();
  const head = createBox(0.5, 0.5, 0.5, 0x78ae63);
  head.position.set(0, 1.62, 0);
  const torso = createBox(0.62, 0.74, 0.32, 0x3e7592);
  torso.position.set(0, 1.08, 0);
  const leftArm = createBox(0.18, 0.7, 0.18, 0x77ad61);
  leftArm.position.set(-0.4, 1.08, 0);
  const rightArm = createBox(0.18, 0.7, 0.18, 0x77ad61);
  rightArm.position.set(0.4, 1.08, 0);
  const leftLeg = createBox(0.22, 0.72, 0.22, 0x4a3a8f);
  leftLeg.position.set(-0.15, 0.38, 0);
  const rightLeg = createBox(0.22, 0.72, 0.22, 0x4a3a8f);
  rightLeg.position.set(0.15, 0.38, 0);
  group.add(head, torso, leftArm, rightArm, leftLeg, rightLeg);
  group.userData = { head, leftArm, rightArm, leftLeg, rightLeg };
  return group;
}

function createChickenModel() {
  const group = new THREE.Group();
  const body = createBox(0.56, 0.5, 0.68, 0xf4f4ef);
  body.position.set(0, 0.56, 0);
  const head = createBox(0.32, 0.32, 0.32, 0xf8f8f4);
  head.position.set(0, 0.95, 0.18);
  const beak = createBox(0.12, 0.08, 0.12, 0xd29f33);
  beak.position.set(0, 0.9, 0.36);
  const comb = createBox(0.1, 0.14, 0.08, 0xc14141);
  comb.position.set(0, 1.12, 0.12);
  const leftLeg = createBox(0.08, 0.3, 0.08, 0xc69930);
  leftLeg.position.set(-0.14, 0.18, 0.08);
  const rightLeg = createBox(0.08, 0.3, 0.08, 0xc69930);
  rightLeg.position.set(0.14, 0.18, 0.08);
  group.add(body, head, beak, comb, leftLeg, rightLeg);
  group.userData = { head, leftLeg, rightLeg };
  return group;
}

function createPigModel() {
  const group = new THREE.Group();
  const body = createBox(0.8, 0.56, 1.08, 0xe6a6b0);
  body.position.set(0, 0.64, 0);
  const head = createBox(0.54, 0.44, 0.46, 0xebadb8);
  head.position.set(0, 0.72, 0.74);
  const snout = createBox(0.26, 0.16, 0.14, 0xd98795);
  snout.position.set(0, 0.66, 1.02);
  const leftFront = createBox(0.14, 0.42, 0.14, 0xd9929d);
  leftFront.position.set(-0.24, 0.22, 0.32);
  const rightFront = createBox(0.14, 0.42, 0.14, 0xd9929d);
  rightFront.position.set(0.24, 0.22, 0.32);
  const leftBack = createBox(0.14, 0.42, 0.14, 0xd9929d);
  leftBack.position.set(-0.24, 0.22, -0.32);
  const rightBack = createBox(0.14, 0.42, 0.14, 0xd9929d);
  rightBack.position.set(0.24, 0.22, -0.32);
  group.add(body, head, snout, leftFront, rightFront, leftBack, rightBack);
  group.userData = { head, leftFront, rightFront, leftBack, rightBack };
  return group;
}

function createCowModel() {
  const group = new THREE.Group();
  const body = createBox(0.92, 0.74, 1.18, 0x6c4634);
  body.position.set(0, 0.88, 0);
  const patchA = createBox(0.2, 0.18, 0.2, 0xf1ede7);
  patchA.position.set(-0.22, 1, 0.16);
  const patchB = createBox(0.18, 0.16, 0.18, 0xf1ede7);
  patchB.position.set(0.24, 0.78, -0.2);
  const head = createBox(0.62, 0.5, 0.5, 0x74503c);
  head.position.set(0, 0.9, 0.86);
  const muzzle = createBox(0.34, 0.18, 0.18, 0xd8c1b4);
  muzzle.position.set(0, 0.78, 1.12);
  const leftFront = createBox(0.16, 0.62, 0.16, 0x4a3026);
  leftFront.position.set(-0.28, 0.31, 0.36);
  const rightFront = createBox(0.16, 0.62, 0.16, 0x4a3026);
  rightFront.position.set(0.28, 0.31, 0.36);
  const leftBack = createBox(0.16, 0.62, 0.16, 0x4a3026);
  leftBack.position.set(-0.28, 0.31, -0.36);
  const rightBack = createBox(0.16, 0.62, 0.16, 0x4a3026);
  rightBack.position.set(0.28, 0.31, -0.36);
  group.add(body, patchA, patchB, head, muzzle, leftFront, rightFront, leftBack, rightBack);
  group.userData = { head, leftFront, rightFront, leftBack, rightBack };
  return group;
}

function raySphereDistance(origin, direction, center, radius) {
  const offset = center.clone().sub(origin);
  const projection = offset.dot(direction);
  if (projection < 0 || projection > MAX_INTERACT_DISTANCE) {
    return null;
  }
  const perpendicular = offset.lengthSq() - projection * projection;
  const radiusSq = radius * radius;
  if (perpendicular > radiusSq) {
    return null;
  }
  const thc = Math.sqrt(radiusSq - perpendicular);
  const distance = projection - thc;
  return distance >= 0 ? distance : projection + thc;
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function canSpawnAt(world, x, z) {
  if (x < WORLD_MIN_X + 2 || x > WORLD_MAX_X - 2 || z < WORLD_MIN_Z + 2 || z > WORLD_MAX_Z - 2) {
    return null;
  }
  const floorX = Math.floor(x);
  const floorZ = Math.floor(z);
  const groundY = world.getTopSolidBlockY(floorX, floorZ);
  if (groundY < 1) {
    return null;
  }
  const groundBlock = world.getBlock(floorX, groundY, floorZ);
  if (groundBlock === BLOCK.WATER || groundBlock === BLOCK.LEAVES) {
    return null;
  }
  if (world.getBlock(floorX, groundY + 1, floorZ) !== BLOCK.AIR || world.getBlock(floorX, groundY + 2, floorZ) !== BLOCK.AIR) {
    return null;
  }
  return { x: floorX + 0.5, y: groundY + 1, z: floorZ + 0.5, groundBlock };
}

function findSpawnPoint(world, playerPosition, passive) {
  const minDistance = passive ? 10 : 18;
  const maxDistance = passive ? 24 : 34;
  for (let attempt = 0; attempt < 26; attempt += 1) {
    const angle = Math.random() * Math.PI * 2;
    const distance = randomBetween(minDistance, maxDistance);
    const x = playerPosition.x + Math.cos(angle) * distance;
    const z = playerPosition.z + Math.sin(angle) * distance;
    const candidate = canSpawnAt(world, x, z);
    if (!candidate) {
      continue;
    }
    if (passive && candidate.groundBlock !== BLOCK.GRASS) {
      continue;
    }
    if (!passive && world.isLightSourceNearby(Math.floor(candidate.x), Math.floor(candidate.y), Math.floor(candidate.z), 7)) {
      continue;
    }
    if (!passive && ![BLOCK.GRASS, BLOCK.DIRT, BLOCK.SAND, BLOCK.COBBLESTONE, BLOCK.STONE].includes(candidate.groundBlock)) {
      continue;
    }
    return candidate;
  }
  return null;
}


function applySeparation(mob, mobs) {
  const offset = new THREE.Vector3();
  for (const other of mobs) {
    if (other.id === mob.id) {
      continue;
    }
    const dx = mob.position.x - other.position.x;
    const dz = mob.position.z - other.position.z;
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq <= 0.001 || distanceSq > 1.6 * 1.6) {
      continue;
    }
    const scale = 0.04 / distanceSq;
    offset.x += dx * scale;
    offset.z += dz * scale;
  }
  mob.position.x = clamp(mob.position.x + offset.x, WORLD_MIN_X + 1.2, WORLD_MAX_X - 1.2);
  mob.position.z = clamp(mob.position.z + offset.z, WORLD_MIN_Z + 1.2, WORLD_MAX_Z - 1.2);
}
function animateMob(mob, dt) {
  mob.walkTime += dt * (mob.speed * 4.5);
  const swing = Math.sin(mob.walkTime) * (mob.moving ? 0.55 : 0.1);
  const parts = mob.mesh.userData;
  if (parts.leftLeg && parts.rightLeg) {
    parts.leftLeg.rotation.x = swing;
    parts.rightLeg.rotation.x = -swing;
  }
  if (parts.leftFront && parts.rightFront) {
    parts.leftFront.rotation.x = swing;
    parts.rightFront.rotation.x = -swing;
  }
  if (parts.leftBack && parts.rightBack) {
    parts.leftBack.rotation.x = -swing;
    parts.rightBack.rotation.x = swing;
  }
  if (parts.leftArm && parts.rightArm) {
    parts.leftArm.rotation.x = -swing;
    parts.rightArm.rotation.x = swing;
  }
  if (parts.head) {
    parts.head.rotation.y = Math.sin(mob.lookPhase) * 0.18;
  }
}

function spawnDropsForMob(mob, spawnDrop) {
  for (const drop of mob.def.drops) {
    const count = drop.min + Math.floor(Math.random() * (drop.max - drop.min + 1));
    if (count > 0) {
      spawnDrop(drop.itemId, mob.position.x, mob.position.y + mob.def.height * 0.35, mob.position.z, count);
    }
  }
}

export function createMobSystem({ scene, world }) {
  const group = new THREE.Group();
  group.name = "mobs";
  scene.add(group);

  const mobs = [];
  let nextMobId = 1;
  let passiveSpawnTimer = 0;
  let zombieSpawnTimer = 0;

  function spawnMob(type, position) {
    const def = MOB_DEFS[type];
    const mesh = def.createModel();
    mesh.position.copy(position);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    group.add(mesh);
    mobs.push({
      id: nextMobId++,
      type,
      def,
      mesh,
      position: mesh.position,
      yaw: mesh.rotation.y,
      targetYaw: mesh.rotation.y,
      health: def.health,
      velocityY: 0,
      actionTimer: randomBetween(1.2, 3.2),
      attackCooldown: 0,
      burnCooldown: 0,
      walkTime: Math.random() * Math.PI * 2,
      lookPhase: Math.random() * Math.PI * 2,
      moving: false,
      hurtFlash: 0,
    });
  }

  function removeMob(index) {
    const [mob] = mobs.splice(index, 1);
    if (!mob) {
      return;
    }
    mob.mesh.traverse((child) => {
      if (child.geometry) {
        child.geometry.dispose();
      }
      if (child.material) {
        child.material.dispose();
      }
    });
    group.remove(mob.mesh);
  }

  function damageMob(mob, amount, spawnDrop) {
    mob.health -= amount;
    mob.hurtFlash = 0.16;
    if (mob.health <= 0) {
      spawnDropsForMob(mob, spawnDrop);
      const index = mobs.findIndex((entry) => entry.id === mob.id);
      if (index >= 0) {
        removeMob(index);
      }
      return true;
    }
    return false;
  }

  function getMobTarget(origin, direction, maxDistance = MAX_INTERACT_DISTANCE) {
    let closest = null;
    for (const mob of mobs) {
      const center = new THREE.Vector3(mob.position.x, mob.position.y + mob.def.height * 0.55, mob.position.z);
      const distance = raySphereDistance(origin, direction, center, mob.def.hitRadius);
      if (distance == null || distance > maxDistance) {
        continue;
      }
      if (!closest || distance < closest.distance) {
        closest = { mob, distance };
      }
    }
    return closest;
  }

  function spawnPassives(playerPosition) {
    const passiveCount = mobs.filter((mob) => mob.def.passive).length;
    if (passiveCount >= PASSIVE_CAP) {
      return;
    }
    const spawnPoint = findSpawnPoint(world, playerPosition, true);
    if (!spawnPoint) {
      return;
    }
    const type = PASSIVE_TYPES[Math.floor(Math.random() * PASSIVE_TYPES.length)];
    spawnMob(type, new THREE.Vector3(spawnPoint.x, spawnPoint.y, spawnPoint.z));
  }

  function spawnZombie(playerPosition) {
    const zombieCount = mobs.filter((mob) => mob.type === "zombie").length;
    if (zombieCount >= ZOMBIE_CAP) {
      return;
    }
    const spawnPoint = findSpawnPoint(world, playerPosition, false);
    if (!spawnPoint) {
      return;
    }
    spawnMob("zombie", new THREE.Vector3(spawnPoint.x, spawnPoint.y, spawnPoint.z));
  }

  function updateMobPathing(mob, dt, player, daylight) {
    const toPlayerX = player.position.x - mob.position.x;
    const toPlayerZ = player.position.z - mob.position.z;
    const distanceToPlayer = Math.hypot(toPlayerX, toPlayerZ);
    mob.attackCooldown = Math.max(0, mob.attackCooldown - dt);
    mob.lookPhase += dt * (mob.def.passive ? 0.8 : 1.3);

    if (mob.type === "zombie") {
      if (daylight > 0.28) {
        mob.burnCooldown -= dt;
        mob.mesh.position.y += Math.sin(mob.lookPhase * 12) * 0.003;
        if (mob.burnCooldown <= 0) {
          mob.burnCooldown = 0.6;
          mob.health -= 4;
          if (mob.health <= 0) {
            return "dead";
          }
        }
      }
      mob.targetYaw = Math.atan2(-toPlayerX, -toPlayerZ);
      mob.moving = distanceToPlayer > mob.def.attackRange;
      if (distanceToPlayer <= mob.def.attackRange + 0.08 && mob.attackCooldown <= 0) {
        player.applyDamage(mob.def.attackDamage, "zombie");
        mob.attackCooldown = 1.05;
      }
    } else {
      const panic = distanceToPlayer < 6;
      mob.actionTimer -= dt;
      if (panic) {
        mob.targetYaw = Math.atan2(mob.position.x - player.position.x, mob.position.z - player.position.z);
        mob.moving = true;
      } else if (mob.actionTimer <= 0) {
        mob.actionTimer = randomBetween(1.2, 4.4);
        mob.targetYaw = mob.yaw + randomBetween(-1.1, 1.1);
        mob.moving = Math.random() > 0.22;
      }
    }

    let yawDelta = mob.targetYaw - mob.yaw;
    while (yawDelta > Math.PI) yawDelta -= Math.PI * 2;
    while (yawDelta < -Math.PI) yawDelta += Math.PI * 2;
    mob.yaw += yawDelta * Math.min(1, dt * 4.8);
    mob.mesh.rotation.y = mob.yaw;

    const moveSpeed = mob.moving ? mob.def.speed * (mob.type === "zombie" ? 1 : distanceToPlayer < 4.5 ? 1.2 : 0.8) : 0;
    const nextX = mob.position.x - Math.sin(mob.yaw) * moveSpeed * dt;
    const nextZ = mob.position.z - Math.cos(mob.yaw) * moveSpeed * dt;
    const candidate = canSpawnAt(world, nextX, nextZ);
    if (!candidate || Math.abs(candidate.y - mob.position.y) > 1.3) {
      mob.targetYaw += Math.PI * 0.6;
      mob.moving = false;
      return "alive";
    }

    mob.position.x = clamp(nextX, WORLD_MIN_X + 1.2, WORLD_MAX_X - 1.2);
    mob.position.z = clamp(nextZ, WORLD_MIN_Z + 1.2, WORLD_MAX_Z - 1.2);
    mob.position.y += (candidate.y - mob.position.y) * Math.min(1, dt * 7);
    return "alive";
  }

  function update(dt, { player, daylight, spawnDrop }) {
    passiveSpawnTimer -= dt;
    zombieSpawnTimer -= dt;
    if (daylight > 0.33 && passiveSpawnTimer <= 0) {
      spawnPassives(player.position);
      passiveSpawnTimer = randomBetween(2.2, 4.5);
    }
    if (daylight < 0.18 && zombieSpawnTimer <= 0) {
      spawnZombie(player.position);
      zombieSpawnTimer = randomBetween(2.6, 4.8);
    }

    for (let index = mobs.length - 1; index >= 0; index -= 1) {
      const mob = mobs[index];
      const status = updateMobPathing(mob, dt, player, daylight);
      applySeparation(mob, mobs);
      if (status === "dead") {
        spawnDropsForMob(mob, spawnDrop);
        removeMob(index);
        continue;
      }
      mob.hurtFlash = Math.max(0, mob.hurtFlash - dt);
      animateMob(mob, dt);
      const distanceToPlayer = mob.position.distanceTo(player.position);
      if (distanceToPlayer > 52 || (mob.def.passive && daylight < 0.1) || (mob.type === "zombie" && daylight > 0.45 && mob.health <= 8)) {
        removeMob(index);
      }
    }
  }

  function getVisibleState(playerPosition) {
    return mobs
      .map((mob) => ({
        type: mob.def.label,
        x: Number(mob.position.x.toFixed(2)),
        y: Number(mob.position.y.toFixed(2)),
        z: Number(mob.position.z.toFixed(2)),
        health: Number(mob.health.toFixed(1)),
        distance: Number(mob.position.distanceTo(playerPosition).toFixed(2)),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 12);
  }

  return {
    mobs,
    update,
    getMobTarget,
    damageMob,
    getVisibleState,
  };
}


