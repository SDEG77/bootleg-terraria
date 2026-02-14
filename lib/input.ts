// lib/input.ts
export function setupKeyboard(
  keys: Record<string, boolean>,
  onSelectHotkey: (slotIndex: number) => void,
  maxSlots = 5
) {
  const handleDown = (e: KeyboardEvent) => {
    keys[e.code] = true;
    if (e.code.startsWith("Digit")) {
      const num = parseInt(e.code.replace("Digit", ""), 10);
      if (!Number.isNaN(num) && num >= 1 && num <= maxSlots) {
        onSelectHotkey(num - 1); // convert to 0-based slot index
      }
    }
  };
  const handleUp = (e: KeyboardEvent) => {
    keys[e.code] = false;
  };

  window.addEventListener("keydown", handleDown);
  window.addEventListener("keyup", handleUp);

  return () => {
    window.removeEventListener("keydown", handleDown);
    window.removeEventListener("keyup", handleUp);
  };
}
