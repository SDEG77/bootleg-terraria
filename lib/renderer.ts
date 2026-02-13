// lib/renderer.ts
import { TILE_COLORS, TILE_SIZE } from "@/lib/constants";
import { Inventory } from "@/lib/inventory";

export function renderWorld(
  ctx: CanvasRenderingContext2D,
  world: number[][],
  camX: number,
  camY: number,
  canvas: HTMLCanvasElement,
  zoom = 1
) {
  const visibleWorldW = canvas.width / zoom;
  const visibleWorldH = canvas.height / zoom;
  const startTx = Math.floor(camX / TILE_SIZE);
  const endTx = Math.min(world[0].length - 1, Math.ceil((camX + visibleWorldW) / TILE_SIZE));
  const startTy = Math.floor(camY / TILE_SIZE);
  const endTy = Math.min(world.length - 1, Math.ceil((camY + visibleWorldH) / TILE_SIZE));

  for (let y = startTy; y <= endTy; y++) {
    for (let x = startTx; x <= endTx; x++) {
      const tile = world[y][x];
      if (!tile) continue;
      ctx.fillStyle = TILE_COLORS[tile] || "#000";
      ctx.fillRect(
        Math.floor((x * TILE_SIZE - camX) * zoom),
        Math.floor((y * TILE_SIZE - camY) * zoom),
        Math.ceil(TILE_SIZE * zoom),
        Math.ceil(TILE_SIZE * zoom)
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

export function drawHealthBar(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  health: number,
  maxHealth: number
) {
  const x = 20;
  const y = 20;
  const w = 220;
  const h = 22;
  const safeMax = Math.max(1, maxHealth);
  const clamped = Math.max(0, Math.min(health, safeMax));
  const ratio = clamped / safeMax;

  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);

  ctx.fillStyle = "#3b0a0a";
  ctx.fillRect(x, y, w, h);

  ctx.fillStyle = "#e53935";
  ctx.fillRect(x, y, Math.floor(w * ratio), h);

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);

  ctx.font = "bold 14px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(`HP ${Math.ceil(clamped)}/${safeMax}`, x + 8, y + 3);

  // Keep text alignment predictable for other HUD draws.
  ctx.textAlign = "start";
}
