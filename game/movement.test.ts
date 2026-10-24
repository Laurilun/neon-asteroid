import { describe, expect, it } from 'vitest';
import { ASTEROID_TYPES, SHIP_FRICTION, SHIP_MAX_SPEED, SHIP_THRUST, SHIP_TURN_SPEED } from '../constants';
import { stepShipMovement, wrapPosition } from './movement';
import { makeShip } from './testFixtures';

const bounds = { width: 800, height: 600 };
const idle = { up: false, left: false, right: false };

describe('ship movement', () => {
  it('responds on the first tick while building angular momentum and thrust', () => {
    const ship = makeShip();
    stepShipMovement(ship, { ...idle, up: true, right: true }, bounds);
    expect(ship.rotation).toBeGreaterThan(0);
    expect(ship.rotation).toBeLessThan(SHIP_TURN_SPEED);
    expect(ship.vel.x).toBeGreaterThan(SHIP_THRUST * .65);
    expect(ship.vel.x).toBeLessThan(SHIP_THRUST);
    expect(ship.pos.y).toBeGreaterThan(100);
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
    const normal = makeShip();
    stepShipMovement(normal, { ...idle, up: true }, bounds);
    expect(ship.vel.x / normal.vel.x).toBeCloseTo(2 * ASTEROID_TYPES.FROZEN.auraSlowFactor);
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

  it('preserves travel direction through a turn and arrests rotation promptly on release', () => {
    const ship = makeShip(); ship.vel.x = 3;
    for (let i = 0; i < 40; i++) stepShipMovement(ship, { ...idle, right: true }, bounds);
    expect(ship.rotation).toBeGreaterThan(1.7);
    expect(ship.vel.y).toBe(0);
    expect(ship.vel.x).toBeGreaterThan(2.5);
    for (let i = 0; i < 10; i++) stepShipMovement(ship, idle, bounds);
    expect(Math.abs(ship.angularVelocity!)).toBeLessThan(.003);
  });

  it('counter-steering reverses full rotation within five ticks', () => {
    const ship = makeShip();
    for (let i = 0; i < 20; i++) stepShipMovement(ship, { ...idle, right: true }, bounds);
    for (let i = 0; i < 5; i++) stepShipMovement(ship, { ...idle, left: true }, bounds);
    expect(ship.angularVelocity).toBeLessThan(0);
    expect(ship.steeringJet).toBeLessThan(0);
  });

  it('builds to capped speed without erasing the distinction between profiles', () => {
    const drift = makeShip(), precise = makeShip();
    for (const ship of [drift, precise]) ship.vel.x = 4;
    for (let i = 0; i < 60; i++) {
      stepShipMovement(drift, idle, bounds, { profile: 'drifter', thrust: 1, steering: 1 });
      stepShipMovement(precise, idle, bounds, { profile: 'precise', thrust: 1, steering: 1 });
    }
    expect(drift.vel.x).toBeGreaterThan(precise.vel.x + .8);
    for (let i = 0; i < 600; i++) stepShipMovement(drift, { ...idle, up: true }, bounds);
    expect(Math.hypot(drift.vel.x, drift.vel.y)).toBeLessThanOrEqual(SHIP_MAX_SPEED);
  });
});
