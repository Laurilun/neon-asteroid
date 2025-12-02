
import { UpgradeCategory, UpgradeDef } from './types';

export const CANVAS_WIDTH = window.innerWidth;
export const CANVAS_HEIGHT = window.innerHeight;

export const FPS = 60;

// --- SHIP PHYSICS (Controlled Drift) ---
export const SHIP_SIZE = 12; 
export const SHIP_THRUST = 0.22; 
export const SHIP_TURN_SPEED = 0.09; 
export const SHIP_FRICTION = 0.995; 
export const SHIP_MAX_SPEED = 13; 

// --- COMBAT ---
export const BULLET_SPEED = 18;
export const BULLET_LIFE = 22; 
export const BULLET_RATE = 5; 
export const BULLET_DAMAGE = 7; 

// --- ENEMIES ---
export const ASTEROID_SPEED_BASE = 1.2;
export const MOLTEN_SPEED_MULTIPLIER = 3.8; 
export const ASTEROID_HULL_DAMAGE = 20; 
export const MOLTEN_SPAWN_RATE = 0.003; 
export const HIT_FLASH_FRAMES = 4;

// --- ECONOMY ---
export const FUEL_DECAY_ON_THRUST = 0.08; 
export const FUEL_DECAY_PASSIVE = 0.03; 
export const FUEL_ORB_VALUE = 35; 
export const FUEL_ORB_LIFE = 500;
export const FUEL_DROP_CHANCE = 0.12; 

export const HULL_ORB_VALUE = 25;
export const HULL_DROP_CHANCE = 0.06; 

// --- LEVELING ---
export const XP_BASE_REQ = 2000;
export const XP_SCALING_FACTOR = 1.2; // Each level needs 20% more points than the last

// --- UPGRADES ---
export const UPGRADES: UpgradeDef[] = [
    // SURVIVAL (Green)
    {
        id: 'efficiency',
        name: 'Ion Recycler',
        description: (t) => `Fuel Efficiency +${20}% (Tier ${t})`,
        category: UpgradeCategory.SURVIVAL,
        color: 'text-green-400 border-green-500 shadow-green-500/50'
    },
    {
        id: 'tank',
        name: 'Expanded Reservoirs',
        description: (t) => `Max Fuel Capacity +${30}% (Tier ${t})`,
        category: UpgradeCategory.SURVIVAL,
        color: 'text-green-400 border-green-500 shadow-green-500/50'
    },
    {
        id: 'hull',
        name: 'Nanocarbon Plating',
        description: (t) => `Max Hull +${25}% & Full Repair (Tier ${t})`,
        category: UpgradeCategory.SURVIVAL,
        color: 'text-green-400 border-green-500 shadow-green-500/50'
    },
    
    // COMBAT (Red)
    {
        id: 'rapidfire',
        name: 'Hyper-Cooling',
        description: (t) => `Fire Rate +${15}% (Tier ${t})`,
        category: UpgradeCategory.COMBAT,
        color: 'text-red-400 border-red-500 shadow-red-500/50'
    },
    {
        id: 'damage',
        name: 'Plasma Concentration',
        description: (t) => `Bullet Damage +${25}% (Tier ${t})`,
        category: UpgradeCategory.COMBAT,
        color: 'text-red-400 border-red-500 shadow-red-500/50'
    },
    {
        id: 'velocity',
        name: 'Magnetic Rails',
        description: (t) => `Bullet Speed & Range +${20}% (Tier ${t})`,
        category: UpgradeCategory.COMBAT,
        color: 'text-red-400 border-red-500 shadow-red-500/50'
    },

    // TECH (Purple)
    {
        id: 'wingman',
        name: 'A.R.C. Drone',
        description: (t) => t === 1 ? 'Deploy an auto-targeting drone' : `Drone Fire Rate +20% (Tier ${t})`,
        category: UpgradeCategory.TECH,
        color: 'text-purple-400 border-purple-500 shadow-purple-500/50'
    },
    {
        id: 'magnet',
        name: 'Tractor Beam',
        description: (t) => `Orb Pickup Range +${50}px (Tier ${t})`,
        category: UpgradeCategory.TECH,
        color: 'text-purple-400 border-purple-500 shadow-purple-500/50'
    },
    {
        id: 'shield',
        name: 'Molten Heat Shield',
        description: (t) => `Block ${t} Molten Hit${t>1?'s':''} (Recharge on Level Up)`,
        category: UpgradeCategory.TECH,
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
  TEXT: '#ffffff',
  FLASH: '#ffffff',
  DRONE: '#a855f7', // Purple 500
  SHIELD: '#d8b4fe', // Purple 300
};
