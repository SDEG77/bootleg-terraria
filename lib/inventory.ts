// lib/inventory.ts
import { TILE } from "@/lib/constants";

export type Inventory = {
  selectedIndex: number; // hotbar slot index 0..4
  slots: number[]; // which tile type each hotbar slot represents (tile id)
  counts: Record<number, number>;
};

export function createInventory(): Inventory {
  // choose the hotbar types (you can reorder)
  const slots = [TILE.DIRT, TILE.STONE, TILE.GRASS, TILE.WOOD, TILE.LEAVES];
  const counts: Record<number, number> = {};
  slots.forEach((t) => (counts[t] = 0));
  return {
    selectedIndex: 0,
    slots,
    counts,
  };
}

export function addToInventory(inv: Inventory, tileType: number, amount = 1) {
  inv.counts[tileType] = (inv.counts[tileType] || 0) + amount;
}

export function removeFromInventory(inv: Inventory, tileType: number, amount = 1) {
  const have = inv.counts[tileType] || 0;
  const take = Math.min(have, amount);
  inv.counts[tileType] = have - take;
  return take;
}

export function getSelectedTile(inv: Inventory): number {
  return inv.slots[inv.selectedIndex];
}
