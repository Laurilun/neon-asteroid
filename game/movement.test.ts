import { describe, expect, it } from 'vitest';
import { ASTEROID_TYPES,  } from '../constants';
import { stepShipMovement, wrapPosition } from './movement';
import { makeShip } from './testFixtures';

const bounds = { width: 800, height: 600 };
const idle = { up: false, left: false, right: false };

describe('ship movement', () => {
  it('starts turning and accelerating immediately, then builds angular speed', () => {
    const ship = makeShip();
    stepShipMovement(ship, { ...idle, up: true, right: true }, bounds);
    expect(ship.rotation).toBeGreaterThan(0);
    expect(ship.vel.x).toBeGreaterThan(.08);
    expect(ship.vel.x).toBeLessThan(.12);
    const firstTurn = ship.spin!;
    for (let i = 0; i < 20; i++) stepShipMovement(ship, { ...idle, right: true }, bounds);
    expect(ship.spin).toBeGreaterThan(firstTurn);
    expect(ship.spin).toBeLessThan(.08);
  });

  it('arrests rotation promptly and preserves linear drift on release', () => {
    const ship = makeShip(); ship.vel.x = 4;
    for (let i = 0; i < 15; i++) stepShipMovement(ship, { ...idle, left: true }, bounds);
    for (let i = 0; i < 10; i++) stepShipMovement(ship, idle, bounds);
    expect(Math.abs(ship.spin!)).toBeLessThan(.002);
    expect(ship.vel.x).toBeGreaterThan(3);
    expect(ship.vel.y).toBe(0);
  });

  it('reverses a full turn within four ticks without resetting linear momentum', () => {
    const ship = makeShip(); ship.vel.y = 3;
    for (let i = 0; i < 20; i++) stepShipMovement(ship, { ...idle, left: true }, bounds);
    for (let i = 0; i < 4; i++) stepShipMovement(ship, { ...idle, right: true }, bounds);
    expect(ship.spin).toBeGreaterThan(0);
    expect(ship.vel.y).toBeGreaterThan(2);
    expect(ship.vel.x).toBe(0);
  });

  it('cancels simultaneous steering and applies frozen slow and engine upgrades', () => {
    const normal = makeShip(), upgraded = makeShip(), frozen = makeShip();
    upgraded.stats.thrustMult = 2; frozen.isFrozen = true;
    for (const ship of [normal, upgraded, frozen]) stepShipMovement(ship, { up: true, left: true, right: true }, bounds);
    expect(normal.rotation).toBe(0);
    expect(upgraded.vel.x).toBeCloseTo(normal.vel.x * 2);
    expect(frozen.vel.x).toBeCloseTo(normal.vel.x * ASTEROID_TYPES.FROZEN.auraSlowFactor!);
  });

  it('recovers from external overspeed gradually, with bounded sustained thrust', () => {
    const ship = makeShip(); ship.vel.x = 20;
    stepShipMovement(ship, idle, bounds);
    expect(ship.vel.x).toBeGreaterThan(15); expect(ship.vel.x).toBeLessThan(20);
    for (let i = 0; i < 1000; i++) stepShipMovement(ship, { ...idle, up: true }, bounds);
    expect(ship.vel.x).toBeGreaterThan(7); expect(ship.vel.x).toBeLessThan(8.2);
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
