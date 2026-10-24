import { ASTEROID_TYPES, SHIP_FRICTION, SHIP_MAX_SPEED, SHIP_THRUST, SHIP_TURN_SPEED } from '../constants';
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

/** One 60 Hz step, retaining thrust upgrades, frozen slow and knockback decay. */
export function stepShipMovement(ship: Ship, input: PlayerInput, bounds: Bounds): void {
  if (ship.toBeRemoved) return;
  if (input.left) ship.rotation -= SHIP_TURN_SPEED;
  if (input.right) ship.rotation += SHIP_TURN_SPEED;
  const slow = ship.isFrozen ? (ASTEROID_TYPES.FROZEN.auraSlowFactor || 0.4) : 1;
  ship.thrusting = input.up;
  if (ship.thrusting) {
    const thrust = SHIP_THRUST * ship.stats.thrustMult * slow;
    ship.vel.x += Math.cos(ship.rotation) * thrust;
    ship.vel.y += Math.sin(ship.rotation) * thrust;
  }
  ship.vel.x *= SHIP_FRICTION;
  ship.vel.y *= SHIP_FRICTION;
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
