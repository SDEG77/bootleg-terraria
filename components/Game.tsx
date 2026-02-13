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
};

const TILE_COLORS = {
  [TILE.AIR]: null,
  [TILE.DIRT]: "#8B5A2B",
  [TILE.STONE]: "#6b6b6b",
  [TILE.GRASS]: "#2ecc71",
};

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const keys = useRef<{ [key: string]: boolean }>({});

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

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const world = generateWorld(WORLD_W, WORLD_H);

    const handleKeyDown = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    function getTile(tx: number, ty: number) {
      if (tx < 0 || ty < 0 || tx >= WORLD_W || ty >= WORLD_H) return TILE.AIR;
      return world[ty][tx];
    }

    function isSolidTile(tx: number, ty: number) {
      const t = getTile(tx, ty);
      return t !== TILE.AIR;
    }

    function resolveCollision(p: typeof player.current) {
      // gravity
      p.vy += 0.5;

      // horizontal
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

      // vertical
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

    function loop() {
      const p = player.current;

      // input
      const left = keys.current["ArrowLeft"] || keys.current["KeyA"];
      const right = keys.current["ArrowRight"] || keys.current["KeyD"];
      const jump = keys.current["Space"] || keys.current["ArrowUp"] || keys.current["KeyW"];

      const speed = 2.5;
      if (left) p.vx = -speed;
      else if (right) p.vx = speed;
      else p.vx = 0;

      if (jump && p.onGround) {
        p.vy = -8;
        p.onGround = false;
      }

      resolveCollision(p);

      // camera
      const camX = Math.max(0, Math.min(WORLD_W * TILE_SIZE - canvas.width, p.x + p.w / 2 - canvas.width / 2));
      const camY = Math.max(0, Math.min(WORLD_H * TILE_SIZE - canvas.height, p.y + p.h / 2 - canvas.height / 2));

      // draw
      ctx.fillStyle = "#87CEEB";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // draw tiles
      const startTx = Math.floor(camX / TILE_SIZE);
      const endTx = Math.min(WORLD_W - 1, Math.ceil((camX + canvas.width) / TILE_SIZE));
      const startTy = Math.floor(camY / TILE_SIZE);
      const endTy = Math.min(WORLD_H - 1, Math.ceil((camY + canvas.height) / TILE_SIZE));

      for (let y = startTy; y <= endTy; y++) {
        for (let x = startTx; x <= endTx; x++) {
          const tile = world[y][x];
          if (tile === TILE.AIR) continue;
          ctx.fillStyle = TILE_COLORS[tile] || "#000";
          ctx.fillRect(x * TILE_SIZE - camX, y * TILE_SIZE - camY, TILE_SIZE, TILE_SIZE);
        }
      }

      // draw player
      ctx.fillStyle = "#ffcc00";
      ctx.fillRect(p.x - camX, p.y - camY, p.w, p.h);

      requestAnimationFrame(loop);
    }

    requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  return <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100vh" }} />;
}
