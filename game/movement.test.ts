import { describe, expect, it } from 'vitest';
import { ASTEROID_TYPES } from '../constants';
import { HANDLING_PROFILES, stepShipMovement, wrapPosition } from './movement';
import { makeShip } from './testFixtures';

const bounds = { width: 800, height: 600 };
const idle = { up: false, left: false, right: false };

describe('ship movement', () => {
  it('preserves travel direction while turning, then counter-steers within six ticks', () => {
    const ship = makeShip(); ship.vel.x = 5;
    for (let i = 0; i < 20; i++) stepShipMovement(ship, { ...idle, right: true }, bounds);
    expect(ship.vel.y).toBe(0);
    expect(ship.vel.x).toBeCloseTo(5 * HANDLING_PROFILES.gunship.drag ** 20);
    expect(ship.angularVelocity).toBe(HANDLING_PROFILES.gunship.turnSpeed);
    for (let i = 0; i < 6; i++) stepShipMovement(ship, { ...idle, left: true }, bounds);
    expect(ship.angularVelocity).toBeLessThan(0);
  });

  it('arrests released rotation quickly without killing linear momentum', () => {
    const ship = makeShip(); ship.angularVelocity = 0.06; ship.vel.x = 4;
    for (let i = 0; i < 8; i++) stepShipMovement(ship, idle, bounds);
    expect(ship.angularVelocity).toBeLessThan(0.003);
    expect(ship.vel.x).toBeGreaterThan(3.8);
  });

  it('allows deliberate retrograde braking and bounded long-running rotation', () => {
    const ship = makeShip(); ship.rotation = Math.PI; ship.vel.x = 4;
    for (let i = 0; i < 30; i++) stepShipMovement(ship, { ...idle, up: true }, bounds);
    expect(ship.vel.x).toBeLessThan(1.5);
    for (let i = 0; i < 3000; i++) stepShipMovement(ship, { ...idle, right: true }, bounds);
    expect(Math.abs(ship.rotation)).toBeLessThanOrEqual(Math.PI);
    expect(Number.isFinite(ship.pos.x)).toBe(true);
  });

  it.each(Object.keys(HANDLING_PROFILES) as (keyof typeof HANDLING_PROFILES)[])('keeps the %s preset controllable at sustained thrust', preset => {
    const ship = makeShip(), profile = HANDLING_PROFILES[preset];
    for (let i = 0; i < 900; i++) stepShipMovement(ship, { ...idle, up: true }, bounds, profile);
    expect(Math.hypot(ship.vel.x, ship.vel.y)).toBeLessThan(profile.maxSpeed + 3.5);
    expect(ship.throttle).toBeCloseTo(1);
    expect(ship.pos.x).toBeGreaterThanOrEqual(0);
    expect(ship.pos.x).toBeLessThanOrEqual(bounds.width);
  });
  it('responds immediately while spooling thrust and angular momentum', () => {
    const ship = makeShip();
    stepShipMovement(ship, { ...idle, up: true, right: true }, bounds);
    expect(ship.rotation).toBeGreaterThan(0);
    expect(ship.angularVelocity).toBeGreaterThan(0);
    expect(ship.throttle).toBeGreaterThan(0);
    expect(ship.vel.x).toBeGreaterThan(0.05);
    expect(ship.vel.x).toBeLessThan(HANDLING_PROFILES.gunship.thrust);
    expect(ship.pos.y).toBeGreaterThan(100);
    expect(ship.thrusting).toBe(true);
  });

  it('cancels simultaneous left/right input and coasts when thrust is released', () => {
    const ship = makeShip();
    ship.vel.x = 2;
    ship.thrusting = true;
    stepShipMovement(ship, { ...idle, left: true, right: true }, bounds);
    expect(ship.rotation).toBe(0);
    expect(ship.vel.x).toBe(2 * HANDLING_PROFILES.gunship.drag);
    expect(ship.thrusting).toBe(false);
  });

  it('applies engine upgrades and frozen thrust without changing steering', () => {
    const ship = makeShip();
    ship.stats.thrustMult = 2;
    const normal = makeShip();
    stepShipMovement(normal, { ...idle, up: true }, bounds);
    ship.isFrozen = true;
    stepShipMovement(ship, { ...idle, up: true }, bounds);
    expect(ship.vel.x).toBeCloseTo(normal.vel.x * 2 * ASTEROID_TYPES.FROZEN.auraSlowFactor);
  });

  it('retains external impulse above cruising speed and bleeds it off smoothly', () => {
    const ship = makeShip();
    ship.vel.x = 20;
    stepShipMovement(ship, idle, bounds);
    expect(ship.vel.x).toBeLessThan(20);
    expect(ship.vel.x).toBeGreaterThan(HANDLING_PROFILES.gunship.maxSpeed);
    for (let i = 0; i < 120; i++) stepShipMovement(ship, idle, bounds);
    expect(ship.vel.x).toBeLessThan(8);

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
