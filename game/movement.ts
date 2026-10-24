import { ASTEROID_TYPES, SHIP_FRICTION, SHIP_MAX_SPEED, SHIP_THRUST, SHIP_TURN_SPEED } from '../constants';
import type { Ship, Vector } from '../types';

export interface Bounds { width: number; height: number }
export interface PlayerInput { up: boolean; left: boolean; right: boolean }
export const HANDLING_PROFILES = {
  gunship: { acceleration: .007, braking: .013, damping: .72, thrust: 1, drag: SHIP_FRICTION },
  drifter: { acceleration: .005, braking: .011, damping: .84, thrust: 1.05, drag: .998 },
  precise: { acceleration: .011, braking: .02, damping: .55, thrust: 1.1, drag: .992 },
};
export type HandlingProfile = keyof typeof HANDLING_PROFILES;
export interface HandlingSettings { profile: HandlingProfile; thrust: number; steering: number }
export const DEFAULT_HANDLING: HandlingSettings = { profile: 'gunship', thrust: 1, steering: 1 };

/** Preserve the original edge teleport, including its loss of overshoot. */
export function wrapPosition(pos: Vector, bounds: Bounds): void {
  if (pos.x < 0) pos.x = bounds.width;
  if (pos.x > bounds.width) pos.x = 0;
  if (pos.y < 0) pos.y = bounds.height;
  if (pos.y > bounds.height) pos.y = 0;
}

/** Angular inertia with stronger counter-steering; turning never rotates linear momentum. */
export function stepShipMovement(ship: Ship, input: PlayerInput, bounds: Bounds, settings = DEFAULT_HANDLING): void {
  if (ship.toBeRemoved) return;
  const profile = HANDLING_PROFILES[settings.profile];
  const steering = Number(input.right) - Number(input.left);
  let angular = ship.angularVelocity ?? 0;
  const oldAngular = angular;
  if (steering) {
    angular += steering * (angular * steering < 0 ? profile.braking : profile.acceleration) * settings.steering;
    angular = Math.max(-SHIP_TURN_SPEED, Math.min(SHIP_TURN_SPEED, angular));
  } else angular *= profile.damping;
  if (Math.abs(angular) < .0001) angular = 0;
  ship.angularVelocity = angular;
  ship.steeringJet = Math.max(-1, Math.min(1, (angular - oldAngular) / profile.acceleration));
  ship.rotation += angular;
  const slow = ship.isFrozen ? (ASTEROID_TYPES.FROZEN.auraSlowFactor || 0.4) : 1;
  ship.thrusting = input.up;
  ship.throttle = (ship.throttle ?? 0) + (Number(input.up) - (ship.throttle ?? 0)) * .25;
  if (ship.thrusting) {
    const thrust = SHIP_THRUST * ship.stats.thrustMult * slow * profile.thrust * settings.thrust * (.65 + .35 * ship.throttle);
    ship.vel.x += Math.cos(ship.rotation) * thrust;
    ship.vel.y += Math.sin(ship.rotation) * thrust;
  }
  ship.vel.x *= profile.drag;
  ship.vel.y *= profile.drag;
  const speed = Math.hypot(ship.vel.x, ship.vel.y);
  const maxSpeed = SHIP_MAX_SPEED * ship.stats.speedMult * slow;
  if (speed > maxSpeed) {
    if (speed > maxSpeed + 0.5) {
      ship.vel.x *= 0.88;
      ship.vel.y *= 0.88;
    } else {
      ship.vel.x = (ship.vel.x / speed) * maxSpeed;
      ship.vel.y = (ship.vel.y / speed) * maxSpeed;
    }
  }
  ship.pos.x += ship.vel.x;
  ship.pos.y += ship.vel.y;
  wrapPosition(ship.pos, bounds);
}
