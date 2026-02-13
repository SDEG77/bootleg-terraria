// lib/worldGenerator.ts
// Simple terrain generator with optional tree placement.
// Tiles:
// 0 = AIR
// 1 = DIRT
// 2 = STONE
// 3 = GRASS (surface)
// 4 = WOOD (tree trunk) - solid
// 5 = LEAVES (tree canopy) - non-solid

export function generateWorld(W: number, H: number): number[][] {
  const world: number[][] = Array.from({ length: H }, () =>
    new Array(W).fill(0)
  );

  const mid = Math.floor(H * 0.6);

  // generate a height map (random walk + small noise)
  const heights = new Array<number>(W);
  let last = mid;
  for (let x = 0; x < W; x++) {
    last += Math.round((Math.random() - 0.5) * 3);
    last = Math.max(Math.floor(H * 0.3), Math.min(Math.floor(H * 0.85), last));
    heights[x] = last;
  }

  // fill terrain
  for (let x = 0; x < W; x++) {
    const h = heights[x];
    for (let y = 0; y < H; y++) {
      if (y < h) {
        world[y][x] = 0; // air
      } else if (y === h) {
        world[y][x] = 3; // grass
      } else if (y <= h + 4) {
        world[y][x] = 1; // dirt
      } else {
        world[y][x] = 2; // stone
      }

      // small caves deeper down
      if (world[y][x] !== 0 && Math.random() < 0.02 && y > h + 6) {
        world[y][x] = 0;
      }
    }
  }

  // place trees
  // For each column, small chance to place a tree if there's space above the surface.
  for (let x = 2; x < W - 2; x++) {
    // Only attempt if this column is grass and the column above is free
    const surfaceY = heights[x];
    if (Math.random() < 0.06) {
      // don't place if adjacent columns are very low/high (avoid cliffs)
      const leftH = heights[x - 1];
      const rightH = heights[x + 1];
      if (Math.abs(leftH - surfaceY) > 2 || Math.abs(rightH - surfaceY) > 2) {
        continue;
      }

      // check vertical space above surface
      const maxTreeHeight = 6;
      const minTreeHeight = 4;
      const tHeight = minTreeHeight + Math.floor(Math.random() * (maxTreeHeight - minTreeHeight + 1));
      const trunkBottomY = surfaceY - 1; // tile just above grass
      const trunkTopY = trunkBottomY - (tHeight - 1);

      if (trunkTopY < 2) continue; // not enough space

      // quick overlap check (don't overwrite existing solid except air)
      let canPlace = true;
      for (let ty = trunkTopY - 2; ty <= trunkBottomY + 1; ty++) {
        for (let tx = x - 2; tx <= x + 2; tx++) {
          if (ty < 0 || tx < 0 || ty >= H || tx >= W) { canPlace = false; break; }
          if (world[ty][tx] !== 0 && world[ty][tx] !== 5) { // allow replacing leaves only
            // don't place tree if there's something solid in the expected canopy/trunk area
            if (ty <= trunkBottomY && ty >= trunkTopY) canPlace = false;
          }
        }
        if (!canPlace) break;
      }
      if (!canPlace) continue;

      // place trunk
      for (let ty = trunkTopY; ty <= trunkBottomY; ty++) {
        world[ty][x] = 4; // wood
      }

      // place leaves canopy: a simple layered blob centered above trunkTopY
      const canopyCenterY = trunkTopY;
      for (let dy = -2; dy <= 1; dy++) {
        const radius = dy === -2 ? 1 : dy === -1 ? 2 : 2; // shapes per row
        for (let dx = -radius; dx <= radius; dx++) {
          const lx = x + dx;
          const ly = canopyCenterY + dy;
          if (lx < 0 || lx >= W || ly < 0 || ly >= H) continue;
          // avoid overwriting trunk or ground
          if (world[ly][lx] === 0) {
            // randomize canopy holes so trees look less blocky
            if (Math.random() < 0.85) {
              world[ly][lx] = 5; // leaves
            }
          }
        }
      }

      // optional: a few scattered leaves below canopy
      for (let dx = -1; dx <= 1; dx++) {
        const lx = x + dx;
        const ly = trunkTopY + 2;
        if (lx >= 0 && lx < W && ly >= 0 && ly < H && world[ly][lx] === 0) {
          if (Math.random() < 0.5) world[ly][lx] = 5;
        }
      }
    }
  }

  return world;
}
