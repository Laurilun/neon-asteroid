
import { UpgradeCategory, UpgradeDef } from './types';

export const CANVAS_WIDTH = window.innerWidth;
export const CANVAS_HEIGHT = window.innerHeight;

export const FPS = 60;

// --- SHIP PHYSICS ---
export const SHIP_SIZE = 12;
export const SHIP_THRUST = 0.035;
export const SHIP_TURN_SPEED = 0.045; // Reduced from 0.07 for better control
export const SHIP_FRICTION = 0.99;
export const SHIP_MAX_SPEED = 6.0;

export const SHIP_BASE_HULL = 100;

// --- COMBAT ---
export const BULLET_SPEED = 12;
export const BULLET_LIFE = 16;
export const BULLET_RATE = 20;
export const BULLET_DAMAGE = 10;

// --- ENEMIES ---
export const ASTEROID_SPEED_BASE = 0.8;
export const MOLTEN_SPEED_MULTIPLIER = 2.2; // High speed threat
export const ASTEROID_HULL_DAMAGE = 20;
export const ASTEROID_SMALL_DAMAGE = 8;
export const HIT_FLASH_FRAMES = 4;
export const FORMATION_CHANCE = 0.25;

// FROZEN ASTEROID
export const FROZEN_SPEED = 0.4;
export const FROZEN_HP = 400; // Tanky
export const FROZEN_AURA_RANGE = 220;
export const FROZEN_AURA_DAMAGE = 0.1;
export const FROZEN_COLOR = '#06b6d4'; // Cyan 500
export const FROZEN_SLOW_FACTOR = 0.4; // 60% Slow

// IRON ORE ASTEROID
export const IRON_SPEED = 5.5;
export const IRON_HP_MULT = 5.0;
export const IRON_DAMAGE = 15;
export const IRON_KNOCKBACK = 35;
export const IRON_COLOR = '#7c2d12'; // Rusty/Dark Iron

// --- PROGRESSION GATES ---
export const LEVEL_GATE_LARGE_ASTEROIDS = 2;
export const LEVEL_GATE_MOLTEN_SMALL = 3;
export const LEVEL_GATE_IRON = 4;
export const LEVEL_GATE_FROZEN = 5;
export const LEVEL_GATE_MOLTEN_LARGE = 8;

// --- SPAWN RATES (Frames @ 60FPS) ---
export const SPAWN_RATES = {
    MOLTEN: { START: 1000, MIN: 350, DECREASE: 50, VARIANCE: 300 },
    IRON: { START: 1200, MIN: 600, DECREASE: 40, VARIANCE: 300 }, // Less frequent
    FROZEN: { START: 1800, MIN: 900, DECREASE: 80, VARIANCE: 600 }
};

// --- ECONOMY / LOOT ---
export const ORB_MAGNET_RANGE_BASE = 60;

export const XP_ORB_NORMAL_VALUE = 40;
export const XP_ORB_SUPER_VALUE = 400;

export const HULL_ORB_VALUE = 25;
export const HULL_DROP_CHANCE = 0.02;

// --- LEVELING ---
export const XP_BASE_REQ = 200;
export const XP_SCALING_FACTOR = 1.20; // Reduced from 1.35 to make late game viable

// --- UPGRADES ---
export const UPGRADES: UpgradeDef[] = [
    // TECH (Green)
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
        description: (t) => `Passive Hull Regen +${(t * 3).toFixed(0)}/sec (Tier ${t})`,
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

    // COMBAT (Red)
    {
        id: 'rapidfire',
        name: 'Hyper-Cooling',
        description: (t) => `Fire Rate +20% (Tier ${t})`,
        category: UpgradeCategory.COMBAT,
        color: 'text-red-400 border-red-500 shadow-red-500/50'
    },
    {
        id: 'multishot',
        name: '+1 Main Gun',
        description: (t) => t === 1 ? 'Double Barrel Cannon' : t === 2 ? 'Triple Spread Shot' : `Add Gun Barrel (Total: ${1 + t})`,
        category: UpgradeCategory.COMBAT,
        color: 'text-red-400 border-red-500 shadow-red-500/50'
    },
    {
        id: 'velocity',
        name: 'Magnetic Rails',
        description: (t) => `Bullet Speed & Range +25% (Tier ${t})`,
        category: UpgradeCategory.COMBAT,
        color: 'text-red-400 border-red-500 shadow-red-500/50'
    },

    // ADD-ONS (Purple)
    {
        id: 'drone',
        name: 'A.R.C. Swarm',
        description: (t) => `Add +1 Autonomous Drone (Tier ${t})`,
        category: UpgradeCategory.ADDONS,
        color: 'text-purple-400 border-purple-500 shadow-purple-500/50'
    },
    // SUB-UPGRADE: Drone Fire Rate
    {
        id: 'drone_rofl',
        parentId: 'drone',
        name: 'Drone: Overclock',
        description: (t) => `Drone Fire Rate +20% (Tier ${t})`,
        category: UpgradeCategory.ADDONS,
        color: 'text-purple-200 border-purple-300 shadow-purple-300/30'
    },
    // SUB-UPGRADE: Drone Gun Count
    {
        id: 'drone_gun',
        parentId: 'drone',
        name: 'Drone: Aux Battery',
        description: (t) => `Drone +1 Gun Barrel (Total: ${1 + t})`,
        category: UpgradeCategory.ADDONS,
        color: 'text-purple-200 border-purple-300 shadow-purple-300/30'
    },

    {
        id: 'magnet',
        name: 'Tractor Beam',
        description: (t) => `Pickup Range +60px (Tier ${t})`,
        category: UpgradeCategory.ADDONS,
        color: 'text-purple-400 border-purple-500 shadow-purple-500/50'
    },
    {
        id: 'shield',
        name: 'Emergency Shield',
        description: (t) => `Prevents Death ${t} Time${t > 1 ? 's' : ''} (2s Invuln)`,
        category: UpgradeCategory.ADDONS,
        color: 'text-purple-400 border-purple-500 shadow-purple-500/50'
    },
    {
        id: 'scavenger',
        name: 'Void Scavenger',
        description: (t) => `Orb Value +25% (Tier ${t})`,
        category: UpgradeCategory.ADDONS,
        color: 'text-purple-400 border-purple-500 shadow-purple-500/50'
    }
];


// --- JUICE ---
export const PARTICLE_COUNT_EXPLOSION = 25;
export const SCREEN_SHAKE_DECAY = 0.9;

export const COLORS = {
    SHIP: '#00ffff', // Cyan
    SHIP_THRUST: '#3b82f6', // Base Blue
    SHIP_THRUST_T2: '#8b5cf6', // Violet
    SHIP_THRUST_T3: '#d946ef', // Magenta Plasma
    BULLET: '#ffffff', // White
    ASTEROID: '#9ca3af', // Cool Grey
    MOLTEN: '#ef4444', // Red 500
    XP_NORMAL: '#ca8a04', // Dark Gold (Yellow 600)
    XP_SUPER: '#facc15', // Bright Gold (Yellow 400)
    HULL: '#3b82f6', // Blue 500
    TEXT: '#ffffff',
    FLASH: '#ffffff',
    DRONE: '#a855f7', // Purple 500
    SHIELD: '#d8b4fe', // Purple 300
    IRON: '#7c2d12', // Rusty Iron
    SHOCKWAVE: '#67e8f9', // Cyan 300
};
