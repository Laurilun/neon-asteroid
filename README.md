# Neon Void ? Mass & Mayhem

A Canvas 2D / React / TypeScript survival roguelite. Pilot a compact armored escort through a wrapping asteroid field, recover energy, and build a mounted cannon battery. All artwork is procedural; no sprites, physics engine, or audio assets are required.

GitHub `main` is the development baseline. Follow [.agent/rules/rules.md](.agent/rules/rules.md) for validation and automatic commit/push. The historical `paska` branch is retained.

## Run and controls

`npm ci`, then `npm run dev` (port 3000). On Windows use `npm.cmd` if PowerShell blocks the script shim. No API key is needed.

- Arrow Up: thrust. Left / Right: steer. Fire is automatic.
- Space: start or restart. P: pause/resume. F3: diagnostics.
- Effects button at top right: reduced debris, no screen shake, reduced flashes. Gameplay and visible hazard boundaries are unchanged.
- Thrust turns change velocity gradually. Turning alone leaves linear momentum intact; turn around and burn to brake. Attitude jets brake rotation on release.

## Experiment console

In the menu, enable **Dev Mode ? Sandbox Mode ? Initiate Launch**. The bottom console offers three handling profiles, thrust strength, immediate Split Shot / Hyper-Cooling / Magnetic Rails / Ricochet equipment, and target material, size, and motion. Target settings apply with **Reset trial** or R after clicking the arena. Collapse the console for a clear view.

Disable Spawn targets and Auto cannon, then reset, for an empty handling trial. Damage immunity is on by default; turn it off for real collision and aura damage. Targets have real health, fracture, and retain their materials. Repeat when cleared replenishes the target group after 90 simulation ticks. The trial suppresses drops, progression and the normal director; ordinary runs retain all of them. P or Pause freezes the trial; Exit returns to the menu.

Quick manual checks:

1. Accelerate, release thrust, turn sideways, then reverse thrust. Compare Heavy escort, Patrol craft and Deep-space tug; check counter-steering and wrapping.
2. With a regular large target, compare one, two and six barrels. Check visible origins, recoil, increasing fire rate and concentrated hits. Reset between configurations.
3. Test every material, moving targets, ricochet chains and massive targets. Check that shards block and are thrown, auras remain readable, and clipped fragments have accurate hitboxes.
4. Turn immunity off and compare a glance against a head-on hit. Check reduced effects, focus loss/resume, P, death/restart, and an ordinary XP upgrade.

## Engine boundaries

| Module | Responsibility |
| --- | --- |
| `game/engine.ts` | Fixed clock, bounded catch-up, periodic timers and collection caps |
| `game/movement.ts` | Torque, thrust, coasting, counter-steering, speed recovery and wrapping |
| `game/gunship.ts` | Shared armor, physical barrel positions and collision footprints |
| `game/projectiles.ts` | Cooldown, mounted volleys, sweeps, damage and ricochets |
| `game/collision.ts` | Swept discs against outlines; hull contacts and relative-speed response |
| `game/rockwork.ts` | Material outlines, area/density mass, impact marks and sector fracture |
| `game/responses.ts` | Typed combat events, bounded debris, mechanical recoil, heat and shake |
| `game/drawing.ts` | Procedural ship/material art, cached rock surfaces and event rendering |
| `game/trials.ts`, `components/TrialConsole.tsx` | Absolute trial settings and developer console |
| `components/AsteroidsGame.tsx` | Canvas lifecycle, world integration, director, special behaviors, loot and progression |

Simulation modules have no React, DOM, wall-clock, or Canvas dependency. Drawing only reads gameplay state; it caches generated surfaces per entity. Cosmetic randomness has a separate event-time generator. `pools.ts` remains unused.

## Simulation and budgets

All rules and visual lifetimes use 60 Hz ticks. Rendering never advances them. Catch-up is limited to five ticks; prolonged overload slows gameplay rather than creating an unbounded backlog. Upgrade screens, explicit pause, hidden tabs and focus loss suspend time. Input is cleared on focus loss and when entering controls.

Bullets sweep their complete tick segment against asteroid polygons. Shards retain their defensive circular hitbox and equal-contact priority; a faint shell shows that blocking volume. Hull contacts use the actual armor and barrel geometry. Fragments retain parent silhouette sections and cached surface detail. Ordinary regular rocks still split into two children (three for massive rocks); other materials become temporary physical-looking debris. Child size categories still govern HP, loot and further splitting, while their actual geometry governs collisions and mass.

Caps: 120 asteroids, 80 shards, 256 projectiles, 180 new effects (60 reduced), and the existing legacy particle/orb limits. Large breakup pieces displace incidental chips when the effect budget is full. Six visible cannons is the visual limit; later Split Shot tiers reinforce their damage by 12% of the base per tier. Each mounted cannon keeps full base damage. See [DOCUMENTATION.md](DOCUMENTATION.md) for design decisions.

## Validation and honest limits

Run `npm test`, `npm run typecheck`, `npm run build`. This milestone passes 75 unit/integration tests, TypeScript and the production build. Tests include frame-rate equivalence, momentum, barrel origins, damage, contact geometry, material-area preservation through repeated fracture, event budgets and cleanup.

A temporary React + jsdom + native Canvas harness also checks launch, steering input, pause, trial controls/reset, all materials, reduced effects, exit, the ordinary upgrade sequence and RAF cleanup. Reproduce with `node scripts/verify-runtime.mjs <directory-containing-jsdom-and-@napi-rs/canvas>`. These optional tools are not application dependencies. It is a simulated DOM test, **not browser playtesting**.

[Art sheet](docs/mass-mayhem-art.png) shows a staged scene at gameplay scale. [Runtime canvas capture](docs/mass-mayhem-runtime.png) comes from the harness and omits DOM overlays. Recreate the art sheet with `node scripts/render-art.mjs <path-to-@napi-rs/canvas>`; it also rejects render-time randomness.

The cached software-Canvas stress probe averaged about 25 ms per frame with 120 rocks, 256 rounds and 180 effects. This is a CPU-only workload measurement, not browser/GPU FPS; the worst-case scene still needs real-device profiling.

The local Vite server ran successfully. Browser tooling listed no connected browsers and could not open an in-app browser, so real browser input feel, CSS layout, focus behavior and GPU performance remain unverified. The manual checks above are still required.

Known compromises: target sweeps use end-of-tick positions; very fast moving targets, thrown shards and wrap-seam contacts do not have full relative-motion continuous collision. Contact response is an arcade approximation without a rigid-body solver. Radial sector fracture can look wedge-like; it is not a geological fracture simulation. The six-barrel/rail combination needs balance testing. The director retains quadratic proximity scans. No camera panning, audio pipeline, sprite pipeline, broad-phase rewrite, hit-stop or render interpolation was added.
