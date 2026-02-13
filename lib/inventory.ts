import { TILE } from "./constants";

export function createInventory() {
  return {
    selected: TILE.DIRT,
    items: {
      [TILE.DIRT]: 0,
      [TILE.STONE]: 0,
      [TILE.GRASS]: 0,
      [TILE.WOOD]: 0,
      [TILE.LEAVES]: 0,
    } as Record<number, number>,
  };
}
