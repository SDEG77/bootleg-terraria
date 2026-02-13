"use client";

import { useEffect, useRef } from "react";
import { generateWorld } from "@/lib/worldGenerator";

const TILE_SIZE = 16;
const WORLD_W = 200;
const WORLD_H = 120;

const TILE = {
  AIR: 0,
  DIRT: 1,
  STONE: 2,
  GRASS: 3,
  WOOD: 4,
  LEAVES: 5,
} as const;

const TILE_COLORS: Record<number, string | null> = {
  [TILE.AIR]: null,
  [TILE.DIRT]: "#8B5A2B",
  [TILE.STONE]: "#6b6b6b",
  [TILE.GRASS]: "#2ecc71",
  [TILE.WOOD]: "#8B4513",
  [TILE.LEAVES]: "#3cb371",
};

type Inventory = Record<number, number>;

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const keys = useRef<{ [key: string]: boolean }>({});
  const selectedSlot = useRef<number>(1);
  const inventory = useRef<Inventory>({
    [TILE.DIRT]: 0,
    [TILE.STONE]: 0,
    [TILE.GRASS]: 0,
    [TILE.WOOD]: 0,
    [TILE.LEAVES]: 0,
  });

  const player = useRef({
    x: 100,
    y: 100,
    w: 12,
    h: 28,
    vx: 0,
    vy: 0,
    onGround: false,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    const world = generateWorld(WORLD_W, WORLD_H);

    function getTile(tx: number, ty: number) {
      if (tx < 0 || ty < 0 || tx >= WORLD_W || ty >= WORLD_H)
        return TILE.AIR;
      return world[ty][tx];
    }

    function setTile(tx: number, ty: number, value: number) {
      if (tx < 0 || ty < 0 || tx >= WORLD_W || ty >= WORLD_H) return;
      world[ty][tx] = value;
    }

    // WOOD + LEAVES are passable
    function isSolidTile(tx: number, ty: number) {
      const t = getTile(tx, ty);
      if (t === TILE.AIR) return false;
      if (t === TILE.LEAVES) return false;
      if (t === TILE.WOOD) return false;
      return true;
    }

    function resolveCollision(p: typeof player.current) {
      p.vy += 0.5;

      p.x += p.vx;
      let minTx = Math.floor(p.x / TILE_SIZE);
      let maxTx = Math.floor((p.x + p.w - 1) / TILE_SIZE);
      let minTy = Math.floor(p.y / TILE_SIZE);
      let maxTy = Math.floor((p.y + p.h - 1) / TILE_SIZE);

      for (let ty = minTy; ty <= maxTy; ty++) {
        for (let tx = minTx; tx <= maxTx; tx++) {
          if (isSolidTile(tx, ty)) {
            if (p.vx > 0) p.x = tx * TILE_SIZE - p.w;
            else if (p.vx < 0) p.x = (tx + 1) * TILE_SIZE;
            p.vx = 0;
          }
        }
      }

      p.y += p.vy;
      p.onGround = false;

      minTx = Math.floor(p.x / TILE_SIZE);
      maxTx = Math.floor((p.x + p.w - 1) / TILE_SIZE);
      minTy = Math.floor(p.y / TILE_SIZE);
      maxTy = Math.floor((p.y + p.h - 1) / TILE_SIZE);

      for (let ty = minTy; ty <= maxTy; ty++) {
        for (let tx = minTx; tx <= maxTx; tx++) {
          if (isSolidTile(tx, ty)) {
            if (p.vy > 0) {
              p.y = ty * TILE_SIZE - p.h;
              p.vy = 0;
              p.onGround = true;
            } else if (p.vy < 0) {
              p.y = (ty + 1) * TILE_SIZE;
              p.vy = 0;
            }
          }
        }
      }
    }

    const handleMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const camX = player.current.x + player.current.w / 2 - canvas.width / 2;
      const camY = player.current.y + player.current.h / 2 - canvas.height / 2;

      const tx = Math.floor((mx + camX) / TILE_SIZE);
      const ty = Math.floor((my + camY) / TILE_SIZE);

      const tile = getTile(tx, ty);

      if (e.button === 0) {
        if (tile !== TILE.AIR) {
          inventory.current[tile] =
            (inventory.current[tile] || 0) + 1;
          setTile(tx, ty, TILE.AIR);
        }
      } else if (e.button === 2) {
        const type = selectedSlot.current;
        if (inventory.current[type] > 0 && tile === TILE.AIR) {
          setTile(tx, ty, type);
          inventory.current[type]--;
        }
      }
    };

    canvas.addEventListener("mousedown", handleMouse);
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    const handleKeyDown = (e: KeyboardEvent) => {
      keys.current[e.code] = true;

      if (e.code.startsWith("Digit")) {
        const num = parseInt(e.code.replace("Digit", ""));
        if (num >= 1 && num <= 5) {
          selectedSlot.current = num;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    function drawInventory(ctx: CanvasRenderingContext2D) {
      const items = [1, 2, 3, 4, 5];
      const size = 40;

      items.forEach((type, i) => {
        const x = 20 + i * (size + 10);
        const y = canvas.height - 60;

        ctx.fillStyle =
          selectedSlot.current === type ? "#ffffff" : "#999999";
        ctx.fillRect(x - 4, y - 4, size + 8, size + 8);

        ctx.fillStyle = TILE_COLORS[type] || "#000";
        ctx.fillRect(x, y, size, size);

        ctx.fillStyle = "#000";
        ctx.fillText(
          String(inventory.current[type] || 0),
          x + 5,
          y + 15
        );
      });
    }

    function loop() {
      const p = player.current;

      const left =
        keys.current["ArrowLeft"] || keys.current["KeyA"];
      const right =
        keys.current["ArrowRight"] || keys.current["KeyD"];
      const jump =
        keys.current["Space"] ||
        keys.current["ArrowUp"] ||
        keys.current["KeyW"];

      const speed = 2.5;
      if (left) p.vx = -speed;
      else if (right) p.vx = speed;
      else p.vx = 0;

      if (jump && p.onGround) {
        p.vy = -8;
        p.onGround = false;
      }

      resolveCollision(p);

      const camX = Math.max(
        0,
        Math.min(
          WORLD_W * TILE_SIZE - canvas.width,
          p.x + p.w / 2 - canvas.width / 2
        )
      );
      const camY = Math.max(
        0,
        Math.min(
          WORLD_H * TILE_SIZE - canvas.height,
          p.y + p.h / 2 - canvas.height / 2
        )
      );

      ctx.fillStyle = "#87CEEB";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

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
          if (tile === TILE.AIR) continue;
          ctx.fillStyle = TILE_COLORS[tile] || "#000";
          ctx.fillRect(
            x * TILE_SIZE - camX,
            y * TILE_SIZE - camY,
            TILE_SIZE,
            TILE_SIZE
          );
        }
      }

      ctx.fillStyle = "#ffcc00";
      ctx.fillRect(
        p.x - camX,
        p.y - camY,
        p.w,
        p.h
      );

      drawInventory(ctx);

      requestAnimationFrame(loop);
    }

    requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousedown", handleMouse);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: "block", width: "100%", height: "100vh" }}
    />
  );
}
