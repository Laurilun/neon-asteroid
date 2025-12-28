

import { UpgradeCategory, UpgradeDef } from './types';

export const CANVAS_WIDTH = window.innerWidth;
export const CANVAS_HEIGHT = window.innerHeight;

export const FPS = 60;

// --- SHIP PHYSICS (Nerfed Start) ---
export const SHIP_SIZE = 12; 
export const SHIP_THRUST = 0.035; // Was 0.05
export const SHIP_TURN_SPEED = 0.07; // Reverted to 0.07 (fast)
export const SHIP_FRICTION = 0.99; 
export const SHIP_MAX_SPEED = 6.0; // Was 8.0

export const SHIP_BASE_HULL = 60; // 3 hits from normal asteroids (20 dmg) = 60.

// --- COMBAT (Nerfed Start) ---
export const BULLET_SPEED = 12; // Was 14
export const BULLET_LIFE = 14;  // Was 18 (Shorter range)
export const BULLET_RATE = 20;  
export const BULLET_DAMAGE = 10; 

// --- ENEMIES ---
export const ASTEROID_SPEED_BASE = 0.8; 
export const MOLTEN_SPEED_MULTIPLIER = 2.0; 
export const ASTEROID_HULL_DAMAGE = 20; // 3 hits to kill base ship
export const ASTEROID_SMALL_DAMAGE = 8; 
export const HIT_FLASH_FRAMES = 4;
export const FORMATION_CHANCE = 0.15; 

// FROZEN ASTEROID
export const FROZEN_SPEED = 0.4;
export const FROZEN_HP = 400; // Tanky
export const FROZEN_AURA_RANGE = 200; // Increased
export const FROZEN_AURA_DAMAGE = 0.1; // Per frame
export const FROZEN_COLOR = '#06b6d4'; // Cyan 500

// IRON ORE ASTEROID (New)
export const IRON_SPEED = 4.5; // Super fast (was 3.0)
export const IRON_HP_MULT = 6.0; // Extremely durable
export const IRON_DAMAGE = 15; // Moderate damage
export const IRON_KNOCKBACK = 30; // Massive knockback
export const IRON_COLOR = '#8c3515'; // Rusty Red-Brown

// --- PROGRESSION GATES ---
export const LEVEL_GATE_LARGE_ASTEROIDS = 2; 
export const LEVEL_GATE_MOLTEN_SMALL = 3;    
export const LEVEL_GATE_IRON = 3;            // Starts appearing early but rare
export const LEVEL_GATE_FROZEN = 4;
export const LEVEL_GATE_MOLTEN_LARGE = 6;    

// --- ECONOMY ---
export const FUEL_DECAY_ON_THRUST = 0.05; 
export const FUEL_DECAY_PASSIVE = 0.005; 
export const FUEL_ORB_VALUE = 20; 
export const FUEL_ORB_LIFE = 600; 
export const FUEL_DROP_CHANCE = 0.25; 

export const HULL_ORB_VALUE = 20; 
export const HULL_DROP_CHANCE = 0.10; 

export const GOLD_ORB_VALUE = 250; // XP
export const DROP_CONVERSION_THRESHOLD = 0.95; // 95%

// --- LEVELING ---
export const XP_BASE_REQ = 600; 
export const XP_SCALING_FACTOR = 1.3; 

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
        id: 'tank',
        name: 'Fusion Cells',
        description: (t) => `Tank +40%, Efficiency +20%, Pickup +20% (Tier ${t})`,
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
        name: 'Splitfire Cannons',
        description: (t) => t === 1 ? 'Double Barrel Cannon' : t === 2 ? 'Triple Spread Shot' : 'Penta-Shot Spread',
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
    {
        id: 'magnet',
        name: 'Tractor Beam',
        description: (t) => `Orb Pickup Range +60px (Tier ${t})`,
        category: UpgradeCategory.ADDONS,
        color: 'text-purple-400 border-purple-500 shadow-purple-500/50'
    },
    {
        id: 'shield',
        name: 'Emergency Shield',
        description: (t) => `Prevents Death ${t} Time${t>1?'s':''} (2s Invuln)`,
        category: UpgradeCategory.ADDONS,
        color: 'text-purple-400 border-purple-500 shadow-purple-500/50'
    },
    {
        id: 'scavenger',
        name: 'Void Scavenger',
        description: (t) => `XP Gain +20% (Tier ${t})`,
        category: UpgradeCategory.ADDONS,
        color: 'text-purple-400 border-purple-500 shadow-purple-500/50'
    }
];


// --- JUICE ---
export const PARTICLE_COUNT_EXPLOSION = 25;
export const SCREEN_SHAKE_DECAY = 0.9;

export const COLORS = {
  SHIP: '#00ffff', // Cyan
  SHIP_THRUST: '#ff00ff', // Magenta
  BULLET: '#ffffff', // White
  ASTEROID: '#9ca3af', // Cool Grey
  MOLTEN: '#ef4444', // Red 500
  FUEL: '#22c55e', // Green 500
  HULL: '#3b82f6', // Blue 500
  GOLD: '#eab308', // Yellow 500
  TEXT: '#ffffff',
  FLASH: '#ffffff',
  DRONE: '#a855f7', // Purple 500
  SHIELD: '#d8b4fe', // Purple 300
  IRON: '#8c3515', // Rusty Brown
};