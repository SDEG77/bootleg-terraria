// lib/renderer.ts
import { TILE_COLORS, TILE_SIZE } from "@/lib/constants";

export type HotbarItem =
  | { kind: "block"; label: string; color: string; count: number }
  | { kind: "weapon"; label: string; weaponId: string }
  | { kind: "spell"; label: string; spellId: string };

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

function getHotbarMetrics(canvas: HTMLCanvasElement, slotCount: number) {
  const size = 44;
  const padding = 10;
  const totalW = slotCount * size + (slotCount - 1) * padding;
  const startX = Math.max(20, Math.floor((canvas.width - totalW) / 2));
  const y = canvas.height - size - 20;
  return { size, padding, startX, y };
}

function drawSwordIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.fillStyle = "#c9d1d9";
  ctx.fillRect(x + Math.floor(size * 0.55), y + Math.floor(size * 0.1), 4, Math.floor(size * 0.55));
  ctx.fillStyle = "#8b5a2b";
  ctx.fillRect(x + Math.floor(size * 0.48), y + Math.floor(size * 0.62), 10, 4);
  ctx.fillStyle = "#d4a15a";
  ctx.fillRect(x + Math.floor(size * 0.59), y + Math.floor(size * 0.7), 2, Math.floor(size * 0.18));
}

function drawBlasterIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.fillStyle = "#2b2b2b";
  ctx.fillRect(x + Math.floor(size * 0.2), y + Math.floor(size * 0.4), Math.floor(size * 0.55), 8);
  ctx.fillStyle = "#5dade2";
  ctx.fillRect(x + Math.floor(size * 0.6), y + Math.floor(size * 0.45), Math.floor(size * 0.2), 4);
  ctx.fillStyle = "#4d4d4d";
  ctx.fillRect(x + Math.floor(size * 0.35), y + Math.floor(size * 0.52), 7, Math.floor(size * 0.22));
}

function drawSpellIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.beginPath();
  ctx.arc(x + size * 0.5, y + size * 0.5, size * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = "#ff8a33";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + size * 0.45, y + size * 0.45, size * 0.1, 0, Math.PI * 2);
  ctx.fillStyle = "#ffd166";
  ctx.fill();
}

export function getHotbarSlotAtPoint(
  canvas: HTMLCanvasElement,
  slotCount: number,
  x: number,
  y: number
): number {
  const { size, padding, startX, y: startY } = getHotbarMetrics(canvas, slotCount);
  for (let i = 0; i < slotCount; i++) {
    const sx = startX + i * (size + padding);
    if (x >= sx && x <= sx + size && y >= startY && y <= startY + size) return i;
  }
  return -1;
}

export function drawHotbar(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  items: HotbarItem[],
  selectedIndex: number
) {
  const slotCount = items.length;
  const { size, padding, startX, y } = getHotbarMetrics(canvas, slotCount);
  ctx.font = "12px monospace";
  ctx.textBaseline = "top";

  for (let i = 0; i < slotCount; i++) {
    const x = startX + i * (size + padding);
    const item = items[i];

    ctx.fillStyle = i === selectedIndex ? "#ffffff" : "#999999";
    ctx.fillRect(x - 4, y - 4, size + 8, size + 8);

    ctx.fillStyle = "#1b1b1b";
    ctx.fillRect(x, y, size, size);

    if (item.kind === "block") {
      ctx.fillStyle = item.color;
      ctx.fillRect(x + 3, y + 3, size - 6, size - 6);
    } else if (item.kind === "weapon") {
      ctx.fillStyle = "#222";
      ctx.fillRect(x + 3, y + 3, size - 6, size - 6);
      if (item.weaponId === "iron_sword") drawSwordIcon(ctx, x, y, size);
      else drawBlasterIcon(ctx, x, y, size);
    } else {
      ctx.fillStyle = "#1c1a26";
      ctx.fillRect(x + 3, y + 3, size - 6, size - 6);
      drawSpellIcon(ctx, x, y, size);
    }

    if (item.kind === "block") {
      ctx.fillStyle = "#000";
      ctx.fillText(String(item.count), x + 6, y + 6);
    }

    ctx.fillStyle = "#fff";
    ctx.fillText(String(i + 1), x + size - 12, y + size - 14);
  }
}

export function drawHealthBar(
  ctx: CanvasRenderingContext2D,
  _canvas: HTMLCanvasElement,
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

export function drawManaBar(
  ctx: CanvasRenderingContext2D,
  _canvas: HTMLCanvasElement,
  mana: number,
  maxMana: number
) {
  const x = 20;
  const y = 48;
  const w = 220;
  const h = 18;
  const safeMax = Math.max(1, maxMana);
  const clamped = Math.max(0, Math.min(mana, safeMax));
  const ratio = clamped / safeMax;

  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);

  ctx.fillStyle = "#071a35";
  ctx.fillRect(x, y, w, h);

  ctx.fillStyle = "#42a5f5";
  ctx.fillRect(x, y, Math.floor(w * ratio), h);

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);

  ctx.font = "bold 12px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(`MP ${Math.ceil(clamped)}/${safeMax}`, x + 8, y + 2);
  ctx.textAlign = "start";
}

export function drawCombatInfo(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  weaponName: string,
  spellName: string,
  enemiesAlive: number
) {
  const x = canvas.width - 320;
  const y = 20;
  const w = 300;
  const h = 62;

  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);

  ctx.fillStyle = "#ffffff";
  ctx.font = "12px monospace";
  ctx.textBaseline = "top";
  ctx.fillText(`Weapon [Q/F]: ${weaponName}`, x + 10, y + 10);
  ctx.fillText(`Spell [R]: ${spellName}`, x + 10, y + 26);
  ctx.fillText(`Enemies: ${enemiesAlive}`, x + 10, y + 42);
}
