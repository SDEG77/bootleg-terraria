// lib/renderer.ts
import { TILE_COLORS, TILE_SIZE } from "@/lib/constants";
import { Inventory } from "@/lib/inventory";

export function renderWorld(
  ctx: CanvasRenderingContext2D,
  world: number[][],
  camX: number,
  camY: number,
  canvas: HTMLCanvasElement
) {
  const startTx = Math.floor(camX / TILE_SIZE);
  const endTx = Math.min(world[0].length - 1, Math.ceil((camX + canvas.width) / TILE_SIZE));
  const startTy = Math.floor(camY / TILE_SIZE);
  const endTy = Math.min(world.length - 1, Math.ceil((camY + canvas.height) / TILE_SIZE));

  for (let y = startTy; y <= endTy; y++) {
    for (let x = startTx; x <= endTx; x++) {
      const tile = world[y][x];
      if (!tile) continue;
      ctx.fillStyle = TILE_COLORS[tile] || "#000";
      ctx.fillRect(
        Math.floor(x * TILE_SIZE - camX),
        Math.floor(y * TILE_SIZE - camY),
        TILE_SIZE,
        TILE_SIZE
      );
    }
  }
}

export function drawHotbar(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, inv: Inventory) {
  const slotCount = inv.slots.length;
  const size = 44;
  const padding = 10;
  const startX = 20;
  const y = canvas.height - size - 20;

  ctx.font = "12px monospace";
  ctx.textBaseline = "top";

  for (let i = 0; i < slotCount; i++) {
    const x = startX + i * (size + padding);

    ctx.fillStyle = i === inv.selectedIndex ? "#ffffff" : "#999999";
    ctx.fillRect(x - 4, y - 4, size + 8, size + 8);

    const tile = inv.slots[i];
    ctx.fillStyle = TILE_COLORS[tile] || "#000";
    ctx.fillRect(x, y, size, size);

    // count
    ctx.fillStyle = "#000";
    ctx.fillText(String(inv.counts[tile] || 0), x + 6, y + 6);

    // slot number
    ctx.fillStyle = "#fff";
    ctx.fillText(String(i + 1), x + size - 12, y + size - 14);
  }
}
