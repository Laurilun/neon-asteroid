# Neon Void: Survival - Game Design Document

## 1. High Concept & Philosophy
**"Classic Asteroids meets Vampire Survivors."**

Neon Void takes the Newtonian physics and skill-based maneuvering of the arcade classic *Asteroids* and fuses it with the dopamine-fueled progression loop of *Vampire Survivors*.

### The Core Experience
1.  **The Power Fantasy (Zero to Hero):**
    *   **The Start (Survival Horror):** You start weak. The ship is heavy, turning is slow, fuel is scarce, and a single asteroid is a threat. You feel vulnerable.
    *   **The End (Doomsday Machine):** By Level 20, you are a god. You don't just survive the void; you consume it. Your ship is a blur of neon, dragging a swarm of drones and unleashing a wall of plasma. The physics that once fought you now obey you.

2.  **The "One More Run" Loop:**
    *   Sessions are designed to be intense and end abruptly if you lose focus.
    *   The "Just one more round" phenomenon is driven by the desire to try a different build (e.g., "What if I max out Drones and Magnet instead of Cannons?").

3.  **Synergy & Build Crafting:**
    *   The satisfaction comes from breaking the game mechanics through upgrades. Finding the right combination of **Tech** (Movement), **Combat** (DPS), and **Add-ons** (Utility) creates a unique "flow" for every run.

---

## 2. Core Mechanics

### Movement (Newtonian Drift)
*   **Physics:** The ship has low friction (`0.99`), meaning it drifts significantly after thrusting stops.
*   **Control:** To stop or turn tight, the player must perform a "retrograde burn" (thrust in the opposite direction).
*   **Thrust:** Applying thrust consumes Fuel.
*   **Progression:** Starts heavy and sluggish. Upgrades ("Plasmatron Thrusters") make it snappy and fast.

### The Economy (Fuel & Hull)
1.  **Fuel (The Clock):**
    *   **Passive Drain:** Fuel depletes slowly over time (`0.005/frame`).
    *   **Active Drain:** Thrusting depletes fuel faster (`0.05/frame`).
    *   **Recovery:** Destroyed asteroids have a **25% chance** to drop a **Green Fuel Orb**.
    *   **Failure:** Running out of fuel results in "Life Support Failure" (Game Over).
2.  **Hull (Health):**
    *   **Damage:** Collisions with asteroids reduce Hull Integrity.
        *   Small Asteroid: ~5 damage.
        *   Large Asteroid: ~15 damage + massive knockback.
        *   Molten Asteroid: Instant Kill (unless shielded).
    *   **Recovery:** Destroyed asteroids have a **10% chance** to drop a **Blue Hull Orb**.

### Combat
*   **Weaponry:** Short-range, rapid-fire energy bolts.
*   **Design:** Bullets fizzle out quickly (`Life: 18 frames`), forcing the player to get close to enemies to kill them ("Danger Close").
*   **Aiming:** Fixed forward-firing. You must face your target to shoot.

---

## 3. Progression System

### Leveling
*   **XP Source:** Score (Destroying rocks, collecting orbs).
*   **Curve:** Fast start (Level 1 req: 600 XP) to hook the player immediately, then scales exponentially (`x1.3`).
*   **Reward:** On Level Up, the game pauses and offers **3 Random Upgrades**, one from each category.

### Upgrade Categories
The game uses a tiered upgrade system. Duplicate upgrades stack infinitely (or until capped), creating massive power spikes.

#### 🟢 TECH (Ship Systems)
*Focus: Movement & Economy*
| ID | Name | Effect |
| :--- | :--- | :--- |
| `engine` | **Plasmatron Thrusters** | Increases Acceleration & Max Speed (+25% per tier). Essential for dodging high-speed threats. |
| `tank` | **Fusion Cells** | Increases Max Fuel (+40%), reduces consumption, improves Orb pickup value. Essential for long runs. |
| `hull` | **Nanocarbon Plating** | Increases Max Hull (+30%) and fully repairs the ship. The "Panic Button" heal. |

#### 🔴 COMBAT (Weaponry)
*Focus: DPS & Crowd Control*
| ID | Name | Effect |
| :--- | :--- | :--- |
| `rapidfire` | **Hyper-Cooling** | Increases Fire Rate (+20% per tier). Turns the pea-shooter into a laser stream. |
| `multishot` | **Splitfire Cannons** | Adds projectiles: Double -> Triple -> Penta-Shot spread. Clears screens instantly. |
| `velocity` | **Magnetic Rails** | Increases Bullet Speed & Range (+25% per tier). Allows engaging Molten rocks safely. |

#### 🟣 ADD-ONS (Special Modules)
*Focus: Automation & Defense*
| ID | Name | Effect |
| :--- | :--- | :--- |
| `drone` | **A.R.C. Swarm** | Adds an autonomous drone that orbits and shoots nearest enemies. The "AFK Farm" enabler. |
| `magnet` | **Tractor Beam** | Pulls Fuel and Hull orbs towards the ship from a distance. Reduces the need for risky maneuvers. |
| `shield` | **Molten Heat Shield** | Blocks hits from Molten Asteroids. Recharges on Level Up. The "Extra Life" mechanic. |

---

## 4. Enemies & Spawning

### The "Director" System
Instead of discrete waves, the game uses a "Director" that maintains a specific density of asteroids based on the current level.
*   **Seamless Entry:** Enemies spawn off-screen and drift in. No pop-ins.
*   **Formations:** 15% chance to spawn a group of rocks in a V-Shape or Line formation, forcing the player to weave or blast a hole.

### Enemy Types
| Type | Color | Behavior | Threat |
| :--- | :--- | :--- | :--- |
| **Asteroid (S/M/L)** | Grey | Drifts, bounces off edges (screen wrap). Splits on death. | Hull Damage, Physical obstruction. |
| **Molten (Flyby)** | Red | Spawns at edge, flies across screen, then despawns. Does NOT wrap. | **Instant Death**. Massive HP. Fast. The "Boss" encounter. |

### Difficulty Gates
*   **Level 1:** Tutorial Phase. Small/Medium rocks only. Slow physics.
*   **Level 2:** Large Asteroids appear. Formations enabled.
*   **Level 3:** Small Molten Asteroids (Flybys) start appearing.
*   **Level 6:** Giant Molten Asteroids appear (Requires Heavy Weapons/Shield).

---

## 5. Technical Details

### Rendering
*   **Engine:** HTML5 Canvas + React Ref-based loop.
*   **Frame Rate:** 60 FPS target.
*   **Juice (Game Feel):**
    *   **Screen Shake:** On impacts and explosions.
    *   **Hit Flash:** Entities flash white when damaged.
    *   **Particles:** Sparks on thrust, impact, and destruction.
    *   **Floating Text:** Damage numbers and resource pickups.

### Collision Detection
*   **Ship:** Vertex-based polygon collision (3 points) against Circle (Asteroid). Ensures the triangular shape feels physically accurate.
*   **Bullets:** Circle-Circle collision.
