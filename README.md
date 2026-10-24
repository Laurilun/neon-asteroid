# Neon Void ? Mass & Mayhem

A Canvas 2D arcade survival roguelite built with React, Vite, and TypeScript. `main` is the development baseline; `paska` remains a historical branch. See [.agent/rules/rules.md](.agent/rules/rules.md) for the validate/commit/push workflow.

## Run and controls

Run `npm ci`, then `npm run dev` (port 3000, or the next free port). No API key is needed. Arrow keys steer and thrust; weapons fire automatically. Space starts/restarts. F3 toggles diagnostics. On Windows use `npm.cmd` if PowerShell blocks the npm shim.

The ship now has angular acceleration, strong counter-steering, momentum-preserving turns, twin engines and reaction jets. A solid armored hull replaces the arrow outline. Its cannon battery grows from one to seven physical hardpoints; further Split Shot tiers reinforce those guns. Every barrel fires a full-strength round. This is an intentional increase in upgrade power and needs late-run balancing through playtests.

Asteroids use material-specific outlines, shaded facets, craters, fissures and strata. Contact-local scars and mass-scaled impulses lead into actual polygon cuts. Gameplay fragments inherit parent motion, rotation, surface features and collision outlines. Loot, level progression, enemy auras, clouds, tungsten shards, drones and screen wrapping remain in ordinary runs.

## Experiment lab

Enable **Dev Mode ? Game-Feel Lab ? Initiate Launch** on the menu. The lab is separate from normal progression. Its live panel offers three handling profiles, thrust/turn tuning, all main weapon tiers, five target materials, four sizes, moving targets, automatic fire and repeat, and a reinforced test hull. Material/size/motion changes replace the targets immediately. **Reset experiment** resets ship position, weapons, effects and targets while keeping the chosen configuration. **Clear field** disables repeat for handling practice. Click the arena after using a slider/select to restore flight input. **Exit to menu** returns to the menu.

The **Effects: Full/Reduced** button works in both ordinary runs and the lab. Reduced mode removes camera shake and invulnerability blinking, softens hit flashes, simplifies surface detail, and lowers the effect budget without changing gameplay damage or collision rules.

See [milestone notes and manual checks](docs/MASS_MAYHEM.md) and the [offline art sheet](docs/mass-mayhem-art-check.png).

## Validate

Run `npm test`, `npm run typecheck`, and `npm run build`.

Engine tests cover fixed-step equivalence at multiple refresh rates, suspension/resume, movement/counter-steering/wrapping, physical firing origins and upgrade damage, swept polygon contacts, shard blocking, ricochets, area-preserving fracture, inherited material coordinates, effect expiry/budgets, deterministic rendering and entity cleanup.

## Engine boundaries

| Location | Responsibility |
| --- | --- |
| `game/engine.ts` | Fixed clock, timers, collection cleanup/caps |
| `game/movement.ts` | Fixed-tick thrust, steering inertia, profiles, frozen slow, wrapping |
| `game/hardware.ts` | Shared hull footprint, cached cannon mounts, battery damage |
| `game/projectiles.ts` | Cooldowns, firing origins, projectile lifetime, swept contacts, impulses/scars, ricochets |
| `game/collision.ts` | Swept circle/polygon geometry, shared ship hull contacts, contact severity |
| `game/fracture.ts` | Material outlines, clipping, inherited fragment motion/material coordinates |
| `game/feel.ts` | Typed presentation events, recoil/heat, finite effect lifetimes and budgets |
| `game/rendering.ts` | Procedural ship/rock/projectile/effect drawing, geometry/path caches |
| `game/lab.ts`, `components/FeelLab.tsx` | Repeatable targets/loadouts and developer controls |
| `components/AsteroidsGame.tsx` | React/canvas integration, director, remaining progression/enemy behavior |
| `components/GameUI.tsx` | Menus, HUD and upgrades |

Gameplay runs at 60 Hz, at most five simulation steps per rendered frame. Upgrade screens, blur and hidden tabs suspend simulation and clear input; resume starts a fresh frame timestamp. Rendering does not advance gameplay or use fresh random values. New effect randomness is sampled at event creation. Decorations never drive gameplay. Geometry/path caches use weak references so destroyed rocks are not retained. `pools.ts` remains unused.

## Current limitations

- Interactive browser testing was unavailable in this session: no connected browser and the in-app browser could not be opened. A temporary DOM/Canvas harness exercised the actual React game and produced inspected 1280?720 captures, but this is not a human playtest or browser performance measurement.
- Extreme-load software Canvas rendering remained over a 60 FPS frame budget; see the measured workload in the milestone notes. F3 and the reduced-effects option support a real browser pass next.
- Projectile sweeps use asteroid end-of-tick poses. Relative-motion continuous collision, fast ship/shard tunneling and physical contacts across wrap seams remain unresolved.
- Collision polygons follow cut geometry; ordinary asteroid hull contacts use a small 4% inset for forgiveness. Defensive shards retain their larger blocking radius. Circular aura ranges and proximity queries remain deliberate approximations.
- Seven barrels are a readability ceiling, not an unlimited geometry expansion. High-tier balance, crowded battery legibility and angular/geometric rock shading deserve the next iteration. No audio, hit-stop, camera panning, asset pipeline or physics-engine migration was added.
