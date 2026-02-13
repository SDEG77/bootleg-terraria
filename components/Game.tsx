"use client";

import { useEffect, useRef } from "react";
import { TILE, TILE_SIZE, WORLD_W, WORLD_H } from "@/lib/constants";
import { createWorld } from "@/lib/world";
import { createPlayer, resolveCollision, Player } from "@/lib/player";
import { createInventory, addToInventory, getSelectedTile, Inventory, removeFromInventory } from "@/lib/inventory";
import { setupKeyboard } from "@/lib/input";
import { renderWorld, drawHotbar, drawHealthBar } from "@/lib/renderer";

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const zoomRef = useRef(1.5);
  const spriteRef = useRef<HTMLImageElement | null>(null);

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
    const MAX_HEALTH = 100;
    let health = MAX_HEALTH;
    const playerSprite = new Image();
    playerSprite.src = "/player-sprite.svg";
    spriteRef.current = playerSprite;
    let spawnX = player.x;
    let spawnY = player.y;

    // spawn on the surface near the center of the world
    {
      const spawnTx = Math.floor(WORLD_W / 2);
      let spawnTy = 0;
      for (let ty = 0; ty < WORLD_H; ty++) {
        if (worldSys.isSolid(spawnTx, ty)) {
          spawnTy = ty;
          break;
        }
      }
      spawnX = spawnTx * TILE_SIZE + (TILE_SIZE - player.w) / 2;
      spawnY = spawnTy * TILE_SIZE - player.h;
      player.x = spawnX;
      player.y = spawnY;
    }

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

    const INTERACT_RANGE_TILES = 6;
    const MIN_ZOOM = 0.75;
    const MAX_ZOOM = 3;
    const ZOOM_STEP = 0.15;

    function getCamera() {
      const zoom = zoomRef.current;
      const viewW = canvas.width / zoom;
      const viewH = canvas.height / zoom;
      const camX = Math.max(0, Math.min(WORLD_W * TILE_SIZE - viewW, player.x + player.w / 2 - viewW / 2));
      const camY = Math.max(0, Math.min(WORLD_H * TILE_SIZE - viewH, player.y + player.h / 2 - viewH / 2));
      return { camX, camY };
    }

    function inWorld(tx: number, ty: number) {
      return tx >= 0 && ty >= 0 && tx < WORLD_W && ty < WORLD_H;
    }

    function tileOverlapsPlayer(tx: number, ty: number) {
      const x = tx * TILE_SIZE;
      const y = ty * TILE_SIZE;
      return (
        x < player.x + player.w &&
        x + TILE_SIZE > player.x &&
        y < player.y + player.h &&
        y + TILE_SIZE > player.y
      );
    }

    function isWithinInteractRange(tx: number, ty: number) {
      const px = player.x + player.w / 2;
      const py = player.y + player.h / 2;
      const cx = tx * TILE_SIZE + TILE_SIZE / 2;
      const cy = ty * TILE_SIZE + TILE_SIZE / 2;
      const dx = cx - px;
      const dy = cy - py;
      const maxDist = INTERACT_RANGE_TILES * TILE_SIZE;
      return dx * dx + dy * dy <= maxDist * maxDist;
    }

    function hasNonAirNeighbor(tx: number, ty: number) {
      return (
        getTile(tx + 1, ty) !== TILE.AIR ||
        getTile(tx - 1, ty) !== TILE.AIR ||
        getTile(tx, ty + 1) !== TILE.AIR ||
        getTile(tx, ty - 1) !== TILE.AIR
      );
    }

    // helper to convert mouse -> world coords and tile coords
    function mouseToTarget(mx: number, my: number, rect: DOMRect) {
      const { camX, camY } = getCamera();
      const zoom = zoomRef.current;
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const worldX = (mx * scaleX) / zoom + camX;
      const worldY = (my * scaleY) / zoom + camY;
      const tx = Math.floor(worldX / TILE_SIZE);
      const ty = Math.floor(worldY / TILE_SIZE);
      return { worldX, worldY, tx, ty };
    }

    // mouse handlers for break/place
    const handleMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const { worldX, worldY, tx, ty } = mouseToTarget(mx, my, rect);
      if (!inWorld(tx, ty) || !isWithinInteractRange(tx, ty)) return;
      const tile = getTile(tx, ty);

      // left = 0 break & pickup
      if (e.button === 0) {
        if (tile !== TILE.AIR) {
          addToInventory(inventory, tile, 1);
          setTile(tx, ty, TILE.AIR);
        }
      }

      // right = 2 place selected
      if (e.button === 2) {
        const type = getSelectedTile(inventory);
        if ((inventory.counts[type] || 0) <= 0) return;

        let placeTx = tx;
        let placeTy = ty;

        // If aiming at a solid tile, place on the closest face to cursor.
        if (tile !== TILE.AIR) {
          const targetCx = tx * TILE_SIZE + TILE_SIZE / 2;
          const targetCy = ty * TILE_SIZE + TILE_SIZE / 2;
          const dx = worldX - targetCx;
          const dy = worldY - targetCy;

          if (Math.abs(dx) > Math.abs(dy)) {
            placeTx += dx > 0 ? 1 : -1;
          } else {
            placeTy += dy > 0 ? 1 : -1;
          }
        }

        if (!inWorld(placeTx, placeTy)) return;
        if (!isWithinInteractRange(placeTx, placeTy)) return;
        if (getTile(placeTx, placeTy) !== TILE.AIR) return;
        if (tileOverlapsPlayer(placeTx, placeTy)) return;
        if (!hasNonAirNeighbor(placeTx, placeTy)) return;

        const taken = removeFromInventory(inventory, type, 1);
        if (taken > 0) {
          setTile(placeTx, placeTy, type);
        }
      }
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const nextZoom = e.deltaY < 0 ? zoomRef.current + ZOOM_STEP : zoomRef.current - ZOOM_STEP;
      zoomRef.current = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom));
    };

    const handleContextMenu = (ev: MouseEvent) => ev.preventDefault();

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("contextmenu", handleContextMenu);

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
      const wasOnGround = player.onGround;
      const impactSpeed = player.vy;
      resolveCollision(player, worldSys.isSolid);

      // Fall damage on hard landings.
      if (!wasOnGround && player.onGround && impactSpeed > 10) {
        const damage = Math.floor((impactSpeed - 9) * 8);
        health = Math.max(0, health - damage);
      }

      // Respawn with full health if dead.
      if (health <= 0) {
        health = MAX_HEALTH;
        player.x = spawnX;
        player.y = spawnY;
        player.vx = 0;
        player.vy = 0;
        player.onGround = false;
      }

      // camera
      const { camX, camY } = getCamera();

      // draw background
      ctx.fillStyle = "#87CEEB";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // world
      const zoom = zoomRef.current;
      renderWorld(ctx, world, camX, camY, canvas, zoom);

      // player
      const drawX = Math.floor((player.x - camX) * zoom);
      const drawY = Math.floor((player.y - camY) * zoom);
      const drawW = Math.ceil(player.w * zoom);
      const drawH = Math.ceil(player.h * zoom);
      const sprite = spriteRef.current;
      if (sprite && sprite.complete && sprite.naturalWidth > 0) {
        ctx.drawImage(sprite, drawX, drawY, drawW, drawH);
      } else {
        ctx.fillStyle = "#ffcc00";
        ctx.fillRect(drawX, drawY, drawW, drawH);
      }

      // HUD hotbar
      drawHealthBar(ctx, canvas, health, MAX_HEALTH);
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
      canvas.removeEventListener("wheel", handleWheel);
      canvas.removeEventListener("contextmenu", handleContextMenu);
      spriteRef.current = null;
    };
  }, []);

  return <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100vh" }} />;
}
