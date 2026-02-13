import { createStore } from "zustand/vanilla";
import { immer } from "zustand/middleware/immer";
import { TILE, TILE_SIZE, WORLD_H, WORLD_W } from "@/lib/constants";
import { addToInventory, createInventory, getSelectedTile, removeFromInventory, type Inventory } from "@/lib/inventory";
import { createPlayer, resolveCollision, type Player } from "@/lib/player";
import { createWorld, getTile, inWorld, isSolid, setTile, type WorldGrid } from "@/lib/world";

type GameState = {
  world: WorldGrid;
  player: Player;
  inventory: Inventory;
  health: number;
  maxHealth: number;
  spawnX: number;
  spawnY: number;
  zoom: number;
};

type GameActions = {
  tick: (keys: Record<string, boolean>) => void;
  selectHotbar: (slotIndex: number) => void;
  changeZoom: (direction: number) => void;
  breakTile: (tx: number, ty: number) => void;
  placeTile: (tx: number, ty: number, worldX: number, worldY: number) => void;
};

export type GameStore = GameState & GameActions;

const MOVE_SPEED = 2.5;
const JUMP_SPEED = -8;
const INTERACT_RANGE_TILES = 6;
const MAX_HEALTH = 100;
const MIN_ZOOM = 0.75;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.15;

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

function tileOverlapsPlayer(player: Player, tx: number, ty: number): boolean {
  const x = tx * TILE_SIZE;
  const y = ty * TILE_SIZE;
  return x < player.x + player.w && x + TILE_SIZE > player.x && y < player.y + player.h && y + TILE_SIZE > player.y;
}

function hasNonAirNeighbor(world: WorldGrid, tx: number, ty: number): boolean {
  return (
    getTile(world, tx + 1, ty) !== TILE.AIR ||
    getTile(world, tx - 1, ty) !== TILE.AIR ||
    getTile(world, tx, ty + 1) !== TILE.AIR ||
    getTile(world, tx, ty - 1) !== TILE.AIR
  );
}

function createInitialState(): GameState {
  const world = createWorld();
  const player = createPlayer();
  const inventory = createInventory();
  const spawnTx = Math.floor(WORLD_W / 2);
  let spawnTy = 0;

  for (let ty = 0; ty < WORLD_H; ty++) {
    if (isSolid(world, spawnTx, ty)) {
      spawnTy = ty;
      break;
    }
  }

  const spawnX = spawnTx * TILE_SIZE + (TILE_SIZE - player.w) / 2;
  const spawnY = spawnTy * TILE_SIZE - player.h;
  player.x = spawnX;
  player.y = spawnY;

  return {
    world,
    player,
    inventory,
    health: MAX_HEALTH,
    maxHealth: MAX_HEALTH,
    spawnX,
    spawnY,
    zoom: 1.5,
  };
}

export function createGameStore() {
  return createStore<GameStore>()(
    immer((set) => ({
      ...createInitialState(),
      tick: (keys) =>
        set((state) => {
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

          if (state.health <= 0) {
            state.health = state.maxHealth;
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
          if (taken > 0) {
            setTile(state.world, placeTx, placeTy, selectedType);
          }
        }),
    }))
  );
}
