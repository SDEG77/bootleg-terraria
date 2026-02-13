export const TILE_SIZE = 16;
export const WORLD_W = 200;
export const WORLD_H = 120;

export const TILE = {
  AIR: 0,
  DIRT: 1,
  STONE: 2,
  GRASS: 3,
  WOOD: 4,
  LEAVES: 5,
} as const;

export const TILE_COLORS: Record<number, string | null> = {
  [TILE.AIR]: null,
  [TILE.DIRT]: "#8B5A2B",
  [TILE.STONE]: "#6b6b6b",
  [TILE.GRASS]: "#2ecc71",
  [TILE.WOOD]: "#8B4513",
  [TILE.LEAVES]: "#3cb371",
};
