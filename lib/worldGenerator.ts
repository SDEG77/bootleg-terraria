// lib/worldGenerator.ts
// Simple terrain generator with optional tree placement.
// Returns number[][] where world[y][x] is a tile id.

import { TILE, WORLD_W, WORLD_H } from "@/lib/constants";

export function generateWorld(W = WORLD_W, H = WORLD_H): number[][] {
  const world: number[][] = Array.from({ length: H }, () => new Array(W).fill(TILE.AIR));

  const mid = Math.floor(H * 0.6);

  // height map - random walk
  const heights: number[] = new Array(W);
  let last = mid;
  for (let x = 0; x < W; x++) {
    last += Math.round((Math.random() - 0.5) * 3);
    last = Math.max(Math.floor(H * 0.3), Math.min(Math.floor(H * 0.85), last));
    heights[x] = last;
  }

  // fill ground
  for (let x = 0; x < W; x++) {
    const h = heights[x];
    for (let y = 0; y < H; y++) {
      if (y < h) world[y][x] = TILE.AIR;
      else if (y === h) world[y][x] = TILE.GRASS;
      else if (y <= h + 4) world[y][x] = TILE.DIRT;
      else world[y][x] = TILE.STONE;

      // small caves
      if (world[y][x] !== TILE.AIR && Math.random() < 0.02 && y > h + 6) {
        world[y][x] = TILE.AIR;
      }
    }
  }

  // place trees
  for (let x = 2; x < W - 2; x++) {
    const surfaceY = heights[x];
    if (Math.random() < 0.06) {
      const leftH = heights[x - 1];
      const rightH = heights[x + 1];
      if (Math.abs(leftH - surfaceY) > 2 || Math.abs(rightH - surfaceY) > 2) continue;

      const maxTreeHeight = 6;
      const minTreeHeight = 4;
      const tHeight = minTreeHeight + Math.floor(Math.random() * (maxTreeHeight - minTreeHeight + 1));
      const trunkBottomY = surfaceY - 1;
      const trunkTopY = trunkBottomY - (tHeight - 1);
      if (trunkTopY < 2) continue;

      // overlap check
      let canPlace = true;
      for (let ty = trunkTopY - 2; ty <= trunkBottomY + 1; ty++) {
        for (let tx = x - 2; tx <= x + 2; tx++) {
          if (ty < 0 || tx < 0 || ty >= H || tx >= W) { canPlace = false; break; }
          if (world[ty][tx] !== TILE.AIR && world[ty][tx] !== TILE.LEAVES) {
            if (ty <= trunkBottomY && ty >= trunkTopY) canPlace = false;
          }
        }
        if (!canPlace) break;
      }
      if (!canPlace) continue;

      // trunk
      for (let ty = trunkTopY; ty <= trunkBottomY; ty++) {
        world[ty][x] = TILE.WOOD;
      }

      // canopy
      const canopyCenterY = trunkTopY;
      for (let dy = -2; dy <= 1; dy++) {
        const radius = dy === -2 ? 1 : dy === -1 ? 2 : 2;
        for (let dx = -radius; dx <= radius; dx++) {
          const lx = x + dx;
          const ly = canopyCenterY + dy;
          if (lx < 0 || lx >= W || ly < 0 || ly >= H) continue;
          if (world[ly][lx] === TILE.AIR) {
            if (Math.random() < 0.85) world[ly][lx] = TILE.LEAVES;
          }
        }
      }

      for (let dx = -1; dx <= 1; dx++) {
        const lx = x + dx;
        const ly = trunkTopY + 2;
        if (lx >= 0 && lx < W && ly >= 0 && ly < H && world[ly][lx] === TILE.AIR) {
          if (Math.random() < 0.5) world[ly][lx] = TILE.LEAVES;
        }
      }
    }
  }

  return world;
}
