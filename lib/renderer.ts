import { TILE_COLORS, TILE_SIZE, WORLD_W, WORLD_H } from "./constants";

export function renderWorld(
  ctx: CanvasRenderingContext2D,
  world: number[][],
  camX: number,
  camY: number,
  canvas: HTMLCanvasElement
) {
  const startTx = Math.floor(camX / TILE_SIZE);
  const endTx = Math.min(
    WORLD_W - 1,
    Math.ceil((camX + canvas.width) / TILE_SIZE)
  );
  const startTy = Math.floor(camY / TILE_SIZE);
  const endTy = Math.min(
    WORLD_H - 1,
    Math.ceil((camY + canvas.height) / TILE_SIZE)
  );

  for (let y = startTy; y <= endTy; y++) {
    for (let x = startTx; x <= endTx; x++) {
      const tile = world[y][x];
      if (!tile) continue;
      ctx.fillStyle = TILE_COLORS[tile] || "#000";
      ctx.fillRect(
        x * TILE_SIZE - camX,
        y * TILE_SIZE - camY,
        TILE_SIZE,
        TILE_SIZE
      );
    }
  }
}
