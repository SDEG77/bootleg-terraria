export function setupKeyboard(keys: any, onSelect: (num: number) => void) {
  const handleDown = (e: KeyboardEvent) => {
    keys[e.code] = true;

    if (e.code.startsWith("Digit")) {
      const num = parseInt(e.code.replace("Digit", ""));
      if (num >= 1 && num <= 5) onSelect(num);
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
