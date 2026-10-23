import { EntityType } from '../types';
import type { Asteroid, Bullet, Ship, TungstenShard } from '../types';

export function makeShip(): Ship {
  return {
    id: 'ship', type: EntityType.Player, pos: { x: 100, y: 100 }, vel: { x: 0, y: 0 },
    radius: 14, angle: 0, rotation: 0, color: '#fff', toBeRemoved: false,
    thrusting: false, hull: 100, maxHull: 100, invulnerableUntil: 2000,
    angularVelocity: 0, throttle: 0, steering: 0,
    isFrozen: false, stunnedUntil: 0,
    stats: {
      regenRate: 0, thrustMult: 1, speedMult: 1, maxHullMult: 1, fireRateMult: 1,
      pickupRange: 50, shieldCharges: 0, maxShieldCharges: 0, shieldRechargeTimer: 0,
      droneCount: 0, droneFireRateMult: 1, droneDamageMult: 1, droneRangeMult: 1,
      multishotTier: 0, xpMult: 1, rangeTier: 0, ricochetTier: 0, damageMult: 1,
      shieldRadiationTier: 0,
    },
  };
}

export function makeAsteroid(id = 'rock', x = 50, radius = 2): Asteroid {
  return {
    id, type: EntityType.Asteroid, pos: { x, y: 100 }, vel: { x: 0, y: 0 },
    radius, angle: 0, color: '#fff', toBeRemoved: false, vertices: [],
    hp: 20, maxHp: 20, sizeCategory: 1, hitFlash: 0,
    rotation: 0, rotationSpeed: 0, pulsateOffset: 0,
  };
}

export function makeBullet(): Bullet {
  return {
    id: 'bullet', type: EntityType.Bullet, pos: { x: 0, y: 100 }, vel: { x: 100, y: 0 },
    radius: 1, angle: 0, color: '#fff', toBeRemoved: false,
    life: 28, damage: 10, bouncesRemaining: 0,
  };
}

export function makeShard(x = 30): TungstenShard {
  return {
    ...makeAsteroid('shard', x), type: EntityType.TungstenShard,
    parentId: 'parent', orbitAngle: 0, orbitRadius: 30, orbitSpeed: 0.1,
    collisionRadius: 5, wobblePhase: 0, wobbleSpeed: 0, driftOffset: { x: 0, y: 0 },
  };
}
