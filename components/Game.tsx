"use client";

import { useEffect, useRef } from "react";
import { TILE_SIZE, WORLD_W, WORLD_H } from "@/lib/constants";
import { createWorld } from "@/lib/world";
import { createPlayer, resolveCollision, Player } from "@/lib/player";
import { createInventory, addToInventory, getSelectedTile, Inventory, removeFromInventory } from "@/lib/inventory";
import { setupKeyboard } from "@/lib/input";
import { renderWorld, drawHotbar } from "@/lib/renderer";

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // world system
    const worldSys = createWorld();
    const world = worldSys.world; // number[][]
    const getTile = worldSys.getTile;
    const setTile = worldSys.setTile;

    // player & inventory
    const player: Player = createPlayer();
    const inventory: Inventory = createInventory();

    // keys map for input
    const keys: Record<string, boolean> = {};

    // keyboard setup
    const cleanupKeyboard = setupKeyboard(keys, (slotIndex) => {
      inventory.selectedIndex = slotIndex;
    });

    // canvas resize
    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    // helper to convert mouse -> world tile coords
    function mouseToTile(mx: number, my: number) {
      const camX = Math.max(0, Math.min(WORLD_W * TILE_SIZE - canvas.width, player.x + player.w / 2 - canvas.width / 2));
      const camY = Math.max(0, Math.min(WORLD_H * TILE_SIZE - canvas.height, player.y + player.h / 2 - canvas.height / 2));
      const tx = Math.floor((mx + camX) / TILE_SIZE);
      const ty = Math.floor((my + camY) / TILE_SIZE);
      return { tx, ty };
    }

    // mouse handlers for break/place
    const handleMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const { tx, ty } = mouseToTile(mx, my);
      const tile = getTile(tx, ty);

      // left = 0 break & pickup
      if (e.button === 0) {
        if (tile !== 0) {
          addToInventory(inventory, tile, 1);
          setTile(tx, ty, 0);
        }
      }

      // right = 2 place selected
      if (e.button === 2) {
        const type = getSelectedTile(inventory);
        if ((inventory.counts[type] || 0) > 0 && tile === 0) {
          // place tile
          const taken = removeFromInventory(inventory, type, 1);
          if (taken > 0) {
            setTile(tx, ty, type);
          }
        }
      }
    };

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("contextmenu", (ev) => ev.preventDefault());

    // main loop
    let raf = 0;

    function updateInputMovement() {
      const left = keys["ArrowLeft"] || keys["KeyA"];
      const right = keys["ArrowRight"] || keys["KeyD"];
      const jump = keys["Space"] || keys["ArrowUp"] || keys["KeyW"];

      const speed = 2.5;
      if (left) player.vx = -speed;
      else if (right) player.vx = speed;
      else player.vx = 0;

      if (jump && player.onGround) {
        player.vy = -8;
        player.onGround = false;
      }
    }

    function loop() {
      updateInputMovement();
      resolveCollision(player, worldSys.isSolid);

      // camera
      const camX = Math.max(0, Math.min(WORLD_W * TILE_SIZE - canvas.width, player.x + player.w / 2 - canvas.width / 2));
      const camY = Math.max(0, Math.min(WORLD_H * TILE_SIZE - canvas.height, player.y + player.h / 2 - canvas.height / 2));

      // draw background
      ctx.fillStyle = "#87CEEB";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // world
      renderWorld(ctx, world, camX, camY, canvas);

      // player
      ctx.fillStyle = "#ffcc00";
      ctx.fillRect(Math.floor(player.x - camX), Math.floor(player.y - camY), player.w, player.h);

      // HUD hotbar
      drawHotbar(ctx, canvas, inventory);

      raf = requestAnimationFrame(loop);
    }

    raf = requestAnimationFrame(loop);

    // cleanup
    return () => {
      cancelAnimationFrame(raf);
      cleanupKeyboard();
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("contextmenu", (ev) => ev.preventDefault());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100vh" }} />;
}
