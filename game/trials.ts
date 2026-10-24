import type { AsteroidTypeName } from '../constants';
import { UPGRADE_DAMAGE_MULT_COMPOUND, UPGRADE_FIRE_RATE_SPEED_MULT } from '../constants';
import type { Ship } from '../types';
import type { FlightMode } from './movement';

export interface Trial {
  flight: FlightMode; power: number; split: number; cooling: number; rails: number; bounce: number;
  material: AsteroidTypeName; size: 1 | 2 | 3 | 4; moving: boolean;
  targets: boolean; fire: boolean; repeat: boolean; safe: boolean;
}
export const INITIAL_TRIAL: Trial = { flight: 'standard', power: 1, split: 0, cooling: 0, rails: 0, bounce: 0,
  material: 'REGULAR', size: 3, moving: false, targets: true, fire: true, repeat: true, safe: true };
export function equipTrial(ship: Ship, trial: Trial): void {
  ship.stats.multishotTier = trial.split;
  ship.stats.fireRateMult = 1 / (1 + trial.cooling * UPGRADE_FIRE_RATE_SPEED_MULT);
  ship.stats.rangeTier = trial.rails;
  ship.stats.damageMult = UPGRADE_DAMAGE_MULT_COMPOUND ** trial.rails;
  ship.stats.ricochetTier = trial.bounce;
}
