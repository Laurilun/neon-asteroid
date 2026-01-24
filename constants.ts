
import { UpgradeCategory, UpgradeDef } from './types';

// ============================================================================
// NEON ASTEROID - GAME CONSTANTS
// ============================================================================
// This file contains all tweakable game values. Adjust these to balance
// gameplay, difficulty, and feel. Each section is clearly labeled.
// ============================================================================

export const CANVAS_WIDTH = window.innerWidth;
export const CANVAS_HEIGHT = window.innerHeight;
export const FPS = 60;

// ============================================================================
// SHIP - Player ship physics and base stats
// ============================================================================

export const SHIP_SIZE = 12;                    // Ship triangle size in pixels
export const SHIP_THRUST = 0.035;               // Acceleration per frame when thrusting
export const SHIP_TURN_SPEED = 0.045;           // Rotation speed in radians per frame
export const SHIP_FRICTION = 0.99;              // Velocity multiplier per frame (1 = no friction)
export const SHIP_MAX_SPEED = 6.0;              // Maximum velocity magnitude
export const SHIP_BASE_HULL = 100;              // Starting hull points

// ============================================================================
// COMBAT - Bullets and invulnerability
// ============================================================================

// Bullets
export const BULLET_SPEED = 9;                  // Bullet velocity (slower = more visible, satisfying lead-aim)
export const BULLET_LIFE = 28;                  // Frames before bullet disappears (longer to compensate speed)
export const BULLET_RATE = 20;                  // Frames between shots (lower = faster)
export const BULLET_DAMAGE = 10;                // Damage per bullet hit (SHIP)
export const BULLET_RADIUS = 2.5;               // Bullet size (larger = more visible impact)

// Invulnerability (in milliseconds)
export const INVULN_DURATION_SHIELD = 5000;     // Invuln after shield saves you (5s)
export const INVULN_DURATION_HIT = 300;         // Brief invuln after taking damage
export const INVULN_BLINK_RATE = 100;           // Ship blink cycle during invuln

// ============================================================================
// ASTEROIDS - Universal Size & Type System
// ============================================================================
// All asteroid properties are calculated from: BASE × SIZE_MULT × TYPE_MULT
// This allows for clean, consistent scaling across all combinations.
// ============================================================================

// --- Size Categories ---
// All asteroid types can spawn in any of these sizes (level-gated)
export const ASTEROID_SIZES = {
    SMALL: 1,
    MEDIUM: 2,
    LARGE: 3,
    XLARGE: 4
} as const;

// --- Base Values (before multipliers) ---
export const ASTEROID_BASE = {
    RADIUS: 18,          // Base radius in pixels
    HP: 20,              // Base hit points (was 25 - faster kills!)
    SPEED: 0.8,          // Base movement speed
    DAMAGE: 25,          // Base collision damage (INCREASED for harder game)
    ROTATION: 0.015,     // Base rotation speed (radians/frame)
    VERTICES: 8,         // Base polygon vertices
    XP_VALUE: 30         // Base XP orb value
};

// Soft Physics - Anti-Stacking Only (gravity removed - now Tungsten-specific)
export const SOFT_DECLUMP_RANGE = 1.2;          // Repel when overlapping by 20%
export const SOFT_DECLUMP_FORCE = 0.08;         // Push strength when too close

// --- Size Multipliers (applied to base values) ---
// REBALANCED: Lower HP for faster kills, lower damage for forgiveness
// threat = base threat value for director system
export const SIZE_MULTIPLIERS = {
    [ASTEROID_SIZES.SMALL]: { radius: 1.0, hp: 0.8, speed: 1.1, damage: 0.5, vertices: 0, xp: 1.0, threat: 1 },
    [ASTEROID_SIZES.MEDIUM]: { radius: 1.9, hp: 2.0, speed: 1.0, damage: 0.8, vertices: 2, xp: 1.5, threat: 2 },
    [ASTEROID_SIZES.LARGE]: { radius: 3.5, hp: 4.5, speed: 0.9, damage: 1.2, vertices: 4, xp: 3.0, threat: 4 },
    [ASTEROID_SIZES.XLARGE]: { radius: 5.5, hp: 10.0, speed: 0.75, damage: 2.0, vertices: 6, xp: 6.0, threat: 8 }
};

// --- Type Definitions ---
// Each type has unique behavior characteristics
export type AsteroidTypeName = 'REGULAR' | 'MOLTEN' | 'IRON' | 'FROZEN' | 'TUNGSTEN';

export interface AsteroidTypeConfig {
    speedMult: number;       // Speed multiplier
    hpMult: number;          // HP multiplier
    damageMult: number;      // Collision damage multiplier
    knockbackMult?: number;  // Knockback multiplier (Iron = massive pushback)
    threatMult: number;      // Threat value multiplier for director system
    splits: boolean;         // Does this type split when destroyed?
    color: string;           // Render color
    glowColor?: string;      // Optional glow effect color
    // Special behaviors
    homingBurst?: boolean;   // Iron: launches fast toward player
    hasAura?: boolean;       // Has damaging/slowing aura
    auraRange?: number;      // Base aura radius (if hasAura)
    auraSizeScale?: number;  // Aura scales with size (0.25 = +25% per size tier)
    auraSlowFactor?: number; // Speed reduction in aura (0.4 = 60% slower, 1.0 = no slow)
    auraDPS?: number;        // Damage per second in aura
    // Gravity aura (Tungsten - disabled)
    hasGravityAura?: boolean;    // Pulls regular asteroids toward it
    gravityRange?: number;       // Base gravity pull radius
    gravitySizeScale?: number;   // Gravity range scales with size
    gravityStrength?: number;    // Pull force on nearby asteroids
    // Shard shield (Tungsten)
    hasShardShield?: boolean;    // Spawns orbiting defensive shards
    shardCountBase?: number;     // Base number of shards
    shardCountPerSize?: number;  // Additional shards per size tier
    shardOrbitRadiusMin?: number; // Inner orbit layer
    shardOrbitRadiusMax?: number; // Outer orbit layer
    shardOrbitSpeed?: number;    // Orbit speed in radians per frame
    shardRadiusMin?: number;     // Smallest shard size
    shardRadiusMax?: number;     // Largest shard size
    shardCollisionMult?: number; // Collision radius multiplier (blocks more than visual)
    shardHp?: number;            // HP of each shard
}

export const ASTEROID_TYPES: Record<AsteroidTypeName, AsteroidTypeConfig> = {
    REGULAR: {
        speedMult: 1.0,
        hpMult: 0.7,              // FAST KILLS - melt faster for power fantasy!
        damageMult: 1.0,
        threatMult: 1.0,          // Base threat level
        splits: true,
        color: '#9ca3af'
    },
    MOLTEN: {
        speedMult: 1.3,           // Slower but CHASES (was 2.0)
        hpMult: 2.5,              // Tanky
        damageMult: 3.0,          // Deadly but survivable (was 5.0)
        threatMult: 2.0,          // HIGH threat - dangerous aura!
        splits: false,
        hasAura: true,            // Burn aura!
        auraRange: 50,            // Slightly larger burn ring (was 40)
        auraSizeScale: 0.3,       // +30% range per size tier
        auraDPS: 40,              // Still punishing (was 50)
        auraSlowFactor: 1.0,      // No slow effect
        color: '#ef4444',
        glowColor: '#f97316'
    },
    IRON: {
        speedMult: 2.8,           // Fast but reactable (was 3.5)
        hpMult: 0.8,              // Low HP - squishy
        damageMult: 1.0,          // Low damage - knockback is the punishment (was 1.5)
        knockbackMult: 4.0,       // MASSIVE knockback - KEPT for character!
        threatMult: 1.5,          // Moderate threat - disruptor
        splits: false,
        homingBurst: true,        // Launches directly at player
        color: '#7c2d12',
        glowColor: '#a16207'
    },
    FROZEN: {
        speedMult: 0.4,           // Slow moving
        hpMult: 3.5,              // Tanky not sponge (was 5.0)
        damageMult: 1.0,          // Normal contact damage
        threatMult: 1.8,          // High threat - zoning control
        splits: false,
        hasAura: true,
        auraRange: 120,           // Base aura (scales with size)
        auraSizeScale: 0.25,      // +25% range per size tier
        auraSlowFactor: 0.5,      // Slightly less punishing (was 0.4)
        auraDPS: 15,
        color: '#06b6d4',
        glowColor: '#22d3ee'
    },
    TUNGSTEN: {
        speedMult: 1.0,           // Normal speed (like regular asteroids)
        hpMult: 8.0,              // Extremely tanky - mini-boss feel
        damageMult: 1.5,          // Moderate contact damage
        threatMult: 3.0,          // Very high threat
        splits: false,
        hasGravityAura: false,    // No gravity - uses shard shield instead
        hasShardShield: true,     // Spawns orbiting defensive shards (Gaara-style)
        shardCountBase: 12,       // Many fragments for dense cloud
        shardCountPerSize: 5,     // +5 shards per size tier
        shardOrbitRadiusMin: 30,  // Inner orbit layer (close to asteroid)
        shardOrbitRadiusMax: 85,  // Outer orbit layer (wide protection)
        shardOrbitSpeed: 0.018,   // Slow, deliberate orbiting
        shardRadiusMin: 4,        // Smallest sand particles
        shardRadiusMax: 12,       // Largest chunks
        shardCollisionMult: 1.6,  // Collision 60% larger than visual (dense sand blocks more)
        shardHp: 18,              // Tanky - requires commitment to break through
        color: '#4a3728',         // Dark brown - heavy dense metal
        glowColor: '#6b4f3a'      // Warm brown glow
    }
};

// --- Splitting Mechanics ---
export const ASTEROID_SPLIT_COUNT_NORMAL = 2;   // Less explosion (was 3)
export const ASTEROID_SPLIT_COUNT_XLARGE = 3;   // XLARGE keeps 3 for boss feel!
export const ASTEROID_SPLIT_MIN_SIZE = ASTEROID_SIZES.MEDIUM; // Only medium+ split
export const ASTEROID_SPLIT_SEPARATION_SPEED = 0.4;
export const ASTEROID_SPLIT_OFFSET_RATIO = 0.5;

// ============================================================================
// SPAWNING - Progression & Scaling for Endless Play
// ============================================================================
// Designed to scale smoothly from level 1 to 100+ without hard caps

// --- Spawn Timing ---
export const SPAWN_INTERVAL_BASE = 60;        // Faster initial spawns (was 90)
export const SPAWN_INTERVAL_MIN = 15;         // Keeps pressure late (was 20)
export const SPAWN_INTERVAL_DECAY = 0.96;     // Slower acceleration (was 0.97)

// --- Screen Density: THREAT-WEIGHTED SYSTEM ---
// Instead of counting asteroids, we count "threat budget"
// Threat = SIZE_MULTIPLIERS.threat × ASTEROID_TYPES.threatMult
export const THREAT_BUDGET_BASE = 15;         // Starting threat budget
export const THREAT_BUDGET_PER_LEVEL = 1.5;   // +1.5 threat per level
export const THREAT_BUDGET_MAX = 60;          // Cap for very late game
export const TARGET_ASTEROID_MIN = 6;         // Minimum asteroid COUNT (never empty)

// --- Level Scaling ---
export const LEVEL_HP_SCALING = 0.12;        // +12% HP per level (compounds) - enemies get tougher
export const LEVEL_SPEED_SCALING = 0.02;     // +2% speed per level (caps at +100%)
export const LEVEL_SPEED_CAP = 2.0;          // Max speed multiplier from levels

// --- Type Spawn Gates (level required for each type/size combo) ---
// REBALANCED: Slightly later gates for breathing room (Vampire Survivors style)
export const SPAWN_GATES = {
    REGULAR: { SMALL: 1, MEDIUM: 1, LARGE: 3, XLARGE: 10 },
    MOLTEN: { SMALL: 3, MEDIUM: 5, LARGE: 8, XLARGE: 14 },
    IRON: { SMALL: 4, MEDIUM: 10, LARGE: 999, XLARGE: 999 },
    FROZEN: { SMALL: 5, MEDIUM: 7, LARGE: 10, XLARGE: 20 },
    TUNGSTEN: { SMALL: 6, MEDIUM: 10, LARGE: 999, XLARGE: 999 }  // Small/Medium only
};

// --- Iron Shotgun Burst (Iron ALWAYS spawns as burst) ---
// Count scales with level in spawnIronBurst function
export const IRON_BURST_COUNT_BASE = 2;       // Base count at level 1
export const IRON_BURST_COUNT_PER_LEVEL = 0.2; // +0.2 per level (so L10 = 4, L20 = 6)
export const IRON_BURST_COUNT_MAX = 7;        // Cap for very high levels
export const IRON_BURST_SPEED_MULT = 1.8;     // Fast and dangerous
export const IRON_BURST_SPREAD = 0.25;        // Tight spread aimed at player

// --- Type Spawn Weights (relative chance to spawn each type) ---
// Higher = more common. Weights scale with level for variety.
export const TYPE_SPAWN_WEIGHTS = {
    REGULAR: { base: 100, perLevel: -1, min: 50 },   // Stays very high
    MOLTEN: { base: 0, perLevel: 5, max: 40 },       // Good
    IRON: { base: 0, perLevel: 1, max: 12 },         // Rare
    FROZEN: { base: 0, perLevel: 4, max: 30 },       // Good
    TUNGSTEN: { base: 0, perLevel: 4, max: 30 }      // FIXED: Same spawn rate as other specials
};

// --- Size Spawn Weights (relative chance for each size) ---
// Larger sizes become more common at higher levels
export const SIZE_SPAWN_WEIGHTS = {
    SMALL: { base: 30, perLevel: -1, min: 10 },  // Much lower - clouds produce small asteroids
    MEDIUM: { base: 35, perLevel: 0, min: 25, max: 35 },
    LARGE: { base: 5, perLevel: 0.8, max: 25 },
    XLARGE: { base: 0, perLevel: 0.3, max: 8 }  // Reduced (was 0.5, max 15)
};

// --- Freebie Upgrade Orb (rare drop from special asteroids) ---
export const FREEBIE_ORB_RADIUS = 12;        // Larger than XP orbs
export const FREEBIE_DROP_CHANCE_BASE = 0.05; // 5% base chance (1/20) from specials
export const FREEBIE_DROP_CHANCE_PER_SIZE = 0.00; // No size scaling - flat 5%

// --- Asteroid Cloud (cohesive swarm entity) ---
// Clouds keep small asteroids together as a homing unit
export const CLOUD_SPAWN_CHANCE = 0.35;           // Chance per spawn cycle to spawn a cloud
export const CLOUD_SIZE_MIN = 8;                  // Minimum asteroids in a cloud
export const CLOUD_SIZE_MAX = 25;                 // Maximum asteroids in a cloud (huge swarms!)
export const CLOUD_SIZE_PER_LEVEL = 0.8;          // +0.8 asteroids per level (fast scaling)
export const CLOUD_COHESION_STRENGTH = 0.08;      // Pull toward cloud center
export const CLOUD_HOMING_STRENGTH = 0.015;       // Cloud center homes toward player
export const CLOUD_SPEED_BASE = 1.2;              // Base speed multiplier
export const CLOUD_SPEED_PER_LEVEL = 0.02;        // Speed scales with level
export const CLOUD_SPEED_MAX = 1.8;               // Cap speed multiplier
export const CLOUD_SPAWN_RADIUS = 120;            // Big spawn spread to prevent clumping
export const CLOUD_MAX_SPREAD = 150;              // Max distance member can stray from center
// ============================================================================
// DRONES - Autonomous companion orbiters
// ============================================================================

// Orbit Behavior
export const DRONE_ORBIT_RADIUS = 55;           // Base orbit distance from player
export const DRONE_ORBIT_VARIANCE = 10;         // Breathing radius variation
export const DRONE_ORBIT_SPEED = 0.015;         // Radians per frame

// Wander (organic movement noise)
export const DRONE_WANDER_X = 15;               // Horizontal wander amplitude
export const DRONE_WANDER_Y = 15;               // Vertical wander amplitude

// Spring Physics
export const DRONE_SPRING = 0.04;               // Spring strength (lower = floatier)
export const DRONE_DAMPING = 0.92;              // Velocity damping (higher = smoother)

// Separation (avoid stacking)
export const DRONE_SEPARATION_DIST = 20;        // Min distance between drones
export const DRONE_SEPARATION_FORCE = 0.05;     // Push strength when too close

// Combat
export const DRONE_TELEPORT_DIST = 400;         // Max distance before teleport back
export const DRONE_TARGET_RANGE = 450;          // Max targeting distance
export const DRONE_BASE_FIRE_RATE = 45;         // Frames between shots (nerfed from 30)
export const DRONE_RECOIL = 1.5;                // Recoil velocity on shoot
export const DRONE_GUN_SPREAD = 0.15;           // Angle spread for multi-gun
export const DRONE_BASE_DAMAGE = 6;             // Base damage per drone bullet (separate from ship)

// ============================================================================
// ECONOMY - Orbs, XP, and loot
// ============================================================================

// XP Orbs
export const XP_ORB_NORMAL_VALUE = 60;          // More XP per kill! (was 50)
export const XP_ORB_SUPER_VALUE = 350;          // Rebalanced (was 500)
export const XP_ORB_RADIUS = { NORMAL: 4, SUPER: 8 };

// Hull Orbs
export const HULL_ORB_VALUE = 25;               // HP restored
export const HULL_ORB_RADIUS = 8;
export const HULL_DROP_CHANCE = 0.025;          // Slightly higher (was 0.02)

// Collection
export const ORB_MAGNET_RANGE_BASE = 60;        // Base pickup range
export const ORB_DRIFT_SPEED = 0.5;             // Random drift velocity

// Leveling - REBALANCED for faster, more rewarding progression
export const XP_BASE_REQ = 150;                 // ~5 small orbs for level 1 (quick first dopamine hit)
export const XP_SCALING_FACTOR = 1.22;          // Aggressive exponential - later levels are a grind

// ============================================================================
// UPGRADES - Stat scaling per tier
// ============================================================================

export const UPGRADE_ENGINE_MULT = 0.25;        // +25% speed per tier
export const UPGRADE_REGEN_PER_TIER = 1.5;      // +1.5 HP/sec per tier
export const UPGRADE_HULL_MULT = 0.30;          // +30% max hull per tier

// Main Cannon Upgrades
export const UPGRADE_FIRE_RATE_SPEED_MULT = 0.25; // +25% Fire Rate Speed (Linear)
export const UPGRADE_DAMAGE_MULT_COMPOUND = 1.15; // +15% Damage (Compounding)
export const UPGRADE_RANGE_MULT = 0.30;           // +30% Range (Linear)

export const UPGRADE_VELOCITY_MULT = 0.25;      // +25% bullet speed per tier (Unused currently)
export const UPGRADE_MAGNET_RANGE = 60;         // +60px pickup range per tier
export const UPGRADE_XP_MULT = 0.25;            // +25% XP value per tier

// Drone Overclock
export const UPGRADE_DRONE_FIRE_RATE_SPEED_MULT = 0.15; // +15% Fire Rate Speed (Linear)
export const UPGRADE_DRONE_DAMAGE_MULT_COMPOUND = 1.10; // +10% Damage (Compounding)
export const UPGRADE_DRONE_RANGE_MULT = 0.25;           // +25% Range (Linear)

// Shield Mechanics
export const SHIELD_RECHARGE_TIME = 30000;      // 30 seconds per shield charge
export const SHIELD_RADIATION_BASE_RADIUS = 120; // Base aura radius (nerfed from 175)
export const SHIELD_RADIATION_RADIUS_PER_TIER = 10; // +10px per tier (nerfed from 15)
export const SHIELD_RADIATION_BASE_DPS = 0;     // Base damage per second
export const SHIELD_RADIATION_DPS_PER_TIER = 3; // +3 DPS per tier (nerfed from 4)

// Multishot spread angles
export const MULTISHOT_SPREAD = {
    DOUBLE: 0.1,                                // Angle offset for 2 barrels
    TRIPLE: 0.2,                                // Angle offset for 3 barrels
    DYNAMIC_TOTAL: 0.6                          // Total spread arc for 4+ barrels
};

// ============================================================================
// VISUALS - Particles, effects, and juice
// ============================================================================

// Particles
export const PARTICLE_COUNT_EXPLOSION = 25;     // Particles on asteroid death
export const PARTICLE_LIFE = 1.0;               // Starting life value
export const PARTICLE_DECAY_THRUST = { MIN: 0.1, MAX: 0.2 };
export const PARTICLE_DECAY_DEBRIS = { MIN: 0.02, MAX: 0.05 };
export const SHOCKWAVE_DECAY = 0.04;            // Shockwave ring fade rate

// Floating Text
export const FLOATING_TEXT_LIFE = 40;           // Frames before fade
export const FLOATING_TEXT_SPEED = 1;           // Upward velocity
export const FLOATING_TEXT_SIZE = 14;           // Default font size

// Screen Effects
export const SCREEN_SHAKE_DECAY = 0.9;          // Shake intensity decay per frame
export const HIT_FLASH_FRAMES = 4;              // White flash duration on hit

// Menu
export const MENU_ASTEROID_COUNT = 5;           // Background asteroids on menu

// ============================================================================
// PERFORMANCE - Entity limits to prevent slowdown
// ============================================================================

export const MAX_PARTICLES = 150;               // Max debris/thrust particles
export const MAX_XP_ORBS = 100;                 // Max XP orbs on screen
export const MAX_HULL_ORBS = 20;                // Max hull orbs on screen
export const MAX_FLOATING_TEXT = 15;            // Max damage/XP numbers
export const MAX_BULLETS = 100;                 // Max bullets on screen

// Colors
export const COLORS = {
    SHIP: '#00ffff',           // Cyan
    SHIP_THRUST: '#3b82f6',    // Base Blue
    SHIP_THRUST_T2: '#8b5cf6', // Violet (tier 2 engine)
    SHIP_THRUST_T3: '#d946ef', // Magenta Plasma (tier 3+)
    BULLET: '#ffffff',
    ASTEROID: '#9ca3af',       // Cool Grey
    MOLTEN: '#ef4444',         // Red
    XP_NORMAL: '#ca8a04',      // Dark Gold
    XP_SUPER: '#facc15',       // Bright Gold
    HULL: '#3b82f6',           // Blue
    TEXT: '#ffffff',
    FLASH: '#ffffff',
    DRONE: '#a855f7',          // Purple
    SHIELD: '#d8b4fe',         // Light Purple
    IRON: '#7c2d12',           // Rusty
    SHOCKWAVE: '#67e8f9',      // Cyan
};

// ============================================================================
// UPGRADES DEFINITIONS
// ============================================================================

export const UPGRADES: UpgradeDef[] = [
    // TECH (Green) - Survival & Mobility
    {
        id: 'engine',
        name: 'Plasmatron Thrusters',
        description: (t) => `Speed +25% (Tier ${t})`,
        category: UpgradeCategory.TECH,
        color: 'text-green-400 border-green-500 shadow-green-500/50'
    },
    {
        id: 'regen',
        name: 'Nano-Repair Bots',
        description: (t) => `Passive Hull Regen +${(t * 1.5).toFixed(1)}/sec (Tier ${t})`,
        category: UpgradeCategory.TECH,
        color: 'text-green-400 border-green-500 shadow-green-500/50'
    },
    {
        id: 'hull',
        name: 'Nanocarbon Plating',
        description: (t) => `Max Hull +30% & Full Repair (Tier ${t})`,
        category: UpgradeCategory.TECH,
        color: 'text-green-400 border-green-500 shadow-green-500/50'
    },

    // COMBAT (Red) - Damage & Fire Rate
    {
        id: 'rapidfire',
        name: 'Hyper-Cooling',
        description: (t) => `Fire Rate +${Math.round(t * UPGRADE_FIRE_RATE_SPEED_MULT * 100)}% (Tier ${t})`,
        category: UpgradeCategory.COMBAT,
        color: 'text-red-400 border-red-500 shadow-red-500/50'
    },
    {
        id: 'multishot',
        name: 'Split Shot',
        description: (t) => `+1 Barrel, DMG Split (${Math.floor((1 + t * 0.3) / (t + 1) * 100)}% each, ${Math.floor((1 + t * 0.3) * 100)}% total)`,
        category: UpgradeCategory.COMBAT,
        color: 'text-red-400 border-red-500 shadow-red-500/50'
    },
    {
        id: 'range',
        name: 'Magnetic Rails',
        description: (t) => `Range +${Math.round(t * UPGRADE_RANGE_MULT * 100)}%, Damage +${Math.round((Math.pow(UPGRADE_DAMAGE_MULT_COMPOUND, t) - 1) * 100)}% (Tier ${t})`,
        category: UpgradeCategory.COMBAT,
        color: 'text-red-400 border-red-500 shadow-red-500/50'
    },
    {
        id: 'ricochet',
        name: 'Ricochet Rounds',
        description: (t) => `Bullets bounce ${t}x to nearby enemies (50% dmg per bounce)`,
        category: UpgradeCategory.COMBAT,
        color: 'text-red-400 border-red-500 shadow-red-500/50'
    },

    // ADD-ONS (Purple) - Companions & Utility
    {
        id: 'drone',
        name: 'A.R.C. Swarm',
        description: (t) => `Add +1 Autonomous Drone (Tier ${t})`,
        category: UpgradeCategory.ADDONS,
        color: 'text-purple-400 border-purple-500 shadow-purple-500/50'
    },
    {
        id: 'drone_rofl',
        parentId: 'drone',
        name: 'Drone: Overclock',
        description: (t) => `Fire Rate +${Math.round(t * UPGRADE_DRONE_FIRE_RATE_SPEED_MULT * 100)}%, Damage +${Math.round((Math.pow(UPGRADE_DRONE_DAMAGE_MULT_COMPOUND, t) - 1) * 100)}%, Range +${Math.round(t * UPGRADE_DRONE_RANGE_MULT * 100)}% (Tier ${t})`,
        category: UpgradeCategory.ADDONS,
        color: 'text-purple-200 border-purple-300 shadow-purple-300/30'
    },
    {
        id: 'magnet',
        name: 'Tractor Beam',
        description: (t) => `Pickup Range +60px, Orb Value +25% (Tier ${t})`,
        category: UpgradeCategory.ADDONS,
        color: 'text-purple-400 border-purple-500 shadow-purple-500/50'
    },
    {
        id: 'shield',
        name: 'Energy Shield',
        description: (t) => `${t} Shield Charge${t > 1 ? 's' : ''}, 5s Invuln, Recharges 30s`,
        category: UpgradeCategory.ADDONS,
        color: 'text-purple-400 border-purple-500 shadow-purple-500/50'
    },
    {
        id: 'shield_radiation',
        parentId: 'shield',
        name: 'Shield: Radiation',
        description: (t) => `Aura deals ${t * 7} DPS in ${175 + t * 30}px (Tier ${t})`,
        category: UpgradeCategory.ADDONS,
        color: 'text-purple-200 border-purple-300 shadow-purple-300/30'
    }
];
