

export interface Vector {
  x: number;
  y: number;
}

export enum EntityType {
  Player = 'PLAYER',
  Asteroid = 'ASTEROID',
  MoltenAsteroid = 'MOLTEN_ASTEROID',
  FrozenAsteroid = 'FROZEN_ASTEROID',
  Bullet = 'BULLET',
  Particle = 'PARTICLE',
  FuelOrb = 'FUEL_ORB',
  HullOrb = 'HULL_ORB',
  GoldOrb = 'GOLD_ORB',
  Drone = 'DRONE',
}

export interface Entity {
  id: string;
  type: EntityType;
  pos: Vector;
  vel: Vector;
  radius: number;
  angle: number; // in radians
  color: string;
  toBeRemoved: boolean;
}

export interface ShipStats {
  fuelEfficiency: number; // Multiplier for decay (default 1.0, lower is better)
  fuelRecoveryMult: number; // Multiplier for orb value (default 1.0, higher is better)
  thrustMult: number;     // Multiplier for engine acceleration (default 1.0)
  speedMult: number;      // Multiplier for max speed (default 1.0)
  maxFuelMult: number;    // Multiplier (default 1.0)
  maxHullMult: number;    // Multiplier (default 1.0)
  fireRateMult: number;   // Multiplier (default 1.0, lower is faster)
  bulletSpeedMult: number;// Multiplier (default 1.0)
  pickupRange: number;    // Pixels (default 50)
  shieldCharges: number;  // Current charges
  maxShieldCharges: number;
  droneCount: number;     // Number of active drones
  multishotTier: number;  // 0 = single, 1 = double, 2 = triple, etc.
  xpMult: number;         // Multiplier for XP gain (default 1.0)
}

export interface Ship extends Entity {
  rotation: number; // Current rotation angle
  thrusting: boolean;
  fuel: number;
  maxFuel: number; // Base value
  hull: number;
  maxHull: number; // Base value
  invulnerableUntil: number;
  stats: ShipStats;
}

export interface Asteroid extends Entity {
  vertices: Vector[]; // For jagged polygon rendering
  hp: number;
  sizeCategory: 1 | 2 | 3; // 3 = large, 2 = medium, 1 = small
  hitFlash: number; // Number of frames to render white
  rotation: number; // Current visual rotation
  rotationSpeed: number; // Radians per frame
  pulsateOffset: number; // Offset for glow animation
}

export interface Bullet extends Entity {
  life: number;
  damage: number; // Snapshot damage at time of firing
}

export interface Particle extends Entity {
  life: number;
  maxLife: number;
  decay: number;
}

export interface FuelOrb extends Entity {
  life: number;
  pulsateOffset: number;
}

export interface HullOrb extends Entity {
  life: number;
  pulsateOffset: number;
}

export interface GoldOrb extends Entity {
  life: number;
  pulsateOffset: number;
}

export interface Drone extends Entity {
  targetId: string | null;
  orbitOffset: number; // Offset angle in the swarm ring
  lastShot: number;
}

export enum GameState {
  MENU,
  PLAYING,
  LEVEL_UP,
  GAME_OVER,
}

export enum UpgradeCategory {
  TECH = 'TECH',       // Green (was Survival)
  COMBAT = 'COMBAT',   // Red
  ADDONS = 'ADD-ONS'   // Purple (was Tech)
}

export interface UpgradeDef {
  id: string;
  name: string;
  description: (tier: number) => string;
  category: UpgradeCategory;
  color: string;
}