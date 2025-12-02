
export interface Vector {
  x: number;
  y: number;
}

export enum EntityType {
  Player = 'PLAYER',
  Asteroid = 'ASTEROID',
  MoltenAsteroid = 'MOLTEN_ASTEROID',
  Bullet = 'BULLET',
  Particle = 'PARTICLE',
  FuelOrb = 'FUEL_ORB',
  HullOrb = 'HULL_ORB',
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
  fuelEfficiency: number; // Multiplier (default 1.0)
  maxFuelMult: number;    // Multiplier (default 1.0)
  maxHullMult: number;    // Multiplier (default 1.0)
  fireRateMult: number;   // Multiplier (default 1.0, lower is faster)
  damageMult: number;     // Multiplier (default 1.0)
  bulletSpeedMult: number;// Multiplier (default 1.0)
  pickupRange: number;    // Pixels (default 50)
  shieldCharges: number;  // Current charges
  maxShieldCharges: number;
  hasWingman: boolean;
  wingmanTier: number;
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

export interface Drone extends Entity {
  targetId: string | null;
  orbitAngle: number;
  lastShot: number;
}

export enum GameState {
  MENU,
  PLAYING,
  LEVEL_UP,
  GAME_OVER,
}

export enum UpgradeCategory {
  SURVIVAL = 'SURVIVAL', // Green
  COMBAT = 'COMBAT',     // Red
  TECH = 'TECH'          // Purple
}

export interface UpgradeDef {
  id: string;
  name: string;
  description: (tier: number) => string;
  category: UpgradeCategory;
  color: string;
}
