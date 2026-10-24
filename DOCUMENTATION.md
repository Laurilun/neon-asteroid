# Mass & Mayhem ? design notes

## Visual language

A short, wide escort hull: pale armor skirts over dark steel machinery, a recessed blue canopy, twin propulsion bells, and exposed cannon receivers. Blue belongs to propulsion; orange-white belongs to ballistic discharge. Heat marks and separate barrel recoil communicate firing cadence. The ship is drawn at radius 19, with its armor and barrel positions shared with collision and firing code.

Rocks use irregular radial contours, broad offset shelves, bevels and sparse craters. Frozen rocks have alternating crystalline tips and translucent-looking facets. Molten rocks have dark crust and glowing fissures. Iron has elongated contours and broad strata; tungsten uses denser, compact contours and closely spaced seams. Existing molten/frozen auras, iron bursts, tungsten shards and cloud behavior remain. Clouds retain their regular-rock material identity and group movement.

## Handling

Heavy escort is the default: 0.115 thrust per tick, 0.994 velocity retention, angular acceleration 0.009 and maximum spin 0.065 radians/tick. Counter-steering multiplies attitude torque by 2.4; release retains 68% of spin per tick. Thrust ramps through a short engine spool but begins at 70% authority, so mass does not create a dead input delay. Max controlled speed is 7.5 before engine upgrades, with gradual recovery from overspeed.

Patrol craft and Deep-space tug are comparison profiles in the lab. Facing does not rotate velocity. A velocity chevron distinguishes travel from aim. RCS jets reflect actual angular acceleration, including automatic braking. Contact severity follows relative normal speed; tangential drift is retained. Rock area and density affect impulse. Iron retains a stronger collision kick.

## Cannon progression

The base cannon fires every 23 ticks: 16 damage, speed 13, lifetime 27 ticks. This is a deliberate heavier, slower beat with enough stopping power to break a small regular rock. Split Shot adds physically positioned barrels up to six. Every barrel retains full damage; the bank converges gently toward a point roughly 420 pixels ahead instead of spreading away from the target. Tiers above five increase bank ammunition damage by 12% per tier.

Hyper-Cooling shortens the existing cooldown, with a four-tick minimum. Recoil recovery and jacket heat visibly respond to cadence. Rails preserve the existing 15% compounded damage and 30% additive lifetime upgrades, with bounded slug length and stronger impacts. Ricochets retain half damage and existing target-selection/revisit behavior, with cool-colored directional trails. Random cyan cartridges are removed.

This significantly strengthens Split Shot. That tradeoff is intentional, but six guns with high rails/cooling need a real balance pass. It would be premature to call the progression finished based on automated checks.

## Material response

A projectile contact records its local entry point and direction, adds bounded cracks and transfers impulse inversely proportional to polygon area and material density. Short impact flares and angular chips eject primarily back out of the contact face. No per-frame random jitter is used.

Destruction divides the parent's ordered boundary into radial sectors. Each section rotates around its own area centroid, inherits translation and tangential rotational motion, and separates under the final shot direction. Regular large rocks become live children; small and special rocks become temporary debris. Both retain their parent's procedural surface through cropped texture inheritance. The existing loot, score and XP logic remains after normal destruction; lab trials deliberately skip rewards.

A typed event vocabulary connects firing, strikes, breakup, collision and near passes to bounded presentation effects. Full/reduced budgets are 180/60. Debris expires within about two seconds; large breakup slabs take priority over minor chips. Recoil, heat, shake and effects advance with simulation time. Near-pass feedback requires an approach-to-recede transition with real relative speed and a cooldown. Shake is directional and bounded, and ordinary bullet hits do not continuously shake the arena.

## Intentional boundaries

No audio, camera scrolling, sprites, physics middleware or giant editor. No hit-stop: high-rate combat retains continuous input. Existing progression/director code remains integrated, rather than using this visual milestone for another architecture rewrite.

Remaining weaknesses: the sector breakup can read as wedges, cached lighting rotates with the material instead of a world light, and fragments retain original surface markings rather than revealing detailed new interior geology. The small hull can hide individual receiver motion at high firing rates. Full relative-motion sweeps, seam contacts, large-population profiling and browser playtesting remain future work. See the README for verification evidence and fast manual trials.
