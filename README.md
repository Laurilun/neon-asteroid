# Neon Void — New Era

A Canvas 2D arcade survival roguelite built with React, Vite and TypeScript. **Mass & Mayhem** turns the original outline ship into an armored gunship, with persistent drift, a physical cannon battery, material surfaces and procedural breakup. [View the art contact sheet](docs/mass-mayhem-preview.png) (actual drawing code, including ships at gameplay scale; not a browser playtest).

GitHub's default `main` is the development baseline. `paska` retains the original New Era history. Completed work is validated, committed and pushed automatically; see [.agent/rules/rules.md](.agent/rules/rules.md).

## Run and validate

With Node.js installed, run `npm ci`, then `npm run dev` (port 3000). No API key is needed. Arrow keys steer/thrust; cannons fire automatically. Space starts/restarts, **P pauses**, and F3 shows diagnostics. Reduced effects is available in the top-right corner and defaults to the system reduced-motion preference.

Run `npm test`, `npm run typecheck`, and `npm run build`. On Windows, use `npm.cmd` if PowerShell blocks the npm script shim. No new game dependencies were added for this milestone.

## What changed

- **Handling:** angular acceleration, fast counter-steering and automatic attitude braking give rotation a wind-up and recovery without rotating the travel vector. Thrust spools quickly; retrograde thrust brakes; low drag preserves coast. A soft speed governor retains collision impulses. Engine plumes, corrective jets and a velocity chevron expose actual motion. The arena still wraps.
- **Ship and battery:** layered slate armor, twin engine housings, cockpit and readable muzzle hardware share normalized geometry with collision detection. Split Shot adds physically positioned, slightly converging cannons: one through eight visible barrels. Tiers beyond seven reinforce that battery by 8% per tier, keeping it readable.
- **Weapon balance:** the base cannon fires a 14-damage, 12px/tick sabot every 18 ticks, with a nominal 26-tick / 312px life. Additional cannons each retain 80% of base cannon damage rather than dividing the old volley. Rails increase damage/reach and reinforce the projectile silhouette; cooling affects cycling, barrel recoil and heat; ricochets use a cyan trail. Four ticks remains the minimum interval. The bullet cap is now 220 so a fast eight-gun rail battery can retain its range.
- **Contact and destruction:** swept polygon contacts find actual asteroid/fragment surfaces. Hull and barrel geometry participate in ship contacts; relative surface-normal speed distinguishes glances from head-on collisions. Projectile impulses depend on target size/density. Local scars grow with damage. Clipped parent polygons become live split children with inherited translation, rotation and separation; nonsplitting bodies leave temporary material chunks. Existing type-specific splitting eligibility, size-category HP, loot and progression remain in ordinary runs.
- **Presentation:** typed shot, impact, fracture, contact and near-miss events feed bounded visual lifetimes. Rock/crystal/metal silhouettes and surfaces differ structurally. Stable surfaces are generated once into a weakly held internal Canvas cache; cracks and hazard boundaries remain dynamic. Lighting on cached surfaces is baked in object space. New visual variation uses its own seeded RNG, never render-frame randomness. The random cyan cartridges are removed.

## Game-feel experiment lab

In the menu, enable **Dev Mode**, enable **Game-feel lab**, then **Initiate Launch**. The lab is absent from ordinary runs. Click the arena after editing a slider; Reset and Resume also restore flight focus. Collapse the panel with its header.

Handling presets (Gunship, Interceptor, Freighter), engine power, contact impulse and shake change live. Weapon sliders equip absolute tiers immediately. Material, size and target motion apply on **Reset trial / Apply targets**. Targets have real, finite HP and use real impact/splitting logic. Lab targets suppress homing and mutual declumping for repeatable trials; Tungsten still grows and throws its defensive shards. Lab kills skip loot/level-up interruptions. Repeat respawns the target group one second after it is cleared.

A fast manual verification pass:

1. With the default gunship, thrust, coast, turn across your travel direction, counter-steer, then face backward and brake. Cross all four screen edges. Compare the other two presets.
2. Reset a regular Large target. Watch the central cannon cycle, localized hits, cracks and clipped halves. Try Split Shot 1, 3 and 7; inspect separate muzzles and recoil. Raise cooling/rails/ricochet and check the increasingly dense battery still reads clearly.
3. Change material/size/motion and reset. Inspect Molten crust/aura, Frozen crystals/slow, Iron plates/impulses, Tungsten strata/shard blocking/throws, and moving targets. Turn ship immunity off to compare glancing and head-on contacts, damage, death and Space restart.
4. Pause with P or the lab button; verify all motion and effects freeze. Resume, switch tabs and return, toggle Reduced effects, and verify no time jump or stuck thrust. Use F3 during a high-tier trial to watch entity/effect counts.
5. Exit to the menu, disable Dev Mode, launch an ordinary run and check XP collection, upgrade selection, splitting/drops, drones, shield saves and game-over/restart. These React/UI flows still require browser verification.

## Engine map

| Location | Responsibility |
| --- | --- |
| `game/engine.ts` | 60 Hz simulation clock, five-step catch-up bound, timers and in-place cleanup/caps |
| `game/movement.ts` | Handling presets, angular/linear momentum, thrust, slow and wrapping |
| `game/geometry.ts`, `game/collision.ts` | Shared hull/mount geometry, clipping, swept polygon contacts and directional ship response |
| `game/projectiles.ts`, `game/asteroids.ts` | Cannon cadence/damage, firing origins, projectile lifecycle/ricochets, material geometry, impulses and breakup |
| `game/feel.ts`, `game/art.ts` | Typed visual responses, recoil/heat/debris budgets, cached procedural rendering |
| `game/lab.ts`, `components/FeelLab.tsx` | Absolute experiment loadouts and compact developer controls |
| `components/AsteroidsGame.tsx`, `components/GameUI.tsx` | React/canvas integration, world collections, director/cloud/special rules, progression and existing menus/HUD |

Rendering never advances gameplay. Upgrade menus, explicit pause, focus loss and hidden tabs suspend simulation time. Invulnerability, cooldowns, pending spawns and visual lifetimes do not expire while paused. Excess wall time beyond five catch-up steps is discarded. Rendering uses the latest simulation state, without interpolation.

Visual budgets are 120 chunks + 100 accents, reduced to 45 + 40 with Reduced effects; every effect expires. Reduced effects disables shake and ship blinking, limits flashes and removes aura haze. Gameplay entity ceilings remain 120 asteroids / 80 shards, with 220 projectiles. `pools.ts` remains unused; no parallel pooling system was introduced.

## Verification and remaining limits

Milestone checks: **86 tests**, TypeScript and production build pass. Tests cover refresh-rate equivalence, pauses, movement/momentum, firing origins and damage, polygon contacts, breakup area/motion, effect cleanup/caps, cached drawing and repeatable rendering. Static Canvas output was inspected at gameplay scale. A local software-Canvas capped-load probe (120 rocks, 80 shards, 220 bullets, 120 chunks, 100 accents) averaged approximately 18ms drawing and 4ms projectile collision work; this is **not browser FPS evidence**.

Vite starts and serves HTTP 200. Interactive browser testing remains unavailable in this session: no connected browser, no in-app browser, and the Windows automation helper's native pipe is unavailable. No start/restart, upgrade UI, full special-behavior, subjective handling or real-browser performance pass is claimed. Use the lab checks above first.

Next priorities are real browser playtesting and profiling, then tuning control/cannon balance against actual runs. Eight muzzles are close to the readability limit; large broken rocks retain exact outer geometry but generated interior texture can change across pieces. Late-game visual density and high-tier power need human judgment. Relative target-motion CCD, thrown-shard/ship tunneling, wrap-seam contacts, and the director/cloud collection scans remain limitations. No audio, hit-stop, camera panning, external art/sprites, general physics engine, full editor or broad-phase framework was added.
