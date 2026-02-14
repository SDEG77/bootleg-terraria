import { createStore } from "zustand/vanilla";
import { immer } from "zustand/middleware/immer";
import { TILE, TILE_SIZE, WORLD_H, WORLD_W } from "@/lib/constants";
import { addToInventory, createInventory, getSelectedTile, removeFromInventory, type Inventory } from "@/lib/inventory";
import { createPlayer, resolveCollision, type Player } from "@/lib/player";
import { createWorld, getTile, inWorld, isSolid, setTile, type WorldGrid } from "@/lib/world";

export type WeaponDefinition = {
  id: string;
  name: string;
  mode: "melee" | "ranged";
  damage: number;
  cooldownFrames: number;
  range?: number;
  speed?: number;
};

export type SpellDefinition = {
  id: string;
  name: string;
  manaCost: number;
  damage: number;
  cooldownFrames: number;
  speed: number;
};

export const WEAPONS: WeaponDefinition[] = [
  { id: "iron_sword", name: "Iron Sword", mode: "melee", damage: 24, cooldownFrames: 16, range: 44 },
  { id: "blaster", name: "Blaster", mode: "ranged", damage: 14, cooldownFrames: 10, speed: 5.4 },
];

export const SPELL: SpellDefinition = {
  id: "fireball",
  name: "Fireball",
  manaCost: 25,
  damage: 34,
  cooldownFrames: 24,
  speed: 4.5,
};

export type Enemy = {
  id: number;
  kind: "slime";
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  onGround: boolean;
  hp: number;
  maxHp: number;
  touchDamage: number;
  touchCooldown: number;
};

export type Projectile = {
  id: number;
  kind: "bullet" | "fireball";
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  damage: number;
  ttl: number;
};

type GameState = {
  world: WorldGrid;
  player: Player;
  inventory: Inventory;
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  manaRegenPerSecond: number;
  spawnX: number;
  spawnY: number;
  zoom: number;
  timeOfDay: number;
  dayLengthMs: number;
  aimX: number;
  aimY: number;
  selectedWeaponIndex: number;
  weaponCooldown: number;
  spellCooldown: number;
  enemies: Enemy[];
  projectiles: Projectile[];
  nextEntityId: number;
  score: number;
};

type GameActions = {
  tick: (keys: Record<string, boolean>) => void;
  selectHotbar: (slotIndex: number) => void;
  changeZoom: (direction: number) => void;
  breakTile: (tx: number, ty: number) => void;
  placeTile: (tx: number, ty: number, worldX: number, worldY: number) => void;
  setAim: (worldX: number, worldY: number) => void;
  cycleWeapon: (direction: number) => void;
  useWeapon: () => void;
  castSpell: () => void;
};

export type GameStore = GameState & GameActions;

const MOVE_SPEED = 2.5;
const JUMP_SPEED = -8;
const INTERACT_RANGE_TILES = 6;
const MAX_HEALTH = 100;
const MAX_MANA = 100;
const MANA_REGEN_PER_SECOND = 10;
const MIN_ZOOM = 0.75;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.15;
const FRAME_MS = 1000 / 60;
const DEFAULT_DAY_LENGTH_MS = 3 * 60 * 1000;

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function isWithinInteractRange(state: GameState, tx: number, ty: number): boolean {
  const px = state.player.x + state.player.w / 2;
  const py = state.player.y + state.player.h / 2;
  const cx = tx * TILE_SIZE + TILE_SIZE / 2;
  const cy = ty * TILE_SIZE + TILE_SIZE / 2;
  const dx = cx - px;
  const dy = cy - py;
  const maxDist = INTERACT_RANGE_TILES * TILE_SIZE;
  return dx * dx + dy * dy <= maxDist * maxDist;
}

function rectOverlap(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function circleRectOverlap(cx: number, cy: number, r: number, rx: number, ry: number, rw: number, rh: number): boolean {
  const nearestX = clamp(cx, rx, rx + rw);
  const nearestY = clamp(cy, ry, ry + rh);
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy <= r * r;
}

function tileOverlapsPlayer(player: Player, tx: number, ty: number): boolean {
  const x = tx * TILE_SIZE;
  const y = ty * TILE_SIZE;
  return rectOverlap(x, y, TILE_SIZE, TILE_SIZE, player.x, player.y, player.w, player.h);
}

function hasNonAirNeighbor(world: WorldGrid, tx: number, ty: number): boolean {
  return (
    getTile(world, tx + 1, ty) !== TILE.AIR ||
    getTile(world, tx - 1, ty) !== TILE.AIR ||
    getTile(world, tx, ty + 1) !== TILE.AIR ||
    getTile(world, tx, ty - 1) !== TILE.AIR
  );
}

function findSurfaceY(world: WorldGrid, tx: number): number {
  for (let ty = 0; ty < WORLD_H; ty++) {
    if (isSolid(world, tx, ty)) return ty;
  }
  return Math.floor(WORLD_H * 0.6);
}

function createInitialEnemies(world: WorldGrid, spawnTx: number): Enemy[] {
  const enemies: Enemy[] = [];
  const offsets = [-28, -20, -12, 12, 20, 28];
  for (let i = 0; i < offsets.length; i++) {
    const tx = clamp(spawnTx + offsets[i], 3, WORLD_W - 4);
    const surfaceY = findSurfaceY(world, tx);
    enemies.push({
      id: i + 1,
      kind: "slime",
      x: tx * TILE_SIZE,
      y: surfaceY * TILE_SIZE - 22,
      w: 18,
      h: 22,
      vx: 0,
      vy: 0,
      onGround: false,
      hp: 40,
      maxHp: 40,
      touchDamage: 8,
      touchCooldown: 0,
    });
  }
  return enemies;
}

function createInitialState(): GameState {
  const world = createWorld();
  const player = createPlayer();
  const inventory = createInventory();
  const spawnTx = Math.floor(WORLD_W / 2);
  const spawnTy = findSurfaceY(world, spawnTx);
  const spawnX = spawnTx * TILE_SIZE + (TILE_SIZE - player.w) / 2;
  const spawnY = spawnTy * TILE_SIZE - player.h;
  const enemies = createInitialEnemies(world, spawnTx);

  player.x = spawnX;
  player.y = spawnY;

  return {
    world,
    player,
    inventory,
    health: MAX_HEALTH,
    maxHealth: MAX_HEALTH,
    mana: MAX_MANA,
    maxMana: MAX_MANA,
    manaRegenPerSecond: MANA_REGEN_PER_SECOND,
    spawnX,
    spawnY,
    zoom: 1.5,
    timeOfDay: 0.25,
    dayLengthMs: DEFAULT_DAY_LENGTH_MS,
    aimX: spawnX + 1,
    aimY: spawnY,
    selectedWeaponIndex: 0,
    weaponCooldown: 0,
    spellCooldown: 0,
    enemies,
    projectiles: [],
    nextEntityId: enemies.length + 1,
    score: 0,
  };
}

function spawnProjectile(state: GameState, kind: "bullet" | "fireball", damage: number, speed: number, ttl: number) {
  const px = state.player.x + state.player.w / 2;
  const py = state.player.y + state.player.h / 2 - 4;
  let dx = state.aimX - px;
  let dy = state.aimY - py;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;
  state.projectiles.push({
    id: state.nextEntityId++,
    kind,
    x: px,
    y: py,
    vx: dx * speed,
    vy: dy * speed,
    r: kind === "fireball" ? 5 : 3,
    damage,
    ttl,
  });
}

export function createGameStore() {
  return createStore<GameStore>()(
    immer((set) => ({
      ...createInitialState(),
      tick: (keys) =>
        set((state) => {
          state.timeOfDay = (state.timeOfDay + FRAME_MS / state.dayLengthMs) % 1;
          state.weaponCooldown = Math.max(0, state.weaponCooldown - 1);
          state.spellCooldown = Math.max(0, state.spellCooldown - 1);
          state.mana = Math.min(state.maxMana, state.mana + state.manaRegenPerSecond / 60);

          const left = keys["ArrowLeft"] || keys["KeyA"];
          const right = keys["ArrowRight"] || keys["KeyD"];
          const jump = keys["Space"] || keys["ArrowUp"] || keys["KeyW"];

          if (left) state.player.vx = -MOVE_SPEED;
          else if (right) state.player.vx = MOVE_SPEED;
          else state.player.vx = 0;

          if (jump && state.player.onGround) {
            state.player.vy = JUMP_SPEED;
            state.player.onGround = false;
          }

          const wasOnGround = state.player.onGround;
          const impactSpeed = state.player.vy;
          resolveCollision(state.player, (tx, ty) => isSolid(state.world, tx, ty));

          if (!wasOnGround && state.player.onGround && impactSpeed > 10) {
            const damage = Math.floor((impactSpeed - 9) * 8);
            state.health = Math.max(0, state.health - damage);
          }

          for (let i = 0; i < state.projectiles.length; i++) {
            const p = state.projectiles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.ttl -= 1;
          }

          for (let i = 0; i < state.enemies.length; i++) {
            const e = state.enemies[i];
            const playerCx = state.player.x + state.player.w / 2;
            const enemyCx = e.x + e.w / 2;
            const dx = playerCx - enemyCx;
            e.vx = dx > 3 ? 1 : dx < -3 ? -1 : 0;
            if (e.onGround && Math.abs(dx) < 56 && Math.random() < 0.012) e.vy = -6.8;
            resolveCollision(e, (tx, ty) => isSolid(state.world, tx, ty));
            if (e.touchCooldown > 0) e.touchCooldown -= 1;

            if (e.touchCooldown <= 0 && rectOverlap(e.x, e.y, e.w, e.h, state.player.x, state.player.y, state.player.w, state.player.h)) {
              state.health = Math.max(0, state.health - e.touchDamage);
              e.touchCooldown = 36;
            }
          }

          for (let i = state.projectiles.length - 1; i >= 0; i--) {
            const p = state.projectiles[i];
            if (p.ttl <= 0) {
              state.projectiles.splice(i, 1);
              continue;
            }

            const tx = Math.floor(p.x / TILE_SIZE);
            const ty = Math.floor(p.y / TILE_SIZE);
            if (isSolid(state.world, tx, ty)) {
              state.projectiles.splice(i, 1);
              continue;
            }

            let hitEnemy = false;
            for (let j = 0; j < state.enemies.length; j++) {
              const e = state.enemies[j];
              if (circleRectOverlap(p.x, p.y, p.r, e.x, e.y, e.w, e.h)) {
                e.hp -= p.damage;
                hitEnemy = true;
                break;
              }
            }
            if (hitEnemy) state.projectiles.splice(i, 1);
          }

          for (let i = state.enemies.length - 1; i >= 0; i--) {
            if (state.enemies[i].hp <= 0) {
              state.enemies.splice(i, 1);
              state.score += 10;
            }
          }

          if (state.health <= 0) {
            state.health = state.maxHealth;
            state.mana = state.maxMana;
            state.player.x = state.spawnX;
            state.player.y = state.spawnY;
            state.player.vx = 0;
            state.player.vy = 0;
            state.player.onGround = false;
          }
        }),
      selectHotbar: (slotIndex) =>
        set((state) => {
          state.inventory.selectedIndex = slotIndex;
        }),
      changeZoom: (direction) =>
        set((state) => {
          const nextZoom = state.zoom + (direction > 0 ? ZOOM_STEP : -ZOOM_STEP);
          state.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom));
        }),
      breakTile: (tx, ty) =>
        set((state) => {
          if (!inWorld(tx, ty) || !isWithinInteractRange(state, tx, ty)) return;
          const tile = getTile(state.world, tx, ty);
          if (tile === TILE.AIR) return;
          addToInventory(state.inventory, tile, 1);
          setTile(state.world, tx, ty, TILE.AIR);
        }),
      placeTile: (tx, ty, worldX, worldY) =>
        set((state) => {
          if (!inWorld(tx, ty) || !isWithinInteractRange(state, tx, ty)) return;
          const selectedType = getSelectedTile(state.inventory);
          if ((state.inventory.counts[selectedType] || 0) <= 0) return;

          const clickedTile = getTile(state.world, tx, ty);
          let placeTx = tx;
          let placeTy = ty;
          if (clickedTile !== TILE.AIR) {
            const targetCx = tx * TILE_SIZE + TILE_SIZE / 2;
            const targetCy = ty * TILE_SIZE + TILE_SIZE / 2;
            const dx = worldX - targetCx;
            const dy = worldY - targetCy;
            if (Math.abs(dx) > Math.abs(dy)) placeTx += dx > 0 ? 1 : -1;
            else placeTy += dy > 0 ? 1 : -1;
          }

          if (!inWorld(placeTx, placeTy)) return;
          if (!isWithinInteractRange(state, placeTx, placeTy)) return;
          if (getTile(state.world, placeTx, placeTy) !== TILE.AIR) return;
          if (tileOverlapsPlayer(state.player, placeTx, placeTy)) return;
          if (!hasNonAirNeighbor(state.world, placeTx, placeTy)) return;

          const taken = removeFromInventory(state.inventory, selectedType, 1);
          if (taken > 0) setTile(state.world, placeTx, placeTy, selectedType);
        }),
      setAim: (worldX, worldY) =>
        set((state) => {
          state.aimX = worldX;
          state.aimY = worldY;
        }),
      cycleWeapon: (direction) =>
        set((state) => {
          const count = WEAPONS.length;
          const next = (state.selectedWeaponIndex + (direction >= 0 ? 1 : -1) + count) % count;
          state.selectedWeaponIndex = next;
        }),
      useWeapon: () =>
        set((state) => {
          if (state.weaponCooldown > 0) return;
          const weapon = WEAPONS[state.selectedWeaponIndex];
          if (!weapon) return;

          if (weapon.mode === "melee") {
            const px = state.player.x + state.player.w / 2;
            const py = state.player.y + state.player.h * 0.5;
            const facing = state.aimX >= px ? 1 : -1;
            const range = weapon.range || 40;
            const attackW = range;
            const attackH = 34;
            const attackX = facing > 0 ? state.player.x + state.player.w : state.player.x - attackW;
            const attackY = py - attackH / 2;

            for (let i = 0; i < state.enemies.length; i++) {
              const e = state.enemies[i];
              if (rectOverlap(attackX, attackY, attackW, attackH, e.x, e.y, e.w, e.h)) {
                e.hp -= weapon.damage;
              }
            }
          } else {
            spawnProjectile(state, "bullet", weapon.damage, weapon.speed || 5, 120);
          }

          state.weaponCooldown = weapon.cooldownFrames;
        }),
      castSpell: () =>
        set((state) => {
          if (state.spellCooldown > 0) return;
          if (state.mana < SPELL.manaCost) return;
          state.mana -= SPELL.manaCost;
          spawnProjectile(state, "fireball", SPELL.damage, SPELL.speed, 135);
          state.spellCooldown = SPELL.cooldownFrames;
        }),
    }))
  );
}
