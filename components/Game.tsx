"use client";

import { useEffect, useRef } from "react";
import { TILE_SIZE, WORLD_W, WORLD_H } from "@/lib/constants";
import { createWorld } from "@/lib/world";
import { createPlayer, resolveCollision } from "@/lib/player";
import { createInventory } from "@/lib/inventory";
import { setupKeyboard } from "@/lib/input";
import { renderWorld } from "@/lib/renderer";

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const worldSys = createWorld();
    const player = createPlayer();
    const inventory = createInventory();

    const keys: Record<string, boolean> = {};

    const cleanupKeyboard = setupKeyboard(keys, (num) => {
      inventory.selected = num;
    });

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    resize();
    window.addEventListener("resize", resize);

    function loop() {
      const speed = 2.5;

      if (keys["KeyA"] || keys["ArrowLeft"]) player.vx = -speed;
      else if (keys["KeyD"] || keys["ArrowRight"]) player.vx = speed;
      else player.vx = 0;

      if (
        (keys["Space"] || keys["KeyW"] || keys["ArrowUp"]) &&
        player.onGround
      ) {
        player.vy = -8;
      }

      resolveCollision(player, worldSys.isSolid);

      const camX = Math.max(
        0,
        Math.min(
          WORLD_W * TILE_SIZE - canvas.width,
          player.x + player.w / 2 - canvas.width / 2
        )
      );

      const camY = Math.max(
        0,
        Math.min(
          WORLD_H * TILE_SIZE - canvas.height,
          player.y + player.h / 2 - canvas.height / 2
        )
      );

      ctx.fillStyle = "#87CEEB";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      renderWorld(ctx, worldSys.world, camX, camY, canvas);

      ctx.fillStyle = "#ffcc00";
      ctx.fillRect(
        player.x - camX,
        player.y - camY,
        player.w,
        player.h
      );

      requestAnimationFrame(loop);
    }

    requestAnimationFrame(loop);

    return () => {
      cleanupKeyboard();
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: "block", width: "100%", height: "100vh" }}
    />
  );
}
