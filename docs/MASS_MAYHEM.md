# Mass & Mayhem ? design and verification

## Direction

An industrial slate-and-ivory gunship, warm kinetic rounds, pale propulsion, and materially distinct rocks. Silhouette and internal planes do the visual work; glows are reserved for inherited special fields and pickups. Rock facets, ice cleavage, molten fissures, iron compression bands and dense tungsten planes share one palette language. All artwork is procedural Canvas geometry, with no new production asset or runtime dependency.

The hull and collision footprint share normalized geometry. Side and central cannon mounts share their positions between drawing and firing. Seven physical mounts are the readable maximum; later tiers add 20% of base damage per round per tier. Unlike the previous damage-sharing rule, added barrels do not reduce individual damage or scatter a volley into an ever-wider cone. Magnetic Rails add a restrained jacket/length change and stronger impacts. Ricochets retain their 50% damage decay, use a cool secondary trail, and preserve contact-to-target direction. Cooling increases cycling rhythm and accumulated vent heat. Recoil is local to the mechanism and does not randomly shove the ship.

## Handling and collisions

The default Gunship profile applies thrust immediately, builds to full output over a short spool, and preserves linear momentum while turning. Angular acceleration reaches the turn cap in about eight ticks; counter-steering crosses zero from full rotation within five ticks. Released steering damps quickly enough to aim. The Drifter profile retains more linear/angular momentum; Precise arrests it sooner. Arrow controls and the finite wrapping arena remain intact.

Ship impact damage and impulse depend on normal relative speed: a grazing encounter is weaker than a head-on strike. Type-specific iron/molten knockback remains. Contact events provide direction and severity to restrained shake and fragments. High-relative-speed receding near passes produce a brief local wake, globally throttled to one per second. There is no slow motion or near-miss screen flash.

## Destruction and event boundaries

Projectile sweeps find the actual polygon edge (including bullet radius), then emit material chips and a short local flash. Impulses scale inversely with approximate area and density; off-center hits alter rotation within a cap. Up to five stable local scars develop as HP drops.

Regular splitting asteroids are clipped into two pieces, or three at the largest size. Child positions reconstruct the parent outline, angular velocity contributes tangential motion, and cut pieces separate with inherited velocity. Parent surface coordinates and scars survive recursive cuts. Existing child HP/category progression and drops remain. Terminal deaths cut the actual outline into temporary solid chunks; debris fades and expires. At the asteroid safety ceiling, overflow children become decorative breakup rather than exceeding the gameplay cap.

`FeelResponses` consumes fired/impact/fracture/collision/near-miss events immediately. It owns visual lifetimes and a hard 220-effect cap (90 reduced), bounded directional shake, recoil and heat. It does not own damage, scoring or physics. This narrow event boundary can host future audio without introducing an audio pipeline now. Ordinary support effects and progression remain in the integration component.

## Fast manual comparison

1. Open Dev Mode, enable Game-Feel Lab, launch. Clear the field and switch off Auto fire. Accelerate, release thrust, turn 90 degrees, then counter-steer. Compare Gunship, Drifter and Precise. Cross every screen edge.
2. Reset; choose Regular / Large, stationary. Watch the center target's cracks and separation. Side targets provide ricochet destinations. Respawn for an immediate repeat; automatic repeat runs after all targets leave/die.
3. Compare Split Shot tiers 0, 1, 2 and 6, then tier 9. Confirm rounds come from each visible muzzle and no per-round damage is lost. Increase cooling and rails; check aim and cadence while drifting.
4. Switch through Molten, Frozen, Iron and Tungsten at each size. Inspect auras, frozen steering/thrust, thrown shards and blocking. Turn off Reinforced test hull to test damage/death. Reset restores the selected experiment.
5. Toggle reduced effects during combat. Damage and collisions should match while shake/blinking disappear and decoration thins. F3 exposes live counts/FPS.
6. Exit the lab, disable its toggle, and launch an ordinary run. Verify XP collection, level-up pause, upgrade selection, shields/drones, rare freebies, death/restart, focus loss and resume. Use the start-level override for later enemy variety. Play at 30/60/high refresh and check late-run load.

## Verification performed

- All 80 tests across five files passed. TypeScript checks and the Vite production build passed. `git diff --check` was clean.
- A temporary jsdom + native Canvas harness mounted the actual React component, entered/exited the lab, replaced every material, cleared/reset the field, sent flight inputs, toggled reduced effects, and entered an ordinary run without runtime errors. Its libraries were installed only beneath ignored `node_modules`; project dependencies were not changed.
- Inspected the procedural art sheet and actual game Canvas output at 1280?720, including parent-to-child surface continuity. The art sheet is an offline renderer capture, not a browser screenshot.
- Interactive browser automation listed no available browser, and opening an in-app browser returned ?Browser is not available: iab?. Real interactive feel and complete progression playtesting remain outstanding.
- A deliberately saturated software-renderer sample used 120 rocks, 256 projectiles, 220 effects, swept collision checks, cached paths and crowded-field detail reduction. Across 200 flushed frames it averaged about 35.2 ms, with a 41.4 ms 95th percentile on this environment. This is neither a browser FPS result nor a complete-game benchmark: it omits director/shard scans and browser/DOM work. It shows that extreme-load browser profiling is still necessary; do not infer guaranteed 60 FPS.

## Deliberate limits and next iteration

No external art, sound production, hit-stop, camera panning, engine migration, rigid-body solver or general-purpose effects framework. No attempt to turn every gameplay system into events. Existing wrapping and progression were kept.

The rocks are intentionally faceted but still look geometric, especially their interior planes. Seven-barrel silhouettes are crowded at native size. Full-strength Split Shot is much stronger and should be tested against late-run HP/density rather than assumed balanced. Small breakup chunks may fade before their material detail reads. The ordinary menus and some inherited aura/pickup effects retain more neon styling than the new hull and weapons. Relative-motion CCD and wrap-seam physical contacts remain technical weaknesses. Browser performance and human control feel are the most important next checks.
