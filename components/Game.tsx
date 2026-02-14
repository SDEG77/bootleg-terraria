"use client";

import { useEffect, useRef } from "react";
import type { StoreApi } from "zustand";
import { TILE_SIZE, WORLD_H, WORLD_W } from "@/lib/constants";
import { createGameStore, SPELL, WEAPONS, type GameStore } from "@/lib/gameStore";
import { setupKeyboard } from "@/lib/input";
import { drawCombatInfo, drawHealthBar, drawHotbar, drawManaBar, renderWorld } from "@/lib/renderer";

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
      store.getState().setAim(worldX, worldY);

      if (e.button === 0) store.getState().breakTile(tx, ty);
      if (e.button === 2) store.getState().placeTile(tx, ty, worldX, worldY);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvasEl.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const { worldX, worldY } = mouseToTarget(mx, my, rect);
      store.getState().setAim(worldX, worldY);
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      store.getState().changeZoom(e.deltaY < 0 ? 1 : -1);
    };

    const handleCombatKeys = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === "KeyQ") {
        store.getState().cycleWeapon(1);
      } else if (e.code === "KeyF") {
        store.getState().useWeapon();
      } else if (e.code === "KeyR") {
        store.getState().castSpell();
      }
    };

    const handleContextMenu = (ev: MouseEvent) => ev.preventDefault();

    canvasEl.addEventListener("mousedown", handleMouseDown);
    canvasEl.addEventListener("mousemove", handleMouseMove);
    canvasEl.addEventListener("wheel", handleWheel, { passive: false });
    canvasEl.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleCombatKeys);

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

      for (let i = 0; i < state.enemies.length; i++) {
        const e = state.enemies[i];
        const ex = Math.floor((e.x - camX) * state.zoom);
        const ey = Math.floor((e.y - camY) * state.zoom);
        const ew = Math.ceil(e.w * state.zoom);
        const eh = Math.ceil(e.h * state.zoom);

        ctxEl.fillStyle = "#4caf50";
        ctxEl.fillRect(ex, ey, ew, eh);

        const hpRatio = Math.max(0, Math.min(1, e.hp / e.maxHp));
        const barW = ew;
        const barH = Math.max(2, Math.ceil(4 * state.zoom));
        ctxEl.fillStyle = "rgba(0,0,0,0.7)";
        ctxEl.fillRect(ex, ey - barH - 3, barW, barH);
        ctxEl.fillStyle = "#ff4d4f";
        ctxEl.fillRect(ex, ey - barH - 3, Math.floor(barW * hpRatio), barH);
      }

      for (let i = 0; i < state.projectiles.length; i++) {
        const p = state.projectiles[i];
        const px = Math.floor((p.x - camX) * state.zoom);
        const py = Math.floor((p.y - camY) * state.zoom);
        const pr = Math.max(2, Math.ceil(p.r * state.zoom));
        ctxEl.beginPath();
        ctxEl.arc(px, py, pr, 0, Math.PI * 2);
        ctxEl.fillStyle = p.kind === "fireball" ? "#ff8a33" : "#d7f0ff";
        ctxEl.fill();
      }

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
      drawManaBar(ctxEl, canvasEl, state.mana, state.maxMana);
      const weaponName = WEAPONS[state.selectedWeaponIndex]?.name || "Unknown";
      drawCombatInfo(ctxEl, canvasEl, weaponName, SPELL.name, state.enemies.length);
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
        mana: state.mana,
        maxMana: state.maxMana,
        zoom: state.zoom,
        timeOfDay: state.timeOfDay,
        isDay: Math.sin(angle) > 0,
        weapon: WEAPONS[state.selectedWeaponIndex]?.name || "Unknown",
        enemies: state.enemies.map((e) => ({ id: e.id, x: e.x, y: e.y, hp: e.hp })),
        projectiles: state.projectiles.length,
        score: state.score,
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
      canvasEl.removeEventListener("mousemove", handleMouseMove);
      canvasEl.removeEventListener("wheel", handleWheel);
      canvasEl.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleCombatKeys);
      spriteRef.current = null;
      storeRef.current = null;
      delete win.render_game_to_text;
      delete win.advanceTime;
    };
  }, []);

  return <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100vh" }} />;
}
