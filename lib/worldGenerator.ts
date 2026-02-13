export function generateWorld(W: number, H: number): number[][] {
  const world: number[][] = Array.from({ length: H }, () =>
    new Array(W).fill(0)
  );

  const mid = Math.floor(H * 0.6);

  for (let x = 0; x < W; x++) {
    const height =
      mid + Math.floor(Math.sin(x * 0.1) * 5);

    for (let y = height; y < H; y++) {
      if (y === height) world[y][x] = 3; // grass
      else if (y < height + 4) world[y][x] = 1; // dirt
      else world[y][x] = 2; // stone
    }
  }

  return world;
}
