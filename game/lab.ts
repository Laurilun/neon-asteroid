import { ASTEROID_BASE, ASTEROID_TYPES, SIZE_MULTIPLIERS, UPGRADE_DAMAGE_MULT_COMPOUND, UPGRADE_FIRE_RATE_SPEED_MULT } from '../constants';
import type { AsteroidTypeName } from '../constants';
import { EntityType } from '../types';
import type { Asteroid, Ship } from '../types';
import type { Bounds, HandlingProfile } from './movement';
import { rockOutline } from './fracture';

export interface LabSettings {
  profile: HandlingProfile; thrust: number; steering: number;
  split: number; cooling: number; rails: number; ricochet: number;
  material: AsteroidTypeName; size: 1 | 2 | 3 | 4; moving: boolean;
  firing: boolean; repeat: boolean; immortal: boolean;
}
export const DEFAULT_LAB: LabSettings = { profile: 'gunship', thrust: 1, steering: 1,
  split: 0, cooling: 0, rails: 0, ricochet: 0, material: 'REGULAR', size: 3,
  moving: false, firing: true, repeat: true, immortal: true };
export function equipLabShip(ship: Ship, settings: LabSettings) {
  ship.stats.multishotTier = settings.split;
  ship.stats.fireRateMult = 1 / (1 + settings.cooling * UPGRADE_FIRE_RATE_SPEED_MULT);
  ship.stats.rangeTier = settings.rails;
  ship.stats.damageMult = Math.pow(UPGRADE_DAMAGE_MULT_COMPOUND, settings.rails);
  ship.stats.ricochetTier = settings.ricochet;
  if (settings.immortal) { ship.hull = 1000; ship.maxHull = 1000; }
  else { ship.maxHull = 100; ship.hull = Math.min(100, ship.hull); }
}
export function labShipPosition(bounds: Bounds) {
  return { x: Math.max(180, bounds.width - 280) * .5, y: bounds.height * .7 };
}
/** Repeatable geometry/layout makes profile comparisons meaningful. No director or loot. */
export function createLabTargets(bounds: Bounds, settings: LabSettings): Asteroid[] {
  const config = ASTEROID_TYPES[settings.material], size = SIZE_MULTIPLIERS[settings.size];
  const types = { REGULAR: EntityType.Asteroid, MOLTEN: EntityType.MoltenAsteroid,
    FROZEN: EntityType.FrozenAsteroid, IRON: EntityType.IronAsteroid, TUNGSTEN: EntityType.TungstenAsteroid };
  const origin = labShipPosition(bounds), radius = ASTEROID_BASE.RADIUS * size.radius;
  const separation = Math.min(radius * 2.25 + 10, Math.max(110, (bounds.width - 300) * .3));
  return [-1, 0, 1].map((index) => {
    let seed = index + 17;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    return ({
    id: `lab-${index}`, type: types[settings.material],
    pos: { x: origin.x + index * separation, y: Math.max(radius + 30, origin.y - 205 - (index === 0 ? 0 : 30)) },
    vel: { x: settings.moving ? .75 * (index === -1 ? -1 : 1) : 0, y: settings.moving ? .15 : 0 },
    radius, angle: 0, color: config.color, toBeRemoved: false,
    vertices: rockOutline(radius, ASTEROID_BASE.VERTICES + size.vertices, types[settings.material], random),
    hp: ASTEROID_BASE.HP * size.hp * config.hpMult, maxHp: ASTEROID_BASE.HP * size.hp * config.hpMult,
    sizeCategory: settings.size, hitFlash: 0, rotation: 0, rotationSpeed: settings.moving ? .003 : 0,
    pulsateOffset: index + 1, shardIds: [], shardSpawnTimer: 0, throwTimer: 0, burstCount: 0,
  }); });
}
