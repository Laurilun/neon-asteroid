<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Neon Void — New Era

A Canvas 2D arcade survival roguelite built with React, Vite, and TypeScript. GitHub's default `main` is the development baseline; `paska` preserves the original New Era history. See [.agent/rules/rules.md](.agent/rules/rules.md) for the automatic validate/commit/push workflow.

## Run locally

With Node.js installed, run `npm ci`, then `npm run dev` (port 3000). No API key is needed to play. Arrow keys steer and thrust, weapons fire automatically, Space starts/restarts, and F3 toggles diagnostics. Developer controls expose start-level overrides and the existing combat sandbox.

## Validate

Run `npm test`, `npm run typecheck`, and `npm run build`. On Windows, use `npm.cmd` if PowerShell's execution policy blocks `npm.ps1`.

The Engine Foundation baseline passed its original four tests, TypeScript command, and production build. Its React type definitions were missing, leaving React state largely unchecked; matching React 19 type definitions are now installed and the missing initial ship stun timestamp is initialized. The expanded suite covers refresh-rate equivalence, bounded catch-up, suspension/resume, cooldowns, movement/wrapping, projectile lifetime, swept contacts, overlapping targets, ricochets, shard blocking, and stable entity cleanup/caps.

## Engine boundaries

| Location | Responsibility |
| --- | --- |
| `game/engine.ts` | Simulation clock, periodic timer primitive, in-place entity cleanup/caps |
| `game/movement.ts` | One-tick ship steering, thrust, friction, frozen slow, knockback decay, wrapping |
| `game/projectiles.ts` | Player cooldown/volleys, projectile movement/lifetime/trails, earliest-hit resolution, shard links, ricochets |
| `game/collision.ts` | Framework-independent swept segment/circle and ship triangle/circle geometry |
| `components/AsteroidsGame.tsx` | React/canvas lifecycle, world collections, integration, effects/rendering, remaining asteroid/director/progression rules |
| `components/GameUI.tsx` | Existing menus, HUD, upgrades and developer controls |
| `constants.ts`, `types.ts` | Balance configuration and shared entity contracts |

Projectile effects and asteroid destruction/loot are narrow callbacks into the integration component. Extracted systems receive explicit state and have no React, DOM, wall-clock, or canvas dependency. Weapon randomness is injectable. `pools.ts` remains unused; this milestone uses in-place collection cleanup without introducing a second pooling/lifecycle system.

## Timing and contact behavior

- All simulation rules run at 60 Hz, preserving the existing 60 FPS constants. Rendering runs once per animation frame with the latest state; interpolation is deferred.
- At most five simulation steps run per rendered frame. Excess elapsed time is discarded during large stalls, so severe overload slows gameplay rather than causing unbounded catch-up.
- Upgrade screens, window blur, and hidden tabs suspend simulation. Input is cleared on focus/visibility changes; resume establishes a fresh timestamp. Invulnerability, weapon/director timers, queued spawns, shards, and effects use simulation time and do not expire while paused. A new run resets the clock and weapon cooldown.
- Bullets sweep their full tick segment, including their final lifetime/viewport segment, and damage only the first contact. Shards win exact contact ties using their existing defensive `collisionRadius`. Asteroids retain their full projectile radius; ship contacts retain the existing forgiving 85% asteroid radius and now include triangle edges/containment.
- A collision starts its invulnerability window immediately, preventing multiple overlapping rocks from bypassing it in the same tick. Lethal shard chip damage and aura deaths now enter game over consistently. Freebie upgrade selection opens after the current tick finishes, consuming one freebie at a time.
- Ricochets retain damage/range rules and may revisit earlier chain members, excluding only their immediate source. New ricochets begin movement/collision on the next tick. Hit effects now originate at actual contact points. Thrust particles emit from the updated ship position.

## Verification limits and next work

Automated engine checks pass. Interactive browser smoke testing was unavailable in the Engine Foundation session: browser automation listed no connected browsers and could not open an in-app browser. Starting Vite also encountered a sandbox port permission error. Start/restart, visual movement/wrapping, asteroid splitting, XP/upgrade selection, focus suspension, damage/death, and all special asteroid behaviors still need a practical browser pass; unit tests do not replace that pass.

Priorities for the next milestone:

1. Playtest and characterize ship control feel, shooting responsiveness, and asteroid interactions against this baseline, especially at 30/60/high refresh rates. Add integration coverage for XP/freebie/death transitions as progression is extracted.
2. Extract asteroid/director and progression state from the integration component. Their scans, cloud membership lookups, and shard spawning still dominate coupling; preserve special behaviors before optimizing.
3. Consider relative-motion continuous collision and a broad phase only after profiling. Current sweeps test targets at their end-of-tick positions; very fast moving targets, thrown shard/ship tunneling, and physical contacts across wrap seams remain limitations. No physics engine or spatial partition was added.
