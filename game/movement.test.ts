import { describe, expect, it } from 'vitest';
import { ASTEROID_TYPES, SHIP_FRICTION, SHIP_MAX_SPEED, SHIP_THRUST, SHIP_TURN_SPEED } from '../constants';
import { stepShipMovement, wrapPosition } from './movement';
import { makeShip } from './testFixtures';

const bounds = { width: 800, height: 600 };
const idle = { up: false, left: false, right: false };

describe('ship movement', () => {
  it('retains 60 FPS acceleration, drag and turn order', () => {
    const ship = makeShip();
    stepShipMovement(ship, { ...idle, up: true, right: true }, bounds);
    expect(ship.rotation).toBe(SHIP_TURN_SPEED);
    expect(ship.vel.x).toBeCloseTo(Math.cos(SHIP_TURN_SPEED) * SHIP_THRUST * SHIP_FRICTION);
    expect(ship.pos.y).toBeCloseTo(100 + Math.sin(SHIP_TURN_SPEED) * SHIP_THRUST * SHIP_FRICTION);
    expect(ship.thrusting).toBe(true);
  });

  it('cancels simultaneous left/right input and coasts when thrust is released', () => {
    const ship = makeShip();
    ship.vel.x = 2;
    ship.thrusting = true;
    stepShipMovement(ship, { ...idle, left: true, right: true }, bounds);
    expect(ship.rotation).toBe(0);
    expect(ship.vel.x).toBe(2 * SHIP_FRICTION);
    expect(ship.thrusting).toBe(false);
  });

  it('applies engine upgrades and frozen thrust without changing steering', () => {
    const ship = makeShip();
    ship.stats.thrustMult = 2;
    ship.isFrozen = true;
    stepShipMovement(ship, { ...idle, up: true }, bounds);
    expect(ship.vel.x).toBeCloseTo(SHIP_THRUST * 2 * ASTEROID_TYPES.FROZEN.auraSlowFactor * SHIP_FRICTION);
  });

  it('retains soft knockback decay above the cap and clamps normal overspeed', () => {
    const ship = makeShip();
    ship.vel.x = 20;
    stepShipMovement(ship, idle, bounds);
    expect(ship.vel.x).toBeCloseTo(20 * SHIP_FRICTION * 0.88);
    ship.vel.x = (SHIP_MAX_SPEED + 0.1) / SHIP_FRICTION;
    stepShipMovement(ship, idle, bounds);
    expect(ship.vel.x).toBeCloseTo(SHIP_MAX_SPEED);
  });

  it.each([
    [{ x: -1, y: -1 }, { x: 800, y: 600 }],
    [{ x: 801, y: 601 }, { x: 0, y: 0 }],
    [{ x: 800, y: 600 }, { x: 800, y: 600 }],
  ])('preserves screen wrapping from %o to %o', (pos, expected) => {
    wrapPosition(pos, bounds);
    expect(pos).toEqual(expected);
  });

  it('does not move a removed ship', () => {
    const ship = makeShip();
    ship.toBeRemoved = true;
    stepShipMovement(ship, { ...idle, up: true }, bounds);
    expect(ship.pos).toEqual({ x: 100, y: 100 });
  });
});
