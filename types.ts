
export interface Vector {
  x: number;
  y: number;
}

export enum EntityType {
  Player = 'PLAYER',
  Asteroid = 'ASTEROID',
  MoltenAsteroid = 'MOLTEN_ASTEROID',
  FrozenAsteroid = 'FROZEN_ASTEROID',
  IronAsteroid = 'IRON_ASTEROID',
  TungstenAsteroid = 'TUNGSTEN_ASTEROID',
  Bullet = 'BULLET',
  Particle = 'PARTICLE',
  ExpOrb = 'EXP_ORB',
  HullOrb = 'HULL_ORB',
  FreebieOrb = 'FREEBIE_ORB',
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
  regenRate: number;      // Hull repaired per second
  thrustMult: number;     // Multiplier for engine acceleration (default 1.0)
  speedMult: number;      // Multiplier for max speed (default 1.0)
  maxHullMult: number;    // Multiplier (default 1.0)
  fireRateMult: number;   // Multiplier (default 1.0, lower is faster)
  pickupRange: number;    // Pixels (default 50)
  shieldCharges: number;  // Current charges
  maxShieldCharges: number;
  shieldRechargeTimer: number; // Time since last recharge (ms)
  droneCount: number;     // Number of active drones
  droneFireRateMult: number; // Drone specific fire rate
  droneDamageMult: number;   // Drone damage multiplier (from Overclock)
  droneRangeMult: number;    // Drone bullet range multiplier (from Overclock)
  multishotTier: number;  // 0 = single, 1 = double, 2 = triple, etc.
  xpMult: number;         // Multiplier for XP gain (default 1.0)
  // New stats for rebalance
  rangeTier: number;      // Range + damage upgrade tier
  ricochetTier: number;   // Ricochet upgrade tier (max bounces)
  damageMult: number;     // Base damage multiplier (from range upgrade)
  shieldRadiationTier: number; // Shield radiation sub-upgrade tier
}

export interface Ship extends Entity {
  rotation: number; // Current rotation angle
  thrusting: boolean;
  hull: number;
  maxHull: number; // Base value
  invulnerableUntil: number;
  stats: ShipStats;
  isFrozen: boolean; // Track if currently in a slow field
}

// Fracture data for smart asteroid breaking
export interface FractureData {
  // Jagged fracture paths from center outward (one per split line)
  fracturePaths: Vector[][];
  // Pre-computed child shapes (2-4 pieces depending on size)
  childShapes: Vector[][];
  // Separation vectors for each child (direction to push apart)
  separationVectors: Vector[];
}

export interface Asteroid extends Entity {
  vertices: Vector[]; // For jagged polygon rendering
  hp: number;
  maxHp: number; // Starting HP for damage percentage calculation
  sizeCategory: 1 | 2 | 3 | 4; // 1=small, 2=medium, 3=large, 4=xlarge
  hitFlash: number; // Number of frames to render white
  rotation: number; // Current visual rotation
  rotationSpeed: number; // Radians per frame
  pulsateOffset: number; // Offset for glow animation
  fractureData?: FractureData; // Pre-computed fracture for splitting (size 2+)
}

export interface Bullet extends Entity {
  life: number;
  damage: number; // Snapshot damage at time of firing
  bouncesRemaining: number; // Ricochet bounces left
  hitChainIds?: string[]; // All asteroids already hit in this ricochet chain
  trail?: Vector[]; // Previous positions for trail effect
  isRicochet?: boolean; // Mark as ricochet bullet for special rendering
  bounceDepth?: number; // How many bounces deep (0 = first bounce)
}

export interface Particle extends Entity {
  life: number;
  maxLife: number;
  decay: number;
  variant?: 'THRUST' | 'DEBRIS' | 'SHOCKWAVE' | 'SHELL';
}

export interface ExpOrb extends Entity {
  // life removed - persistent
  value: number;
  variant: 'NORMAL' | 'SUPER';
  pulsateOffset: number;
}

export interface HullOrb extends Entity {
  // life removed - persistent
  pulsateOffset: number;
}

// Rare drop from special asteroids - grants free upgrade without level increase
export interface FreebieOrb extends Entity {
  pulsateOffset: number;
  sparklePhase: number;
}
export interface Drone extends Entity {
  targetId: string | null;
  orbitOffset: number; // Offset angle in the swarm ring
  lastShot: number;
  // Physics for organic movement
  targetPos: Vector;
}

// Asteroid cloud - keeps small asteroids together as a cohesive homing unit
export interface AsteroidCloud {
  id: string;
  pos: Vector;           // Cloud center position
  vel: Vector;           // Cloud velocity (homes toward player)
  memberIds: string[];   // IDs of asteroids belonging to this cloud
  memberOffsets: Vector[]; // Fixed offset from cloud center for each member
  spawnTime: number;     // Frame when cloud was created
}

export enum GameState {
  MENU,
  PLAYING,
  LEVEL_UP,
  GAME_OVER,
}

export enum UpgradeCategory {
  TECH = 'TECH',       // Green
  COMBAT = 'COMBAT',   // Red
  ADDONS = 'ADD-ONS'   // Purple
}

export interface UpgradeDef {
  id: string;
  parentId?: string; // If present, this upgrade only appears if parentId is active
  name: string;
  description: (tier: number) => string;
  category: UpgradeCategory;
  color: string;
}
