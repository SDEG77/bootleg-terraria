// lib/player.ts
import { TILE_SIZE } from "@/lib/constants";

export type Player = {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  onGround: boolean;
};

export function createPlayer(): Player {
  return {
    x: 100,
    y: 100,
    w: 12,
    h: 28,
    vx: 0,
    vy: 0,
    onGround: false,
  };
}

// resolve collisions in two passes (horizontal then vertical)
export function resolveCollision(p: Player, isSolid: (tx: number, ty: number) => boolean) {
  // gravity
  p.vy += 0.5;

  // horizontal
  p.x += p.vx;
  {
    let minTx = Math.floor(p.x / TILE_SIZE);
    let maxTx = Math.floor((p.x + p.w - 1) / TILE_SIZE);
    let minTy = Math.floor(p.y / TILE_SIZE);
    let maxTy = Math.floor((p.y + p.h - 1) / TILE_SIZE);

    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        if (isSolid(tx, ty)) {
          if (p.vx > 0) p.x = tx * TILE_SIZE - p.w;
          else if (p.vx < 0) p.x = (tx + 1) * TILE_SIZE;
          p.vx = 0;
          minTx = Math.floor(p.x / TILE_SIZE);
          maxTx = Math.floor((p.x + p.w - 1) / TILE_SIZE);
        }
      }
    }
  }

  // vertical
  p.y += p.vy;
  p.onGround = false;
  {
    let minTx = Math.floor(p.x / TILE_SIZE);
    let maxTx = Math.floor((p.x + p.w - 1) / TILE_SIZE);
    let minTy = Math.floor(p.y / TILE_SIZE);
    let maxTy = Math.floor((p.y + p.h - 1) / TILE_SIZE);

    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        if (isSolid(tx, ty)) {
          if (p.vy > 0) {
            p.y = ty * TILE_SIZE - p.h;
            p.vy = 0;
            p.onGround = true;
          } else if (p.vy < 0) {
            p.y = (ty + 1) * TILE_SIZE;
            p.vy = 0;
          }
          minTy = Math.floor(p.y / TILE_SIZE);
          maxTy = Math.floor((p.y + p.h - 1) / TILE_SIZE);
        }
      }
    }
  }
}
