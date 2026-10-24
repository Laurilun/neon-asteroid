import { ASTEROID_TYPES } from '../constants';
import type { Ship, Vector } from '../types';

export interface Bounds { width: number; height: number }
export interface PlayerInput { up: boolean; left: boolean; right: boolean }

/** Preserve the original edge teleport, including its loss of overshoot. */
export function wrapPosition(pos: Vector, bounds: Bounds): void {
  if (pos.x < 0) pos.x = bounds.width;
  if (pos.x > bounds.width) pos.x = 0;
  if (pos.y < 0) pos.y = bounds.height;
  if (pos.y > bounds.height) pos.y = 0;
}

export const FLIGHT_MODES = {
  standard: { name: 'Heavy escort', acceleration: .115, retention: .994, torque: .009, turnLimit: .065, brake: .68 },
  agile: { name: 'Patrol craft', acceleration: .14, retention: .987, torque: .016, turnLimit: .075, brake: .48 },
  drift: { name: 'Deep-space tug', acceleration: .09, retention: .998, torque: .006, turnLimit: .055, brake: .8 },
};
export type FlightMode = keyof typeof FLIGHT_MODES;

/** Torque is immediate; facing ramps over a few ticks. Reversal uses doubled
 * attitude thrust. Releasing steering arrests spin without cancelling drift. */
export function stepShipMovement(ship: Ship, input: PlayerInput, bounds: Bounds,
  mode: FlightMode = 'standard', enginePower = 1): void {
  if (ship.toBeRemoved) return;
  const tuning = FLIGHT_MODES[mode];
  const command = Number(input.right) - Number(input.left);
  let spin = ship.spin ?? 0;
  const before = spin;
  if (command) spin += command * tuning.torque * (spin * command < 0 ? 2.4 : 1);
  else spin *= tuning.brake;
  spin = Math.max(-tuning.turnLimit, Math.min(tuning.turnLimit, spin));
  ship.spin = Math.abs(spin) < .0002 ? 0 : spin;
  ship.turnJet = (spin - before) / tuning.torque;
  ship.rotation = Math.atan2(Math.sin(ship.rotation + spin), Math.cos(ship.rotation + spin));
  const slow = ship.isFrozen ? (ASTEROID_TYPES.FROZEN.auraSlowFactor || .4) : 1;
  ship.thrusting = input.up;
  ship.drive = (ship.drive ?? 0) + ((input.up ? 1 : 0) - (ship.drive ?? 0)) * .3;
  if (input.up) {
    const thrust = tuning.acceleration * enginePower * ship.stats.thrustMult * slow * (.7 + .3 * ship.drive);
    ship.vel.x += Math.cos(ship.rotation) * thrust;
    ship.vel.y += Math.sin(ship.rotation) * thrust;
  }
  ship.vel.x *= tuning.retention;
  ship.vel.y *= tuning.retention;
  const speed = Math.hypot(ship.vel.x, ship.vel.y), limit = 7.5 * ship.stats.speedMult * slow;
  if (speed > limit) {
    const next = limit + (speed - limit) * .9;
    ship.vel.x *= next / speed; ship.vel.y *= next / speed;
  }
  ship.pos.x += ship.vel.x; ship.pos.y += ship.vel.y;
  wrapPosition(ship.pos, bounds);
}
