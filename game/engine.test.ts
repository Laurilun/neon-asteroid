import { BULLET_RATE } from '../constants';
import { describe, expect, it } from 'vitest';
import { advancePeriodicTimer, compactEntities, MAX_CATCH_UP_STEPS, SimulationClock, TARGET_FRAME_MS } from './engine';
import { stepShipMovement } from './movement';
import { advanceProjectiles, PlayerWeapon, retireProjectiles } from './projectiles';
import { makeShip } from './testFixtures';
import type { Bullet } from '../types';

describe('SimulationClock', () => {
  it('waits for elapsed time and retains sub-tick remainders', () => {
    const clock = new SimulationClock();
    let ticks = 0;
    const step = () => { ticks++; };
    expect(clock.advance(0, true, step)).toBe(0);
    expect(clock.advance(10, true, step)).toBe(0);
    expect(clock.advance(20, true, step)).toBe(1);
    expect(clock.advance(34, true, step)).toBe(1);
    expect(ticks).toBe(2);
  });

  it.each([30, 60, 120, 144, 240])('runs exactly 60 ticks per second at %i Hz', hz => {
    const clock = new SimulationClock();
    let ticks = 0;
    for (let i = 0; i <= hz; i++) clock.advance(i * 1000 / hz, true, () => { ticks++; });
    expect(ticks).toBe(60);
    expect(clock.timeMs).toBeCloseTo(1000);
  });

  it('bounds spikes and discards excess time without future catch-up', () => {
    const clock = new SimulationClock();
    clock.advance(0, true, () => {});
    expect(clock.advance(10_000, true, () => {})).toBe(MAX_CATCH_UP_STEPS);
    expect(clock.advance(10_000 + TARGET_FRAME_MS, true, () => {})).toBe(1);
    expect(clock.timeMs).toBeCloseTo(6 * TARGET_FRAME_MS);
  });

  it('suspends time and discards the wall-clock gap on resume', () => {
    const clock = new SimulationClock();
    clock.advance(0, true, () => {});
    clock.advance(20, true, () => {});
    const paused = clock.timeMs;
    expect(clock.advance(30, false, () => { throw Error('paused step'); })).toBe(0);
    expect(clock.advance(100_000, true, () => {})).toBe(0);
    expect(clock.timeMs).toBe(paused);
    expect(clock.advance(100_020, true, () => {})).toBe(1);
  });

  it('stops a catch-up batch immediately when a step opens an upgrade screen', () => {
    const clock = new SimulationClock();
    clock.advance(0, true, () => {});
    expect(clock.advance(80, true, () => false)).toBe(1);
    expect(clock.advance(5000, true, () => {})).toBe(0);
    expect(clock.timeMs).toBeCloseTo(TARGET_FRAME_MS);
  });

  it('handles clock reversal and invalid timestamps without poisoning later frames', () => {
    const clock = new SimulationClock();
    for (const time of [100, 90, NaN, Infinity, 200]) expect(clock.advance(time, true, () => {})).toBe(0);
    expect(clock.advance(220, true, () => {})).toBe(1);
  });

  it('can discard a focus gap without resetting gameplay time, and reset a run completely', () => {
    const clock = new SimulationClock();
    clock.advance(0, true, () => {});
    clock.advance(20, true, () => {});
    clock.resetFrame();
    expect(clock.advance(9000, true, () => {})).toBe(0);
    expect(clock.timeMs).toBeCloseTo(TARGET_FRAME_MS);
    clock.reset();
    expect(clock.timeMs).toBe(0);
    expect(clock.advance(9500, true, () => {})).toBe(0);
  });
});

describe('compactEntities', () => {
  it('removes dead entries, retains newest live entries, and preserves identity/order', () => {
    const entities = [false, true, false, false, true].map((toBeRemoved, id) => ({ id, toBeRemoved }));
    const reference = entities;
    compactEntities(entities, 2);
    expect(entities).toBe(reference);
    expect(entities.map(e => e.id)).toEqual([2, 3]);
    compactEntities(entities, 0);
    expect(entities).toEqual([]);
  });

  it('handles empty and entirely removed collections', () => {
    const entities = [{ toBeRemoved: true }];
    compactEntities(entities, 20);
    compactEntities(entities, 20);
    expect(entities).toEqual([]);
  });
});

describe('advancePeriodicTimer', () => {
  it('fires after a fractional frame step crosses its interval', () => {
    expect(advancePeriodicTimer(3.75, 0.5, 4)).toEqual({ elapsed: true, timer: 0.25 });
  });
});

describe('simulation integration', () => {
  function run(hz: number) {
    const clock = new SimulationClock();
    const ship = makeShip();
    const weapon = new PlayerWeapon();
    const bullets: Bullet[] = [];
    let shots = 0;
    const step = () => {
      stepShipMovement(ship, { up: true, left: false, right: true }, { width: 1000, height: 1000 });
      if (weapon.step(ship, bullets, () => 0.5)) shots++;
      advanceProjectiles(bullets, { width: 1000, height: 1000 });
      retireProjectiles(bullets);
      compactEntities(bullets, 100);
    };
    for (let i = 0; i <= hz * 3; i++) clock.advance(i * 1000 / hz, true, step);
    return { ship, bullets, shots, time: clock.timeMs };
  }

  it.each([30, 120, 144, 240])('preserves movement, fire cadence and projectile lifetime at %i Hz', hz => {
    expect(run(hz)).toEqual(run(60));
    expect(run(hz).shots).toBe(Math.floor(180 / BULLET_RATE));
  });

  it('keeps cooldown, shield timer and invulnerability frozen across an upgrade pause', () => {
    const clock = new SimulationClock(), weapon = new PlayerWeapon(), ship = makeShip();
    const bullets: Bullet[] = [];
    const step = () => {
      weapon.step(ship, bullets, () => 0.5);
      ship.stats.shieldRechargeTimer += TARGET_FRAME_MS;
    };
    clock.advance(0, true, step);
    clock.advance(50, true, step);
    const timer = ship.stats.shieldRechargeTimer;
    clock.advance(60, false, step);
    clock.advance(60_000, false, step);
    clock.advance(60_010, true, step);
    expect(ship.stats.shieldRechargeTimer).toBe(timer);
    expect(clock.timeMs).toBeLessThan(ship.invulnerableUntil);
    expect(bullets).toEqual([]);
    // Only the remaining simulation ticks complete the weapon cooldown.
    for (let i = 1; i <= BULLET_RATE - 3; i++) clock.advance(60_010 + i * TARGET_FRAME_MS, true, step);
    expect(bullets).toHaveLength(1);
    expect(ship.stats.shieldRechargeTimer).toBeCloseTo(BULLET_RATE * TARGET_FRAME_MS);
  });
});
