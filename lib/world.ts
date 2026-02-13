import { generateWorld } from "@/lib/worldGenerator";
import { TILE, WORLD_W, WORLD_H } from "@/lib/constants";

export type WorldGrid = number[][];

export function createWorld(): WorldGrid {
  return generateWorld(WORLD_W, WORLD_H);
}

export function inWorld(tx: number, ty: number): boolean {
  return tx >= 0 && ty >= 0 && tx < WORLD_W && ty < WORLD_H;
}

export function getTile(world: WorldGrid, tx: number, ty: number): number {
  if (!inWorld(tx, ty)) return TILE.AIR;
  return world[ty][tx];
}

export function setTile(world: WorldGrid, tx: number, ty: number, value: number): void {
  if (!inWorld(tx, ty)) return;
  world[ty][tx] = value;
}

// Leaves and wood are passable (non-solid)
export function isSolid(world: WorldGrid, tx: number, ty: number): boolean {
  const t = getTile(world, tx, ty);
  if (t === TILE.AIR) return false;
  if (t === TILE.LEAVES) return false;
  if (t === TILE.WOOD) return false;
  return true;
}
