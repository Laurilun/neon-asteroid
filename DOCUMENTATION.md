# Neon Void — Game Design

## Core fantasy

Pilot an armored gunship through an asteroid field, manage momentum, discharge a growing cannon battery and tear substantial masses apart. Classic Asteroids steering/wrapping meets a compact survival roguelite: collect energy, choose a build, survive escalating pressure and want another run after death.

Mass, clarity, causality, rhythm and restraint guide the art and handling. Opaque surfaces, mechanical silhouettes and localized energy take precedence over generic neon outlines and full-screen flashes. The base ship and cannon should be satisfying before upgrades arrive.

## Piloting and combat

Arrow keys steer and thrust; firing is automatic and forward-facing. Space starts/restarts and P pauses. Rotation has acceleration and inertia, with quick counter-steering and automatic attitude braking. Turning preserves linear momentum; deliberate retrograde thrust brakes travel. The ship wraps across the fixed arena without a scrolling camera.

The procedural gunship has layered armor, engine housings, a cockpit and visible hardpoints. Hull and cannon templates define both drawing and collision footprint. Propulsion, recoil, heat and velocity cues respond to actual simulation state.

Split Shot grows a mounted battery through eight visible cannons, then reinforces it. Each added barrel retains useful damage; the battery slightly converges rather than spraying an ever-wider cone. Hyper-Cooling changes cycling rhythm, Magnetic Rails changes power/reach, and Ricochet produces distinct target-to-target traces. The random cyan shell effect is removed.

Projectile hits apply localized, mass-dependent impulses and persistent damage scars. Asteroid polygons are clipped at destruction; live child rocks preserve pieces of the parent's boundary and inherit translation, rotation and separation. Material chunks supplement them and expire. Glancing ship contacts preserve tangential travel and are less severe than head-on collisions.

## Survival and progression

Hull is health. Collisions, thrown shards and damaging auras threaten it; regeneration, hull pickups, plating and shields support survival. Shields save a fatal hit, restore partial hull and grant temporary invulnerability, then recharge over gameplay time. Invulnerability and recharge do not run down while paused.

Kills grant score; XP comes from collected orbs. The current level target starts at 300 XP and grows by 1.26 per level, carrying overflow. Level-up pauses the simulation and offers one upgrade from each available category. Rare special-asteroid freebies grant an upgrade without increasing the level. Numeric tuning belongs in `constants.ts` rather than this document's historical tables.

| Category | Systems |
| --- | --- |
| Tech | Thrusters, regeneration and hull plating |
| Combat | Cooling, mounted Split Shot, rails and ricochet |
| Add-ons | Drones and overclock, pickup magnet/XP, shields and radiation |

## Enemy identity

| Material/entity | Visual and mechanical identity |
| --- | --- |
| Regular rock | Pitted, stratified mass; wraps, drifts and splits by size |
| Molten | Basalt crust and branching hot seams; damaging aura and gentle pursuit/flyby |
| Frozen | Angular crystal silhouette and facets; slowing/damaging zone |
| Iron | Asymmetric plated debris; fast burst entries and strong contact impulses |
| Tungsten | Dense blocky strata; orbiting defensive shards that intercept rounds and can be thrown |
| Clouds | Cohesive groups of small regular rocks that approach together |

The director retains threat-weighted, level-gated spawning. Special types retain their aura, burst, cloud or shard roles. Material choice affects projectile impulse through density. Lab targets suppress homing/declumping to isolate feel, and lab kills skip loot; these experiment rules do not apply to ordinary runs.

## Technical/design boundary

The game remains React / TypeScript / Vite with Canvas 2D and a fixed 60 Hz simulation. Visual events carry shot, impact, fracture, contact and close-pass responses; they can support future audio without an audio pipeline today. Stable procedural surfaces are cached, visual randomness is independent of gameplay, and debris/effect counts and lifetimes are bounded.

See [README.md](README.md) for the lab, exact weapon changes, module map, checks and verification limits. See [.agent/rules/rules.md](.agent/rules/rules.md) for the `main` development and automatic validate/commit/push workflow.
