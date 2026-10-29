import { describe, expect, it, vi } from 'vitest';
import { EFFECT_LIMITS, FeelSystem } from './feel';
import { makeAsteroid, makeBullet, makeShip } from './testFixtures';
import { EntityType } from '../types';
import { breakupAsteroid } from './asteroids';
import { rockPolygon, seededRandom } from './geometry';
import { SimulationClock } from './engine';
import { DEFAULT_LAB, equipLabWeapon } from './lab';
import { drawAsteroid, drawFeelEffects, drawProjectile, drawShip } from './art';

const impact = { kind: 'impact' as const, pos: { x: 50, y: 50 }, direction: { x: 1, y: 0 },
  material: EntityType.Asteroid, power: 14, radius: 30, destroyed: false };

describe('event-driven presentation', () => {
  it('owns recoil/heat recovery and bounded event-time effects without touching the projectile', () => {
    const feel = new FeelSystem(), bullet = makeBullet(); bullet.mountId = 2;
    const snapshot = structuredClone(bullet);
    feel.emit({ kind: 'shot', bullet });
    feel.emit(impact);
    expect(feel.recoil[2]).toBe(1);
    expect(feel.muzzle[2]).toBe(1);
    for (let i = 0; i < 120; i++) feel.step();
    expect(feel.debris).toEqual([]); expect(feel.accents).toEqual([]);
    expect(feel.recoil[2]).toBeLessThan(0.001);
    expect(bullet).toEqual(snapshot);
  });

  it('caps sustained high-rate combat and uses smaller budgets in reduced mode', () => {
    const feel = new FeelSystem();
    for (let i = 0; i < 1000; i++) feel.emit(impact);
    expect(feel.debris.length).toBeLessThanOrEqual(EFFECT_LIMITS.debris);
    expect(feel.accents.length).toBeLessThanOrEqual(EFFECT_LIMITS.accents);
    feel.reduced = true; feel.step();
    expect(feel.debris.length).toBeLessThanOrEqual(EFFECT_LIMITS.reducedDebris);
    expect(feel.accents.length).toBeLessThanOrEqual(EFFECT_LIMITS.reducedAccents);
    feel.reset();
    expect(feel.heat.every(value => value === 0)).toBe(true);
    expect(feel.shake).toBe(0);
  });

  it('keeps full clipped chunks only when gameplay is not already carrying those pieces', () => {
    const a = makeAsteroid('a', 50, 50); a.vertices = rockPolygon(50, 12, seededRandom(2));
    const pieces = breakupAsteroid(a, 3), feel = new FeelSystem();
    feel.emit({ kind: 'fracture', asteroid: a, pieces, livePieces: false });
    expect(feel.debris.some(e => e.vertices === pieces[0].vertices)).toBe(true);
    feel.reset(); feel.emit({ kind: 'fracture', asteroid: a, pieces, livePieces: true });
    expect(feel.debris.some(e => e.vertices === pieces[0].vertices)).toBe(false);
    for (let i = 0; i < 100; i++) feel.step();
    expect(feel.debris).toEqual([]);
  });

  it('does not consume gameplay randomness and reproduces event variation after reset', () => {
    const feel = new FeelSystem();
    const spy = vi.spyOn(Math, 'random').mockImplementation(() => { throw Error('gameplay random consumed'); });
    try {
      feel.emit(impact); const first = structuredClone(feel.debris);
      feel.reset(); feel.emit(impact);
      expect(feel.debris).toEqual(first);
    } finally { spy.mockRestore(); }
  });

  it.each([30, 144, 240])('keeps recoil/effect timing identical at %i Hz including a pause', hz => {
    const run = (refresh: number) => {
      const feel = new FeelSystem(), clock = new SimulationClock();
      feel.emit(impact);
      for (let i = 0; i <= refresh; i++) clock.advance(i * 1000 / refresh, true, () => feel.step());
      const before = structuredClone(feel.accents);
      clock.advance(50_000, false, () => feel.step());
      expect(feel.accents).toEqual(before);
      return { debris: feel.debris, accents: feel.accents, shake: feel.shake };
    };
    expect(run(hz)).toEqual(run(60));
  });

  it('reports a close approach once and ignores distant passes', () => {
    const feel = new FeelSystem(), ship = makeShip(), a = makeAsteroid('a', 100, 18);
    ship.vel.x = 4;
    for (const [tick, x] of [-30, -12, 0, 12, 30].entries()) {
      ship.pos = { x: 100 + x, y: 145 };
      feel.trackNearMisses(ship, [a], tick);
    }
    expect(feel.accents.filter(e => e.kind === 'near')).toHaveLength(1);
    feel.reset(); ship.pos.y = 400; feel.trackNearMisses(ship, [a], 20);
    expect(feel.accents).toEqual([]);
  });

  it('applies absolute lab weapon tiers without compounding and restores baseline loadout', () => {
    const ship = makeShip(), settings = { ...DEFAULT_LAB, split: 5, rapid: 8, rails: 3, ricochet: 4 };
    equipLabWeapon(ship, settings); const stats = { ...ship.stats };
    equipLabWeapon(ship, settings); expect(ship.stats).toEqual(stats);
    equipLabWeapon(ship, DEFAULT_LAB);
    expect(ship.stats.multishotTier).toBe(0); expect(ship.stats.damageMult).toBe(1); expect(ship.stats.fireRateMult).toBe(1);
  });

  it('draws repeatable frames without random flicker or simulation mutation', () => {
    const feel = new FeelSystem(), ship = makeShip(), a = makeAsteroid('art', 50, 40), bullet = makeBullet();
    a.vertices = rockPolygon(40, 10, seededRandom(1));
    feel.emit(impact);
    const before = JSON.stringify({ ship, a, bullet, debris: feel.debris, accents: feel.accents });
    const record = () => {
      const ops: unknown[] = [];
      const ctx = new Proxy({}, { get: (_, key) => (...args: unknown[]) => ops.push([key, ...args]),
        set: (_, key, value) => { ops.push([key, value]); return true; } }) as CanvasRenderingContext2D;
      drawAsteroid(ctx, a, 100, false); drawShip(ctx, ship, feel, 100); drawProjectile(ctx, bullet);
      drawFeelEffects(ctx, feel.debris, false);
      return ops;
    };
    const spy = vi.spyOn(Math, 'random').mockImplementation(() => { throw Error('render randomness'); });
    try { expect(record()).toEqual(record()); } finally { spy.mockRestore(); }
    expect(JSON.stringify({ ship, a, bullet, debris: feel.debris, accents: feel.accents })).toBe(before);
  });

  it('rasterizes stable rock surfaces once while drawing later damage as an overlay', () => {
    let allocations = 0;
    const ops: unknown[] = [];
    const context = new Proxy({}, { get: (_, key) => (...args: unknown[]) => ops.push([key, ...args]),
      set: () => true }) as CanvasRenderingContext2D;
    vi.stubGlobal('OffscreenCanvas', class {
      constructor(_width: number, _height: number) { allocations++; }
      getContext() { return context; }
    });
    try {
      const a = makeAsteroid('cache', 100, 40); a.vertices = rockPolygon(40, 10, seededRandom(2));
      drawAsteroid(context, a, 0, false);
      const first = ops.length;
      a.scars = [{ pos: { x: -30, y: 0 }, angle: 0, strength: 1 }]; a.hp = 5;
      drawAsteroid(context, a, 1, false);
      expect(allocations).toBe(1);
      expect(ops.slice(first).some(op => Array.isArray(op) && op[0] === 'drawImage')).toBe(true);
      expect(ops.slice(first).some(op => Array.isArray(op) && op[0] === 'lineTo')).toBe(true);
    } finally { vi.unstubAllGlobals(); }
  });
});
