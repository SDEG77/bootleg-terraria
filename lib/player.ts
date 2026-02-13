import { TILE_SIZE } from "./constants";

export function createPlayer() {
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

export function resolveCollision(
  p: any,
  isSolid: (tx: number, ty: number) => boolean
) {
  p.vy += 0.5;

  p.x += p.vx;
  collide(p, isSolid);

  p.y += p.vy;
  p.onGround = false;
  collide(p, isSolid, true);
}

function collide(
  p: any,
  isSolid: (tx: number, ty: number) => boolean,
  vertical = false
) {
  const minTx = Math.floor(p.x / TILE_SIZE);
  const maxTx = Math.floor((p.x + p.w - 1) / TILE_SIZE);
  const minTy = Math.floor(p.y / TILE_SIZE);
  const maxTy = Math.floor((p.y + p.h - 1) / TILE_SIZE);

  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      if (isSolid(tx, ty)) {
        if (!vertical) {
          if (p.vx > 0) p.x = tx * TILE_SIZE - p.w;
          else if (p.vx < 0) p.x = (tx + 1) * TILE_SIZE;
          p.vx = 0;
        } else {
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
}
