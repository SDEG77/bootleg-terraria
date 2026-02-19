Original prompt: great, now its time for the combat overhaul, with mana and spells, and weapons, and enemies

- Added combat architecture into `lib/gameStore.ts` with:
  - weapons (`WEAPONS`), spell (`SPELL`), cooldowns, mana + regen
  - enemy state + spawning + movement + contact damage
  - projectile simulation and hit detection against enemies/terrain
  - weapon attack action (`useWeapon`) and spell cast action (`castSpell`)
- Updated `components/Game.tsx` with combat controls:
  - `Q` cycle weapon, `F` use weapon, `R` cast spell
  - mouse move updates combat aim direction
  - rendering for enemies + enemy HP bars + projectiles
- Updated HUD in `lib/renderer.ts`:
  - mana bar
  - combat info panel (weapon/spell/enemy count)

Validation:
- npm run lint: passed
- npm run build: passed

Controls:
- Q: cycle weapon
- F: use selected weapon
- R: cast spell
- Mouse move: aim weapons/spells

TODOs / suggestions:
- Add enemy respawn waves and scaling.
- Add enemy attack projectiles for ranged enemy types.
- Add weapon hotbar slot or UI selection with icons.
- Add hit flash / knockback feedback on both player and enemies.

Pause menu:
- Added ESC pause toggle in `components/Game.tsx`.
- While paused, game simulation (`tick`) stops.
- Added pause overlay menu with options:
  - Resume: closes menu and resumes game.
  - Quit: navigates to `about:blank`.
- Menu is mouse-clickable and blocks gameplay clicks while open.
- `render_game_to_text` now includes `paused`.
- Updated mouse wheel controls:
  - Wheel (default): cycles hotbar selection forward/backward.
  - Ctrl + Wheel: zoom in/out (keeps previous zoom behavior accessible).
