import { UPGRADE_DAMAGE_MULT_COMPOUND, UPGRADE_FIRE_RATE_SPEED_MULT } from '../constants';
import type { AsteroidTypeName } from '../constants';
import type { Ship } from '../types';
import type { HandlingPreset } from './movement';

export interface LabSettings {
  profile: HandlingPreset; thrust: number; impact: number; shake: number;
  split: number; rapid: number; rails: number; ricochet: number;
  material: AsteroidTypeName; size: 1 | 2 | 3 | 4; moving: boolean;
  immortal: boolean; repeat: boolean;
}
export const DEFAULT_LAB: LabSettings = {
  profile: 'gunship', thrust: 1, impact: 1, shake: 1,
  split: 0, rapid: 0, rails: 0, ricochet: 0,
  material: 'REGULAR', size: 3, moving: false, immortal: true, repeat: true,
};

/** Apply absolute tiers, so lab edits never compound old upgrades accidentally. */
export function equipLabWeapon(ship: Ship, settings: LabSettings): Record<string, number> {
  ship.stats.multishotTier = settings.split;
  ship.stats.fireRateMult = 1 / (1 + settings.rapid * UPGRADE_FIRE_RATE_SPEED_MULT);
  ship.stats.rangeTier = settings.rails;
  ship.stats.damageMult = UPGRADE_DAMAGE_MULT_COMPOUND ** settings.rails;
  ship.stats.ricochetTier = settings.ricochet;
  return { multishot: settings.split, rapidfire: settings.rapid, range: settings.rails, ricochet: settings.ricochet };
}
