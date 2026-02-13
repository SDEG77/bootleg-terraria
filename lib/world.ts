// lib/world.ts
import { generateWorld } from "@/lib/worldGenerator";
import { TILE, WORLD_W, WORLD_H } from "@/lib/constants";

export function createWorld() {
  const world = generateWorld(WORLD_W, WORLD_H);

  function getTile(tx: number, ty: number): number {
    if (tx < 0 || ty < 0 || tx >= WORLD_W || ty >= WORLD_H) return TILE.AIR;
    return world[ty][tx];
  }

  function setTile(tx: number, ty: number, value: number) {
    if (tx < 0 || ty < 0 || tx >= WORLD_W || ty >= WORLD_H) return;
    world[ty][tx] = value;
  }

  // Leaves and wood are passable (non-solid)
  function isSolid(tx: number, ty: number): boolean {
    const t = getTile(tx, ty);
    if (t === TILE.AIR) return false;
    if (t === TILE.LEAVES) return false;
    if (t === TILE.WOOD) return false;
    return true;
  }

  return {
    world,
    getTile,
    setTile,
    isSolid,
  };
}
