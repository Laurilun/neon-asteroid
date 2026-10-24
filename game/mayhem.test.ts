import { describe, expect, it } from 'vitest';
import { BULLET_DAMAGE, BULLET_RATE } from '../constants';
import { EntityType } from '../types';
import type { Bullet } from '../types';
import { makeAsteroid, makeBullet, makeShip } from './testFixtures';
import { cannons, worldPoint } from './gunship';
import { checkShipCollision, collideShip, sweepOutline } from './collision';
import { cleaveRock, rockOutline, strikeRock } from './rockwork';
import { PlayerWeapon } from './projectiles';
import { CombatResponses, RESPONSE_CAP } from './responses';
import { equipTrial, INITIAL_TRIAL } from './trials';
import { SimulationClock } from './engine';

const area = (outline: readonly { x: number; y: number }[]) => Math.abs(outline.reduce((sum, p, i) => {
  const q = outline[(i + 1) % outline.length]; return sum + p.x * q.y - q.x * p.y;
}, 0)) / 2;

describe('physical cannon bank', () => {
  it.each([0, 1, 2, 3, 4, 5, 9, 30])('fires from every visible muzzle at tier %i, after rotation', tier => {
    const ship = makeShip(); ship.rotation = Math.PI / 2; ship.radius = 19; ship.stats.multishotTier = tier;
    const bullets: Bullet[] = [], weapon = new PlayerWeapon(), fired: number[] = [];
    for (let i = 0; i < BULLET_RATE; i++) weapon.step(ship, bullets, () => .5, b => fired.push(b.mount!));
    expect(bullets.length).toBe(Math.min(6, tier + 1));
    for (let i = 0; i < bullets.length; i++) {
      const mount = cannons(tier)[i], b = bullets[i];
      expect(b.pos.x).toBeCloseTo(100 - mount.y * 19);
      expect(b.pos.y).toBeCloseTo(100 + (mount.x + .065) * 19);
      expect(b.damage).toBeGreaterThanOrEqual(BULLET_DAMAGE);
      expect(b.vel.y).toBeGreaterThan(12);
    }
    expect(new Set(bullets.map(b => b.pos.x)).size).toBe(bullets.length);
    expect(fired).toEqual(bullets.map((_, i) => i));
  });

  it('updates trial weapons absolutely, including downgrades', () => {
    const ship = makeShip(); equipTrial(ship, { ...INITIAL_TRIAL, rails: 6, split: 4, cooling: 8 });
    equipTrial(ship, INITIAL_TRIAL);
    expect(ship.stats.damageMult).toBe(1); expect(ship.stats.fireRateMult).toBe(1); expect(ship.stats.multishotTier).toBe(0);
  });
});

describe('contact and mass', () => {
  const square = [{ x: -10, y: -10 }, { x: 10, y: -10 }, { x: 10, y: 10 }, { x: -10, y: 10 }];
  it('sweeps against real faces and misses empty portions of the bounding circle', () => {
    expect(sweepOutline({ x: -20, y: 0 }, { x: 20, y: 0 }, square, 2)).toBeCloseTo(.2);
    expect(sweepOutline({ x: -20, y: 14 }, { x: 20, y: 14 }, square, 2)).toBeNull();
    expect(sweepOutline({ x: 0, y: 0 }, { x: 0, y: 0 }, square, 0)).toBe(0);
    expect(sweepOutline({ x: -12, y: 0 }, { x: -12, y: 0 }, square, 2)).toBe(0);
  });
  it('uses visible armor and cannon geometry for hull contacts', () => {
    const ship = makeShip(), rock = makeAsteroid('tiny', 100 + 14 * 1.145, .5);
    expect(checkShipCollision(ship, rock)).toBe(true);
    rock.pos.y += 9;
    expect(checkShipCollision(ship, rock)).toBe(false);
  });
  it('head-on contact is stronger than a glance, preserving tangent velocity', () => {
    const head = makeShip(), glance = makeShip(), rock = makeAsteroid('rock', 130, 30);
    head.vel = { x: 7, y: 0 }; glance.vel = { x: 0, y: 7 };
    const a = collideShip(head, rock); rock.vel = { x: 0, y: 0 };
    const b = collideShip(glance, rock);
    expect(a.damageFactor).toBeGreaterThan(b.damageFactor * 2);
    expect(glance.vel.y).toBe(7); expect(head.vel.x).toBeLessThan(7);
  });
  it('small rocks react more than large dense ones; scars remain bounded', () => {
    const small = makeAsteroid('small', 100, 18), large = makeAsteroid('metal', 100, 90), bullet = makeBullet();
    large.type = EntityType.TungstenAsteroid;
    strikeRock(small, bullet); strikeRock(large, bullet);
    expect(small.vel.x).toBeGreaterThan(large.vel.x * 20);
    for (let i = 0; i < 50; i++) strikeRock(small, bullet);
    expect(small.wounds).toHaveLength(6);
  });
});

describe('fracture geometry and presentation lifecycle', () => {
  it.each([EntityType.Asteroid, EntityType.FrozenAsteroid, EntityType.MoltenAsteroid, EntityType.IronAsteroid, EntityType.TungstenAsteroid])('partitions %s without creating or losing material', type => {
    const rock = makeAsteroid('parent', 200, 70); rock.type = type;
    rock.vertices = rockOutline(70, 14, type, () => .5); rock.rotation = .8; rock.vel = { x: 2, y: -1 };
    const pieces = cleaveRock(rock, 3);
    expect(pieces).toHaveLength(3);
    expect(pieces.reduce((sum, p) => sum + area(p.vertices), 0)).toBeCloseTo(area(rock.vertices), 5);
    for (const p of pieces) {
      expect(Number.isFinite(p.vel.x + p.vel.y + p.radius)).toBe(true);
      expect(p.rotation).toBe(rock.rotation);
      expect(p.vel.x).toBeGreaterThan(0);
      const next = cleaveRock({ ...rock, vertices: p.vertices, radius: p.radius, pos: p.pos }, 2);
      expect(next.reduce((sum, p) => sum + area(p.vertices), 0)).toBeCloseTo(area(p.vertices), 4);
      // Every noncentral boundary vertex is literally inherited from the parent.
      for (const v of p.vertices.slice(1)) {
        const actual = worldPoint(v, p.pos, p.rotation);
        expect(rock.vertices.some(original => {
          const expected = worldPoint(original, rock.pos, rock.rotation);
          return Math.hypot(actual.x - expected.x, actual.y - expected.y) < 1e-6;
        })).toBe(true);
      }
    }
  });
  it('keeps effect counts bounded under extreme fire and clears every lifetime', () => {
    const response = new CombatResponses();
    for (let i = 0; i < 1000; i++) response.emit({ type: 'strike', point: { x: 0, y: 0 }, velocity: { x: 1, y: 0 }, damage: 200, material: EntityType.Asteroid });
    expect(response.flecks.length).toBe(RESPONSE_CAP);
    const rock = makeAsteroid('large', 100, 90); rock.vertices = rockOutline(90, 14, rock.type, () => .5);
    response.emit({ type: 'break', rock, fragments: cleaveRock(rock, 3), solid: false });
    expect(response.flecks.filter(f => f.source)).toHaveLength(3);
    expect(response.flecks.length).toBe(RESPONSE_CAP);
    response.reduced = true; response.tick(); expect(response.flecks.length).toBeLessThanOrEqual(60);
    for (let i = 0; i < 100; i++) response.tick(); expect(response.flecks).toHaveLength(0);
  });
  it('does not duplicate live fracture slabs with decorative ones', () => {
    const rock = makeAsteroid('rock', 50, 30); rock.vertices = rockOutline(30, 12, rock.type, () => .5);
    const response = new CombatResponses(), fragments = cleaveRock(rock, 3);
    response.emit({ type: 'break', rock, fragments, solid: true }); expect(response.flecks).toHaveLength(0);
    response.emit({ type: 'break', rock, fragments, solid: false }); expect(response.flecks).toHaveLength(3);
    response.clear(); expect(response.flecks).toHaveLength(0); expect(response.shake).toEqual({ x: 0, y: 0 });
  });
  it('keeps recoil and debris identical at 30, 60 and 144 Hz, frozen while paused', () => {
    const run = (hz: number) => {
      const clock = new SimulationClock(), response = new CombatResponses(); let tick = 0;
      const step = () => { response.tick(); if (++tick % 7 === 0) response.emit({ type: 'discharge', mount: 0 }); };
      for (let i = 0; i <= hz; i++) clock.advance(i * 1000 / hz, true, step);
      const value = response.barrelKick[0]; clock.advance(10000, false, step); expect(response.barrelKick[0]).toBe(value);
      return response.barrelKick;
    };
    expect(run(30)).toEqual(run(60)); expect(run(144)).toEqual(run(60));
  });
});
