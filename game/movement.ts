import { ASTEROID_TYPES } from '../constants';
import type { Ship, Vector } from '../types';

export interface Bounds { width: number; height: number }
export interface PlayerInput { up: boolean; left: boolean; right: boolean }
export interface HandlingProfile {
  label: string; thrust: number; drag: number; maxSpeed: number;
  angularAcceleration: number; turnSpeed: number; counterSteer: number; releaseDamping: number;
}
export const HANDLING_PROFILES = {
  gunship: { label: 'Gunship · balanced', thrust: 0.105, drag: 0.995, maxSpeed: 7.5,
    angularAcceleration: 0.0065, turnSpeed: 0.06, counterSteer: 1.85, releaseDamping: 0.66 },
  interceptor: { label: 'Interceptor · precise', thrust: 0.13, drag: 0.989, maxSpeed: 8,
    angularAcceleration: 0.011, turnSpeed: 0.073, counterSteer: 2.1, releaseDamping: 0.53 },
  freighter: { label: 'Freighter · long drift', thrust: 0.085, drag: 0.998, maxSpeed: 7,
    angularAcceleration: 0.004, turnSpeed: 0.051, counterSteer: 2.2, releaseDamping: 0.75 },
} satisfies Record<string, HandlingProfile>;
export type HandlingPreset = keyof typeof HANDLING_PROFILES;

/** Preserve the original edge teleport, including its loss of overshoot. */
export function wrapPosition(pos: Vector, bounds: Bounds): void {
  if (pos.x < 0) pos.x = bounds.width;
  if (pos.x > bounds.width) pos.x = 0;
  if (pos.y < 0) pos.y = bounds.height;
  if (pos.y > bounds.height) pos.y = 0;
}

/** Deliberate rotation with fast arrest/counter-steer and momentum-preserving turns. */
export function stepShipMovement(ship: Ship, input: PlayerInput, bounds: Bounds,
  profile: HandlingProfile = HANDLING_PROFILES.gunship, thrustScale = 1): void {
  if (ship.toBeRemoved) return;
  ship.steering = Number(input.right) - Number(input.left);
  if (ship.steering) {
    const counter = ship.angularVelocity * ship.steering < 0 ? profile.counterSteer : 1;
    ship.angularVelocity += ship.steering * profile.angularAcceleration * counter;
    ship.angularVelocity = Math.max(-profile.turnSpeed, Math.min(profile.turnSpeed, ship.angularVelocity));
  } else {
    // Automatic attitude jets arrest rotation; expose the actual corrective command.
    ship.steering = Math.abs(ship.angularVelocity) > 0.003 ? -Math.sign(ship.angularVelocity) : 0;
    ship.angularVelocity *= profile.releaseDamping;
    if (Math.abs(ship.angularVelocity) < 0.0001) ship.angularVelocity = 0;
  }
  ship.rotation += ship.angularVelocity;
  // Keep angles numerically stable through long survival runs.
  ship.rotation = Math.atan2(Math.sin(ship.rotation), Math.cos(ship.rotation));
  const slow = ship.isFrozen ? (ASTEROID_TYPES.FROZEN.auraSlowFactor || 0.4) : 1;
  ship.thrusting = input.up;
  ship.throttle += ((input.up ? 1 : 0) - ship.throttle) * (input.up ? 0.28 : 0.35);
  if (ship.thrusting) {
    const thrust = profile.thrust * thrustScale * ship.stats.thrustMult * slow * (0.45 + 0.55 * ship.throttle);
    ship.vel.x += Math.cos(ship.rotation) * thrust;
    ship.vel.y += Math.sin(ship.rotation) * thrust;
  }
  ship.vel.x *= profile.drag;
  ship.vel.y *= profile.drag;
  const speed = Math.hypot(ship.vel.x, ship.vel.y);
  const maxSpeed = profile.maxSpeed * ship.stats.speedMult * slow;
  if (speed > maxSpeed) {
    // Smooth overspeed recovery preserves external impacts instead of erasing them.
    const retained = maxSpeed + (speed - maxSpeed) * 0.96;
    ship.vel.x *= retained / speed;
    ship.vel.y *= retained / speed;
  }
  ship.pos.x += ship.vel.x;
  ship.pos.y += ship.vel.y;
  wrapPosition(ship.pos, bounds);
}
