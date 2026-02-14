"use client";

import { useEffect, useRef } from "react";
import type { StoreApi } from "zustand";
import { TILE_SIZE, WORLD_H, WORLD_W } from "@/lib/constants";
import { createGameStore, type GameStore } from "@/lib/gameStore";
import { setupKeyboard } from "@/lib/input";
import { drawHealthBar, drawHotbar, renderWorld } from "@/lib/renderer";

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function skyColorFromTime(timeOfDay: number): string {
  const angle = timeOfDay * Math.PI * 2;
  const daylight = clamp01((Math.sin(angle - Math.PI / 2) + 1) / 2);
  const r = Math.round(lerp(16, 135, daylight));
  const g = Math.round(lerp(24, 206, daylight));
  const b = Math.round(lerp(54, 235, daylight));
  return `rgb(${r}, ${g}, ${b})`;
}

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const spriteRef = useRef<HTMLImageElement | null>(null);
  const storeRef = useRef<StoreApi<GameStore> | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasEl = canvas;
    const ctx = canvasEl.getContext("2d");
    if (!ctx) return;
    const ctxEl = ctx;

    ctxEl.imageSmoothingEnabled = false;
    const store = createGameStore();
    storeRef.current = store;

    const playerSprite = new Image();
    playerSprite.src = "/player-sprite.svg";
    spriteRef.current = playerSprite;

    const keys: Record<string, boolean> = {};
    const cleanupKeyboard = setupKeyboard(keys, (slotIndex) => {
      store.getState().selectHotbar(slotIndex);
    });

    function resize() {
      canvasEl.width = window.innerWidth;
      canvasEl.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    function getCamera() {
      const state = store.getState();
      const viewW = canvasEl.width / state.zoom;
      const viewH = canvasEl.height / state.zoom;
      const camX = Math.max(0, Math.min(WORLD_W * TILE_SIZE - viewW, state.player.x + state.player.w / 2 - viewW / 2));
      const camY = Math.max(0, Math.min(WORLD_H * TILE_SIZE - viewH, state.player.y + state.player.h / 2 - viewH / 2));
      return { camX, camY };
    }

    function mouseToTarget(mx: number, my: number, rect: DOMRect) {
      const { camX, camY } = getCamera();
      const zoom = store.getState().zoom;
      const scaleX = canvasEl.width / rect.width;
      const scaleY = canvasEl.height / rect.height;
      const worldX = (mx * scaleX) / zoom + camX;
      const worldY = (my * scaleY) / zoom + camY;
      const tx = Math.floor(worldX / TILE_SIZE);
      const ty = Math.floor(worldY / TILE_SIZE);
      return { worldX, worldY, tx, ty };
    }

    const handleMouseDown = (e: MouseEvent) => {
      const rect = canvasEl.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const { worldX, worldY, tx, ty } = mouseToTarget(mx, my, rect);

      if (e.button === 0) store.getState().breakTile(tx, ty);
      if (e.button === 2) store.getState().placeTile(tx, ty, worldX, worldY);
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      store.getState().changeZoom(e.deltaY < 0 ? 1 : -1);
    };

    const handleContextMenu = (ev: MouseEvent) => ev.preventDefault();

    canvasEl.addEventListener("mousedown", handleMouseDown);
    canvasEl.addEventListener("wheel", handleWheel, { passive: false });
    canvasEl.addEventListener("contextmenu", handleContextMenu);

    let raf = 0;
    function loop() {
      store.getState().tick(keys);
      const state = store.getState();
      const { camX, camY } = getCamera();

      ctxEl.fillStyle = skyColorFromTime(state.timeOfDay);
      ctxEl.fillRect(0, 0, canvasEl.width, canvasEl.height);

      const celestialAngle = state.timeOfDay * Math.PI * 2 - Math.PI / 2;
      const celestialX = canvasEl.width * 0.5 + Math.cos(celestialAngle) * canvasEl.width * 0.38;
      const celestialY = canvasEl.height * 0.82 - Math.sin(celestialAngle) * canvasEl.height * 0.62;
      const isDay = Math.sin(celestialAngle) > 0;
      ctxEl.beginPath();
      ctxEl.arc(celestialX, celestialY, 18, 0, Math.PI * 2);
      ctxEl.fillStyle = isDay ? "#ffd54f" : "#f5f3ce";
      ctxEl.fill();

      renderWorld(ctxEl, state.world, camX, camY, canvasEl, state.zoom);

      const drawX = Math.floor((state.player.x - camX) * state.zoom);
      const drawY = Math.floor((state.player.y - camY) * state.zoom);
      const drawW = Math.ceil(state.player.w * state.zoom);
      const drawH = Math.ceil(state.player.h * state.zoom);
      const sprite = spriteRef.current;

      if (sprite && sprite.complete && sprite.naturalWidth > 0) {
        ctxEl.drawImage(sprite, drawX, drawY, drawW, drawH);
      } else {
        ctxEl.fillStyle = "#ffcc00";
        ctxEl.fillRect(drawX, drawY, drawW, drawH);
      }

      drawHealthBar(ctxEl, canvasEl, state.health, state.maxHealth);
      drawHotbar(ctxEl, canvasEl, state.inventory);

      raf = requestAnimationFrame(loop);
    }

    const win = window as Window & {
      render_game_to_text?: () => string;
      advanceTime?: (ms: number) => void;
    };
    win.render_game_to_text = () => {
      const state = store.getState();
      const angle = state.timeOfDay * Math.PI * 2 - Math.PI / 2;
      return JSON.stringify({
        coordinateSystem: "origin top-left, +x right, +y down",
        player: {
          x: state.player.x,
          y: state.player.y,
          vx: state.player.vx,
          vy: state.player.vy,
          onGround: state.player.onGround,
        },
        health: state.health,
        maxHealth: state.maxHealth,
        zoom: state.zoom,
        timeOfDay: state.timeOfDay,
        isDay: Math.sin(angle) > 0,
      });
    };
    win.advanceTime = (ms: number) => {
      const steps = Math.max(1, Math.round(ms / (1000 / 60)));
      for (let i = 0; i < steps; i++) {
        store.getState().tick(keys);
      }
    };

    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      cleanupKeyboard();
      window.removeEventListener("resize", resize);
      canvasEl.removeEventListener("mousedown", handleMouseDown);
      canvasEl.removeEventListener("wheel", handleWheel);
      canvasEl.removeEventListener("contextmenu", handleContextMenu);
      spriteRef.current = null;
      storeRef.current = null;
      delete win.render_game_to_text;
      delete win.advanceTime;
    };
  }, []);

  return <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100vh" }} />;
}
