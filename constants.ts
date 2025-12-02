
import { UpgradeCategory, UpgradeDef } from './types';

export const CANVAS_WIDTH = window.innerWidth;
export const CANVAS_HEIGHT = window.innerHeight;

export const FPS = 60;

// --- SHIP PHYSICS (Vampire Survivors Start: Slow & Heavy) ---
export const SHIP_SIZE = 12; 
export const SHIP_THRUST = 0.05; // Base acceleration (Starts very sluggish)
export const SHIP_TURN_SPEED = 0.07; 
export const SHIP_FRICTION = 0.99; 
export const SHIP_MAX_SPEED = 8.0; // Base max speed (Starts slow)

// --- COMBAT (Weak Start) ---
export const BULLET_SPEED = 14; 
export const BULLET_LIFE = 18;  
export const BULLET_RATE = 20;  
export const BULLET_DAMAGE = 10; 

// --- ENEMIES ---
export const ASTEROID_SPEED_BASE = 1.0; // Slightly slower base speed
export const MOLTEN_SPEED_MULTIPLIER = 3.5; 
export const ASTEROID_HULL_DAMAGE = 15; 
export const ASTEROID_SMALL_DAMAGE = 5; 
export const MOLTEN_SPAWN_RATE = 0.003; 
export const HIT_FLASH_FRAMES = 4;

// --- PROGRESSION GATES ---
export const LEVEL_GATE_LARGE_ASTEROIDS = 2; 
export const LEVEL_GATE_MOLTEN_SMALL = 3;    
export const LEVEL_GATE_MOLTEN_LARGE = 6;    

// --- ECONOMY (Less Panic) ---
export const FUEL_DECAY_ON_THRUST = 0.05; // Base drain
export const FUEL_DECAY_PASSIVE = 0.005; // Base passive drain
export const FUEL_ORB_VALUE = 20; 
export const FUEL_ORB_LIFE = 600; // Lasts longer
export const FUEL_DROP_CHANCE = 0.25; // 1 in 4 rocks drops fuel

export const HULL_ORB_VALUE = 20; 
export const HULL_DROP_CHANCE = 0.10; 

// --- LEVELING ---
export const XP_BASE_REQ = 600; // Very fast first level up
export const XP_SCALING_FACTOR = 1.3; 

// --- UPGRADES ---
export const UPGRADES: UpgradeDef[] = [
    // TECH (Green)
    {
        id: 'engine',
        name: 'Plasmatron Thrusters',
        description: (t) => `Acceleration & Max Speed +25% (Tier ${t})`,
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
        name: 'Molten Heat Shield',
        description: (t) => `Block ${t} Molten Hit${t>1?'s':''} (Recharge on Level Up)`,
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
  TEXT: '#ffffff',
  FLASH: '#ffffff',
  DRONE: '#a855f7', // Purple 500
  SHIELD: '#d8b4fe', // Purple 300
};
