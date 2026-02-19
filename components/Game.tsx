"use client";

import { useEffect, useRef } from "react";
import type { StoreApi } from "zustand";
import { TILE_COLORS, TILE_SIZE, WORLD_H, WORLD_W } from "@/lib/constants";
import { createGameStore, SPELL, WEAPONS, type GameStore } from "@/lib/gameStore";
import { setupKeyboard } from "@/lib/input";
import { drawCombatInfo, drawHealthBar, drawHotbar, drawManaBar, getHotbarSlotAtPoint, renderWorld, type HotbarItem } from "@/lib/renderer";

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
    const slotCount = store.getState().inventory.slots.length + WEAPONS.length + 1;
    let paused = false;
    const cleanupKeyboard = setupKeyboard(keys, (slotIndex) => {
      store.getState().selectHotbar(slotIndex);
    }, slotCount);

    function getPauseMenuRects() {
      const panelW = 320;
      const panelH = 220;
      const panelX = Math.floor((canvasEl.width - panelW) / 2);
      const panelY = Math.floor((canvasEl.height - panelH) / 2);
      const btnW = 180;
      const btnH = 44;
      const btnX = panelX + Math.floor((panelW - btnW) / 2);
      const resumeY = panelY + 92;
      const quitY = resumeY + btnH + 14;
      return {
        panelX,
        panelY,
        panelW,
        panelH,
        resume: { x: btnX, y: resumeY, w: btnW, h: btnH },
        quit: { x: btnX, y: quitY, w: btnW, h: btnH },
      };
    }

    function pointInRect(px: number, py: number, r: { x: number; y: number; w: number; h: number }) {
      return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
    }

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

      if (paused && e.button === 0) {
        const menu = getPauseMenuRects();
        if (pointInRect(mx, my, menu.resume)) {
          paused = false;
          return;
        }
        if (pointInRect(mx, my, menu.quit)) {
          window.location.href = "about:blank";
          return;
        }
        return;
      }

      const clickedSlot = getHotbarSlotAtPoint(canvasEl, slotCount, mx, my);
      if (clickedSlot >= 0) {
        store.getState().setHotbarIndex(clickedSlot);
        return;
      }

      const { worldX, worldY, tx, ty } = mouseToTarget(mx, my, rect);
      store.getState().setAim(worldX, worldY);

      const state = store.getState();
      const blockSlots = state.inventory.slots.length;
      const weaponSlotsEnd = blockSlots + WEAPONS.length;

      if (e.button === 0) {
        const selected = state.selectedHotbarIndex;
        if (selected < blockSlots) {
          store.getState().breakTile(tx, ty);
        } else if (selected < weaponSlotsEnd) {
          store.getState().useWeapon();
        } else {
          store.getState().castSpell();
        }
      }
      if (e.button === 2) store.getState().placeTile(tx, ty, worldX, worldY);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (paused) return;
      const rect = canvasEl.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const { worldX, worldY } = mouseToTarget(mx, my, rect);
      store.getState().setAim(worldX, worldY);
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey) {
        store.getState().changeZoom(e.deltaY < 0 ? 1 : -1);
        return;
      }

      const state = store.getState();
      const step = e.deltaY > 0 ? 1 : -1;
      const next = (state.selectedHotbarIndex + step + slotCount) % slotCount;
      store.getState().setHotbarIndex(next);
    };

    const handleCombatKeys = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === "Escape") {
        paused = !paused;
        return;
      }
      if (paused) return;
      if (e.code === "KeyQ") {
        store.getState().cycleWeapon(1);
      } else if (e.code === "KeyF") {
        const state = store.getState();
        const idx = state.inventory.slots.length + state.selectedWeaponIndex;
        store.getState().setHotbarIndex(idx);
        store.getState().useWeapon();
      } else if (e.code === "KeyR") {
        const state = store.getState();
        const spellIndex = state.inventory.slots.length + WEAPONS.length;
        store.getState().setHotbarIndex(spellIndex);
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
      if (!paused) {
        store.getState().tick(keys);
      }
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
      const hotbarItems: HotbarItem[] = [
        ...state.inventory.slots.map((tile) => ({
          kind: "block" as const,
          label: String(tile),
          color: TILE_COLORS[tile] || "#666",
          count: state.inventory.counts[tile] || 0,
        })),
        ...WEAPONS.map((w) => ({
          kind: "weapon" as const,
          label: w.name,
          weaponId: w.id,
        })),
        {
          kind: "spell" as const,
          label: SPELL.name,
          spellId: SPELL.id,
        },
      ];
      drawHotbar(ctxEl, canvasEl, hotbarItems, state.selectedHotbarIndex);

      if (paused) {
        const menu = getPauseMenuRects();
        ctxEl.fillStyle = "rgba(0,0,0,0.5)";
        ctxEl.fillRect(0, 0, canvasEl.width, canvasEl.height);

        ctxEl.fillStyle = "#1b1b1b";
        ctxEl.fillRect(menu.panelX, menu.panelY, menu.panelW, menu.panelH);
        ctxEl.strokeStyle = "#ffffff";
        ctxEl.lineWidth = 2;
        ctxEl.strokeRect(menu.panelX, menu.panelY, menu.panelW, menu.panelH);

        ctxEl.fillStyle = "#ffffff";
        ctxEl.font = "bold 28px monospace";
        ctxEl.textAlign = "center";
        ctxEl.textBaseline = "top";
        ctxEl.fillText("Paused", menu.panelX + menu.panelW / 2, menu.panelY + 28);

        ctxEl.fillStyle = "#2f7d32";
        ctxEl.fillRect(menu.resume.x, menu.resume.y, menu.resume.w, menu.resume.h);
        ctxEl.fillStyle = "#ffffff";
        ctxEl.font = "bold 18px monospace";
        ctxEl.fillText("Resume", menu.resume.x + menu.resume.w / 2, menu.resume.y + 12);

        ctxEl.fillStyle = "#8b1e1e";
        ctxEl.fillRect(menu.quit.x, menu.quit.y, menu.quit.w, menu.quit.h);
        ctxEl.fillStyle = "#ffffff";
        ctxEl.fillText("Quit", menu.quit.x + menu.quit.w / 2, menu.quit.y + 12);

        ctxEl.textAlign = "start";
      }

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
        paused,
        weapon: WEAPONS[state.selectedWeaponIndex]?.name || "Unknown",
        selectedHotbarIndex: state.selectedHotbarIndex,
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
