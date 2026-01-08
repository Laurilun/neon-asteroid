
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
export const BULLET_SPEED = 12;                 // Bullet velocity
export const BULLET_LIFE = 16;                  // Frames before bullet disappears
export const BULLET_RATE = 20;                  // Frames between shots (lower = faster)
export const BULLET_DAMAGE = 10;                // Damage per bullet hit

// Invulnerability (in milliseconds)
export const INVULN_DURATION_SHIELD = 5000;     // Invuln after shield saves you (5s)
export const INVULN_DURATION_HIT = 300;         // Brief invuln after taking damage
export const INVULN_BLINK_RATE = 100;           // Ship blink cycle during invuln

// ============================================================================
// ENEMIES - All asteroid types and their properties
// ============================================================================

// --- Regular Asteroids ---
// Size categories: 1=Small, 2=Medium, 3=Large
export const ASTEROID_RADIUS = { SMALL: 18, MEDIUM: 35, LARGE: 65 };
export const ASTEROID_HP_BASE = { SMALL: 20, MEDIUM: 50, LARGE: 150 };
export const ASTEROID_HP_SCALING = 0.1;         // +10% HP per player level
export const ASTEROID_SPEED_BASE = 0.8;         // Base movement speed
export const ASTEROID_ROTATION_SPEED = 0.02;    // Max rotation per frame
export const ASTEROID_HULL_DAMAGE = 20;         // Damage to player from medium/large
export const ASTEROID_SMALL_DAMAGE = 8;         // Damage from small asteroids
export const ASTEROID_SPLITS = true;            // Normal asteroids split when destroyed
export const ASTEROID_SPLIT_COUNT = 2;          // Into 2 pieces
export const ASTEROID_SPLIT_MIN_SIZE = 2;       // Only medium+ asteroids split

// --- Molten Asteroids (Fast, deadly) ---
export const MOLTEN_SPEED_MULTIPLIER = 2.2;     // Speed relative to base
export const MOLTEN_RADIUS = { SMALL: 20, LARGE: 45 };
export const MOLTEN_HP = { SMALL: 30, LARGE: 100 };
export const MOLTEN_SPLITS = false;             // Molten asteroids explode, don't split

// --- Iron Asteroids (Armored swarm) ---
export const IRON_SPEED = 5.5;                  // Very fast
export const IRON_HP_MULT = 5.0;                // HP multiplier vs regular asteroids
export const IRON_DAMAGE = 15;                  // Damage on collision
export const IRON_KNOCKBACK = 35;               // Pushback force on hit
export const IRON_RADIUS = { SMALL: 15, MEDIUM: 30 };
export const IRON_COLOR = '#7c2d12';            // Rusty/Dark Iron
export const IRON_SPLITS = false;               // Iron asteroids are destroyed outright

// --- Frozen Asteroids (Slow aura hazard) ---
export const FROZEN_SPEED = 0.4;                // Slow-moving
export const FROZEN_HP = 400;                   // Very tanky
export const FROZEN_RADIUS = 60;                // Large size
export const FROZEN_AURA_RANGE = 220;           // Slowing aura radius
export const FROZEN_AURA_DAMAGE = 0.1;          // Damage per frame in aura
export const FROZEN_SLOW_FACTOR = 0.4;          // 60% speed reduction in aura
export const FROZEN_COLOR = '#06b6d4';          // Cyan
export const FROZEN_SPLITS = false;             // Frozen asteroids shatter completely

// --- Asteroid Splitting (shared settings) ---
export const ASTEROID_SPLIT_SEPARATION_SPEED = 0.4;  // Gentle push-apart velocity
export const ASTEROID_SPLIT_OFFSET_RATIO = 0.5;      // Spawn offset as ratio of parent radius


// ============================================================================
// SPAWNING - Formation patterns and spawn rates
// ============================================================================

// Formation Spawning
export const FORMATION_CHANCE = 0.25;           // Chance to spawn formation vs single
export const FORMATION_COUNT = { MIN: 6, MAX: 10 }; // Asteroids per formation
export const FORMATION_SPREAD = 300;            // Position spread in formation
export const FORMATION_BUFFER = 300;            // Spawn distance from screen edge
export const FORMATION_SPEED_MULT = 1.1;        // Speed boost for formation asteroids

// Single Asteroid Spawning
export const SINGLE_SPAWN_BUFFER = 80;          // Spawn distance from edge

// Level-based Scaling
export const LEVEL_SPEED_SCALING = 0.05;        // +5% asteroid speed per level
export const TARGET_DENSITY_BASE = 4;           // Minimum asteroids on screen
export const TARGET_DENSITY_SCALING = 10;       // Max additional asteroids (caps at level 10)

// Spawn Rates (frames @ 60 FPS)
export const SPAWN_RATES = {
    MOLTEN: { START: 1000, MIN: 350, DECREASE: 50, VARIANCE: 300 },
    IRON: { START: 1200, MIN: 600, DECREASE: 40, VARIANCE: 300 },
    FROZEN: { START: 1800, MIN: 900, DECREASE: 80, VARIANCE: 600 }
};

// Progression Gates (level required to spawn)
export const LEVEL_GATE_LARGE_ASTEROIDS = 2;
export const LEVEL_GATE_MOLTEN_SMALL = 3;
export const LEVEL_GATE_IRON = 4;
export const LEVEL_GATE_FROZEN = 5;
export const LEVEL_GATE_MOLTEN_LARGE = 8;

// Iron Swarm
export const IRON_SWARM_COUNT = { MIN: 3, MAX: 4 };
export const IRON_SWARM_SPREAD = 70;            // Position spread in swarm

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
export const DRONE_BASE_FIRE_RATE = 30;         // Frames between shots
export const DRONE_RECOIL = 1.5;                // Recoil velocity on shoot
export const DRONE_GUN_SPREAD = 0.15;           // Angle spread for multi-gun

// ============================================================================
// ECONOMY - Orbs, XP, and loot
// ============================================================================

// XP Orbs
export const XP_ORB_NORMAL_VALUE = 40;          // XP from normal orb
export const XP_ORB_SUPER_VALUE = 400;          // XP from super orb (large asteroids)
export const XP_ORB_RADIUS = { NORMAL: 4, SUPER: 8 };

// Hull Orbs
export const HULL_ORB_VALUE = 25;               // HP restored
export const HULL_ORB_RADIUS = 8;
export const HULL_DROP_CHANCE = 0.02;           // 2% chance from any asteroid

// Collection
export const ORB_MAGNET_RANGE_BASE = 60;        // Base pickup range
export const ORB_DRIFT_SPEED = 0.5;             // Random drift velocity

// Leveling
export const XP_BASE_REQ = 200;                 // XP needed for level 2
export const XP_SCALING_FACTOR = 1.20;          // XP requirement multiplier per level

// ============================================================================
// UPGRADES - Stat scaling per tier
// ============================================================================

export const UPGRADE_ENGINE_MULT = 0.25;        // +25% speed per tier
export const UPGRADE_REGEN_PER_TIER = 1.5;      // +1.5 HP/sec per tier (nerfed)
export const UPGRADE_HULL_MULT = 0.30;          // +30% max hull per tier
export const UPGRADE_FIRE_RATE_REDUCTION = 0.20;// -20% fire delay per tier (min 10%)
export const UPGRADE_VELOCITY_MULT = 0.25;      // +25% bullet speed per tier
export const UPGRADE_MAGNET_RANGE = 60;         // +60px pickup range per tier
export const UPGRADE_XP_MULT = 0.25;            // +25% XP value per tier

// Drone Overclock specific
export const UPGRADE_DRONE_FIRE_RATE_REDUCTION = 0.20; // -20% fire delay per tier
export const UPGRADE_DRONE_DAMAGE_MULT = 0.15;  // +15% drone damage per tier
export const UPGRADE_DRONE_RANGE_MULT = 0.35;   // +35% drone bullet range per tier (buffed)

// Shield Mechanics
export const SHIELD_RECHARGE_TIME = 30000;      // 30 seconds per shield charge
export const SHIELD_RADIATION_BASE_RADIUS = 175; // Base aura radius in pixels
export const SHIELD_RADIATION_RADIUS_PER_TIER = 15; // +15px per tier (nerfed from 30)
export const SHIELD_RADIATION_BASE_DPS = 0;     // Base damage per second
export const SHIELD_RADIATION_DPS_PER_TIER = 4; // +4 DPS per tier (nerfed from 7)

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
        description: (t) => `Fire Rate +20% (Tier ${t})`,
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
        description: (t) => `Range +25%, Damage +15% (Tier ${t})`,
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
        description: (t) => `Drone Fire +20%, Damage +15%, Range +25% (Tier ${t})`,
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
